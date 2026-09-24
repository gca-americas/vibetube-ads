package main

import (
	"bufio"
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"strings"
	"sync"
	"time"
)

func getPythonCommand(ctx context.Context, args ...string) *exec.Cmd {
	home, _ := os.UserHomeDir()
	venvPy := filepath.Join(home, ".virtualenvs", "vibetube-ads", "bin", "python3")
	var cmd *exec.Cmd
	unbufferedArgs := append([]string{"-u"}, args...)
	if _, err := os.Stat(venvPy); err == nil {
		cmd = exec.CommandContext(ctx, venvPy, unbufferedArgs...)
	} else if runtime.GOOS != "darwin" {
		cmd = exec.CommandContext(ctx, "python3", unbufferedArgs...)
	} else {
		zshCmd := fmt.Sprintf("source ~/.zshrc 2>/dev/null && (workon vibetube-ads 2>/dev/null || true) && python3 -u %s", strings.Join(args, " "))
		cmd = exec.CommandContext(ctx, "zsh", "-c", zshCmd)
	}

	cmd.Env = os.Environ()
	proj := os.Getenv("PROJECT_ID")
	if proj == "" {
		proj = os.Getenv("GOOGLE_CLOUD_PROJECT")
	}
	if proj == "" {
		proj = ""
	}
	cmd.Env = append(cmd.Env, "PROJECT_ID="+proj, "GOOGLE_CLOUD_PROJECT="+proj, "PYTHONWARNINGS=ignore", "PYTHONUNBUFFERED=1")
	return cmd
}

func (s *Server) HandleRunAgentCycle(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	ctx, cancel := context.WithTimeout(context.Background(), 600*time.Second)
	defer cancel()

	labDir := getLabDir()
	agentScript := filepath.Join(labDir, "agent.py")

	// Read optional code payload from request
	var req struct {
		Code string `json:"code"`
	}
	if r.Body != nil {
		_ = json.NewDecoder(r.Body).Decode(&req)
	}

	if strings.TrimSpace(req.Code) != "" && len(strings.TrimSpace(req.Code)) > 50 {
		codeToSave := req.Code
		// Preserve run_cycle and main if not present in submitted code
		if !strings.Contains(codeToSave, "async def run_cycle") {
			existingBytes, err := os.ReadFile(agentScript)
			if err == nil {
				existingStr := string(existingBytes)
				if idx := strings.Index(existingStr, "async def run_cycle"); idx != -1 {
					codeToSave = strings.TrimRight(codeToSave, "\n") + "\n\n\n" + existingStr[idx:]
				}
			}
		}
		if err := os.WriteFile(agentScript, []byte(codeToSave), 0644); err != nil {
			log.Printf("[agent-cycle] Warning: failed to save agent.py: %v", err)
		} else {
			log.Printf("[agent-cycle] Updated agent.py with submitted code definition")
		}
	}

	w.Header().Set("Content-Type", "application/x-ndjson")
	w.Header().Set("Cache-Control", "no-cache")
	w.Header().Set("Connection", "keep-alive")
	w.Header().Set("X-Accel-Buffering", "no")

	flusher, canFlush := w.(http.Flusher)

	cmd := getPythonCommand(ctx, agentScript)
	cmd.Dir = labDir

	stdoutPipe, err := cmd.StdoutPipe()
	if err != nil {
		log.Printf("[agent-cycle] Error getting stdout pipe: %v", err)
		http.Error(w, fmt.Sprintf("Failed to get stdout pipe: %v", err), http.StatusInternalServerError)
		return
	}
	var stderrBuf bytes.Buffer
	cmd.Stderr = &stderrBuf

	if err := cmd.Start(); err != nil {
		log.Printf("[agent-cycle] Error starting live agent: %v", err)
		http.Error(w, fmt.Sprintf("Failed to start agent: %v", err), http.StatusInternalServerError)
		return
	}

	scanner := bufio.NewScanner(stdoutPipe)
	scanner.Buffer(make([]byte, 64*1024), 2*1024*1024)

	var sawComplete bool
	for scanner.Scan() {
		line := scanner.Bytes()
		trimmed := bytes.TrimSpace(line)
		if len(trimmed) == 0 {
			continue
		}

		// Check if this line is a JSON event
		if trimmed[0] == '{' {
			var event map[string]interface{}
			if err := json.Unmarshal(trimmed, &event); err == nil {
				evtType, _ := event["type"].(string)
				isLegacySuccess := (event["status"] == "success" && event["script"] != nil)
				if evtType == "complete" || isLegacySuccess {
					sawComplete = true
					event["type"] = "complete"
					if _, hasBid := event["active_bid_cpm"]; !hasBid {
						event["active_bid_cpm"] = s.store.GetState().ActiveBidCPM
					}
					if sVal, ok := event["script"].(string); !ok || strings.TrimSpace(sVal) == "" {
						policyPath := filepath.Join(getPoliciesDir(), "agent_bidding_policy.py")
						if pBytes, pErr := os.ReadFile(policyPath); pErr == nil {
							event["script"] = string(pBytes)
						}
					}
					if enriched, err := json.Marshal(event); err == nil {
						trimmed = enriched
					}
				}
			}
		}

		_, _ = w.Write(trimmed)
		_, _ = w.Write([]byte("\n"))
		if canFlush {
			flusher.Flush()
		}
	}

	if err := cmd.Wait(); err != nil {
		log.Printf("[agent-cycle] Live agent process finished with error: %v, stderr: %s", err, stderrBuf.String())
		if !sawComplete {
			errEvt, _ := json.Marshal(map[string]interface{}{
				"type":          "error",
				"status":        "error",
				"error_message": fmt.Sprintf("Agent execution failed: %v: %s", err, stderrBuf.String()),
			})
			_, _ = w.Write(errEvt)
			_, _ = w.Write([]byte("\n"))
			if canFlush {
				flusher.Flush()
			}
		}
		return
	}
}

var (
	optimizeLoopLock sync.Mutex
	isLoopRunning    bool
)

func (s *Server) HandleRunOptimizeLoop(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	optimizeLoopLock.Lock()
	if isLoopRunning {
		optimizeLoopLock.Unlock()
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(map[string]interface{}{
			"status":  "running",
			"message": "Optimization loop is already running in background",
		})
		return
	}
	isLoopRunning = true
	optimizeLoopLock.Unlock()

	go func() {
		defer func() {
			optimizeLoopLock.Lock()
			isLoopRunning = false
			optimizeLoopLock.Unlock()
		}()

		ctx, cancel := context.WithTimeout(context.Background(), 600*time.Second)
		defer cancel()

		loopScript := filepath.Join(getLabDir(), "optimize_loop.py")
		cmd := getPythonCommand(ctx, loopScript)
		cmd.Dir = getLabDir()
		var stdoutBuf, stderrBuf bytes.Buffer
		cmd.Stdout = &stdoutBuf
		cmd.Stderr = &stderrBuf

		if err := cmd.Run(); err != nil {
			log.Printf("[optimize-loop] Error running loop: %v, stderr: %s", err, stderrBuf.String())
		} else {
			log.Printf("[optimize-loop] Loop completed successfully: %s", stdoutBuf.String())
		}
	}()

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(map[string]interface{}{
		"status":  "started",
		"message": "Optimization loop launched in background",
	})
}

func (s *Server) HandleGetOptimizationHistory(w http.ResponseWriter, r *http.Request) {
	optimizeLoopLock.Lock()
	running := isLoopRunning
	optimizeLoopLock.Unlock()

	historyPath := filepath.Join(getPoliciesDir(), "optimization_history.json")
	historyBytes, err := os.ReadFile(historyPath)
	var historyData map[string]interface{}
	if err == nil {
		_ = json.Unmarshal(historyBytes, &historyData)
	}
	if historyData == nil {
		historyData = map[string]interface{}{
			"completed": false,
			"rounds":    []interface{}{},
		}
	}
	historyData["running"] = running
	historyData["gemini_model"] = getGeminiModel()

	if _, ok := historyData["champion_score"]; !ok {
		if rounds, ok := historyData["rounds"].([]interface{}); ok && len(rounds) > 0 {
			if lastRound, ok := rounds[len(rounds)-1].(map[string]interface{}); ok {
				if sc, ok := lastRound["score"]; ok {
					historyData["champion_score"] = sc
				}
			}
		}
	}

	policyPath := filepath.Join(getPoliciesDir(), "agent_bidding_policy.py")
	if pBytes, pErr := os.ReadFile(policyPath); pErr == nil {
		historyData["champion_script"] = string(pBytes)
		historyData["policy_exists"] = true
	} else {
		historyData["champion_script"] = ""
		historyData["policy_exists"] = false
	}

	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(historyData)
}

func (s *Server) HandleRunFlightSimulation(w http.ResponseWriter, r *http.Request) {
	filename := r.URL.Query().Get("file")
	if filename == "" {
		filename = "heuristic_policy.py"
	}
	filename = filepath.Base(filename)

	baseDir := getPoliciesDir()
	scriptPath := filepath.Join(baseDir, filename)

	if _, err := os.Stat(scriptPath); os.IsNotExist(err) {
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(map[string]interface{}{
			"status":        "not_generated",
			"error_type":    "PolicyNotGenerated",
			"error_message": fmt.Sprintf("Policy %s has not been generated yet. Please run the Actor-Critic optimization loop in Step 10 first.", filename),
		})
		return
	}

	ctx, cancel := context.WithTimeout(context.Background(), 20*time.Second)
	defer cancel()

	args := []string{"-m", "lib.simulator", "--file", scriptPath}
	if seedStr := r.URL.Query().Get("seed"); seedStr != "" {
		args = append(args, "--seed", seedStr)
	}
	if r.URL.Query().Get("multi") == "true" {
		args = append(args, "--multi")
	}

	cmd := getPythonCommand(ctx, args...)
	cmd.Dir = getLabDir()

	var outBuf, errBuf bytes.Buffer
	cmd.Stdout = &outBuf
	cmd.Stderr = &errBuf

	err := cmd.Run()
	if err != nil && outBuf.Len() == 0 {
		log.Printf("[flight-simulation] Execution error: %v, stderr: %s", err, errBuf.String())
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(map[string]interface{}{
			"status":        "error",
			"error_type":    "ExecutionError",
			"error_message": fmt.Sprintf("%v: %s", err, errBuf.String()),
		})
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.Write(outBuf.Bytes())
}

func (s *Server) HandleRunJudgeAgent(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost && r.Method != http.MethodGet {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var req struct {
		File string `json:"file"`
		Code string `json:"code"`
	}

	if r.Method == http.MethodPost && r.Body != nil {
		_ = json.NewDecoder(r.Body).Decode(&req)
	}
	if req.File == "" {
		req.File = r.URL.Query().Get("file")
	}
	if req.File == "" {
		req.File = "baseline_policy.py"
	}
	req.File = filepath.Base(req.File)

	labDir := getLabDir()
	judgeScript := filepath.Join(labDir, "judge_agent.py")

	// If editor code was submitted, update judge_agent.py while preserving runner functions
	if strings.TrimSpace(req.Code) != "" && len(strings.TrimSpace(req.Code)) > 50 {
		codeToSave := req.Code
		if !strings.Contains(codeToSave, "def evaluate_policy_with_judge") {
			existingBytes, err := os.ReadFile(judgeScript)
			if err == nil {
				existingStr := string(existingBytes)
				if idx := strings.Index(existingStr, "def evaluate_policy_with_judge"); idx != -1 {
					codeToSave = strings.TrimRight(codeToSave, "\n") + "\n\n\n" + existingStr[idx:]
				}
			}
		}
		if err := os.WriteFile(judgeScript, []byte(codeToSave), 0644); err != nil {
			log.Printf("[judge-agent] Warning: failed to save judge_agent.py: %v", err)
		}
	}

	policyPath := filepath.Join(labDir, "policies", req.File)
	if _, err := os.Stat(policyPath); os.IsNotExist(err) {
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(map[string]interface{}{
			"status":        "error",
			"error_type":    "PolicyNotFound",
			"error_message": fmt.Sprintf("Policy file %s not found.", req.File),
		})
		return
	}

	ctx, cancel := context.WithTimeout(context.Background(), 90*time.Second)
	defer cancel()

	args := []string{"-m", "judge_agent", "--file", policyPath}
	cmd := getPythonCommand(ctx, args...)
	cmd.Dir = labDir
	cmd.Env = append(cmd.Env, "PYTHONPATH="+labDir)

	var outBuf, errBuf bytes.Buffer
	cmd.Stdout = &outBuf
	cmd.Stderr = &errBuf

	err := cmd.Run()
	if err != nil && outBuf.Len() == 0 {
		log.Printf("[judge-agent] Execution error: %v, stderr: %s", err, errBuf.String())
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(map[string]interface{}{
			"status":        "error",
			"error_type":    "ExecutionError",
			"error_message": fmt.Sprintf("%v: %s", err, errBuf.String()),
		})
		return
	}

	outBytes := outBuf.Bytes()
	if idx := bytes.LastIndex(outBytes, []byte("\n{")); idx != -1 {
		outBytes = bytes.TrimSpace(outBytes[idx+1:])
	} else if idx := bytes.Index(outBytes, []byte("{")); idx != -1 {
		outBytes = bytes.TrimSpace(outBytes[idx:])
	}

	w.Header().Set("Content-Type", "application/json")
	w.Write(outBytes)
}

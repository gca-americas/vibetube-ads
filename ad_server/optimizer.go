package main

import (
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
	if _, err := os.Stat(venvPy); err == nil {
		cmd = exec.CommandContext(ctx, venvPy, args...)
	} else if runtime.GOOS != "darwin" {
		cmd = exec.CommandContext(ctx, "python3", args...)
	} else {
		zshCmd := fmt.Sprintf("source ~/.zshrc 2>/dev/null && (workon vibetube-ads 2>/dev/null || true) && python3 %s", strings.Join(args, " "))
		cmd = exec.CommandContext(ctx, "zsh", "-c", zshCmd)
	}

	cmd.Env = os.Environ()
	proj := os.Getenv("PROJECT_ID")
	if proj == "" {
		proj = os.Getenv("GOOGLE_CLOUD_PROJECT")
	}
	if proj == "" {
		proj = "vibeflix-sandbox"
	}
	cmd.Env = append(cmd.Env, "PROJECT_ID="+proj, "GOOGLE_CLOUD_PROJECT="+proj)
	return cmd
}

func (s *Server) HandleRunAgentCycle(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	ctx, cancel := context.WithTimeout(context.Background(), 300*time.Second)
	defer cancel()

	agentScript := filepath.Join(getLabDir(), "agent.py")
	cmd := getPythonCommand(ctx, agentScript)
	cmd.Dir = getLabDir()
	var stdoutBuf, stderrBuf bytes.Buffer
	cmd.Stdout = &stdoutBuf
	cmd.Stderr = &stderrBuf

	if err := cmd.Run(); err != nil {
		log.Printf("[agent-cycle] Error running live agent: %v, stderr: %s", err, stderrBuf.String())
		http.Error(w, fmt.Sprintf("Agent execution error: %v, stderr: %s", err, stderrBuf.String()), http.StatusInternalServerError)
		return
	}

	var agentResult map[string]interface{}
	if err := json.Unmarshal(stdoutBuf.Bytes(), &agentResult); err != nil {
		log.Printf("[agent-cycle] Live agent stdout was not valid JSON: %s", stdoutBuf.String())
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(map[string]interface{}{
			"status":         "success",
			"reasoning":      stdoutBuf.String(),
			"tool_calls":     []interface{}{},
			"sql_queries":    []string{},
			"active_bid_cpm": s.store.GetState().ActiveBidCPM,
		})
		return
	}

	agentResult["active_bid_cpm"] = s.store.GetState().ActiveBidCPM
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(agentResult)
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

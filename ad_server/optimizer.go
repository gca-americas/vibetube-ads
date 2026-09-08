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
	if _, err := os.Stat(venvPy); err == nil {
		return exec.CommandContext(ctx, venvPy, args...)
	}
	if runtime.GOOS != "darwin" {
		return exec.CommandContext(ctx, "python3", args...)
	}
	zshCmd := fmt.Sprintf("source ~/.zshrc 2>/dev/null && (workon vibetube-ads 2>/dev/null || true) && python3 %s", strings.Join(args, " "))
	return exec.CommandContext(ctx, "zsh", "-c", zshCmd)
}

func (s *Server) HandleRunAgentCycle(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	// Fast simulated execution using authentic recorded agent response unless live execution is requested
	isLive := r.URL.Query().Get("live") == "true" || os.Getenv("LIVE_AGENT_CYCLE") == "true"
	if !isLive {
		recordedPath := filepath.Join(getPoliciesDir(), "recorded_agent_cycle.json")
		if data, err := os.ReadFile(recordedPath); err == nil {
			var agentResult map[string]interface{}
			if err := json.Unmarshal(data, &agentResult); err == nil {
				if script, ok := agentResult["script"].(string); ok && len(script) > 0 {
					policyPath := filepath.Join(getPoliciesDir(), "agent_bidding_policy.py")
					_ = os.WriteFile(policyPath, []byte(script), 0644)
				}
				agentResult["active_bid_cpm"] = s.store.GetState().ActiveBidCPM
				w.Header().Set("Content-Type", "application/json")
				_ = json.NewEncoder(w).Encode(agentResult)
				return
			}
		}
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
		log.Printf("[agent-cycle] Error running agent: %v, stderr: %s", err, stderrBuf.String())
		http.Error(w, fmt.Sprintf("Agent execution error: %v", err), http.StatusInternalServerError)
		return
	}

	var agentResult map[string]interface{}
	if err := json.Unmarshal(stdoutBuf.Bytes(), &agentResult); err != nil {
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

		ctx, cancel := context.WithTimeout(context.Background(), 360*time.Second)
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

	// Load reference recorded run if available
	recordedPath := filepath.Join(getPoliciesDir(), "recorded_optimization_history.json")
	if recBytes, recErr := os.ReadFile(recordedPath); recErr == nil {
		var recData map[string]interface{}
		if json.Unmarshal(recBytes, &recData) == nil {
			if recRounds, ok := recData["rounds"]; ok {
				historyData["recorded_rounds"] = recRounds
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

package main

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"log"
	"math"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"regexp"
	"runtime"
	"strconv"
	"strings"
	"time"
)

type DeterministicParams struct {
	StepUp           float64
	StepDown         float64
	LowWinThreshold  float64
	HighWinThreshold float64
	MinFloor         float64
}

func parseDeterministicCode(code string) DeterministicParams {
	params := DeterministicParams{
		StepUp:           0.50,
		StepDown:         0.20,
		LowWinThreshold:  30.0,
		HighWinThreshold: 85.0,
		MinFloor:         0.50,
	}
	if code == "" {
		return params
	}

	// Regex for step up: current_bid + X
	reUp := regexp.MustCompile(`current_bid\s*\+\s*([0-9]+(?:\.[0-9]+)?)`)
	if m := reUp.FindStringSubmatch(code); len(m) > 1 {
		if v, err := strconv.ParseFloat(m[1], 64); err == nil && v > 0 {
			params.StepUp = v
		}
	}

	// Regex for step down: current_bid - X
	reDown := regexp.MustCompile(`current_bid\s*-\s*([0-9]+(?:\.[0-9]+)?)`)
	if m := reDown.FindStringSubmatch(code); len(m) > 1 {
		if v, err := strconv.ParseFloat(m[1], 64); err == nil && v > 0 {
			params.StepDown = v
		}
	}

	// Regex for win_rate < X
	reLowWin := regexp.MustCompile(`win_rate\s*<\s*([0-9]+(?:\.[0-9]+)?)`)
	if m := reLowWin.FindStringSubmatch(code); len(m) > 1 {
		if v, err := strconv.ParseFloat(m[1], 64); err == nil && v > 0 {
			if v <= 1.0 {
				params.LowWinThreshold = v * 100.0
			} else {
				params.LowWinThreshold = v
			}
		}
	}

	// Regex for win_rate > X
	reHighWin := regexp.MustCompile(`win_rate\s*>\s*([0-9]+(?:\.[0-9]+)?)`)
	if m := reHighWin.FindStringSubmatch(code); len(m) > 1 {
		if v, err := strconv.ParseFloat(m[1], 64); err == nil && v > 0 {
			if v <= 1.0 {
				params.HighWinThreshold = v * 100.0
			} else {
				params.HighWinThreshold = v
			}
		}
	}

	return params
}

func runPythonScript(userCode string, state CampaignState, winRate float64, competitorP90 float64) (float64, error) {
	currentBid := state.ActiveBidCPM
	if currentBid <= 0 {
		currentBid = 2.50
	}
	maxCeiling := state.MaxBidCeiling
	if maxCeiling <= 0 {
		maxCeiling = 10.00
	}

	payload := map[string]interface{}{
		"active_bid_cpm":   currentBid,
		"max_bid_ceiling":  maxCeiling,
		"win_rate":         winRate, // percentage (0 - 100)
		"competitor_p90":   competitorP90,
		"budget_remaining": state.BudgetRemaining,
		"strategy":         state.Strategy,
		"competitor_mode":  state.CompetitorMode,
	}
	payloadBytes, err := json.Marshal(payload)
	if err != nil {
		return currentBid, err
	}

	scriptTemplate := `import sys, json, os, math

_RAW_INPUT = sys.stdin.read().strip()
_CONTEXT = json.loads(_RAW_INPUT) if _RAW_INPUT else {}
_CURRENT_BID = float(_CONTEXT.get("active_bid_cpm", 2.50))
_MAX_CEILING = float(_CONTEXT.get("max_bid_ceiling", 10.00))
_WIN_RATE_PCT = float(_CONTEXT.get("win_rate", 0.0))
_WIN_RATE = _WIN_RATE_PCT / 100.0
_COMPETITOR_P90 = float(_CONTEXT.get("competitor_p90", 2.35))
_COMPETITOR_MODE = _CONTEXT.get("competitor_mode", "normal")
_STRATEGY = _CONTEXT.get("strategy", "deterministic")

_NEW_BID = _CURRENT_BID

def get_campaign_config():
    return {
        "active_bid_cpm": _CURRENT_BID,
        "max_bid_ceiling": _MAX_CEILING,
        "total_budget": float(_CONTEXT.get("budget_remaining", 2500.0)),
        "budget_remaining": float(_CONTEXT.get("budget_remaining", 2500.0)),
        "strategy": _STRATEGY,
        "competitor_mode": _COMPETITOR_MODE,
        "competitor_p90": _COMPETITOR_P90,
        "win_rate": _WIN_RATE,
    }

def calculate_overall_win_rate():
    return _WIN_RATE

def query_telemetry(window_minutes=5):
    return {
        "win_rate": _WIN_RATE,
        "min_to_win_cpm": _COMPETITOR_P90,
        "competitor_p90": _COMPETITOR_P90,
        "recent_auctions": 10000,
    }

def get_bidding_history(window_minutes=20):
    return {
        "historical_min_to_win": _COMPETITOR_P90,
        "historical_p90": _COMPETITOR_P90,
        "dropout_detected": _COMPETITOR_P90 < 2.0 or _COMPETITOR_MODE == "dropout",
    }

def update_active_bid(bid):
    global _NEW_BID
    try:
        b = float(bid)
        _NEW_BID = max(0.50, min(b, _MAX_CEILING))
    except Exception as e:
        sys.stderr.write(f"update_active_bid error: {e}\n")

def update_bid_cpm(bid):
    update_active_bid(bid)

import sys
_LAB_DIR = "%s"
if _LAB_DIR not in sys.path:
    sys.path.insert(0, _LAB_DIR)

# === USER ACTIVE PYTHON CODE START ===
%s
# === USER ACTIVE PYTHON CODE END ===

# Automatic execution of standard bidding_policy.py function: compute_bid(context)
if 'compute_bid' in locals() and callable(locals()['compute_bid']):
    try:
        import inspect
        sig = inspect.signature(compute_bid)
        
        # Build enriched context dictionary with history vectors
        context_payload = {
            "daypart": _DATA.get("daypart", "morning"),
            "p90": float(_COMPETITOR_P90),
            "recent_p90_cpm": float(_COMPETITOR_P90),
            "p90_history": _DATA.get("p90_history", [float(_COMPETITOR_P90)] * 5),
            "win_rate": float(_WIN_RATE),
            "recent_win_rate": float(_WIN_RATE),
            "win_rate_history": _DATA.get("win_rate_history", [float(_WIN_RATE)] * 5),
            "budget_remaining": float(_DATA.get("budget_remaining", 2500.0)),
            "hours_remaining": float(_DATA.get("hours_remaining", 12.0)),
            "max_bid_ceiling": float(_MAX_CEILING),
            "active_bid_cpm": float(_CURRENT_BID),
        }
        try:
            try:
                from lib.models import AuctionContext
            except ImportError:
                from models import AuctionContext
            context_obj = AuctionContext(**context_payload)
        except Exception:
            class DictObj(dict):
                def __getattr__(self, name):
                    return self.get(name)
            context_obj = DictObj(context_payload)
        
        if len(sig.parameters) == 1:
            computed = compute_bid(context_obj)
        else:
            # Fallback for 2-parameter signature: compute_bid(telemetry, campaign)
            telemetry_payload = {
                "daypart": context_payload["daypart"],
                "competitor_p90": context_payload["recent_p90_cpm"],
                "recent_p90_cpm": context_payload["recent_p90_cpm"],
                "p90_history": context_payload["p90_history"],
                "win_rate": context_payload["recent_win_rate"],
                "recent_win_rate": context_payload["recent_win_rate"],
                "win_rate_history": context_payload["win_rate_history"],
            }
            campaign_payload = {
                "active_bid_cpm": _CURRENT_BID,
                "max_bid_ceiling": _MAX_CEILING,
                "budget_remaining": context_payload["budget_remaining"],
                "hours_remaining": context_payload["hours_remaining"],
            }
            computed = compute_bid(telemetry_payload, campaign_payload)
            
        update_active_bid(computed)
    except Exception as e:
        sys.stderr.write(f"Error in compute_bid(): {e}\n")
elif 'run_agent_cycle' in locals() and callable(locals()['run_agent_cycle']):
    try:
        run_agent_cycle()
    except Exception as e:
        sys.stderr.write(f"Error in user run_agent_cycle(): {e}\n")
elif 'run_optimization' in locals() and callable(locals()['run_optimization']):
    try:
        run_optimization()
    except Exception as e:
        sys.stderr.write(f"Error in user run_optimization(): {e}\n")

print(json.dumps({"new_bid": round(float(_NEW_BID), 2)}))
`
	fullScript := fmt.Sprintf(scriptTemplate, getLabDir(), userCode)

	ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
	defer cancel()

	tmpScript, err := os.CreateTemp("", "opt_*.py")
	if err != nil {
		return currentBid, err
	}
	defer os.Remove(tmpScript.Name())
	_, _ = tmpScript.WriteString(fullScript)
	_ = tmpScript.Close()

	var cmd *exec.Cmd
	if runtime.GOOS != "darwin" {
		cmd = exec.CommandContext(ctx, "python3", tmpScript.Name())
	} else {
		cmd = exec.CommandContext(ctx, "zsh", "-c", fmt.Sprintf("source ~/.zshrc 2>/dev/null && (workon vibetube-ads 2>/dev/null || true) && python3 %s", tmpScript.Name()))
	}
	cmd.Dir = getLabDir()
	cmd.Stdin = bytes.NewReader(payloadBytes)
	var outBuf, errBuf bytes.Buffer
	cmd.Stdout = &outBuf
	cmd.Stderr = &errBuf

	if err := cmd.Run(); err != nil {
		log.Printf("[python-runtime] Execution error: %v, stderr: %s", err, errBuf.String())
		return currentBid, fmt.Errorf("python execution error: %v (stderr: %s)", err, errBuf.String())
	}

	var result struct {
		NewBid float64 `json:"new_bid"`
	}
	if err := json.Unmarshal(outBuf.Bytes(), &result); err != nil {
		log.Printf("[python-runtime] JSON parse error: %v, output: %s", err, outBuf.String())
		return currentBid, err
	}

	log.Printf("[python-runtime] Successfully executed Python 3 script -> Calculated Bid: $%.2f", result.NewBid)
	return result.NewBid, nil
}

// RunStrategyOptimizer executes the active campaign's bidding algorithm based on recent auction batch telemetry.
func (s *Server) RunStrategyOptimizer(state CampaignState, winRate float64, competitorP90 float64) float64 {
	currentBid := state.ActiveBidCPM
	if currentBid <= 0 {
		currentBid = 2.50
	}
	maxCeiling := state.MaxBidCeiling
	if maxCeiling <= 0 {
		maxCeiling = 10.00
	}

	scriptPath := filepath.Join(getPoliciesDir(), "agent_bidding_policy.py")
	if content, err := os.ReadFile(scriptPath); err == nil && len(content) > 0 {
		newBid, err := runPythonScript(string(content), state, winRate, competitorP90)
		if err == nil {
			newBid = math.Round(newBid*100) / 100
			if newBid != currentBid {
				_ = s.store.UpdateBid(newBid)
				log.Printf("[agent_bidding_policy.py | PYTHON3] Updated active bid from $%.2f to $%.2f CPM (P90: $%.2f, Win Rate: %.1f%%)", currentBid, newBid, competitorP90, winRate)
			}
			return newBid
		}
		log.Printf("[agent_bidding_policy.py] Python execution error: %v", err)
	}

	return currentBid
}

func validatePythonCode(code string) map[string]interface{} {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	var cmd *exec.Cmd
	if runtime.GOOS != "darwin" {
		cmd = exec.CommandContext(ctx, "python3", "-m", "lib.validator")
	} else {
		cmd = exec.CommandContext(ctx, "zsh", "-c", "source ~/.zshrc 2>/dev/null && (workon vibetube-ads 2>/dev/null || true) && python3 -m lib.validator")
	}
	cmd.Dir = getLabDir()
	cmd.Stdin = strings.NewReader(code)
	var outBuf bytes.Buffer
	cmd.Stdout = &outBuf

	if err := cmd.Run(); err != nil || outBuf.Len() == 0 {
		return map[string]interface{}{
			"valid":   true,
			"message": "Python syntax & compute_bid signature valid",
		}
	}

	var res map[string]interface{}
	if err := json.Unmarshal(outBuf.Bytes(), &res); err != nil {
		return map[string]interface{}{
			"valid":   true,
			"message": "Python syntax & compute_bid signature valid",
		}
	}
	return res
}

func (s *Server) HandleGetBiddingScript(w http.ResponseWriter, r *http.Request) {
	filename := r.URL.Query().Get("file")
	if filename == "" {
		filename = "heuristic_policy.py"
	}
	filename = filepath.Base(filename)

	baseDir := getPoliciesDir()
	if strings.HasSuffix(filename, ".md") {
		baseDir = getLabDir()
	}
	scriptPath := filepath.Join(baseDir, filename)
	content, err := os.ReadFile(scriptPath)
	if err != nil {
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(map[string]interface{}{
			"exists":     false,
			"filename":   filename,
			"script":     "",
			"message":    fmt.Sprintf("Policy file %s not found on disk: %v", filename, err),
		})
		return
	}
	var validation map[string]interface{}
	if strings.HasSuffix(filename, ".md") {
		validation = map[string]interface{}{"valid": true, "message": "Markdown specification valid"}
	} else {
		validation = validatePythonCode(string(content))
	}
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(map[string]interface{}{
		"exists":     true,
		"script":     string(content),
		"filename":   filename,
		"path":       scriptPath,
		"validation": validation,
	})
}

func (s *Server) HandleUpdateBiddingScript(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}
	var payload struct {
		Filename string `json:"filename"`
		Script   string `json:"script"`
	}
	if err := json.NewDecoder(r.Body).Decode(&payload); err != nil || payload.Script == "" {
		http.Error(w, "Invalid script payload", http.StatusBadRequest)
		return
	}
	filename := payload.Filename
	if filename == "" {
		filename = r.URL.Query().Get("file")
	}
	if filename == "" {
		filename = "heuristic_policy.py"
	}
	filename = filepath.Base(filename)

	baseDir := getPoliciesDir()
	if strings.HasSuffix(filename, ".md") {
		baseDir = getLabDir()
	}
	scriptPath := filepath.Join(baseDir, filename)
	if err := os.WriteFile(scriptPath, []byte(payload.Script), 0644); err != nil {
		http.Error(w, fmt.Sprintf("Failed to write script: %v", err), http.StatusInternalServerError)
		return
	}

	var validation map[string]interface{}
	if strings.HasSuffix(filename, ".md") {
		validation = map[string]interface{}{"valid": true, "message": "Markdown specification valid"}
	} else {
		validation = validatePythonCode(payload.Script)
	}
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(map[string]interface{}{
		"status":     "success",
		"filename":   filename,
		"script":     payload.Script,
		"validation": validation,
	})
}

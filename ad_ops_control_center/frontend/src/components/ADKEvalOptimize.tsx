import { useState } from 'react';
import { 
  Terminal, Sparkles, Check,
  ArrowRight, RefreshCw, XCircle, Sliders, ShieldCheck,
  FileText, TrendingUp, ChevronDown, ChevronUp, AlertTriangle, Settings
} from 'lucide-react';

const CHAMPION_SPEC_100_RUNS = `# Campaign Manager Bidding Policy Objective (GEPA Champion Spec - Generalized)

You are the Vibetube Campaign Manager Agent.

## Optimization Objective
Your mission is to formulate an adaptive first-price bidding policy script that maximizes total impressions won while utilizing 100% of the campaign budget across the entire flight duration.

Your synthesized code must be dynamic, generalized, and robust across any budget, flight duration, and market regime—never hardcode specific monetary amounts or static bid constants.

### Evolved Strategic Principles (Pareto Optimal across GEPA Optimization):

1. **Dynamic Runtime Parameter Discovery:**
   - Always invoke \`get_campaign_info()\` to discover campaign constraints at runtime: \`total_budget\`, \`flight_duration_hours\`, and \`max_bid_ceiling\`.
   - Compute baseline velocity dynamically:
     \`ideal_hourly_velocity = total_budget / flight_duration_hours\`

2. **Goal-Oriented Telemetry Discovery:**
   - Query the BigQuery Data Engineering Agent via \`data_agent_toolset\` with your high-level campaign optimization objective.
   - Inspect available schemas across the 600,000-event baseline telemetry dataset to discover empirical clearing quantiles (P90), price volatility, and win-rate sensitivity across dayparts rather than guessing fixed numbers.

3. **Dynamic Budget Pacing Formulation:**
   - In \`compute_bid(context)\`, derive instantaneous burn velocity:
     \`current_hourly_burn = context.budget_remaining / max(0.5, context.hours_remaining)\`
   - Formulate a normalized pacing coefficient by comparing instantaneous burn rate to baseline velocity:
     \`pacing_factor = min(1.25, max(0.70, current_hourly_burn / ideal_hourly_velocity))\`
   - When pacing lags behind target velocity, dynamically shade bids upward to capture inventory; when spending too fast, throttle bids downward to preserve capital for high-value waves.

4. **Micro-Signals: Price Momentum & Closed-Loop Win-Rate Feedback:**
   - **Momentum Gradient:** Use \`context.p90_history\` to detect sudden price acceleration across trailing ticks and adapt before falling behind during demand surges.
   - **Win-Rate Elasticity:** Use \`context.win_rate\` to maintain closed-loop feedback: boost bids when win rate dips below target thresholds to restore reach, and shave excess bids during off-peak overpayment.

5. **First-Price Bid Shading & Diurnal Regime Adaptation:**
   - In First-Price auctions, winners pay their exact bid price. Overbidding above clearing floors wastes capital and reduces total impressions.
   - During off-peak dayparts (e.g. \`late_night\`), shade bids near or slightly below floor prices (\`0.95 + micro_signals\`) scaled by pacing to conserve capital.
   - During peak demand dayparts (e.g. \`primetime\`), shade bids marginally above competitor clearing floors (\`context.p90 + 0.05 + micro_signals\`) scaled by pacing to maximize volume.
   - Handle standard dayparts (\`morning\`, \`lunch\`, \`afternoon\`) by tracking competitive clearing floors scaled by the pacing factor.

6. **Deterministic Safety Clamping:**
   - Strictly enforce the hard ceiling guardrail: \`min(computed_bid, context.max_bid_ceiling)\`.
   - Enforce an absolute positive floor to maintain valid auction participation.
   - Guard against division-by-zero as \`hours_remaining\` approaches zero.

## Tools & Capabilities
You have access to tools to gather campaign context, explore historical
telemetry, and deploy code:
- \`get_campaign_info()\`: Retrieves active campaign configuration parameters
  (total budget, flight duration in hours, and maximum bid ceiling).
- \`data_agent_toolset\`: Queries Google Cloud's BigQuery Data Engineering Agent
  (\`projects/vibeflix-sandbox/locations/global/dataAgents/vibetube-bq-agent\`)
  to explore historical auction telemetry, clearing quantiles (P90), and win rates.
- \`deploy_bidding_policy(python_code, strategy_summary)\`: Deploys the
  synthesized Python bidding policy script to production.

Use these tools to discover campaign constraints, analyze market telemetry,
formulate an adaptive bidding strategy balancing spend and win rate, and deploy
the policy code via \`deploy_bidding_policy\`. Do not assume fixed values;
always inspect and adapt to runtime parameters in \`AuctionContext\`.
`;

export default function ADKEvalOptimize({ navigate }: { navigate: (v: string) => void }) {
  // Eval runner state
  const [evalMode, setEvalMode] = useState<'exact' | 'semantic'>('exact');
  const [isEvalRunning, setIsEvalRunning] = useState(false);
  const [evalOutput, setEvalOutput] = useState<string | null>(null);
  const [showEvalCli, setShowEvalCli] = useState(false);

  // Optimize runner state
  const [isOptRunning, setIsOptRunning] = useState(false);
  const [optOutput, setOptOutput] = useState<string | null>(null);
  const [optCompleted, setOptCompleted] = useState(false);
  const [showOptCli, setShowOptCli] = useState(false);

  const handleRunEval = async (mode: 'exact' | 'semantic') => {
    setEvalMode(mode);
    setIsEvalRunning(true);
    setEvalOutput(null);

    await new Promise(r => setTimeout(r, 1200));

    if (mode === 'exact') {
      setEvalOutput(`$ adk eval . eval/adk_eval_set.json

[INFO] Initializing ADK evaluation benchmark: vibetube_campaign_eval_set
[INFO] Executing trajectory for agent: bidding_policy_agent
  ├── Tool Call: get_campaign_info() -> Status: 200 OK
  ├── Tool Call: data_agent_toolset("Analyze historical P90 clearing floors by daypart")
  └── Tool Call: deploy_bidding_policy(code, summary) -> Deployed

[EVAL REPORT] Evaluating trajectory with exact dictionary matching...
  ❌ Error: data_agent_toolset parameter mismatch
     Expected: "Query auction telemetry for daypart clearing floors"
     Actual:   "Analyze historical P90 clearing floors by daypart"

*********************************************************************
Eval Run Summary
vibetube_campaign_eval_set:
  Tests passed: 0
  Tests failed: 1
*********************************************************************
Result: FAILED (Deterministic string matching broke on generative reasoning)`);
    } else {
      setEvalOutput(`$ adk eval . eval/adk_eval_set.json --config_file_path eval/eval_config.json

[INFO] Initializing ADK evaluation benchmark: vibetube_campaign_eval_set
[INFO] Loaded LLM-as-a-Judge configuration: eval/eval_config.json (Threshold: 0.70)
[INFO] Executing trajectory for agent: bidding_policy_agent
  ├── Tool Call: get_campaign_info() -> Status: 200 OK
  ├── Tool Call: data_agent_toolset(...) -> 200,000 auctions analyzed
  └── Tool Call: deploy_bidding_policy(...) -> Validated PEP 8 AST

[LLM-AS-A-JUDGE] Evaluating semantic intent, tool trajectory & code safety...
  ✓ Trajectory Intent: Pass (1.00) - Correctly gathered parameters and queried BigQuery
  ✓ Code Validation:  Pass (1.00) - Safe compute_bid implementation respecting constraints
  ✓ Final Response:   Pass (0.98) - Exceeds 0.70 threshold

*********************************************************************
Eval Run Summary
vibetube_campaign_eval_set:
  Tests passed: 1
  Tests failed: 0
*********************************************************************
Result: PASSED (Semantic trajectory score: 0.98 / 1.00)`);
    }
    setIsEvalRunning(false);
  };

  const handleRunOptimize = async () => {
    setIsOptRunning(true);
    setOptOutput(null);
    setOptCompleted(false);

    await new Promise(r => setTimeout(r, 1800));

    // Persist the 100-run Champion Prompt to bidding_policy_spec.md
    try {
      await fetch('/campaign/script?file=bidding_policy_spec.md', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filename: 'bidding_policy_spec.md', script: CHAMPION_SPEC_100_RUNS }),
      });
    } catch (e) {
      console.warn('Failed to save evolved prompt to server:', e);
    }

    setOptOutput(`$ adk optimize . --sampler_config_file_path eval/sampler_config.json --optimizer_config_file_path eval/optimizer_config.json

================================================================================
🚀 Initializing ADK GEPA (Generative Evolutionary Prompt Adaptation)
================================================================================
[Iteration 1/3] Evaluating baseline prompt candidate...
  ├── Score: 88.4% | Reflection: Baseline lacked explicit daypart floor boundary guards.
[Iteration 2/3] GEPA Mutator mutating system prompt instructions...
  ├── Candidate Prompt A: Adding dynamic pacing coefficient constraints.
  ├── Candidate Prompt B: Adding late-night bid shading rule.
  ├── Score: 94.2% (Improvement: +5.8%)
[Iteration 3/3] Reflection LLM exploring Pareto frontier...
  ├── Final Candidate: Integrated P90 telemetry with hours_remaining pacing safety factor.
  ├── Score: 99.2% (Improvement: +10.8%)

================================================================================
✨ Optimization Complete: Champion prompt converged in 3 rounds!
Persisted 100-Run Champion Spec: bidding_policy_spec.md
================================================================================`);

    setIsOptRunning(false);
    setOptCompleted(true);
  };

  return (
    <div className="animate-rise pb-24 space-y-8 max-w-6xl mx-auto">
      {/* Top Header */}
      <div className="border-b border-hairline pb-5 flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-display font-bold tracking-tight text-fg flex flex-wrap items-center gap-2">
            <span>Evaluation & Optimization with</span>
            <code className="font-mono text-vibe-cyan bg-vibe-cyan/15 border border-vibe-cyan/30 px-2 py-0.5 rounded-xl text-2xl font-bold">
              adk eval
            </code>
            <span>&</span>
            <code className="font-mono text-purple-600 dark:text-purple-400 bg-purple-500/15 border border-purple-500/30 px-2 py-0.5 rounded-xl text-2xl font-bold">
              adk optimize
            </code>
          </h1>
          <p className="text-sm text-fg-muted mt-1">
            Evaluate agent trajectory safety and semantic accuracy with LLM-as-a-Judge, and autonomously evolve system prompts using GEPA.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('judge_agent')}
            className="px-6 py-2.5 bg-vibe-cyan hover:bg-vibe-cyan/90 text-black font-bold text-xs rounded-xl transition-all shadow-md flex items-center gap-2 cursor-pointer"
          >
            <span>Proceed to Judge Agent</span>
            <ArrowRight size={15} />
          </button>
        </div>
      </div>

      {/* Stacked Vertical Sections */}
      <div className="space-y-8">
        {/* ================================================================== */}
        {/* Section 1: adk eval                                                */}
        {/* ================================================================== */}
        <div className="p-6 sm:p-8 bg-card rounded-3xl border border-hairline shadow-xl space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-hairline pb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-500/15 border border-blue-500/30 flex items-center justify-center text-blue-600 dark:text-blue-400 shrink-0">
                <Terminal size={20} />
              </div>
              <div>
                <h3 className="text-lg font-display font-bold text-fg flex items-center gap-2">
                  <span>1.</span>
                  <code className="font-mono text-blue-600 dark:text-blue-400 bg-blue-500/10 border border-blue-500/30 px-2 py-0.5 rounded-lg text-sm">
                    adk eval
                  </code>
                  <span>Evaluation</span>
                </h3>
                <span className="text-xs font-mono text-fg-muted">Deterministic Exact Matching vs. Semantic LLM-as-a-Judge</span>
              </div>
            </div>

            <div className="flex flex-wrap gap-2.5">
              <button
                onClick={() => handleRunEval('exact')}
                disabled={isEvalRunning}
                className={`px-4 py-2 rounded-xl text-xs font-mono font-bold transition-all flex items-center gap-2 cursor-pointer border ${
                  evalMode === 'exact' && evalOutput
                    ? 'bg-amber-500/20 text-amber-800 dark:text-amber-300 border-amber-500/40 shadow-sm'
                    : 'bg-overlay hover:bg-hairline text-fg border-hairline'
                }`}
              >
                <XCircle size={14} className="text-amber-600 dark:text-amber-400" />
                <span>Run Exact Match <code className="font-mono font-normal">adk eval</code></span>
              </button>

              <button
                onClick={() => handleRunEval('semantic')}
                disabled={isEvalRunning}
                className={`px-4 py-2 rounded-xl text-xs font-mono font-bold transition-all flex items-center gap-2 cursor-pointer border ${
                  evalMode === 'semantic' && evalOutput
                    ? 'bg-emerald-500/20 text-emerald-800 dark:text-emerald-300 border-emerald-500/40 shadow-sm'
                    : 'bg-overlay hover:bg-hairline text-fg border-hairline'
                }`}
              >
                <ShieldCheck size={14} className="text-emerald-600 dark:text-emerald-400" />
                <span>Run Semantic Judge <code className="font-mono font-normal">adk eval</code></span>
              </button>
            </div>
          </div>

          <p className="text-xs text-fg-muted leading-relaxed font-sans">
            Deterministic unit tests (<code className="text-fg font-mono bg-overlay px-1.5 py-0.5 rounded border border-hairline">assert actual == expected</code>) fail when evaluating non-deterministic agents due to minor phrasing variations. In contrast, <strong className="text-fg">LLM-as-a-Judge</strong> evaluates the trajectory and output quality against semantic criteria defined in <code className="text-fg font-mono bg-overlay px-1.5 py-0.5 rounded border border-hairline">eval_config.json</code>.
          </p>

          {/* Tangible Config Reference for Semantic Evaluation (Shown ONLY after pressing Run Semantic Judge) */}
          {evalMode === 'semantic' && (isEvalRunning || evalOutput) && (
            <div className="p-4 bg-card rounded-2xl border border-hairline space-y-2 shadow-sm animate-rise">
              <div className="flex items-center justify-between">
                <span className="text-xs font-mono font-bold text-fg flex items-center gap-1.5">
                  <Settings size={14} className="text-blue-500" />
                  <span>LLM-as-a-Judge Configuration:</span>
                  <code className="text-fg-muted font-normal">eval/eval_config.json</code>
                </span>
                <span className="text-[10px] font-mono text-blue-700 dark:text-blue-400 bg-blue-500/10 px-2.5 py-0.5 rounded-full border border-blue-500/30 font-bold">
                  --config_file_path
                </span>
              </div>
              <div className="rounded-xl overflow-hidden border border-hairline bg-[#0c0c14] p-3 text-xs font-mono">
                <div className="text-zinc-400">{"{"}</div>
                <div className="text-zinc-400 pl-4">"criteria": {"{"}</div>
                <div className="text-emerald-400 pl-8 bg-emerald-500/10 py-1 rounded border-l-2 border-emerald-500">
                  <strong className="text-white">"final_response_match_v2"</strong>: {"{"} <span className="text-zinc-400 font-sans italic text-[11px]">// &lt;-- Semantic LLM-as-a-Judge evaluator on Vertex AI</span>
                </div>
                <div className="text-emerald-400 pl-12 bg-emerald-500/10 py-0.5 rounded border-l-2 border-emerald-500">
                  <strong className="text-white">"threshold": 0.7</strong> <span className="text-zinc-400 font-sans italic text-[11px]">// &lt;-- Pass criteria (0.0 to 1.0 confidence score)</span>
                </div>
                <div className="text-emerald-400 pl-8 bg-emerald-500/10 py-1 rounded border-l-2 border-emerald-500">{"}"}</div>
                <div className="text-zinc-400 pl-4">{"}"}</div>
                <div className="text-zinc-400">{"}"}</div>
              </div>
            </div>
          )}

          {/* Tangible Visual Evaluation Output */}
          {isEvalRunning ? (
            <div className="p-8 rounded-2xl border border-hairline bg-overlay/40 flex items-center justify-center gap-3 text-vibe-cyan font-mono text-xs animate-pulse">
              <RefreshCw size={18} className="animate-spin" />
              <span>Running ADK Evaluation suite ({evalMode === 'exact' ? 'Exact Match' : 'Semantic LLM-as-a-Judge'})...</span>
            </div>
          ) : evalOutput && evalMode === 'exact' ? (
            <div className="space-y-4 animate-rise">
              {/* Exact Match Failure Diagnostic Card */}
              <div className="p-5 rounded-2xl border border-amber-500/40 bg-amber-500/5 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-xs font-mono font-bold text-amber-800 dark:text-amber-300">
                    <AlertTriangle size={16} className="text-amber-600 dark:text-amber-400" />
                    <span>Exact Match String Assertion Mismatch</span>
                  </div>
                  <span className="text-[11px] font-mono px-2.5 py-0.5 rounded-full bg-red-500/15 text-red-700 dark:text-red-400 border border-red-500/30 font-bold">
                    0/1 Tests Passed (Failed)
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
                  <div className="p-3 bg-card rounded-xl border border-hairline font-mono text-xs space-y-1">
                    <span className="text-[10px] text-fg-muted uppercase tracking-wider block">Expected Golden Parameter:</span>
                    <code className="text-red-700 dark:text-red-400 block bg-red-500/10 p-2 rounded-lg border border-red-500/20">
                      "Query auction telemetry for daypart clearing floors"
                    </code>
                  </div>
                  <div className="p-3 bg-card rounded-xl border border-hairline font-mono text-xs space-y-1">
                    <span className="text-[10px] text-fg-muted uppercase tracking-wider block">Actual Agent Parameter:</span>
                    <code className="text-emerald-700 dark:text-emerald-400 block bg-emerald-500/10 p-2 rounded-lg border border-emerald-500/20">
                      "Analyze historical P90 clearing floors by daypart"
                    </code>
                  </div>
                </div>

                <p className="text-xs text-fg-muted font-sans leading-relaxed pt-1">
                  💡 <strong className="text-fg">Key Takeaway:</strong> The agent’s query was functionally identical and successfully retrieved the data, but rigid dictionary comparison broke. Generative reasoning requires semantic evaluation.
                </p>
              </div>

              {/* CLI Toggle */}
              <button
                onClick={() => setShowEvalCli(!showEvalCli)}
                className="text-xs font-mono text-fg-muted hover:text-fg flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                {showEvalCli ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                <span>{showEvalCli ? 'Hide raw CLI terminal logs' : 'View raw CLI terminal logs'}</span>
              </button>

              {showEvalCli && (
                <div className="rounded-2xl border border-hairline bg-[#0c0c14] p-5 text-xs font-mono text-zinc-300 overflow-x-auto">
                  <pre className="whitespace-pre leading-relaxed">{evalOutput}</pre>
                </div>
              )}
            </div>
          ) : evalOutput && evalMode === 'semantic' ? (
            <div className="space-y-4 animate-rise">
              {/* Semantic Judge 3-Criteria Scorecard */}
              <div className="p-5 rounded-2xl border border-emerald-500/40 bg-emerald-500/5 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-xs font-mono font-bold text-emerald-800 dark:text-emerald-300">
                    <ShieldCheck size={16} className="text-emerald-600 dark:text-emerald-400" />
                    <span>Vertex AI LLM-as-a-Judge Evaluation Scorecard</span>
                  </div>
                  <span className="text-[11px] font-mono px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-800 dark:text-emerald-300 border border-emerald-500/40 font-bold">
                    1/1 Tests Passed (Score: 0.98 / 1.00)
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="p-3.5 bg-card rounded-xl border border-hairline space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-mono font-bold uppercase text-fg-muted">Trajectory Flow</span>
                      <span className="text-xs font-mono font-bold text-emerald-600 dark:text-emerald-400">1.00 (Pass)</span>
                    </div>
                    <div className="w-full bg-overlay rounded-full h-1.5 overflow-hidden">
                      <div className="bg-emerald-500 h-full rounded-full w-full" />
                    </div>
                    <p className="text-[11px] text-fg-muted font-sans leading-tight">
                      Invoked state reader, BigQuery A2A, and deployment tools in correct logical sequence.
                    </p>
                  </div>

                  <div className="p-3.5 bg-card rounded-xl border border-hairline space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-mono font-bold uppercase text-fg-muted">Code Guardrails</span>
                      <span className="text-xs font-mono font-bold text-emerald-600 dark:text-emerald-400">1.00 (Pass)</span>
                    </div>
                    <div className="w-full bg-overlay rounded-full h-1.5 overflow-hidden">
                      <div className="bg-emerald-500 h-full rounded-full w-full" />
                    </div>
                    <p className="text-[11px] text-fg-muted font-sans leading-tight">
                      Verified strict bid clamping to <code className="text-fg font-mono">max_bid_ceiling</code> with valid AST syntax.
                    </p>
                  </div>

                  <div className="p-3.5 bg-card rounded-xl border border-hairline space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-mono font-bold uppercase text-fg-muted">Semantic Objective</span>
                      <span className="text-xs font-mono font-bold text-emerald-600 dark:text-emerald-400">0.98 (Pass)</span>
                    </div>
                    <div className="w-full bg-overlay rounded-full h-1.5 overflow-hidden">
                      <div className="bg-emerald-500 h-full rounded-full w-[98%]" />
                    </div>
                    <p className="text-[11px] text-fg-muted font-sans leading-tight">
                      Synthesized mathematical pacing formula tracking diurnal clearing distributions.
                    </p>
                  </div>
                </div>
              </div>

              {/* CLI Toggle */}
              <button
                onClick={() => setShowEvalCli(!showEvalCli)}
                className="text-xs font-mono text-fg-muted hover:text-fg flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                {showEvalCli ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                <span>{showEvalCli ? 'Hide raw CLI terminal logs' : 'View raw CLI terminal logs'}</span>
              </button>

              {showEvalCli && (
                <div className="rounded-2xl border border-hairline bg-[#0c0c14] p-5 text-xs font-mono text-zinc-300 overflow-x-auto">
                  <pre className="whitespace-pre leading-relaxed">{evalOutput}</pre>
                </div>
              )}
            </div>
          ) : null}
        </div>

        {/* ================================================================== */}
        {/* Section 2: adk optimize (GEPA)                                     */}
        {/* ================================================================== */}
        <div className="p-6 sm:p-8 bg-card rounded-3xl border border-hairline shadow-xl space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-hairline pb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-purple-500/15 border border-purple-500/30 flex items-center justify-center text-purple-600 dark:text-purple-400 shrink-0">
                <Sliders size={20} />
              </div>
              <div>
                <h3 className="text-lg font-display font-bold text-fg flex items-center gap-2">
                  <span>2.</span>
                  <code className="font-mono text-purple-600 dark:text-purple-400 bg-purple-500/10 border border-purple-500/30 px-2 py-0.5 rounded-lg text-sm">
                    adk optimize
                  </code>
                  <span>(GEPA Prompt Evolution)</span>
                </h3>
                <span className="text-xs font-mono text-fg-muted">Generative Evolutionary Prompt Adaptation & Reflection Loop</span>
              </div>
            </div>

            <button
              onClick={handleRunOptimize}
              disabled={isOptRunning}
              className={`px-5 py-2.5 font-bold text-xs rounded-xl transition-all shadow-md flex items-center gap-2 cursor-pointer border ${
                optCompleted
                  ? 'bg-purple-500/15 text-purple-700 dark:text-purple-300 border-purple-500/30'
                  : 'bg-vibe-cyan hover:bg-vibe-cyan/90 text-black border-transparent shadow-vibe-cyan/20'
              }`}
            >
              {isOptRunning ? (
                <>
                  <RefreshCw size={14} className="animate-spin text-black" />
                  <span>Evolving Instructions with GEPA...</span>
                </>
              ) : optCompleted ? (
                <>
                  <Check size={14} />
                  <span>Prompt Optimized (99.2% Score)</span>
                </>
              ) : (
                <>
                  <Sparkles size={14} />
                  <span>Run <code className="font-mono font-normal">adk optimize</code> Evolution</span>
                </>
              )}
            </button>
          </div>

          <p className="text-xs text-fg-muted leading-relaxed font-sans">
            Instead of manually guessing prompt phrasing, <strong className="text-fg">GEPA</strong> analyzes failed trajectories with a Reflection LLM, mutates the instruction text in <code className="text-fg font-mono bg-overlay px-1.5 py-0.5 rounded border border-hairline">bidding_policy_spec.md</code>, and autonomously searches the Pareto frontier for the highest-scoring candidate.
          </p>

          {/* Tangible Config Reference for GEPA Optimizer */}
          <div className="p-4 bg-card rounded-2xl border border-hairline space-y-2 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-mono font-bold text-fg flex items-center gap-1.5">
                <Sliders size={14} className="text-purple-500" />
                <span>GEPA Optimizer Configuration:</span>
                <code className="text-fg-muted font-normal">eval/optimizer_config.json</code>
              </span>
              <span className="text-[10px] font-mono text-purple-700 dark:text-purple-400 bg-purple-500/10 px-2.5 py-0.5 rounded-full border border-purple-500/30 font-bold">
                --optimizer_config_file_path
              </span>
            </div>
            <div className="rounded-xl overflow-hidden border border-hairline bg-[#0c0c14] p-3 text-xs font-mono">
              <div className="text-zinc-400">{"{"}</div>
              <div className="text-purple-300 pl-4 bg-purple-500/10 py-1 rounded border-l-2 border-purple-500">
                <strong className="text-white">"max_metric_calls": 3</strong>, <span className="text-zinc-400 font-sans italic text-[11px]">// &lt;-- Max evaluation iterations along Pareto frontier</span>
              </div>
              <div className="text-purple-300 pl-4 bg-purple-500/10 py-1 rounded border-l-2 border-purple-500">
                <strong className="text-white">"reflection_minibatch_size": 1</strong> <span className="text-zinc-400 font-sans italic text-[11px]">// &lt;-- Failed trajectories analyzed by Reflection LLM per cycle</span>
              </div>
              <div className="text-zinc-400">{"}"}</div>
            </div>
          </div>

          {/* Tangible GEPA Evolution Output */}
          {isOptRunning ? (
            <div className="p-8 rounded-2xl border border-hairline bg-overlay/40 flex items-center justify-center gap-3 text-purple-400 font-mono text-xs animate-pulse">
              <RefreshCw size={18} className="animate-spin" />
              <span>Mutating prompt candidates & evaluating reflection feedback across Pareto frontier...</span>
            </div>
          ) : optCompleted ? (
            <div className="space-y-6 animate-rise">
              {/* 3-Iteration Evolutionary Progression Cards */}
              <div className="space-y-2">
                <span className="text-xs font-mono font-bold uppercase tracking-wider text-fg-muted flex items-center gap-1.5">
                  <TrendingUp size={14} className="text-purple-500" />
                  Evolutionary Search Trajectory (3 Iterations):
                </span>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div className="p-4 bg-card rounded-2xl border border-hairline space-y-2 shadow-sm">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-mono font-bold text-fg">Iteration 1: Baseline</span>
                      <span className="text-xs font-mono font-bold text-amber-600 dark:text-amber-400">88.4%</span>
                    </div>
                    <div className="w-full bg-overlay rounded-full h-1.5 overflow-hidden">
                      <div className="bg-amber-500 h-full rounded-full w-[88.4%]" />
                    </div>
                    <p className="text-[11px] text-fg-muted font-sans leading-relaxed">
                      Reflection identified premature budget burn during late-night hours due to lack of off-peak shading instructions.
                    </p>
                  </div>

                  <div className="p-4 bg-card rounded-2xl border border-hairline space-y-2 shadow-sm">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-mono font-bold text-fg">Iteration 2: Mutator</span>
                      <span className="text-xs font-mono font-bold text-cyan-700 dark:text-vibe-cyan">94.2% (+5.8%)</span>
                    </div>
                    <div className="w-full bg-overlay rounded-full h-1.5 overflow-hidden">
                      <div className="bg-vibe-cyan h-full rounded-full w-[94.2%]" />
                    </div>
                    <p className="text-[11px] text-fg-muted font-sans leading-relaxed">
                      GEPA injected hourly pacing coefficient constraints (<code className="text-fg font-mono">budget / hours</code>) and floor guards.
                    </p>
                  </div>

                  <div className="p-4 bg-purple-500/10 rounded-2xl border border-purple-500/40 space-y-2 shadow-sm">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-mono font-bold text-purple-700 dark:text-purple-300">Iteration 3: Champion</span>
                      <span className="text-xs font-mono font-bold text-emerald-600 dark:text-emerald-400">99.2% (+10.8%)</span>
                    </div>
                    <div className="w-full bg-overlay rounded-full h-1.5 overflow-hidden">
                      <div className="bg-emerald-500 h-full rounded-full w-[99.2%]" />
                    </div>
                    <p className="text-[11px] text-fg-muted font-sans leading-relaxed">
                      Pareto optimal: Unified P90 telemetry with hours-remaining safety buffer. Zero budget starvation.
                    </p>
                  </div>
                </div>
              </div>

              {/* 100-Run Champion Banner */}
              <div className="p-4 bg-purple-500/10 rounded-2xl border border-purple-500/30 flex items-start gap-3 shadow-sm animate-rise">
                <div className="p-2 rounded-xl bg-purple-500/20 text-purple-600 dark:text-purple-300 shrink-0 mt-0.5">
                  <Sparkles size={16} />
                </div>
                <div className="space-y-1">
                  <h4 className="text-xs font-mono font-bold text-fg flex items-center gap-2">
                    <span>⚡ 100-Iteration Champion Prompt Deployed to Production</span>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 font-bold border border-emerald-500/30">
                      Default GEPA Scale
                    </span>
                  </h4>
                  <p className="text-[11px] text-fg-muted font-sans leading-relaxed">
                    For workshop velocity, this interactive test ran a fast 3-cycle sampler. However, the system has automatically persisted the <strong>100-iteration Champion Prompt</strong> (the default ADK GEPA run count) to <code className="text-fg font-mono bg-overlay px-1.5 py-0.5 rounded border border-hairline">bidding_policy_spec.md</code>. Your agent now carries full production-grade pacing, diurnal floor tracking, and mathematical guardrails.
                  </p>
                </div>
              </div>

              {/* Spec Diff: What GEPA added to bidding_policy_spec.md */}
              <div className="p-5 rounded-2xl border border-hairline bg-card shadow-md space-y-3">
                <div className="flex items-center justify-between border-b border-hairline pb-2.5">
                  <div className="flex items-center gap-2 text-xs font-mono font-bold text-fg">
                    <FileText size={15} className="text-purple-600 dark:text-purple-400" />
                    <span>Mutation: <code className="font-mono bg-overlay px-1.5 py-0.5 rounded border border-hairline text-fg">bidding_policy_spec.md</code> Diff</span>
                  </div>
                  <span className="text-[10px] font-mono text-emerald-700 dark:text-emerald-300 bg-emerald-500/15 border border-emerald-500/30 px-2 py-0.5 rounded-full font-bold">
                    +4 Rules Injected (100 Runs Converged)
                  </span>
                </div>

                <div className="rounded-xl overflow-hidden border border-hairline bg-[#0c0c14] p-4 text-xs font-mono space-y-1">
                  <div className="text-zinc-500">  # System Prompt: Evolved Optimization Principles</div>
                  <div className="text-zinc-400">  Your mission is to maximize total impressions won while utilizing 100% of budget:</div>
                  <div className="text-emerald-400 bg-emerald-500/10 px-2 py-1 rounded border-l-2 border-emerald-500">
                    + - **Dynamic Hourly Velocity:** Derive burn rate = budget_remaining / max(0.5, hours_remaining) relative to baseline velocity (total_budget / flight_duration).
                  </div>
                  <div className="text-emerald-400 bg-emerald-500/10 px-2 py-1 rounded border-l-2 border-emerald-500">
                    + - **Off-Peak Bid Shading:** During off-peak dayparts (e.g. late_night), shade bid to 0.95 * pacing_factor to conserve liquidity.
                  </div>
                  <div className="text-emerald-400 bg-emerald-500/10 px-2 py-1 rounded border-l-2 border-emerald-500">
                    + - **Primetime Peak Aggression:** In peak dayparts, allocate maximum capital (base_p90 + 0.05) * pacing_factor to capture volume.
                  </div>
                  <div className="text-emerald-400 bg-emerald-500/10 px-2 py-1 rounded border-l-2 border-emerald-500">
                    + - **Strict Floor Clamping:** Always return min(computed_bid, context.max_bid_ceiling) and maintain positive bid floor.
                  </div>
                </div>
              </div>

              {/* CLI Toggle */}
              <button
                onClick={() => setShowOptCli(!showOptCli)}
                className="text-xs font-mono text-fg-muted hover:text-fg flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                {showOptCli ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                <span>{showOptCli ? 'Hide raw GEPA optimizer logs' : 'View raw GEPA optimizer logs'}</span>
              </button>

              {showOptCli && (
                <div className="rounded-2xl border border-hairline bg-[#0c0c14] p-5 text-xs font-mono text-purple-300 overflow-x-auto">
                  <pre className="whitespace-pre leading-relaxed">{optOutput}</pre>
                </div>
              )}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

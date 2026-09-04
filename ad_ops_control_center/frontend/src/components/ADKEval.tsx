import { useState } from 'react';
import { 
  ShieldCheck, Check,
  ChevronDown, ChevronUp, ArrowRight, ArrowLeft, RefreshCw, Sparkles, FileText,
  Sliders, Info, Scale, Activity, ArrowDown
} from 'lucide-react';

export default function ADKEval({ navigate }: { navigate: (v: string) => void }) {
  const [isEvalRunning, setIsEvalRunning] = useState(false);
  const [evalOutput, setEvalOutput] = useState<string | null>(null);
  const [showEvalCli, setShowEvalCli] = useState(false);
  const [activeSpecTab, setActiveSpecTab] = useState<'raw_trace' | 'eval_set' | 'side_by_side'>('raw_trace');
  const [evalConfigView, setEvalConfigView] = useState<'active' | 'full'>('active');
  const [showHowItWorks, setShowHowItWorks] = useState(false);
  const [showEvalSetHowItWorks, setShowEvalSetHowItWorks] = useState(false);

  const handleRunEval = async () => {
    setIsEvalRunning(true);
    setEvalOutput(null);

    await new Promise(r => setTimeout(r, 1200));

    setEvalOutput(`$ adk eval . eval/adk_eval_set.json --config_file_path eval/eval_config.json

[INFO] Initializing ADK evaluation benchmark: vibetube_campaign_eval_set
[INFO] Loaded LLM-as-a-Judge configuration: eval/eval_config.json
  ├── Criteria 1: tool_trajectory_avg_score (Threshold: 1.0, Match: in_order)
  └── Criteria 2: final_response_match_v2 (Threshold: 0.70, Model: gemini-2.5-flash, Samples: 3)
[INFO] Executing trajectory for agent: bidding_policy_agent
  ├── Step 1: Tool get_campaign_info() -> Status: 200 OK
  ├── Step 2: Tool data_agent_toolset("Analyze historical P90 clearing floors by daypart") -> 200,000 auctions
  └── Step 3: Tool deploy_bidding_policy(code, summary) -> AST Validated, Deployed to production

[LLM-AS-A-JUDGE] Multi-sample evaluation across Vertex AI...
  ✓ Tool Trajectory: Pass (1.00 / 1.00) - Required tools executed in correct sequence (in_order)
  ✓ Code Guardrails: Pass (1.00 / 1.00) - AST syntax valid, ceiling clamped to max_bid_ceiling
  ✓ Semantic Match:  Pass (0.98 / 1.00) - Policy correctly implements dynamic budget pacing

*********************************************************************
Eval Run Summary
vibetube_campaign_eval_set:
  Tests passed: 1
  Tests failed: 0
*********************************************************************
Result: PASSED (Combined Benchmark Score: 0.98 / 1.00)`);

    setIsEvalRunning(false);
  };

  return (
    <div className="animate-rise pb-24 space-y-8 max-w-6xl mx-auto">
      {/* Top Header */}
      <div className="border-b border-hairline pb-5 flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-display font-bold tracking-tight text-fg flex flex-wrap items-center gap-2">
            <span>Agent Evaluation with</span>
            <code className="font-mono text-blue-600 dark:text-blue-400 bg-blue-500/15 border border-blue-500/30 px-2 py-0.5 rounded-xl text-2xl font-bold">
              adk eval
            </code>
          </h1>
          <p className="text-sm text-fg-muted mt-1">
            Evaluate agent trajectory ordering, tool usage, and semantic policy quality using Vertex AI LLM-as-a-Judge.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('judge_agent')}
            className="px-6 py-2.5 bg-vibe-cyan hover:bg-vibe-cyan/90 text-black font-bold text-xs rounded-xl transition-all shadow-md flex items-center gap-2 cursor-pointer"
          >
            <span>Proceed to Simulation Judge</span>
            <ArrowRight size={15} />
          </button>
        </div>
      </div>

      {/* Main Card: adk eval */}
      <div className="p-6 sm:p-8 bg-card rounded-3xl border border-hairline shadow-xl space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-hairline pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-500/15 border border-blue-500/30 flex items-center justify-center text-blue-600 dark:text-blue-400 shrink-0">
              <ShieldCheck size={20} />
            </div>
            <div>
              <h3 className="text-lg font-display font-bold text-fg flex items-center gap-2">
                <code className="font-mono text-blue-600 dark:text-blue-400 bg-blue-500/10 border border-blue-500/30 px-2 py-0.5 rounded-lg text-sm">
                  adk eval
                </code>
                <span>Evaluation Suite</span>
              </h3>
              <span className="text-xs font-mono text-fg-muted">Trajectory Sequence Verification & Multi-Sample LLM Evaluation</span>
            </div>
          </div>

          {activeSpecTab === 'side_by_side' || evalOutput ? (
            <button
              onClick={handleRunEval}
              disabled={isEvalRunning}
              className={`px-5 py-2.5 font-bold text-xs rounded-xl transition-all shadow-md flex items-center gap-2 cursor-pointer border ${
                evalOutput
                  ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30'
                  : 'bg-vibe-cyan hover:bg-vibe-cyan/90 text-black border-transparent shadow-vibe-cyan/20'
              }`}
            >
              {isEvalRunning ? (
                <>
                  <RefreshCw size={14} className="animate-spin text-black" />
                  <span>Evaluating Trajectory on Vertex AI...</span>
                </>
              ) : evalOutput ? (
                <>
                  <Check size={14} />
                  <span>Evaluation Passed (0.98 Score)</span>
                </>
              ) : (
                <>
                  <ShieldCheck size={14} />
                  <span>Run <code className="font-mono font-normal">adk eval</code></span>
                </>
              )}
            </button>
          ) : (
            <div className="text-xs font-mono text-fg-muted flex items-center gap-2 px-3.5 py-2 rounded-xl bg-card border border-hairline">
              <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
              <span>Step {activeSpecTab === 'raw_trace' ? '1' : '2'} of 3: Guided Setup</span>
            </div>
          )}
        </div>

        {/* Unified Evaluation Pipeline: Raw Trace -> Benchmark Scenario -> Side-by-Side Rubric */}
        <div className="p-5 bg-card rounded-2xl border border-hairline space-y-4 shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-hairline pb-3">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-blue-500/15 border border-blue-500/30 flex items-center justify-center text-blue-600 dark:text-blue-400 shrink-0">
                <Scale size={16} />
              </div>
              <div>
                <span className="text-xs font-mono font-bold text-fg block">
                  Evaluation Pipeline (3-Step Guided Workflow)
                </span>
                <span className="text-[11px] text-fg-muted font-sans block">
                  Step 1: Inspect Trace → Step 2: Extract eval_set → Step 3: Pair with eval_config.
                </span>
              </div>
            </div>

            {/* Linear Step Indicator (Non-clickable: Student must navigate sequentially) */}
            <div className="flex items-center gap-1.5 bg-overlay/60 p-1 rounded-xl border border-hairline">
              <div className={`px-2.5 py-1 rounded-lg text-xs font-mono font-bold flex items-center gap-1.5 transition-all ${
                activeSpecTab === 'raw_trace'
                  ? 'bg-amber-500 text-black shadow-sm'
                  : 'text-fg-muted opacity-50'
              }`}>
                <Activity size={12} />
                <span>1. Raw Trace</span>
              </div>
              <span className="text-fg-muted text-[10px]">→</span>
              <div className={`px-2.5 py-1 rounded-lg text-xs font-mono font-bold flex items-center gap-1.5 transition-all ${
                activeSpecTab === 'eval_set'
                  ? 'bg-cyan-500 text-black shadow-sm'
                  : 'text-fg-muted opacity-50'
              }`}>
                <FileText size={12} />
                <span>2. eval_set</span>
              </div>
              <span className="text-fg-muted text-[10px]">→</span>
              <div className={`px-2.5 py-1 rounded-lg text-xs font-mono font-bold flex items-center gap-1.5 transition-all ${
                activeSpecTab === 'side_by_side'
                  ? 'bg-blue-500 text-white shadow-sm'
                  : 'text-fg-muted opacity-50'
              }`}>
                <Scale size={12} />
                <span>3. Side-by-Side</span>
              </div>
            </div>
          </div>

          {/* TAB 1: Raw Session Recording Trace (Gory Detail) */}
          {activeSpecTab === 'raw_trace' && (
            <div className="space-y-4 animate-rise">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs font-mono text-fg-muted">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-fg">Stage 1:</span>
                  <code className="text-amber-500 dark:text-amber-400 font-normal">session_recording_trace.jsonl</code>
                  <span className="text-[11px] font-sans text-fg-muted">: Raw unedited session recording stream captured from Step 6 execution</span>
                </div>
                <span className="text-[10px] font-mono text-amber-700 dark:text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/30 font-bold self-start sm:self-auto">
                  Live Trace Captured
                </span>
              </div>

              {/* Metadata Telemetry Ribbon */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 p-3 rounded-xl bg-card border border-hairline text-xs font-mono">
                <div className="space-y-0.5">
                  <span className="text-[10px] text-fg-muted uppercase tracking-wider block">Session ID</span>
                  <span className="font-bold text-fg text-[11px]">sess_rec_9a7b21</span>
                </div>
                <div className="space-y-0.5">
                  <span className="text-[10px] text-fg-muted uppercase tracking-wider block">Agent Target</span>
                  <span className="font-bold text-cyan-500 dark:text-cyan-400 text-[11px]">bidding_policy_agent</span>
                </div>
                <div className="space-y-0.5">
                  <span className="text-[10px] text-fg-muted uppercase tracking-wider block">Model & Latency</span>
                  <span className="font-bold text-fg text-[11px]">gemini-2.5-flash (7,240 ms)</span>
                </div>
                <div className="space-y-0.5">
                  <span className="text-[10px] text-fg-muted uppercase tracking-wider block">Total Tokens</span>
                  <span className="font-bold text-emerald-600 dark:text-emerald-400 text-[11px]">1,420 in / 580 out</span>
                </div>
              </div>

              {/* Raw Event Stream Viewer (The Gory Detail) */}
              <div className="rounded-xl overflow-hidden border border-hairline bg-[#0c0c14] p-4 text-xs font-mono leading-relaxed space-y-3 max-h-[520px] overflow-y-auto">
                <div className="text-zinc-500 font-sans italic text-[11px] pb-1 flex items-center justify-between border-b border-zinc-800">
                  <span>// ADK 2.0 Session Trace Stream (Chronological Order with Timestamps & Ephemeral Metrics)</span>
                  <span className="text-[10px] text-amber-400 font-mono">9 Chronological Events Captured</span>
                </div>

                {/* Event 1: USER_INPUT */}
                <div className="p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/30 space-y-1">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-amber-400 font-bold flex items-center gap-2">
                      <span className="px-1.5 py-0.2 rounded bg-amber-500/20 text-[10px]">EVENT 1</span>
                      <span>USER_INPUT</span>
                    </span>
                    <span className="text-zinc-400 text-[10px]">T+00:00.000 (0ms)</span>
                  </div>
                  <div className="text-zinc-300 text-[11px] pl-2">
                    <span className="text-zinc-500">"text":</span> <span className="text-amber-200">"Retrieve active campaign info, analyze auction telemetry across dayparts, and deploy compute_bid policy."</span>
                  </div>
                </div>

                {/* Event 2: MODEL_THINKING */}
                <div className="p-2.5 rounded-lg bg-purple-500/10 border border-purple-500/30 space-y-1">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-purple-400 font-bold flex items-center gap-2">
                      <span className="px-1.5 py-0.2 rounded bg-purple-500/20 text-[10px]">EVENT 2</span>
                      <span>MODEL_THINKING (Chain of Thought)</span>
                    </span>
                    <span className="text-zinc-400 text-[10px]">T+00:00.820 (820ms, 94 tokens)</span>
                  </div>
                  <div className="text-purple-200 text-[11px] pl-2 italic">
                    "Goal: inspect campaign constraints (budget, ceiling) -&gt; query BigQuery Data Agent for daypart clearing floors -&gt; formulate dynamic compute_bid formula -&gt; deploy via deploy_bidding_policy. Next action: call get_campaign_info()."
                  </div>
                </div>

                {/* Event 3: TOOL_INVOCATION (get_campaign_info) */}
                <div className="p-2.5 rounded-lg bg-cyan-500/10 border border-cyan-500/30 space-y-1">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-cyan-400 font-bold flex items-center gap-2">
                      <span className="px-1.5 py-0.2 rounded bg-cyan-500/20 text-[10px]">EVENT 3</span>
                      <span>TOOL_INVOCATION</span>
                    </span>
                    <span className="text-zinc-400 text-[10px]">T+00:01.450 (630ms) | call_id: call_camp_01</span>
                  </div>
                  <div className="text-cyan-200 text-[11px] pl-2">
                    <span className="text-zinc-400">tool:</span> <span className="text-cyan-300 font-bold">get_campaign_info</span>, <span className="text-zinc-400">args:</span> <span className="text-zinc-300">{"{}"}</span>
                  </div>
                </div>

                {/* Event 4: TOOL_RESPONSE (get_campaign_info) */}
                <div className="p-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/30 space-y-1">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-emerald-400 font-bold flex items-center gap-2">
                      <span className="px-1.5 py-0.2 rounded bg-emerald-500/20 text-[10px]">EVENT 4</span>
                      <span>TOOL_RESPONSE</span>
                    </span>
                    <span className="text-zinc-400 text-[10px]">T+00:01.890 (440ms) | Status: 200 OK</span>
                  </div>
                  <div className="text-emerald-200 text-[11px] pl-2 font-mono">
                    {"{ \"daily_budget\": 2500.0, \"max_bid_ceiling\": 10.0, \"currency\": \"USD\", \"active_dayparts\": [\"morning\", \"afternoon\", \"primetime\", \"late_night\"] }"}
                  </div>
                </div>

                {/* Event 5: TOOL_INVOCATION (data_agent_toolset) */}
                <div className="p-2.5 rounded-lg bg-cyan-500/10 border border-cyan-500/30 space-y-1">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-cyan-400 font-bold flex items-center gap-2">
                      <span className="px-1.5 py-0.2 rounded bg-cyan-500/20 text-[10px]">EVENT 5</span>
                      <span>TOOL_INVOCATION</span>
                    </span>
                    <span className="text-zinc-400 text-[10px]">T+00:02.310 (420ms) | call_id: call_bq_02</span>
                  </div>
                  <div className="text-cyan-200 text-[11px] pl-2">
                    <span className="text-zinc-400">tool:</span> <span className="text-cyan-300 font-bold">data_agent_toolset</span>, <span className="text-zinc-400">args:</span> <span className="text-emerald-300">{"{ \"question\": \"What are historical P90 clearing floor prices and win rates by daypart?\" }"}</span>
                  </div>
                </div>

                {/* Event 6: TOOL_RESPONSE (data_agent_toolset) */}
                <div className="p-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/30 space-y-1">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-emerald-400 font-bold flex items-center gap-2">
                      <span className="px-1.5 py-0.2 rounded bg-emerald-500/20 text-[10px]">EVENT 6</span>
                      <span>TOOL_RESPONSE (BigQuery Analytics Agent)</span>
                    </span>
                    <span className="text-zinc-400 text-[10px]">T+00:04.820 (2,510ms) | Rows: 600,000</span>
                  </div>
                  <div className="text-emerald-200 text-[11px] pl-2 font-mono">
                    {"{ \"p90_floors\": { \"morning\": 1.20, \"afternoon\": 2.10, \"primetime\": 9.60, \"late_night\": 0.85 }, \"win_rates\": { \"morning\": 0.42, \"afternoon\": 0.38, \"primetime\": 0.29, \"late_night\": 0.65 } }"}
                  </div>
                </div>

                {/* Event 7: TOOL_INVOCATION (deploy_bidding_policy) */}
                <div className="p-2.5 rounded-lg bg-cyan-500/10 border border-cyan-500/30 space-y-1">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-cyan-400 font-bold flex items-center gap-2">
                      <span className="px-1.5 py-0.2 rounded bg-cyan-500/20 text-[10px]">EVENT 7</span>
                      <span>TOOL_INVOCATION</span>
                    </span>
                    <span className="text-zinc-400 text-[10px]">T+00:05.400 (580ms) | call_id: call_actuator_03</span>
                  </div>
                  <div className="text-cyan-200 text-[11px] pl-2 space-y-0.5">
                    <div><span className="text-zinc-400">tool:</span> <span className="text-cyan-300 font-bold">deploy_bidding_policy</span></div>
                    <div><span className="text-zinc-400">args.python_code:</span> <span className="text-zinc-300">"def compute_bid(context: AuctionContext) -&gt; float:\n    # Dynamic P90 pacing policy with ceiling clamping\n    ..."</span></div>
                    <div><span className="text-zinc-400">args.strategy_summary:</span> <span className="text-zinc-300">"Adaptive daypart shading with P90 ceiling clamping"</span></div>
                  </div>
                </div>

                {/* Event 8: TOOL_RESPONSE (deploy_bidding_policy) */}
                <div className="p-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/30 space-y-1">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-emerald-400 font-bold flex items-center gap-2">
                      <span className="px-1.5 py-0.2 rounded bg-emerald-500/20 text-[10px]">EVENT 8</span>
                      <span>TOOL_RESPONSE</span>
                    </span>
                    <span className="text-zinc-400 text-[10px]">T+00:06.150 (750ms) | AST Validated</span>
                  </div>
                  <div className="text-emerald-200 text-[11px] pl-2 font-mono">
                    {"{ \"status\": \"deployed\", \"path\": \"policies/agent_bidding_policy.py\", \"ast_valid\": true, \"clamped_to_ceiling\": true }"}
                  </div>
                </div>

                {/* Event 9: MODEL_RESPONSE */}
                <div className="p-2.5 rounded-lg bg-blue-500/10 border border-blue-500/30 space-y-1">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-blue-400 font-bold flex items-center gap-2">
                      <span className="px-1.5 py-0.2 rounded bg-blue-500/20 text-[10px]">EVENT 9</span>
                      <span>MODEL_RESPONSE (Final Completion)</span>
                    </span>
                    <span className="text-zinc-400 text-[10px]">T+00:07.240 (1,090ms, 580 tokens)</span>
                  </div>
                  <div className="text-blue-200 text-[11px] pl-2">
                    "Successfully analyzed auction telemetry and deployed production bidding policy to policies/agent_bidding_policy.py with $10.00 ceiling protection."
                  </div>
                </div>
              </div>

              {/* The Narrative Bridge Callout */}
              <div className="p-4 rounded-2xl border border-amber-500/30 bg-amber-500/5 space-y-3">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-2 text-xs font-mono font-bold text-amber-600 dark:text-amber-400">
                    <Info size={16} />
                    <span>Look, this is what gets produced by recording the execution.</span>
                  </div>
                  <span className="text-[10px] font-mono text-zinc-400">Transient noise vs Durable contracts</span>
                </div>
                <p className="text-xs text-fg-muted leading-relaxed font-sans">
                  This unedited trace captures timestamps, fluctuating millisecond latencies (such as 2,510ms for BigQuery), token usage counters, and internal model reasoning. If you tested against this raw noise directly, tests would fail on every run due to minor latency jitter. Instead, ADK strips out the noise and extracts only the durable contracts into <code className="font-mono text-fg font-bold">eval/adk_eval_set.json</code>.
                </p>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1 border-t border-hairline">
                  <span className="text-[11px] font-mono text-fg-muted">
                    CLI Equivalent: <code className="text-cyan-600 dark:text-cyan-400 font-bold">adk eval create-eval-set --trace session_trace.jsonl --output eval/adk_eval_set.json</code>
                  </span>
                  <button
                    type="button"
                    onClick={() => setActiveSpecTab('eval_set')}
                    className="px-4 py-2 bg-cyan-500 hover:bg-cyan-400 text-black font-bold text-xs rounded-xl transition-all shadow-md flex items-center gap-2 cursor-pointer font-mono shrink-0"
                  >
                    <span>Serialize Trace to eval_set.json (adk eval create-eval-set)</span>
                    <ArrowRight size={14} />
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: Extracted Benchmark (eval/adk_eval_set.json) */}
          {activeSpecTab === 'eval_set' && (
            <div className="space-y-4 animate-rise">
              <div className="flex items-center justify-between text-xs font-mono text-fg-muted">
                <span className="flex items-center gap-2">
                  <span className="font-bold text-fg">Stage 2:</span>
                  <code className="text-cyan-600 dark:text-cyan-400 font-normal">eval/adk_eval_set.json</code>
                  <span className="text-[11px] font-sans text-fg-muted">: Ground-truth benchmark scenario and expected tool sequence</span>
                </span>
                <span className="text-[10px] font-mono text-cyan-700 dark:text-cyan-400 bg-cyan-500/10 px-2 py-0.5 rounded-full border border-cyan-500/30 font-bold hidden md:inline">
                  eval_set_path
                </span>
              </div>

              {/* Extraction & Serialization Bridge Banner */}
              <div className="p-4 rounded-xl border border-cyan-500/30 bg-cyan-500/5 space-y-3">
                <div className="flex items-center gap-2 text-xs font-mono font-bold text-cyan-600 dark:text-cyan-400">
                  <ArrowDown size={15} />
                  <span>The Extraction Bridge: How the Raw Trace Becomes eval_set.json</span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs font-sans">
                  <div className="p-3 rounded-lg bg-card border border-hairline space-y-1">
                    <span className="font-mono font-bold text-red-500 dark:text-red-400 text-[11px] block">
                      1. Stripped Out (Transient Runtime Noise)
                    </span>
                    <ul className="text-[11px] text-fg-muted space-y-0.5 list-disc list-inside">
                      <li>Millisecond timestamps and clock drift (<code className="font-mono text-fg text-[10px]">T+00:04.820</code>)</li>
                      <li>Fluctuating network and BigQuery execution latency (<code className="font-mono text-fg text-[10px]">2,510ms</code>)</li>
                      <li>Token usage counters (<code className="font-mono text-fg text-[10px]">1,420 in / 580 out</code>)</li>
                      <li>Ephemeral chain of thought reasoning scratchpads</li>
                    </ul>
                  </div>
                  <div className="p-3 rounded-lg bg-card border border-hairline space-y-1">
                    <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400 text-[11px] block">
                      2. Preserved (Durable Evaluation Contracts)
                    </span>
                    <ul className="text-[11px] text-fg-muted space-y-0.5 list-disc list-inside">
                      <li><strong className="text-fg">Directive:</strong> Raw user prompt mapped to <code className="font-mono text-amber-500 text-[10px]">user_content</code></li>
                      <li><strong className="text-fg">Trajectory:</strong> Tool invocations mapped to <code className="font-mono text-cyan-500 text-[10px]">invocation_events</code></li>
                      <li><strong className="text-fg">Outcome:</strong> Completion payload mapped to <code className="font-mono text-emerald-500 text-[10px]">final_response</code></li>
                    </ul>
                  </div>
                </div>
              </div>

              {/* Syntax Highlighted JSON Viewer for adk_eval_set.json */}
              <div className="rounded-xl overflow-hidden border border-hairline bg-[#0c0c14] p-4 text-xs font-mono leading-relaxed space-y-1">
                <div className="text-zinc-500 font-sans italic text-[11px] pb-1">// eval/adk_eval_set.json (Golden Benchmark Scenario & Reference Trajectory)</div>
                <div className="text-zinc-400">{"{"}</div>
                <div className="text-zinc-300 pl-4">
                  <span className="text-white font-bold">"eval_set_id"</span>: <span className="text-cyan-300">"vibetube_campaign_eval_set"</span>,
                </div>
                <div className="text-zinc-400 pl-4">"eval_cases": [{"{"}</div>
                
                {/* Part 1: user_content */}
                <div className="text-amber-400 pl-8 bg-amber-500/10 py-1.5 px-2 rounded border-l-2 border-amber-500 my-1">
                  <span className="text-white font-bold">"user_content"</span>: {"{"}
                  <div className="text-amber-300 pl-4">
                    <span className="text-white">"text"</span>: <span className="text-amber-200">"Retrieve active campaign info, analyze auction telemetry across dayparts, and deploy compute_bid policy."</span>
                  </div>
                  <div>{"},"}</div>
                </div>

                {/* Part 2: intermediate_data.invocation_events */}
                <div className="text-cyan-400 pl-8 bg-cyan-500/10 py-1.5 px-2 rounded border-l-2 border-cyan-500 my-1">
                  <span className="text-white font-bold">"intermediate_data"</span>: {"{"}
                  <div className="text-cyan-300 pl-4">
                    <span className="text-white font-bold">"invocation_events"</span>: [ <span className="text-zinc-400 font-sans italic text-[11px]">// Golden Reference Trajectory evaluated by tool_trajectory_avg_score</span>
                    <div className="pl-4 text-zinc-300 py-0.5">
                      1. {"{"} <span className="text-cyan-300">"name"</span>: <span className="text-emerald-400">"get_campaign_info"</span>, <span className="text-zinc-400">"args"</span>: {"{}"} {"},"}
                    </div>
                    <div className="pl-4 text-zinc-300 py-0.5">
                      2. {"{"} <span className="text-cyan-300">"name"</span>: <span className="text-emerald-400">"query_bigquery_agent"</span>, <span className="text-zinc-400">"args"</span>: {"{"} <span className="text-zinc-400">"question"</span>: <span className="text-emerald-300">"historical P90..."</span> {"}"} {"},"}
                    </div>
                    <div className="pl-4 text-zinc-300 py-0.5">
                      3. {"{"} <span className="text-cyan-300">"name"</span>: <span className="text-emerald-400">"deploy_bidding_policy"</span>, <span className="text-zinc-400">"args"</span>: {"{"} <span className="text-zinc-400">"python_code"</span>: <span className="text-emerald-300">"..."</span>, <span className="text-zinc-400">"strategy_summary"</span>: <span className="text-emerald-300">"..."</span> {"}"} {"}"}
                    </div>
                    ]
                  </div>
                  <div>{"},"}</div>
                </div>

                {/* Part 3: final_response */}
                <div className="text-emerald-400 pl-8 bg-emerald-500/10 py-1.5 px-2 rounded border-l-2 border-emerald-500 my-1">
                  <span className="text-white font-bold">"final_response"</span>: {"{"}
                  <div className="text-emerald-300 pl-4">
                    <span className="text-white">"text"</span>: <span className="text-emerald-200">"Successfully deployed bidding policy to agent_bidding_policy.py."</span> <span className="text-zinc-400 font-sans italic text-[11px]">// Evaluated by final_response_match_v2</span>
                  </div>
                  <div>{"}"}</div>
                </div>

                <div className="text-zinc-400 pl-4">{"}]"}</div>
                <div className="text-zinc-400">{"}"}</div>
              </div>

              {/* 4-Part Component Breakdown Cards for adk_eval_set.json */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-1">
                <div className="p-3.5 bg-card rounded-xl border border-hairline space-y-1.5 shadow-sm">
                  <div className="flex items-center gap-1.5 text-xs font-mono font-bold text-blue-500 dark:text-blue-400">
                    <span className="w-2 h-2 rounded-full bg-blue-400" />
                    <span>1. Suite & Case Taxonomy</span>
                  </div>
                  <p className="text-[11px] text-fg-muted font-sans leading-relaxed">
                    <code className="text-fg font-mono">eval_set_id</code> and <code className="text-fg font-mono">eval_cases</code> group version-controlled test scenarios across automated CI/CD and regression runs.
                  </p>
                </div>

                <div className="p-3.5 bg-card rounded-xl border border-hairline space-y-1.5 shadow-sm">
                  <div className="flex items-center gap-1.5 text-xs font-mono font-bold text-amber-500 dark:text-amber-400">
                    <span className="w-2 h-2 rounded-full bg-amber-400" />
                    <span>2. Benchmark Directive</span>
                  </div>
                  <p className="text-[11px] text-fg-muted font-sans leading-relaxed">
                    <code className="text-fg font-mono">user_content</code> defines the exact business directive submitted to the agent during evaluation to kick off the decision cycle.
                  </p>
                </div>

                <div className="p-3.5 bg-card rounded-xl border border-hairline space-y-1.5 shadow-sm">
                  <div className="flex items-center gap-1.5 text-xs font-mono font-bold text-cyan-500 dark:text-cyan-400">
                    <span className="w-2 h-2 rounded-full bg-cyan-400" />
                    <span>3. Golden Trajectory</span>
                  </div>
                  <p className="text-[11px] text-fg-muted font-sans leading-relaxed">
                    <code className="text-fg font-mono">invocation_events</code> records the reference tool invocation sequence evaluated by <code className="text-fg font-mono">tool_trajectory_avg_score</code> with <code className="text-fg font-mono">in_order</code> matching.
                  </p>
                </div>

                <div className="p-3.5 bg-card rounded-xl border border-hairline space-y-1.5 shadow-sm">
                  <div className="flex items-center gap-1.5 text-xs font-mono font-bold text-emerald-600 dark:text-emerald-400">
                    <span className="w-2 h-2 rounded-full bg-emerald-400" />
                    <span>4. Reference Outcome</span>
                  </div>
                  <p className="text-[11px] text-fg-muted font-sans leading-relaxed">
                    <code className="text-fg font-mono">final_response</code> establishes the expected completion payload scored by the Vertex AI LLM-as-a-Judge against safety & mathematical criteria.
                  </p>
                </div>
              </div>

              {/* Collapsible Deep Dive: How eval_set.json is Authored & Maintained in Practice */}
              <div className="border-t border-hairline pt-3">
                <button
                  type="button"
                  onClick={() => setShowEvalSetHowItWorks(!showEvalSetHowItWorks)}
                  className="text-xs font-mono text-cyan-600 dark:text-cyan-400 hover:text-cyan-500 flex items-center justify-between w-full p-2.5 rounded-xl bg-cyan-500/5 hover:bg-cyan-500/10 border border-cyan-500/20 transition-all cursor-pointer"
                >
                  <div className="flex items-center gap-2">
                    <Info size={14} className="text-cyan-500" />
                    <span className="font-bold">Deep Dive: How is eval_set.json Authored & Maintained in Practice?</span>
                    <span className="text-[10px] text-fg-muted font-sans hidden md:inline">: Trace Recording vs Synthetic vs Declarative SDK</span>
                  </div>
                  {showEvalSetHowItWorks ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                </button>

                {showEvalSetHowItWorks && (
                  <div className="mt-3 p-4 bg-[#0c0c14] rounded-xl border border-hairline space-y-4 text-xs font-sans text-fg-muted leading-relaxed">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      <div className="p-3 bg-card/60 rounded-lg border border-hairline space-y-1.5">
                        <span className="text-xs font-mono font-bold text-fg flex items-center gap-1.5">
                          <span className="w-1.5 h-1.5 rounded-full bg-cyan-400" />
                          1. Trace Recording (~70%)
                        </span>
                        <p className="text-[11px] text-fg-muted leading-relaxed">
                          Engineers do <strong className="text-fg">not</strong> write nested trajectory JSON manually. Developers interact with the agent in staging or Cloud Shell; ADK intercepts and serializes the complete session (prompts, tool calls, parameters, responses). Successful runs are vetted and tagged as golden benchmarks.
                        </p>
                      </div>

                      <div className="p-3 bg-card/60 rounded-lg border border-hairline space-y-1.5">
                        <span className="text-xs font-mono font-bold text-fg flex items-center gap-1.5">
                          <span className="w-1.5 h-1.5 rounded-full bg-purple-400" />
                          2. Synthetic Generation (~20%)
                        </span>
                        <p className="text-[11px] text-fg-muted leading-relaxed">
                          High-reasoning models (like Gemini 2.5 Pro) are provided with the Pydantic schema of <code className="font-mono text-fg text-[10px]">EvalSet</code> to synthetically generate edge cases: sudden auction price spikes, API timeout handling, and out-of-budget boundary tests.
                        </p>
                      </div>

                      <div className="p-3 bg-card/60 rounded-lg border border-hairline space-y-1.5">
                        <span className="text-xs font-mono font-bold text-fg flex items-center gap-1.5">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                          3. Declarative Python SDK (~10%)
                        </span>
                        <p className="text-[11px] text-fg-muted leading-relaxed">
                          In automated CI/CD pipelines, engineers construct test cases using typed Python classes (<code className="font-mono text-fg text-[10px]">EvalCase</code>, <code className="font-mono text-fg text-[10px]">InvocationEvent</code>). The SDK handles validation, schema formatting, and JSON serialization.
                        </p>
                      </div>
                    </div>

                    <div className="p-2.5 rounded-lg bg-overlay/50 border border-hairline flex items-center justify-between flex-wrap gap-2 text-[11px]">
                      <span className="font-mono text-fg">
                        <strong>Team Ownership:</strong> Product Managers own business directives (<code className="text-amber-400 font-mono">user_content</code>) & semantic criteria; Data & ML Engineers own tool routing contracts (<code className="text-cyan-400 font-mono">invocation_events</code>) & AST security rules.
                      </span>
                    </div>
                  </div>
                )}
              </div>

              {/* Navigation Actions */}
              <div className="flex items-center justify-between pt-1 flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setActiveSpecTab('raw_trace')}
                  className="px-3.5 py-2 text-fg-muted hover:text-fg text-xs font-mono transition-colors flex items-center gap-1.5 cursor-pointer"
                >
                  <ArrowLeft size={13} />
                  <span>Back to Raw Trace</span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveSpecTab('side_by_side')}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs rounded-xl transition-all shadow-md flex items-center gap-2 cursor-pointer font-mono"
                >
                  <span>Compare Side-by-Side with eval_config.json</span>
                  <ArrowRight size={14} />
                </button>
              </div>
            </div>
          )}

          {/* TAB 3: Side-by-Side Specification Pairing (eval_set + eval_config) */}
          {activeSpecTab === 'side_by_side' && (
            <div className="space-y-4 animate-rise">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs font-mono text-fg-muted">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-fg">Stage 3:</span>
                  <span>Side-by-Side Specification Pairing</span>
                  <span className="text-[11px] font-sans text-fg-muted">: How the Grading Rubric supports and evaluates the Benchmark</span>
                </div>

                {/* Switcher for Config Rules */}
                <div className="flex items-center gap-1 bg-overlay p-0.5 rounded-xl border border-hairline">
                  <button
                    type="button"
                    onClick={() => setEvalConfigView('active')}
                    className={`px-2.5 py-1 rounded-lg text-xs font-mono font-bold transition-all cursor-pointer ${
                      evalConfigView === 'active'
                        ? 'bg-blue-500 text-white shadow-sm'
                        : 'text-fg-muted hover:text-fg'
                    }`}
                  >
                    Active Lab Rules
                  </button>
                  <button
                    type="button"
                    onClick={() => setEvalConfigView('full')}
                    className={`px-2.5 py-1 rounded-lg text-xs font-mono font-bold transition-all cursor-pointer flex items-center gap-1 ${
                      evalConfigView === 'full'
                        ? 'bg-blue-500 text-white shadow-sm'
                        : 'text-fg-muted hover:text-fg'
                    }`}
                  >
                    <span>Full Schema (Expand)</span>
                    <Sliders size={12} />
                  </button>
                </div>
              </div>

              {/* Side-by-Side 2-Column Grid */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
                {/* Column 1: Test Scenario (eval/adk_eval_set.json) */}
                <div className="space-y-2 p-4 rounded-xl bg-card border border-hairline shadow-sm">
                  <div className="flex items-center justify-between pb-1 border-b border-hairline">
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-cyan-400" />
                      <span className="text-xs font-mono font-bold text-fg">1. Benchmark Scenario</span>
                    </div>
                    <code className="text-[10px] font-mono text-cyan-600 dark:text-cyan-400 bg-cyan-500/10 px-2 py-0.5 rounded border border-cyan-500/20">
                      eval/adk_eval_set.json
                    </code>
                  </div>
                  <p className="text-[11px] text-fg-muted font-sans">
                    Defines <strong>WHAT</strong> is tested: input prompt, expected tools, and target outcome.
                  </p>

                  <div className="rounded-xl overflow-hidden border border-hairline bg-[#0c0c14] p-3 text-[11px] font-mono leading-relaxed space-y-1 max-h-[380px] overflow-y-auto">
                    <div className="text-zinc-500 text-[10px] pb-1">// The Test Scenario Data</div>
                    <div className="text-zinc-400">{"{"}</div>
                    <div className="text-zinc-300 pl-2">
                      <span className="text-white font-bold">"eval_set_id"</span>: <span className="text-cyan-300">"vibetube_campaign_eval_set"</span>,
                    </div>
                    <div className="text-zinc-400 pl-2">"eval_cases": [{"{"}</div>
                    
                    {/* user_content */}
                    <div className="text-amber-400 pl-4 bg-amber-500/10 py-1 px-2 rounded border-l-2 border-amber-500 my-1">
                      <span className="text-white font-bold">"user_content"</span>: {"{"}
                      <div className="text-amber-200 pl-2 text-[10px]">
                        "text": "Retrieve active campaign info, analyze auction telemetry across dayparts, and deploy compute_bid policy."
                      </div>
                      <div>{"},"}</div>
                    </div>

                    {/* invocation_events (linked to trajectory) */}
                    <div className="text-cyan-400 pl-4 bg-cyan-500/10 py-1 px-2 rounded border-l-2 border-cyan-500 my-1">
                      <div className="flex items-center justify-between">
                        <span className="text-white font-bold">"invocation_events"</span>: [
                        <span className="text-[9px] text-cyan-300 font-mono font-bold bg-cyan-500/20 px-1.5 py-0.2 rounded">Graded by Criteria 1</span>
                      </div>
                      <div className="pl-2 text-zinc-300 py-0.5 text-[10px]">
                        1. <span className="text-cyan-300">"get_campaign_info"</span> {"{}"}
                      </div>
                      <div className="pl-2 text-zinc-300 py-0.5 text-[10px]">
                        2. <span className="text-cyan-300">"query_bigquery_agent"</span> {"{ \"question\": \"...\" }"}
                      </div>
                      <div className="pl-2 text-zinc-300 py-0.5 text-[10px]">
                        3. <span className="text-cyan-300">"deploy_bidding_policy"</span> {"{ \"code\": \"...\" }"}
                      </div>
                      <div>{"],"}</div>
                    </div>

                    {/* final_response (linked to semantic judge) */}
                    <div className="text-emerald-400 pl-4 bg-emerald-500/10 py-1 px-2 rounded border-l-2 border-emerald-500 my-1">
                      <div className="flex items-center justify-between">
                        <span className="text-white font-bold">"final_response"</span>: {"{"}
                        <span className="text-[9px] text-emerald-300 font-mono font-bold bg-emerald-500/20 px-1.5 py-0.2 rounded">Graded by Criteria 2</span>
                      </div>
                      <div className="text-emerald-200 pl-2 text-[10px]">
                        "text": "Successfully deployed bidding policy to agent_bidding_policy.py."
                      </div>
                      <div>{"}"}</div>
                    </div>

                    <div className="text-zinc-400 pl-2">{"}]"}</div>
                    <div className="text-zinc-400">{"}"}</div>
                  </div>
                </div>

                {/* Column 2: Grading Rubric (eval/eval_config.json) */}
                <div className="space-y-2 p-4 rounded-xl bg-card border border-hairline shadow-sm">
                  <div className="flex items-center justify-between pb-1 border-b border-hairline">
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-blue-500" />
                      <span className="text-xs font-mono font-bold text-fg">2. Grading Rubric</span>
                    </div>
                    <code className="text-[10px] font-mono text-blue-600 dark:text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded border border-blue-500/20">
                      eval/eval_config.json
                    </code>
                  </div>
                  <p className="text-[11px] text-fg-muted font-sans">
                    Defines <strong>HOW</strong> it is graded: trajectory rules, thresholds, and judge models.
                  </p>

                  <div className="rounded-xl overflow-hidden border border-hairline bg-[#0c0c14] p-3 text-[11px] font-mono leading-relaxed space-y-1 max-h-[380px] overflow-y-auto">
                    <div className="text-zinc-500 text-[10px] pb-1">// The Teacher's Grading Rubric</div>
                    {evalConfigView === 'active' ? (
                      <div>
                        <div className="text-zinc-400">{"{"}</div>
                        <div className="text-zinc-400 pl-2">"criteria": {"{"}</div>

                        {/* Criteria 1 */}
                        <div className="text-cyan-400 pl-4 bg-cyan-500/10 py-1 px-2 rounded border-l-2 border-cyan-500 my-1">
                          <div className="flex items-center justify-between">
                            <span className="text-white font-bold">"tool_trajectory_avg_score"</span>: {"{"}
                            <span className="text-[9px] text-cyan-300 font-mono font-bold bg-cyan-500/20 px-1.5 py-0.2 rounded">Inspects invocation_events</span>
                          </div>
                          <div className="text-cyan-300 pl-2 text-[10px]">
                            "threshold": <span className="text-white font-bold">1.0</span>,
                          </div>
                          <div className="text-cyan-300 pl-2 text-[10px]">
                            "match_type": <span className="text-emerald-400 font-bold">"in_order"</span>
                          </div>
                          <div>{"},"}</div>
                        </div>

                        {/* Criteria 2 */}
                        <div className="text-emerald-400 pl-4 bg-emerald-500/10 py-1 px-2 rounded border-l-2 border-emerald-500 my-1">
                          <div className="flex items-center justify-between">
                            <span className="text-white font-bold">"final_response_match_v2"</span>: {"{"}
                            <span className="text-[9px] text-emerald-300 font-mono font-bold bg-emerald-500/20 px-1.5 py-0.2 rounded">Inspects final_response</span>
                          </div>
                          <div className="text-emerald-300 pl-2 text-[10px]">
                            "threshold": <span className="text-white font-bold">0.7</span>,
                          </div>
                          <div className="text-emerald-300 pl-2 text-[10px]">
                            "judge_model_options": {"{ \"judge_model\": \"gemini-2.5-flash\", \"num_samples\": 3 }"}
                          </div>
                          <div>{"}"}</div>
                        </div>

                        <div className="text-zinc-400 pl-2">{"}"}</div>
                        <div className="text-zinc-400">{"}"}</div>
                      </div>
                    ) : (
                      <div className="space-y-1">
                        <div className="text-zinc-400">{"{"}</div>
                        <div className="text-zinc-400 pl-2">"criteria": {"{"}</div>
                        <div className="text-cyan-300 pl-4 text-[10px]">"tool_trajectory_avg_score": {"{ \"threshold\": 1.0, \"match_type\": \"in_order\" },"}</div>
                        <div className="text-emerald-300 pl-4 text-[10px]">"final_response_match_v2": {"{ \"threshold\": 0.7, \"num_samples\": 3 },"}</div>
                        <div className="text-amber-300 pl-4 text-[10px]">"validate_bidding_ast": {"{ \"threshold\": 1.0 }"}</div>
                        <div className="text-zinc-400 pl-2">{"},"}</div>
                        <div className="text-amber-400 pl-2 bg-amber-500/10 p-1.5 rounded border-l-2 border-amber-500">
                          <span className="text-white font-bold">"custom_metrics"</span>: {"{"}
                          <div className="text-amber-200 pl-2 text-[10px]">
                            "validate_bidding_ast": {"{ \"code_config\": { \"name\": \"validators.validate_policy\" } }"}
                          </div>
                          <div>{"}"}</div>
                        </div>
                        <div className="text-zinc-400">{"}"}</div>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Explainer Banner: How Config Supports & Grades Eval Set */}
              <div className="p-4 rounded-xl border border-blue-500/30 bg-blue-500/5 space-y-2 text-xs font-sans">
                <div className="flex items-center gap-2 font-mono font-bold text-blue-600 dark:text-blue-400">
                  <Scale size={15} />
                  <span>How eval_config.json Directly Supports and Grades eval_set.json</span>
                </div>
                <p className="text-[11px] text-fg-muted leading-relaxed">
                  Notice the decoupled contract: <code className="font-mono text-fg">eval_set.json</code> defines the <strong>ground-truth facts</strong> of the run (directive, tools, output), while <code className="font-mono text-fg">eval_config.json</code> provides the <strong>grading instruments</strong>. This means you can update benchmark scenarios without modifying grading rules, and you can tune evaluation strictness (e.g. tightening threshold from 0.70 to 0.85) without re-recording agent sessions.
                </p>
              </div>

              {/* 3-Part Component Breakdown Cards */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-1">
                <div className="p-3.5 bg-card rounded-xl border border-hairline space-y-1.5 shadow-sm">
                  <div className="flex items-center gap-1.5 text-xs font-mono font-bold text-cyan-500 dark:text-cyan-400">
                    <span className="w-2 h-2 rounded-full bg-cyan-400" />
                    <span>1. Trajectory Ordering</span>
                  </div>
                  <p className="text-[11px] text-fg-muted font-sans leading-relaxed">
                    <code className="text-fg font-mono">match_type: "in_order"</code> guarantees the agent calls discovery, BigQuery, and deployment in logical order, while granting freedom to run extra telemetry queries without failing.
                  </p>
                </div>

                <div className="p-3.5 bg-card rounded-xl border border-hairline space-y-1.5 shadow-sm">
                  <div className="flex items-center gap-1.5 text-xs font-mono font-bold text-emerald-600 dark:text-emerald-400">
                    <span className="w-2 h-2 rounded-full bg-emerald-400" />
                    <span>2. Semantic Scoring</span>
                  </div>
                  <p className="text-[11px] text-fg-muted font-sans leading-relaxed">
                    <code className="text-fg font-mono">threshold: 0.7</code> evaluates mathematical formulation, AST code syntax, and pacing logic semantically rather than demanding rigid verbatim text matching.
                  </p>
                </div>

                <div className="p-3.5 bg-card rounded-xl border border-hairline space-y-1.5 shadow-sm">
                  <div className="flex items-center gap-1.5 text-xs font-mono font-bold text-purple-600 dark:text-purple-400">
                    <span className="w-2 h-2 rounded-full bg-purple-400" />
                    <span>3. Multi-Sample Judge</span>
                  </div>
                  <p className="text-[11px] text-fg-muted font-sans leading-relaxed">
                    <code className="text-fg font-mono">num_samples: 3</code> samples the judge model repeatedly and aggregates scores, neutralizing LLM scoring jitter to deliver consistent benchmark results.
                  </p>
                </div>
              </div>

              {/* Deep Dive Explainer */}
              <div className="border border-hairline rounded-xl overflow-hidden bg-overlay/30">
                <button
                  type="button"
                  onClick={() => setShowHowItWorks(!showHowItWorks)}
                  className="w-full p-3.5 flex items-center justify-between text-left hover:bg-overlay/50 transition-colors cursor-pointer"
                >
                  <div className="flex items-center gap-2">
                    <Info size={15} className="text-blue-500" />
                    <span className="text-xs font-mono font-bold text-fg">
                      Deep Dive: How eval_config.json is Written, Generated & Evaluated
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 text-xs text-fg-muted font-mono">
                    <span>{showHowItWorks ? 'Collapse' : 'Explain'}</span>
                    {showHowItWorks ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                  </div>
                </button>

                {showHowItWorks && (
                  <div className="p-4 pt-0 space-y-3 text-xs border-t border-hairline font-sans">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-3">
                      <div className="p-3 bg-card rounded-lg border border-hairline space-y-1.5">
                        <h5 className="font-mono font-bold text-fg text-[11px] flex items-center gap-1.5">
                          <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                          <span>1. How It Is Authored</span>
                        </h5>
                        <p className="text-fg-muted text-[11px] leading-relaxed">
                          Teams author <code className="text-fg font-mono">eval_config.json</code> as declarative Config-as-Code alongside their agents, or generate it via ADK's Pydantic model (<code className="text-fg font-mono">EvalConfig.model_dump_json()</code>). This defines reproducible CI/CD quality gates.
                        </p>
                      </div>

                      <div className="p-3 bg-card rounded-lg border border-hairline space-y-1.5">
                        <h5 className="font-mono font-bold text-fg text-[11px] flex items-center gap-1.5">
                          <span className="w-1.5 h-1.5 rounded-full bg-cyan-500" />
                          <span>2. How ADK Executes It</span>
                        </h5>
                        <p className="text-fg-muted text-[11px] leading-relaxed">
                          When running <code className="text-fg font-mono">adk eval</code>, ADK feeds <code className="text-fg font-mono">user_content</code> to the agent, intercepts every function call to grade sequence against <code className="text-fg font-mono">invocation_events</code>, runs deterministic custom code tests, and polls Vertex AI judges.
                        </p>
                      </div>

                      <div className="p-3 bg-card rounded-lg border border-hairline space-y-1.5">
                        <h5 className="font-mono font-bold text-fg text-[11px] flex items-center gap-1.5">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                          <span>3. Why This Builds Trust</span>
                        </h5>
                        <p className="text-fg-muted text-[11px] leading-relaxed">
                          Rather than opaque prompt scores or subjective human review, ADK combines deterministic trajectory math with multi-sample LLM rubric grading. Every metric threshold is transparent, auditable, and enforceable before deployment.
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Navigation Actions */}
              <div className="flex items-center justify-between pt-1 flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setActiveSpecTab('eval_set')}
                  className="px-3.5 py-2 text-fg-muted hover:text-fg text-xs font-mono transition-colors flex items-center gap-1.5 cursor-pointer"
                >
                  <ArrowLeft size={13} />
                  <span>Back to eval_set.json</span>
                </button>
                <button
                  type="button"
                  onClick={handleRunEval}
                  disabled={isEvalRunning}
                  className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl transition-all shadow-md flex items-center gap-2 cursor-pointer font-mono"
                >
                  <ShieldCheck size={14} />
                  <span>Execute adk eval Benchmark</span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Tangible Visual Evaluation Output */}
        {isEvalRunning ? (
          <div className="p-8 rounded-2xl border border-hairline bg-overlay/40 flex items-center justify-center gap-3 text-vibe-cyan font-mono text-xs animate-pulse">
            <RefreshCw size={18} className="animate-spin" />
            <span>Evaluating agent trajectory, tool arguments, and code safety on Vertex AI...</span>
          </div>
        ) : evalOutput ? (
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
                    Invoked state reader, BigQuery Data Agent tool, and deployment tools in correct logical sequence (<code className="text-fg font-mono">in_order</code>).
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
                    Calculated budget pacing formula tracking daypart clearing prices across 3 judge samples.
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


      {/* Bottom Milestone Callout */}
      {evalOutput && !isEvalRunning && (
        <div className="p-5 bg-gradient-to-r from-blue-500/10 via-indigo-500/10 to-purple-500/10 rounded-3xl border border-blue-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-lg animate-rise">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-blue-500/20 text-blue-400 flex items-center justify-center shrink-0 border border-blue-500/30">
              <Sparkles size={20} />
            </div>
            <div>
              <h4 className="text-sm font-display font-bold text-fg">Trajectory & Code Guardrails Verified</h4>
              <p className="text-xs text-fg-muted">The agent passed semantic LLM-as-a-Judge evaluation. Next, wire the Actor-Critic simulation loop to critique and evolve policies under live market physics.</p>
            </div>
          </div>
          <button
            onClick={() => navigate('judge_agent')}
            className="px-5 py-2.5 bg-vibe-cyan hover:bg-vibe-cyan/90 text-black font-bold text-xs rounded-xl transition-all shadow-md flex items-center gap-2 cursor-pointer shrink-0"
          >
            <span>Proceed to Step 8: Judge Agent</span>
            <ArrowRight size={14} />
          </button>
        </div>
      )}
    </div>
  );
}

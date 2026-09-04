import { useState } from 'react';
import { 
  ShieldCheck, Check, Settings, ListOrdered, CheckCircle2,
  ChevronDown, ChevronUp, ArrowRight, RefreshCw, Sparkles, FileText
} from 'lucide-react';

export default function ADKEval({ navigate }: { navigate: (v: string) => void }) {
  const [isEvalRunning, setIsEvalRunning] = useState(false);
  const [evalOutput, setEvalOutput] = useState<string | null>(null);
  const [showEvalCli, setShowEvalCli] = useState(false);
  const [activeConfigTab, setActiveConfigTab] = useState<'eval_config' | 'eval_set'>('eval_config');

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
            onClick={() => navigate('adk_optimize')}
            className="px-6 py-2.5 bg-vibe-cyan hover:bg-vibe-cyan/90 text-black font-bold text-xs rounded-xl transition-all shadow-md flex items-center gap-2 cursor-pointer"
          >
            <span>Proceed to ADK Optimize</span>
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
        </div>

        <p className="text-xs text-fg-muted leading-relaxed font-sans">
          Evaluating generative agents requires assessing reasoning trajectories, code guardrails, and semantic intent. Google Cloud ADK uses an <strong className="text-fg">LLM-as-a-Judge</strong> on Vertex AI configured via <code className="text-fg font-mono bg-overlay px-1.5 py-0.5 rounded border border-hairline">eval_config.json</code> to audit both execution order and code safety.
        </p>

        {/* Detailed Config Reference & Breakdown */}
        <div className="p-5 bg-card rounded-2xl border border-hairline space-y-4 shadow-sm">
          {/* Tab Navigation */}
          <div className="flex items-center justify-between border-b border-hairline pb-3 flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setActiveConfigTab('eval_config')}
                className={`px-3 py-1.5 rounded-xl text-xs font-mono font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                  activeConfigTab === 'eval_config'
                    ? 'bg-blue-500/15 text-blue-600 dark:text-blue-400 border border-blue-500/30 shadow-sm'
                    : 'text-fg-muted hover:text-fg hover:bg-overlay/50 border border-transparent'
                }`}
              >
                <Settings size={14} />
                <span>eval/eval_config.json</span>
                <span className="text-[10px] font-sans font-normal opacity-75 hidden sm:inline">(Rules & Criteria)</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveConfigTab('eval_set')}
                className={`px-3 py-1.5 rounded-xl text-xs font-mono font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                  activeConfigTab === 'eval_set'
                    ? 'bg-cyan-500/15 text-cyan-600 dark:text-cyan-400 border border-cyan-500/30 shadow-sm'
                    : 'text-fg-muted hover:text-fg hover:bg-overlay/50 border border-transparent'
                }`}
              >
                <FileText size={14} />
                <span>eval/adk_eval_set.json</span>
                <span className="text-[10px] font-sans font-normal opacity-75 hidden sm:inline">(Golden Benchmark)</span>
              </button>
            </div>

            <span className="text-[10px] font-mono text-blue-700 dark:text-blue-400 bg-blue-500/10 px-2.5 py-0.5 rounded-full border border-blue-500/30 font-bold">
              {activeConfigTab === 'eval_config' ? '--config_file_path' : 'eval_set_path'}
            </span>
          </div>

          {activeConfigTab === 'eval_config' ? (
            <>
              {/* Syntax Highlighted JSON Viewer for eval_config.json */}
              <div className="rounded-xl overflow-hidden border border-hairline bg-[#0c0c14] p-4 text-xs font-mono leading-relaxed">
                <div className="text-zinc-500 font-sans italic text-[11px] pb-1">// eval/eval_config.json (Evaluation Criteria & Judge Thresholds)</div>
                <div className="text-zinc-400">{"{"}</div>
                <div className="text-zinc-400 pl-4">"criteria": {"{"}</div>
                
                {/* Part 1: Tool Trajectory */}
                <div className="text-cyan-400 pl-8 bg-cyan-500/10 py-1 px-2 rounded border-l-2 border-cyan-500 my-1">
                  <span className="text-white font-bold">"tool_trajectory_avg_score"</span>: {"{"}
                  <div className="text-cyan-300 pl-4">
                    <span className="text-white">"threshold"</span>: 1.0, <span className="text-zinc-400 font-sans italic text-[11px]">// 100% required tool compliance</span>
                  </div>
                  <div className="text-cyan-300 pl-4">
                    <span className="text-white">"match_type"</span>: <span className="text-emerald-400">"in_order"</span> <span className="text-zinc-400 font-sans italic text-[11px]">// Enforces sequence while allowing exploratory queries</span>
                  </div>
                  <div>{"},"}</div>
                </div>

                {/* Part 2: Semantic Response Match & Evaluator Options */}
                <div className="text-emerald-400 pl-8 bg-emerald-500/10 py-1 px-2 rounded border-l-2 border-emerald-500 my-1">
                  <span className="text-white font-bold">"final_response_match_v2"</span>: {"{"}
                  <div className="text-emerald-300 pl-4">
                    <span className="text-white">"threshold"</span>: 0.7, <span className="text-zinc-400 font-sans italic text-[11px]">// Semantic quality & constraint threshold (0.0 to 1.0)</span>
                  </div>
                  <div className="text-emerald-300 pl-4">
                    <span className="text-white">"judge_model_options"</span>: {"{"}
                    <div className="text-emerald-200 pl-4">
                      <span className="text-white">"judge_model"</span>: <span className="text-cyan-300">"gemini-2.5-flash"</span>, <span className="text-zinc-400 font-sans italic text-[11px]">// Evaluator foundation model on Vertex AI</span>
                    </div>
                    <div className="text-emerald-200 pl-4">
                      <span className="text-white">"num_samples"</span>: 3 <span className="text-zinc-400 font-sans italic text-[11px]">// Repeated sampling to eliminate stochastic scoring variance</span>
                    </div>
                    <div>{"}"}</div>
                  </div>
                  <div>{"}"}</div>
                </div>

                <div className="text-zinc-400 pl-4">{"}"}</div>
                <div className="text-zinc-400">{"}"}</div>
              </div>

              {/* 3-Part Component Breakdown Cards for eval_config.json */}
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
            </>
          ) : (
            <>
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

              {/* 3-Part Component Breakdown Cards for adk_eval_set.json */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-1">
                <div className="p-3.5 bg-card rounded-xl border border-hairline space-y-1.5 shadow-sm">
                  <div className="flex items-center gap-1.5 text-xs font-mono font-bold text-amber-500 dark:text-amber-400">
                    <span className="w-2 h-2 rounded-full bg-amber-400" />
                    <span>1. Benchmark Prompt</span>
                  </div>
                  <p className="text-[11px] text-fg-muted font-sans leading-relaxed">
                    <code className="text-fg font-mono">user_content</code> defines the exact business directive submitted to the agent during evaluation to kick off the decision cycle.
                  </p>
                </div>

                <div className="p-3.5 bg-card rounded-xl border border-hairline space-y-1.5 shadow-sm">
                  <div className="flex items-center gap-1.5 text-xs font-mono font-bold text-cyan-500 dark:text-cyan-400">
                    <span className="w-2 h-2 rounded-full bg-cyan-400" />
                    <span>2. Golden Trajectory</span>
                  </div>
                  <p className="text-[11px] text-fg-muted font-sans leading-relaxed">
                    <code className="text-fg font-mono">invocation_events</code> records the reference tool invocation sequence evaluated by <code className="text-fg font-mono">tool_trajectory_avg_score</code> with <code className="text-fg font-mono">in_order</code> matching.
                  </p>
                </div>

                <div className="p-3.5 bg-card rounded-xl border border-hairline space-y-1.5 shadow-sm">
                  <div className="flex items-center gap-1.5 text-xs font-mono font-bold text-emerald-600 dark:text-emerald-400">
                    <span className="w-2 h-2 rounded-full bg-emerald-400" />
                    <span>3. Reference Outcome</span>
                  </div>
                  <p className="text-[11px] text-fg-muted font-sans leading-relaxed">
                    <code className="text-fg font-mono">final_response</code> establishes the expected completion payload scored by the Vertex AI LLM-as-a-Judge against safety & mathematical criteria.
                  </p>
                </div>
              </div>
            </>
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

            {/* Evaluated Tool Trajectory Stepper */}
            <div className="p-5 rounded-2xl border border-cyan-500/40 bg-cyan-500/5 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-cyan-500/20 pb-3">
                <div className="flex items-center gap-2 text-xs font-mono font-bold text-cyan-700 dark:text-cyan-300">
                  <ListOrdered size={16} className="text-cyan-500" />
                  <span>Evaluated Tool Trajectory Sequence:</span>
                  <code className="text-[11px] font-normal text-fg-muted font-mono">eval/adk_eval_set.json</code>
                </div>
                <span className="text-[11px] font-mono px-2.5 py-0.5 rounded-full bg-cyan-500/20 text-cyan-800 dark:text-cyan-300 border border-cyan-500/40 font-bold w-fit">
                  3/3 Tools Matched (in_order)
                </span>
              </div>

              <div className="space-y-3">
                {/* Step 1 */}
                <div className="p-3.5 bg-card rounded-xl border border-hairline flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs font-mono shadow-sm">
                  <div className="flex items-start sm:items-center gap-3">
                    <div className="w-6 h-6 rounded-full bg-cyan-500/20 text-cyan-500 dark:text-cyan-400 flex items-center justify-center font-bold text-[11px] shrink-0">
                      1
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-fg">get_campaign_info()</span>
                        <span className="text-[10px] px-2 py-0.5 rounded bg-overlay border border-hairline text-fg-muted">State Discovery</span>
                      </div>
                      <span className="text-[11px] text-fg-muted font-sans block mt-0.5">
                        Discovered total budget ($2,500.00), flight duration (24h), and bid ceiling ($10.00).
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0 md:self-center self-end">
                    <span className="text-emerald-600 dark:text-emerald-400 font-bold flex items-center gap-1 text-[11px]">
                      <CheckCircle2 size={13} />
                      <span>Matched</span>
                    </span>
                  </div>
                </div>

                {/* Step 2 */}
                <div className="p-3.5 bg-card rounded-xl border border-hairline flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs font-mono shadow-sm">
                  <div className="flex items-start sm:items-center gap-3">
                    <div className="w-6 h-6 rounded-full bg-cyan-500/20 text-cyan-500 dark:text-cyan-400 flex items-center justify-center font-bold text-[11px] shrink-0">
                      2
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-fg">data_agent_toolset(...)</span>
                        <span className="text-[10px] px-2 py-0.5 rounded bg-overlay border border-hairline text-fg-muted">BigQuery Telemetry</span>
                      </div>
                      <span className="text-[11px] text-fg-muted font-sans block mt-0.5">
                        Queried historical P90 clearing floors by daypart (primetime $9.60, late_night $0.85).
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0 md:self-center self-end">
                    <span className="text-emerald-600 dark:text-emerald-400 font-bold flex items-center gap-1 text-[11px]">
                      <CheckCircle2 size={13} />
                      <span>Matched</span>
                    </span>
                  </div>
                </div>

                {/* Step 3 */}
                <div className="p-3.5 bg-card rounded-xl border border-hairline flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs font-mono shadow-sm">
                  <div className="flex items-start sm:items-center gap-3">
                    <div className="w-6 h-6 rounded-full bg-cyan-500/20 text-cyan-500 dark:text-cyan-400 flex items-center justify-center font-bold text-[11px] shrink-0">
                      3
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-fg">deploy_bidding_policy(...)</span>
                        <span className="text-[10px] px-2 py-0.5 rounded bg-overlay border border-hairline text-fg-muted">Code Actuation</span>
                      </div>
                      <span className="text-[11px] text-fg-muted font-sans block mt-0.5">
                        Validated deterministic AST syntax and deployed policy to <code className="font-mono text-fg">policies/agent_bidding_policy.py</code>.
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0 md:self-center self-end">
                    <span className="text-emerald-600 dark:text-emerald-400 font-bold flex items-center gap-1 text-[11px]">
                      <CheckCircle2 size={13} />
                      <span>Matched</span>
                    </span>
                  </div>
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
              <p className="text-xs text-fg-muted">The agent passed semantic LLM-as-a-Judge evaluation. Next, evolve the prompt instructions using GEPA in ADK Optimize.</p>
            </div>
          </div>
          <button
            onClick={() => navigate('adk_optimize')}
            className="px-5 py-2.5 bg-vibe-cyan hover:bg-vibe-cyan/90 text-black font-bold text-xs rounded-xl transition-all shadow-md flex items-center gap-2 cursor-pointer shrink-0"
          >
            <span>Proceed to Step 8: ADK Optimize</span>
            <ArrowRight size={14} />
          </button>
        </div>
      )}
    </div>
  );
}

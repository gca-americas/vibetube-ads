import { useState } from 'react';
import { 
  Terminal, ShieldCheck, XCircle, Settings, AlertTriangle, 
  ChevronDown, ChevronUp, ArrowRight, RefreshCw, Sparkles
} from 'lucide-react';

export default function ADKEval({ navigate }: { navigate: (v: string) => void }) {
  const [evalMode, setEvalMode] = useState<'exact' | 'semantic'>('exact');
  const [isEvalRunning, setIsEvalRunning] = useState(false);
  const [evalOutput, setEvalOutput] = useState<string | null>(null);
  const [showEvalCli, setShowEvalCli] = useState(false);

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
            Evaluate agent trajectory safety, tool arguments, and semantic quality using LLM-as-a-Judge instead of brittle exact assertions.
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
              <Terminal size={20} />
            </div>
            <div>
              <h3 className="text-lg font-display font-bold text-fg flex items-center gap-2">
                <code className="font-mono text-blue-600 dark:text-blue-400 bg-blue-500/10 border border-blue-500/30 px-2 py-0.5 rounded-lg text-sm">
                  adk eval
                </code>
                <span>Evaluation Suite</span>
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

        {/* Tangible Config Reference for Semantic Evaluation */}
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
                    Invoked state reader, BigQuery Data Agent tool, and deployment tools in correct logical sequence.
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
                    Calculated budget pacing formula tracking daypart clearing prices.
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
      {evalMode === 'semantic' && evalOutput && !isEvalRunning && (
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
            <span>Proceed to ADK Optimize</span>
            <ArrowRight size={14} />
          </button>
        </div>
      )}
    </div>
  );
}

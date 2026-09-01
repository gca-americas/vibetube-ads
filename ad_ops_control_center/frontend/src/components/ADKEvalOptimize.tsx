import { useState } from 'react';
import { 
  Terminal, Sparkles, Check,
  ArrowRight, RefreshCw, XCircle, Sliders, ShieldCheck
} from 'lucide-react';

export default function ADKEvalOptimize({ navigate }: { navigate: (v: string) => void }) {
  // Eval runner state
  const [evalMode, setEvalMode] = useState<'exact' | 'semantic'>('exact');
  const [isEvalRunning, setIsEvalRunning] = useState(false);
  const [evalOutput, setEvalOutput] = useState<string | null>(null);

  // Optimize runner state
  const [isOptRunning, setIsOptRunning] = useState(false);
  const [optOutput, setOptOutput] = useState<string | null>(null);
  const [optCompleted, setOptCompleted] = useState(false);

  const handleRunEval = async (mode: 'exact' | 'semantic') => {
    setEvalMode(mode);
    setIsEvalRunning(true);
    setEvalOutput(null);

    await new Promise(r => setTimeout(r, 1400));

    if (mode === 'exact') {
      setEvalOutput(`$ adk eval . eval/adk_eval_set.json

[INFO] Initializing ADK evaluation benchmark: vibetube_campaign_eval_set
[INFO] Executing trajectory for agent: bidding_policy_agent
  ├── Tool Call: get_campaign_info() -> Status: 200 OK
  ├── Tool Call: ask_data_agent("Analyze historical P90 clearing floors by daypart")
  └── Tool Call: deploy_bidding_policy(code, summary) -> Deployed

[EVAL REPORT] Evaluating trajectory with exact dictionary matching...
  ❌ Error: ask_data_agent parameter mismatch
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
  ├── Tool Call: ask_data_agent(...) -> 200,000 auctions analyzed
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

    await new Promise(r => setTimeout(r, 2000));

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
Updated instruction file: bidding_policy_spec.md
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
            Learn why deterministic testing fails for generative agents, how LLM-as-a-Judge semantic scoring works, and how GEPA automatically evolves prompt instructions.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('judge_agent')}
            className="px-6 py-2.5 bg-vibe-cyan hover:bg-vibe-cyan/90 text-black font-bold text-xs rounded-xl transition-all shadow-md flex items-center gap-2 cursor-pointer"
          >
            <span>Proceed to Judge Agent (Step 8)</span>
            <ArrowRight size={15} />
          </button>
        </div>
      </div>

      {/* Stacked Vertical Sections */}
      <div className="space-y-8">
        {/* Section 1: adk eval */}
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
                    : 'bg-vibe-cyan/15 hover:bg-vibe-cyan/25 text-cyan-800 dark:text-vibe-cyan border-vibe-cyan/30'
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

          {/* Terminal Box: Only shown when executing or output available */}
          {(isEvalRunning || evalOutput) && (
            <div className="rounded-2xl border border-hairline bg-[#0c0c14] p-5 text-xs font-mono text-zinc-300 overflow-x-auto min-h-[180px] animate-rise shadow-inner">
              {isEvalRunning ? (
                <div className="flex items-center gap-2 text-vibe-cyan py-6">
                  <RefreshCw size={15} className="animate-spin" />
                  <span>Running ADK Evaluation suite ({evalMode === 'exact' ? 'Exact Match' : 'Semantic LLM-as-a-Judge'})...</span>
                </div>
              ) : (
                <pre className="whitespace-pre leading-relaxed">{evalOutput}</pre>
              )}
            </div>
          )}
        </div>

        {/* Section 2: adk optimize */}
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
                  <span>(GEPA)</span>
                </h3>
                <span className="text-xs font-mono text-fg-muted">Generative Evolutionary Prompt Adaptation</span>
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
            Instead of manually tweaking prompt wording, <strong className="text-fg">GEPA</strong> mutates instructions in <code className="text-fg font-mono bg-overlay px-1.5 py-0.5 rounded border border-hairline">bidding_policy_spec.md</code>, reflects on edge-case failures, and autonomously searches for the highest-performing system prompt along the Pareto frontier.
          </p>

          {/* Terminal Box: Only shown when executing or output available */}
          {(isOptRunning || optOutput) && (
            <div className="rounded-2xl border border-hairline bg-[#0c0c14] p-5 text-xs font-mono text-zinc-300 overflow-x-auto min-h-[180px] animate-rise shadow-inner">
              {isOptRunning ? (
                <div className="flex items-center gap-2 text-purple-400 py-6">
                  <RefreshCw size={15} className="animate-spin" />
                  <span>Evaluating candidates and reflecting across Pareto frontier...</span>
                </div>
              ) : (
                <pre className="whitespace-pre leading-relaxed text-purple-300">{optOutput}</pre>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

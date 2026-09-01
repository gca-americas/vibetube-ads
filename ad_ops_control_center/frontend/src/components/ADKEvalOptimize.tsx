import { useState } from 'react';
import { 
  Terminal, Sparkles, Check,
  ArrowRight, ArrowLeft, RefreshCw, XCircle, Sliders, ShieldCheck
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
          <h1 className="text-3xl font-display font-bold tracking-tight text-fg">
            Benchmarking with `adk eval` & `adk optimize`
          </h1>
          <p className="text-sm text-fg-muted mt-1">
            Learn why deterministic testing fails for generative agents, how LLM-as-a-Judge semantic scoring works, and how GEPA automatically evolves prompt instructions.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('agent_execution')}
            className="px-4 py-2.5 bg-card hover:bg-overlay text-fg text-xs font-mono font-medium rounded-xl border border-hairline transition-all flex items-center gap-2 cursor-pointer shadow-sm"
          >
            <ArrowLeft size={14} />
            <span>Back to Execution (Step 6)</span>
          </button>

          <button
            onClick={() => navigate('judge_agent')}
            className="px-5 py-2.5 bg-vibe-cyan hover:bg-vibe-cyan/90 text-black font-bold text-xs rounded-xl transition-all shadow-md flex items-center gap-1.5 cursor-pointer"
          >
            <span>Proceed to Judge Agent (Step 8)</span>
            <ArrowRight size={15} />
          </button>
        </div>
      </div>

      {/* Dual Cards Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
        {/* Card 1: adk eval */}
        <div className="p-6 bg-card rounded-3xl border border-hairline shadow-xl space-y-5">
          <div className="flex items-center justify-between border-b border-hairline pb-4">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-blue-500/15 border border-blue-500/30 flex items-center justify-center text-blue-600 dark:text-blue-400">
                <Terminal size={18} />
              </div>
              <div>
                <h3 className="text-base font-display font-bold text-fg">1. `adk eval` Benchmarking</h3>
                <span className="text-[11px] font-mono text-fg-muted">Deterministic vs. Semantic LLM-as-a-Judge</span>
              </div>
            </div>
          </div>

          <p className="text-xs text-fg-muted leading-relaxed font-sans">
            Deterministic unit tests (<code className="text-fg font-mono">assert actual == expected</code>) fail when evaluating non-deterministic agents. LLM-as-a-Judge evaluates the trajectory and output quality against semantic criteria.
          </p>

          <div className="flex flex-wrap gap-2.5">
            <button
              onClick={() => handleRunEval('exact')}
              disabled={isEvalRunning}
              className={`px-4 py-2 rounded-xl text-xs font-mono font-bold transition-all flex items-center gap-1.5 cursor-pointer border ${
                evalMode === 'exact' && evalOutput
                  ? 'bg-amber-500/20 text-amber-800 dark:text-amber-300 border-amber-500/40'
                  : 'bg-overlay hover:bg-hairline text-fg border-hairline'
              }`}
            >
              <XCircle size={14} className="text-amber-600 dark:text-amber-400" />
              <span>Run Exact Match Eval</span>
            </button>

            <button
              onClick={() => handleRunEval('semantic')}
              disabled={isEvalRunning}
              className={`px-4 py-2 rounded-xl text-xs font-mono font-bold transition-all flex items-center gap-1.5 cursor-pointer border ${
                evalMode === 'semantic' && evalOutput
                  ? 'bg-emerald-500/20 text-emerald-800 dark:text-emerald-300 border-emerald-500/40'
                  : 'bg-vibe-cyan/15 hover:bg-vibe-cyan/25 text-cyan-800 dark:text-vibe-cyan border-vibe-cyan/30'
              }`}
            >
              <ShieldCheck size={14} className="text-emerald-600 dark:text-emerald-400" />
              <span>Run Semantic Judge Eval</span>
            </button>
          </div>

          {/* Terminal Box */}
          <div className="rounded-2xl border border-hairline bg-[#0c0c14] p-4 text-xs font-mono text-zinc-300 overflow-x-auto min-h-[220px]">
            {isEvalRunning ? (
              <div className="flex items-center gap-2 text-vibe-cyan">
                <RefreshCw size={14} className="animate-spin" />
                <span>Running ADK Evaluation suite...</span>
              </div>
            ) : evalOutput ? (
              <pre className="whitespace-pre leading-relaxed">{evalOutput}</pre>
            ) : (
              <div className="text-zinc-500 italic">
                Click one of the buttons above to execute <code className="text-zinc-400">adk eval</code> and observe the result.
              </div>
            )}
          </div>
        </div>

        {/* Card 2: adk optimize */}
        <div className="p-6 bg-card rounded-3xl border border-hairline shadow-xl space-y-5">
          <div className="flex items-center justify-between border-b border-hairline pb-4">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-purple-500/15 border border-purple-500/30 flex items-center justify-center text-purple-600 dark:text-purple-400">
                <Sliders size={18} />
              </div>
              <div>
                <h3 className="text-base font-display font-bold text-fg">2. `adk optimize` (GEPA)</h3>
                <span className="text-[11px] font-mono text-fg-muted">Generative Evolutionary Prompt Adaptation</span>
              </div>
            </div>
          </div>

          <p className="text-xs text-fg-muted leading-relaxed font-sans">
            Instead of manually tweaking prompt wording, <strong className="text-fg">GEPA</strong> mutates instructions, reflects on edge-case failures, and autonomously searches for the highest-performing system prompt.
          </p>

          <button
            onClick={handleRunOptimize}
            disabled={isOptRunning}
            className="px-5 py-2.5 bg-gradient-to-r from-purple-500 to-indigo-600 hover:from-purple-500/90 hover:to-indigo-600/90 text-white font-bold text-xs rounded-xl transition-all shadow-md flex items-center gap-2 cursor-pointer"
          >
            {isOptRunning ? (
              <>
                <RefreshCw size={14} className="animate-spin" />
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
                <span>Run `adk optimize` Evolution</span>
              </>
            )}
          </button>

          {/* Terminal Box */}
          <div className="rounded-2xl border border-hairline bg-[#0c0c14] p-4 text-xs font-mono text-zinc-300 overflow-x-auto min-h-[220px]">
            {isOptRunning ? (
              <div className="flex items-center gap-2 text-purple-400">
                <RefreshCw size={14} className="animate-spin" />
                <span>Evaluating candidates across Pareto frontier...</span>
              </div>
            ) : optOutput ? (
              <pre className="whitespace-pre leading-relaxed text-purple-300">{optOutput}</pre>
            ) : (
              <div className="text-zinc-500 italic">
                Click "Run `adk optimize` Evolution" to watch the reflection loop search prompt space.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

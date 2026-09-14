import { useState, useEffect, useRef } from 'react';
import {
  Terminal, ArrowRight, Check, CheckCircle2,
  Code2, RefreshCw, Play, Cpu, Activity,
  Copy, Lock, FileText, Lightbulb
} from 'lucide-react';
import PythonCodeHighlight from './PythonCodeHighlight';
import MarkdownCodeHighlight from './MarkdownCodeHighlight';

type StepId = 'tool' | 'prompt';

interface StepTabItem {
  id: StepId;
  stepNum: number;
  label: string;
}

const STEP_TABS: StepTabItem[] = [
  {
    id: 'tool',
    stepNum: 1,
    label: '1. evaluate_policy',
  },
  {
    id: 'prompt',
    stepNum: 2,
    label: '2. judge_prompt.md',
  },
];

const STEP_HINTS: Record<StepId, { text: string; code: string }> = {
  tool: {
    text: 'In judge_agent.py above, add evaluate_policy to the tools list:',
    code: 'tools=[evaluate_policy],',
  },
  prompt: {
    text: 'In judge_agent.py above, update instruction="" in judge_agent to:',
    code: 'instruction=PROMPT_PATH.read_text(encoding="utf-8"),',
  },
};

interface CodeExplanation {
  title: string;
  description: string;
}

const EVALUATE_POLICY_CODE_SNIPPET = `def evaluate_policy(
    policy_code: str,
    total_budget: float = 2500.0,
    flight_duration_hours: float = 24.0,
    max_bid_ceiling: float = 10.0,
) -> dict[str, Any]:
    """Simulates candidate bidding policy across a 24-hour market flight in-memory."""
    try:
        policy_func = load_policy_from_code(policy_code)
        result = run_simulation(
            policy_func,
            total_budget=total_budget,
            flight_duration_hours=flight_duration_hours,
            max_bid_ceiling=max_bid_ceiling,
        )
        return {
            "status": "success",
            "score": result.yield_score,
            "impressions_won": result.total_impressions,
            "total_spend": result.total_spend,
            "budget_remaining": result.budget_remaining,
            "budget_utilization_pct": result.budget_utilization_pct,
            "effective_cpm": result.effective_cpm,
            "hours_active": result.hours_active,
            "exhausted_hour": result.exhausted_hour,
            "overall_win_rate_pct": result.overall_win_rate,
            "summary": result.summary_text,
        }
    except Exception as e:
        return {
            "status": "error",
            "error": str(e),
            "score": 0.0,
            "summary": f"Policy execution failed: {e}",
        }`;

const EVALUATE_TOOL_EXPLANATIONS: CodeExplanation[] = [
  {
    title: '1. Load Policy from Disk',
    description: 'Compiles the candidate Python script and verifies the compute_bid(context) function.',
  },
  {
    title: '2. Run the Simulation',
    description: 'Simulates 48 half-hour auction intervals across a 24-hour campaign flight under diurnal clearing prices and market volatility.',
  },
  {
    title: '3. Return Metrics',
    description: 'Packages impressions, spend, budget utilization, eCPM, and the overall yield score for the Judge.',
  },
];

const JUDGE_SYSTEM_PROMPT_SNIPPET = `# Judge Agent & Yield Optimization

You are the Vibetube Judge Agent. Your mission is to evaluate
synthesized bidding policy scripts against market microeconomics and
formulate precise, actionable algorithmic critiques.

## Your Evaluation Workflow:
1. Call \`evaluate_policy(policy_code)\` to simulate the candidate script
   across auction traffic.
2. Inspect the quantitative telemetry:
   - Budget Utilization: The objective is to utilize 100% of the allocated
     campaign budget across the entire flight duration.
   - Pacing Survival: Did the policy run out of budget too early?
   - Under-spending: Did the policy leave significant budget unspent?
   - Daypart Performance: Did the policy bid competitively during Primetime?
3. Return a comprehensive evaluation with:
   - \`score\`: The simulation yield score (0 to 100).
   - \`diagnostics\`: Clear analysis of why the policy underperformed.
   - \`recommendations\`: Concrete mathematical pacing adjustments (e.g., dynamic
     budget pacing multipliers using budget_remaining / hours_remaining) for
     the Bidding Agent.`;

const JUDGE_PROMPT_EXPLANATIONS: CodeExplanation[] = [
  {
    title: 'Adversarial Judge Persona',
    description: 'Directs Gemini to evaluate microeconomic viability with zero author confirmation bias, isolating economic traps that the Generator misses.',
  },
  {
    title: 'Multi-Dimensional Telemetry Inspection',
    description: 'Audits budget utilization, pacing survival across the 24-hour campaign flight, and primetime yield under dynamic market physics.',
  },
  {
    title: 'Actionable Mathematical Recommendations',
    description: 'Compels the Judge to provide explicit algorithmic pacing formulas (e.g., dynamic pacing multipliers) rather than vague subjective feedback.',
  },
];

type PolicyKey = 'baseline' | 'heuristic' | 'agentic';

interface PolicyEvaluationResult {
  key: PolicyKey;
  label: string;
  badge: string;
  sourceStep: string;
  file: string;
  description: string;
  score: number;
  verdict: string;
  impressions: number;
  spend: number;
  ecpm: number;
  exhausted_hour: string;
  budget_utilization: number;
  win_rate: number;
  diagnostics: string;
  recommendations: string;
  fullCritique?: string;
  colorTheme: 'red' | 'amber' | 'emerald';
}

function getEvaluationMarkdown(evaluation: PolicyEvaluationResult): string {
  if (evaluation.fullCritique && evaluation.fullCritique.trim().length > 0) {
    return evaluation.fullCritique.trim();
  }

  return `# Judge Agent Evaluation: ${evaluation.label}
**Verdict:** ${evaluation.verdict}  
**Simulation Score:** ${evaluation.score}/100 · **Flight Survival:** ${evaluation.exhausted_hour}

## Root-Cause Bottleneck Diagnostics
${evaluation.diagnostics}

## Actionable Algorithmic Recommendations
${evaluation.recommendations}`.trim();
}

const DEFAULT_POLICIES: Record<PolicyKey, PolicyEvaluationResult> = {
  baseline: {
    key: 'baseline',
    label: 'Flat Bid ($2.50 CPM)',
    badge: 'Step 2 Flat Bid',
    sourceStep: 'Step 2 Flat Bid',
    file: 'baseline_policy.py',
    description: 'Static $2.50 CPM flat bidding policy without daypart pricing sensitivity or pacing.',
    score: 54.3,
    verdict: 'Severe Under-spending & Primetime Starvation',
    impressions: 311647,
    spend: 779.12,
    ecpm: 2.50,
    exhausted_hour: 'None (Survived 24h)',
    budget_utilization: 31.2,
    win_rate: 51.9,
    diagnostics:
      'Catastrophic Pacing & Shading Failure: Static $2.50 CPM overpaid during late-night hours ($0.85 clearing price) and was completely shutout during afternoon bidding wars and primetime surges ($9.60 clearing price). Left $1,720.88 (68.8%) unspent while winning zero high-value impressions.',
    recommendations:
      'Eliminate static bidding immediately. Must inspect context.daypart and historical clearing prices to dynamically shade bids and pace expenditure across 24 hours.',
    colorTheme: 'red',
  },
  heuristic: {
    key: 'heuristic',
    label: 'Heuristic Policy (Daypart Tiers)',
    badge: 'Step 3 Attempt 2',
    sourceStep: 'Step 3 Data Exploration',
    file: 'heuristic_policy.py',
    description: 'Rule-based daypart tier thresholds from exploratory BigQuery telemetry.',
    score: 77.3,
    verdict: 'Complexity Wall / Volatility Failure',
    impressions: 392594,
    spend: 1685.23,
    ecpm: 4.29,
    exhausted_hour: 'None (Survived 24h)',
    budget_utilization: 67.4,
    win_rate: 65.4,
    diagnostics:
      'Complexity Wall Trapped: Rule-based daypart tiers survived morning ramp-up, but failed to adapt when rival bid momentum spiked during the afternoon bidding war. Rigid if/else brackets could not respond to fluid competitor velocity, leaving $814.77 (32.6%) unspent.',
    recommendations:
      'Static rule boundaries cannot adapt to fluid competitor velocity. Replace hardcoded if/else rules with closed-loop pacing feedback: scale bid dynamically using context.budget_remaining / max(0.5, context.hours_remaining).',
    colorTheme: 'amber',
  },
  agentic: {
    key: 'agentic',
    label: 'Agentic Candidate (Dynamic Pacing)',
    badge: 'Step 4 AI Engineer',
    sourceStep: 'Step 4 AI Data Engineer',
    file: 'agent_bidding_policy.py',
    description: 'Synthesized ADK candidate utilizing closed-loop feedback budget pacing.',
    score: 88.7,
    verdict: 'Production Viable Candidate',
    impressions: 440640,
    spend: 2110.72,
    ecpm: 4.79,
    exhausted_hour: 'None (Full Flight Survival)',
    budget_utilization: 84.4,
    win_rate: 73.4,
    diagnostics:
      'Strong Policy Candidate: Dynamic pacing successfully conserved budget across the 24h flight and captured high-value primetime impressions ($1,125.00 spent during peak hours). Shading logic avoided overpayment during late-night.',
    recommendations:
      'Fine-tune bid elasticity during lunch surge volatility spikes to capture incremental impressions without accelerating burn rate.',
    colorTheme: 'emerald',
  },
};

const INITIAL_JUDGE_CODE = `"""Judge Agent ADK module for evaluating bidding policies."""

from pathlib import Path

from google.adk.agents import LlmAgent

from lib.config import settings
from lib.tools import evaluate_policy

PROMPT_PATH = Path(__file__).resolve().parent / "judge_prompt.md"

judge_agent = LlmAgent(
    name="simulation_judge",
    model=settings.model_name,
    description="Simulates and critiques candidate bidding policies.",
    instruction="",
    tools=[],
)`;

function checkToolRegistered(code: string, toolPattern: string): boolean {
  const toolsMatch = code.match(/tools\s*=\s*\[([\s\S]*?)\]/);
  const targetText = toolsMatch ? toolsMatch[1] : code;

  // Strip comments from lines so commented-out TODOs aren't treated as registered tools
  const uncommented = targetText
    .split('\n')
    .map(line => {
      const idx = line.indexOf('#');
      return idx >= 0 ? line.slice(0, idx) : line;
    })
    .join('\n');

  const regex = new RegExp(`\\b${toolPattern}\\b`);
  return regex.test(uncommented);
}

function checkInstructionBound(code: string): boolean {
  const uncommented = code
    .split('\n')
    .map(line => {
      const idx = line.indexOf('#');
      return idx >= 0 ? line.slice(0, idx) : line;
    })
    .join('\n');

  if (uncommented.includes('PROMPT_PATH.read_text(') || uncommented.includes('SPEC_PATH.read_text(')) {
    return true;
  }

  const match = uncommented.match(/instruction\s*=\s*([^\n,]+)/);
  if (match) {
    const val = match[1].trim();
    const stripped = val.replace(/['"\s]/g, '');
    if (stripped !== '' && stripped !== 'None') {
      return true;
    }
  }
  return false;
}

export default function JudgeAgent({ navigate }: { navigate: (v: string) => void }) {
  const [judgeCode, setJudgeCode] = useState<string>(INITIAL_JUDGE_CODE);
  const [activeStepTab, setActiveStepTab] = useState<StepId>('tool');
  const [revealedHints, setRevealedHints] = useState<Record<string, boolean>>({});
  const [copiedHint, setCopiedHint] = useState<string | null>(null);
  const [copiedCli, setCopiedCli] = useState<boolean>(false);

  const [activePolicy, setActivePolicy] = useState<PolicyKey>('baseline');
  const [evaluatingPolicy, setEvaluatingPolicy] = useState<PolicyKey | null>(null);
  const [evaluations, setEvaluations] = useState<Record<PolicyKey, PolicyEvaluationResult>>(DEFAULT_POLICIES);
  const [evaluatedPolicies, setEvaluatedPolicies] = useState<Record<PolicyKey, boolean>>({
    baseline: false,
    heuristic: false,
    agentic: false,
  });

  const executionSectionRef = useRef<HTMLDivElement>(null);

  // Dynamic Theme Detection matching Step 4
  const [isLight, setIsLight] = useState(() => {
    if (typeof document !== 'undefined') {
      return document.documentElement.classList.contains('light');
    }
    return false;
  });

  useEffect(() => {
    if (typeof document === 'undefined') return;
    const checkTheme = () => setIsLight(document.documentElement.classList.contains('light'));
    checkTheme();
    const observer = new MutationObserver(checkTheme);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    return () => observer.disconnect();
  }, []);

  const codeTagClass = isLight
    ? 'bg-slate-200/80 text-slate-900 border border-slate-300/60'
    : 'bg-overlay text-fg border border-hairline';

  const isToolEquipped =
    checkToolRegistered(judgeCode, 'evaluate_policy') ||
    checkToolRegistered(judgeCode, 'evaluate_policy_code');
  const isInstructionBound = checkInstructionBound(judgeCode);

  const isJudgeReady = isToolEquipped && isInstructionBound;

  const isTabUnlocked = (tabId: StepId): boolean => {
    if (tabId === 'tool') return true;
    if (tabId === 'prompt') return isToolEquipped;
    return false;
  };

  const toggleHint = (stepId: string) => {
    setRevealedHints(prev => ({ ...prev, [stepId]: !prev[stepId] }));
  };

  const handleCopyHint = (stepId: StepId) => {
    const codeToCopy = STEP_HINTS[stepId].code;
    navigator.clipboard.writeText(codeToCopy);
    setCopiedHint(stepId);
    setTimeout(() => setCopiedHint(null), 2000);
  };

  const CLI_COMMAND = `adk run . "Simulate agent_bidding_policy.py under market physics and critique yield bottlenecks"`;

  const handleCopyCli = async () => {
    await navigator.clipboard.writeText(CLI_COMMAND);
    setCopiedCli(true);
    setTimeout(() => setCopiedCli(false), 2000);
  };

  const handleEvaluatePolicy = async (key: PolicyKey) => {
    setEvaluatingPolicy(key);
    setActivePolicy(key);

    try {
      const policyConfig = evaluations[key];
      // Invoke live Judge Agent endpoint with editor code and target policy file
      const res = await fetch('/agent/judge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          file: policyConfig.file,
          code: judgeCode,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.status === 'success') {
          setEvaluations(prev => ({
            ...prev,
            [key]: {
              ...prev[key],
              score: data.score ?? data.yield_score ?? prev[key].score,
              impressions: data.total_impressions ?? prev[key].impressions,
              spend: data.total_spend ?? prev[key].spend,
              ecpm: data.effective_cpm ?? prev[key].ecpm,
              budget_utilization: data.budget_utilization_pct ?? prev[key].budget_utilization,
              win_rate: data.overall_win_rate ?? prev[key].win_rate,
              exhausted_hour: data.exhausted_hour ? `Hour ${data.exhausted_hour}` : 'None (Survived 24h)',
              diagnostics: data.diagnostics || prev[key].diagnostics,
              recommendations: data.recommendations || prev[key].recommendations,
              fullCritique: data.full_critique || prev[key].fullCritique,
            }
          }));
        }
      }
    } catch (err) {
      console.warn('Live Judge Agent evaluation error, falling back to simulation endpoint:', key, err);
      try {
        const policyConfig = evaluations[key];
        const res = await fetch(`/simulation/flight?file=${policyConfig.file}`);
        if (res.ok) {
          const data = await res.json();
          if (data.status === 'success') {
            setEvaluations(prev => ({
              ...prev,
              [key]: {
                ...prev[key],
                score: data.yield_score ?? prev[key].score,
                impressions: data.total_impressions ?? prev[key].impressions,
                spend: data.total_spend ?? prev[key].spend,
                ecpm: data.effective_cpm ?? prev[key].ecpm,
                budget_utilization: data.budget_utilization_pct ?? prev[key].budget_utilization,
                win_rate: data.overall_win_rate ?? prev[key].win_rate,
                exhausted_hour: data.exhausted_hour ? `Hour ${data.exhausted_hour}` : 'None (Survived 24h)',
              }
            }));
          }
        }
      } catch (fallbackErr) {
        console.warn('Simulation fallback failed:', fallbackErr);
      }
    }

    setEvaluatedPolicies(prev => ({ ...prev, [key]: true }));
    setEvaluatingPolicy(null);
  };

  const currentEvaluation = evaluations[activePolicy];

  return (
    <div className="animate-rise pb-24 space-y-8 max-w-6xl mx-auto">
      {/* 1. Judge Agent Workflow Overview (Visual Image Diagram) */}
      <div className="rounded-3xl overflow-hidden border border-hairline bg-[#FDFBF7] dark:bg-slate-950/40 p-6 md:p-8 shadow-xl flex flex-col items-center justify-center">
        <img
          src="/judge-agent-architecture.png"
          alt="Judge Agent Workflow Diagram"
          className="w-full max-w-4xl max-h-[460px] object-contain mx-auto rounded-xl drop-shadow-md"
        />
        <p className="text-sm text-slate-600 dark:text-fg-muted font-sans mt-3 text-center max-w-2xl leading-relaxed">
          <strong>Judge Agent Workflow:</strong> The candidate <code className={`font-mono text-xs px-1 py-0.5 rounded ${codeTagClass}`}>bidding_policy.py</code> is received by the Judge Agent, which executes in-memory simulation via <code className={`font-mono text-xs px-1 py-0.5 rounded ${codeTagClass}`}>evaluate_policy()</code> and formulates an objective Policy Evaluation (yield score, diagnostics, and algorithmic recommendations).
        </p>
      </div>

      {/* 2. Interactive judge_agent.py Code Assembly (Editable, Single Instance Above Stepper) */}
      <div id="judge-code-editor" className="rounded-3xl overflow-hidden border border-hairline bg-card shadow-xl">
        <PythonCodeHighlight
          code={judgeCode}
          filename="agentic_data_engineer/judge_agent.py"
          editable={true}
          showCopy={false}
          onChange={setJudgeCode}
          onReset={() => setJudgeCode(INITIAL_JUDGE_CODE)}
          isModified={judgeCode !== INITIAL_JUDGE_CODE}
          className="max-h-[640px]"
        />
      </div>

      {/* 3. Unified 2-Step Assembly Stepper (Tool Actuator + Prompt Spec) */}
      <div className="rounded-3xl border border-hairline bg-card shadow-xl overflow-hidden p-6 md:p-8 space-y-6">
        {/* Stepper Tabs Bar with Sequential Step Locking */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {STEP_TABS.map((tab) => {
            const isSelected = activeStepTab === tab.id;
            const isDone = tab.id === 'tool' ? isToolEquipped : isInstructionBound;
            const unlocked = isTabUnlocked(tab.id);

            return (
              <button
                key={tab.id}
                type="button"
                disabled={!unlocked}
                onClick={() => unlocked && setActiveStepTab(tab.id)}
                className={`p-3.5 rounded-2xl border text-left transition-all relative flex items-center justify-between gap-2 ${
                  !unlocked
                    ? 'bg-overlay/20 border-hairline/60 opacity-40 cursor-not-allowed'
                    : isSelected
                    ? 'bg-card border-purple-500 shadow-md ring-2 ring-purple-500/20 cursor-pointer'
                    : isDone
                    ? 'bg-card/70 border-emerald-500/30 hover:border-emerald-500/60 cursor-pointer'
                    : 'bg-overlay/40 border-hairline hover:bg-overlay hover:border-slate-400/40 cursor-pointer'
                }`}
                title={!unlocked ? 'Complete preceding step to unlock' : tab.label}
              >
                <div className="flex items-center gap-2.5 min-w-0 flex-1">
                  <div className={`w-6 h-6 rounded-lg flex items-center justify-center text-xs font-bold shrink-0 ${
                    !unlocked
                      ? 'bg-overlay text-fg-muted/60'
                      : isDone
                      ? 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400'
                      : isSelected
                      ? 'bg-purple-500 text-white'
                      : 'bg-overlay text-fg-muted'
                  }`}>
                    {!unlocked ? (
                      <Lock size={12} />
                    ) : isDone ? (
                      <Check size={13} />
                    ) : tab.id === 'prompt' ? (
                      <FileText size={13} />
                    ) : (
                      <Code2 size={13} />
                    )}
                  </div>
                  <span className={`text-xs sm:text-sm font-bold font-mono truncate ${
                    !unlocked
                      ? 'text-fg-muted/60'
                      : isSelected
                      ? 'text-fg'
                      : isDone
                      ? 'text-fg'
                      : 'text-fg-muted'
                  }`}>
                    {tab.label}
                  </span>
                </div>
                {isDone ? (
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded border shrink-0 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20">
                    ✓ Done
                  </span>
                ) : !unlocked ? (
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded border shrink-0 bg-overlay text-fg-muted/60 border-hairline">
                    Locked
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>

        {/* Tab 1: evaluate_policy Tool Actuator */}
        {activeStepTab === 'tool' && (
          <div className="space-y-4 animate-rise">
            <PythonCodeHighlight
              code={EVALUATE_POLICY_CODE_SNIPPET}
              filename="lib/tools.py (evaluate_policy)"
              editable={false}
              showCopy={false}
              className="max-h-[500px]"
            />

            {/* Help cards grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5 pt-2">
              {EVALUATE_TOOL_EXPLANATIONS.map((item, idx) => (
                <div key={idx} className="p-4 bg-card rounded-2xl border border-hairline shadow-sm space-y-1.5">
                  <h5 className="text-sm font-semibold text-fg flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-vibe-cyan shrink-0" />
                    {item.title}
                  </h5>
                  <p className="text-sm text-fg-muted leading-relaxed font-sans">{item.description}</p>
                </div>
              ))}
            </div>

            {/* Action Instruction & Next Navigation Bar */}
            <div className="pt-4 border-t border-hairline flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3 min-w-0">
                <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 border ${
                  isToolEquipped
                    ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-400'
                    : isLight
                    ? 'bg-slate-100 border-slate-200 text-slate-500'
                    : 'bg-overlay border-hairline text-fg-muted'
                }`}>
                  {isToolEquipped ? <Check size={16} /> : <Cpu size={16} />}
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-fg font-sans">
                    {isToolEquipped ? (
                      <span className="text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5 font-mono">
                        Tool <code className="font-bold">evaluate_policy</code> equipped in <code className="font-bold">tools=[evaluate_policy]</code> above.
                      </span>
                    ) : (
                      <span>
                        Equip the simulation actuator by registering <code className={`font-mono text-xs px-1.5 py-0.5 rounded ${codeTagClass}`}>evaluate_policy</code> in <code className="font-mono text-fg font-bold">tools=[...]</code> above.
                      </span>
                    )}
                  </p>
                </div>
              </div>

              <button
                type="button"
                disabled={!isToolEquipped}
                onClick={() => isToolEquipped && setActiveStepTab('prompt')}
                className={`px-5 py-2.5 rounded-xl font-mono text-xs font-bold transition-all flex items-center justify-center gap-2 shrink-0 ${
                  isToolEquipped
                    ? 'bg-vibe-cyan hover:bg-vibe-cyan/90 text-black shadow-md cursor-pointer hover:shadow-vibe-cyan/20'
                    : isLight
                    ? 'bg-slate-100 text-slate-400 border border-slate-200 opacity-60 cursor-not-allowed'
                    : 'bg-overlay text-fg-muted border border-hairline opacity-40 cursor-not-allowed'
                }`}
                title={isToolEquipped ? 'Advance to next step' : 'Equip evaluate_policy in the tools array above to unlock'}
              >
                <span>|&gt; Next</span>
              </button>
            </div>

            {/* Reveal Hint Component */}
            {!isToolEquipped && (
              <div className={`rounded-2xl border p-4 space-y-3 transition-colors ${
                isLight
                  ? 'bg-amber-50/70 border-amber-200/90 text-slate-900 shadow-xs'
                  : 'bg-overlay/30 border-hairline text-fg'
              }`}>
                <div className="flex items-center justify-between">
                  <button
                    type="button"
                    onClick={() => toggleHint('tool')}
                    className="text-sm font-mono font-bold text-amber-700 dark:text-amber-400 hover:text-amber-800 dark:hover:text-amber-300 flex items-center gap-2 cursor-pointer transition-colors"
                  >
                    <Lightbulb size={16} className="text-amber-600 dark:text-amber-400 shrink-0" />
                    <span>{revealedHints['tool'] ? 'Hide Hint' : 'Reveal Hint'}</span>
                  </button>
                </div>

                {revealedHints['tool'] && (
                  <div className={`pt-3 border-t space-y-2.5 animate-rise ${isLight ? 'border-amber-200/80' : 'border-hairline'}`}>
                    <p className={`text-sm font-sans leading-relaxed ${isLight ? 'text-slate-800 font-medium' : 'text-fg'}`}>
                      {STEP_HINTS['tool'].text}
                    </p>
                    <div className={`p-2.5 sm:p-3 rounded-xl border font-mono text-sm flex items-center justify-between gap-3 ${
                      isLight
                        ? 'bg-white border-slate-200 text-slate-900 shadow-xs'
                        : 'bg-slate-950 border-slate-800 text-amber-300 shadow-inner'
                    }`}>
                      <code className="overflow-x-auto select-all py-0.5">{STEP_HINTS['tool'].code}</code>
                      <button
                        type="button"
                        onClick={() => handleCopyHint('tool')}
                        className={`px-2.5 py-1 rounded-lg border text-xs font-mono font-medium transition-all flex items-center gap-1.5 shrink-0 cursor-pointer ${
                          copiedHint === 'tool'
                            ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-400 font-semibold'
                            : isLight
                            ? 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-200'
                            : 'bg-overlay hover:bg-hairline text-fg-muted hover:text-fg border-hairline'
                        }`}
                        title="Copy hint code to clipboard"
                      >
                        {copiedHint === 'tool' ? (
                          <>
                            <Check size={13} className="text-emerald-500" />
                            <span>Copied!</span>
                          </>
                        ) : (
                          <>
                            <Copy size={13} />
                            <span>Copy</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Tab 2: judge_prompt.md Judge Instructions */}
        {activeStepTab === 'prompt' && (
          <div className="space-y-4 animate-rise">
            <PythonCodeHighlight
              code={JUDGE_SYSTEM_PROMPT_SNIPPET}
              filename="judge_prompt.md"
              editable={false}
              showCopy={false}
              className="max-h-[500px]"
            />

            {/* Help cards grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5 pt-2">
              {JUDGE_PROMPT_EXPLANATIONS.map((item, idx) => (
                <div key={idx} className="p-4 bg-card rounded-2xl border border-hairline shadow-sm space-y-1.5">
                  <h5 className="text-sm font-semibold text-fg flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-purple-500 shrink-0" />
                    {item.title}
                  </h5>
                  <p className="text-sm text-fg-muted leading-relaxed font-sans">{item.description}</p>
                </div>
              ))}
            </div>

            {/* Action Instruction Bar */}
            <div className="pt-4 border-t border-hairline flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3 min-w-0">
                <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 border ${
                  isInstructionBound
                    ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-400'
                    : isLight
                    ? 'bg-slate-100 border-slate-200 text-slate-500'
                    : 'bg-overlay border-hairline text-fg-muted'
                }`}>
                  {isInstructionBound ? <Check size={16} /> : <FileText size={16} />}
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-fg font-sans">
                    {isInstructionBound ? (
                      <span className="text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5 font-mono">
                        Prompt specification bound to <code className="font-bold">instruction=PROMPT_PATH.read_text(encoding="utf-8")</code> above.
                      </span>
                    ) : (
                      <span>
                        Equip the judge prompt specification by setting <code className={`font-mono text-xs px-1.5 py-0.5 rounded ${codeTagClass}`}>instruction=PROMPT_PATH.read_text(encoding="utf-8")</code> in <code className="font-mono text-fg font-bold">judge_agent</code> above.
                      </span>
                    )}
                  </p>
                </div>
              </div>

              {isJudgeReady && (
                <button
                  type="button"
                  onClick={() => executionSectionRef.current?.scrollIntoView({ behavior: 'smooth' })}
                  className="px-4 py-2 bg-vibe-cyan hover:bg-vibe-cyan/90 text-black rounded-xl text-xs font-semibold font-mono flex items-center justify-center gap-1.5 transition-all shadow-sm shrink-0 cursor-pointer"
                >
                  <span>Run Judge Agent ↓</span>
                </button>
              )}
            </div>

            {/* Reveal Hint Component */}
            {!isInstructionBound && (
              <div className={`rounded-2xl border p-4 space-y-3 transition-colors ${
                isLight
                  ? 'bg-amber-50/70 border-amber-200/90 text-slate-900 shadow-xs'
                  : 'bg-overlay/30 border-hairline text-fg'
              }`}>
                <div className="flex items-center justify-between">
                  <button
                    type="button"
                    onClick={() => toggleHint('prompt')}
                    className="text-sm font-mono font-bold text-amber-700 dark:text-amber-400 hover:text-amber-800 dark:hover:text-amber-300 flex items-center gap-2 cursor-pointer transition-colors"
                  >
                    <Lightbulb size={16} className="text-amber-600 dark:text-amber-400 shrink-0" />
                    <span>{revealedHints['prompt'] ? 'Hide Hint' : 'Reveal Hint'}</span>
                  </button>
                </div>

                {revealedHints['prompt'] && (
                  <div className={`pt-3 border-t space-y-2.5 animate-rise ${isLight ? 'border-amber-200/80' : 'border-hairline'}`}>
                    <p className={`text-sm font-sans leading-relaxed ${isLight ? 'text-slate-800 font-medium' : 'text-fg'}`}>
                      {STEP_HINTS['prompt'].text}
                    </p>
                    <div className={`p-2.5 sm:p-3 rounded-xl border font-mono text-sm flex items-center justify-between gap-3 ${
                      isLight
                        ? 'bg-white border-slate-200 text-slate-900 shadow-xs'
                        : 'bg-slate-950 border-slate-800 text-amber-300 shadow-inner'
                    }`}>
                      <code className="overflow-x-auto select-all py-0.5">{STEP_HINTS['prompt'].code}</code>
                      <button
                        type="button"
                        onClick={() => handleCopyHint('prompt')}
                        className={`px-2.5 py-1 rounded-lg border text-xs font-mono font-medium transition-all flex items-center gap-1.5 shrink-0 cursor-pointer ${
                          copiedHint === 'prompt'
                            ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-400 font-semibold'
                            : isLight
                            ? 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-200'
                            : 'bg-overlay hover:bg-hairline text-fg-muted hover:text-fg border-hairline'
                        }`}
                        title="Copy hint code to clipboard"
                      >
                        {copiedHint === 'prompt' ? (
                          <>
                            <Check size={13} className="text-emerald-500" />
                            <span>Copied!</span>
                          </>
                        ) : (
                          <>
                            <Copy size={13} />
                            <span>Copy</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* 4. Live Agent Execution & Policy Evaluation Suite */}
      <div ref={executionSectionRef} className="space-y-6 pt-4 border-t border-hairline">
        {!isJudgeReady ? (
          /* Locked State Banner */
          <div className="p-8 rounded-3xl border-2 border-dashed border-hairline bg-card/40 opacity-80 flex flex-col items-center justify-center text-center space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-overlay border border-hairline flex items-center justify-center text-fg-muted">
              <Lock size={22} />
            </div>
            <h4 className="text-base font-bold text-fg">
              Judge Agent Execution &amp; Policy Evaluation (Locked)
            </h4>
            <p className="text-sm text-fg-muted max-w-lg font-sans">
              Register <code className="text-fg font-semibold">evaluate_policy</code> in <code className="text-fg font-semibold">tools=[...]</code> and bind the judge prompt in <code className="text-fg font-semibold">instruction=...</code> above to unlock live policy evaluation.
            </p>
            <div className="text-sm font-mono text-amber-600 dark:text-amber-400 font-bold">
              Prompt: {isInstructionBound ? '✓ Bound' : 'Pending'} · Tool: {isToolEquipped ? '✓ Equipped' : 'Pending'}
            </div>
          </div>
        ) : (
          /* Unlocked Execution Panel */
          <div className="space-y-6 animate-rise">
            {/* Cloud Shell CLI Execution Box */}
            <div className="p-5 rounded-2xl border border-slate-300 dark:border-slate-700/60 bg-slate-100 dark:bg-slate-900 text-slate-900 dark:text-white font-mono text-xs shadow-xl space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-300 dark:border-slate-800 pb-3">
                <div className="flex items-center gap-2">
                  <Terminal size={16} className="text-cyan-700 dark:text-vibe-cyan" />
                  <span className="font-bold text-sm text-slate-900 dark:text-slate-100">Cloud Shell CLI Execution</span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleCopyCli}
                    className="px-3.5 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-800 dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-slate-200 hover:text-slate-950 dark:hover:text-white rounded-lg border border-slate-300 dark:border-slate-700 transition-all flex items-center gap-1.5 cursor-pointer text-xs font-semibold"
                  >
                    {copiedCli ? (
                      <>
                        <Check size={13} className="text-emerald-600 dark:text-emerald-400" />
                        <span className="text-emerald-700 dark:text-emerald-400 font-bold">Copied!</span>
                      </>
                    ) : (
                      <>
                        <Copy size={13} />
                        <span>Copy Command</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              <div className="p-3 bg-white dark:bg-slate-950/90 rounded-xl border border-slate-300 dark:border-slate-800 text-cyan-950 dark:text-cyan-300 select-all overflow-x-auto font-mono text-xs font-bold leading-relaxed shadow-inner">
                {CLI_COMMAND}
              </div>

              <div className="text-sm text-slate-600 dark:text-slate-400 font-sans">
                Run this simulation audit in Cloud Shell, or test policies directly in the workbench using the suite below.
              </div>
            </div>

            {/* Interactive Policy Evaluation Suite (Simulation Critique) */}
            <div className="p-6 md:p-8 bg-card rounded-3xl border border-hairline shadow-2xl space-y-6">
              {/* Header & Controls */}
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-5 border-b border-hairline">
                <div>
                  <h3 className="text-lg font-bold text-fg flex items-center gap-2">
                    <Activity size={20} className="text-purple-600 dark:text-purple-400" />
                    <span>Execute Judge Agent on Candidate Policies</span>
                  </h3>
                  <p className="text-sm text-fg-muted mt-1 font-sans">
                    Select a policy below and run the Judge Agent to simulate 24-hour auction traffic and inspect performance critiques.
                  </p>
                </div>

                <div className="flex items-center gap-3 shrink-0">
                  {evaluatingPolicy ? (
                    <div className="px-5 py-2.5 bg-purple-500/15 border border-purple-500/40 text-purple-700 dark:text-purple-300 rounded-xl text-sm font-mono font-bold flex items-center gap-2 shadow-sm animate-pulse">
                      <RefreshCw size={15} className="animate-spin" />
                      <span>Simulating {evaluations[evaluatingPolicy].label}...</span>
                    </div>
                  ) : (
                    <button
                      onClick={() => handleEvaluatePolicy(activePolicy)}
                      className="px-5 py-2.5 bg-purple-600 hover:bg-purple-700 text-white font-semibold text-sm rounded-xl transition-all shadow-md flex items-center gap-2 cursor-pointer"
                    >
                      <Play size={14} className="fill-white" />
                      <span>Run Judge Agent</span>
                    </button>
                  )}
                </div>
              </div>

              {/* 3 Policy Selection Cards */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {(['baseline', 'heuristic', 'agentic'] as PolicyKey[]).map((key) => {
                  const pol = evaluations[key];
                  const isEvaluating = evaluatingPolicy === key;
                  const isActive = activePolicy === key;
                  const isEvaluated = evaluatedPolicies[key];

                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => {
                        if (evaluatingPolicy !== null) return;
                        setActivePolicy(key);
                      }}
                      disabled={evaluatingPolicy !== null}
                      className={`p-4 rounded-2xl border-2 text-left transition-all flex flex-col justify-between gap-3 relative cursor-pointer disabled:cursor-not-allowed ${
                        isActive
                          ? !isEvaluated
                            ? 'bg-purple-500/10 border-purple-500/70 shadow-lg shadow-purple-500/10 ring-1 ring-purple-500/30'
                            : pol.colorTheme === 'red'
                            ? 'bg-red-500/10 border-red-500/70 shadow-lg shadow-red-500/10 ring-1 ring-red-500/30'
                            : pol.colorTheme === 'amber'
                            ? 'bg-amber-500/10 border-amber-500/70 shadow-lg shadow-amber-500/10 ring-1 ring-amber-500/30'
                            : 'bg-emerald-500/10 border-emerald-500/70 shadow-lg shadow-emerald-500/10 ring-1 ring-emerald-500/30'
                          : 'bg-card border-hairline hover:border-purple-500/40 hover:bg-overlay'
                      }`}
                    >
                      <div className="flex items-center justify-between w-full">
                        <span className="text-xs font-semibold uppercase tracking-wider px-2.5 py-0.5 rounded-md bg-overlay border border-hairline text-fg-muted">
                          {pol.badge}
                        </span>
                        {isEvaluated ? (
                          <span className={`text-xs font-mono font-bold px-2.5 py-0.5 rounded-full border ${
                            pol.colorTheme === 'red'
                              ? 'bg-red-100 text-red-900 border-red-300 dark:bg-red-500/20 dark:text-red-300 dark:border-red-500/40'
                              : pol.colorTheme === 'amber'
                              ? 'bg-amber-100 text-amber-950 border-amber-300 dark:bg-amber-500/20 dark:text-amber-300 dark:border-amber-500/40'
                              : 'bg-emerald-100 text-emerald-950 border-emerald-300 dark:bg-emerald-500/20 dark:text-emerald-300 dark:border-emerald-500/40'
                          }`}>
                            {pol.score}/100
                          </span>
                        ) : (
                          <span className="text-xs font-mono font-medium px-2.5 py-0.5 rounded-full border bg-overlay border-hairline text-fg-muted">
                            Awaiting Run
                          </span>
                        )}
                      </div>

                      <div>
                        <h4 className="text-sm font-bold font-mono text-fg">{pol.label}</h4>
                        <p className="text-sm text-fg-muted font-sans mt-1 line-clamp-2">
                          {isEvaluated ? pol.verdict : pol.description}
                        </p>
                      </div>

                      <div className="w-full pt-2 border-t border-hairline flex items-center justify-between text-xs font-mono font-bold">
                        {isEvaluating ? (
                          <span className="text-purple-600 dark:text-purple-400 flex items-center gap-1.5 animate-pulse text-xs">
                            <RefreshCw size={13} className="animate-spin" /> Simulating auctions...
                          </span>
                        ) : isEvaluated ? (
                          isActive ? (
                            <span className={`flex items-center gap-1.5 text-xs ${
                              pol.colorTheme === 'red'
                                ? 'text-red-700 dark:text-red-400'
                                : pol.colorTheme === 'amber'
                                ? 'text-amber-700 dark:text-amber-400'
                                : 'text-emerald-700 dark:text-emerald-400'
                            }`}>
                              <CheckCircle2 size={13} /> Active Critique
                            </span>
                          ) : (
                            <span className="text-fg-muted flex items-center gap-1.5 text-xs hover:text-fg">
                              <CheckCircle2 size={13} /> View Results →
                            </span>
                          )
                        ) : isActive ? (
                          <span className="text-purple-700 dark:text-purple-400 flex items-center gap-1.5 text-xs font-semibold">
                            <Play size={12} className="fill-current" /> Selected · Ready to Run
                          </span>
                        ) : (
                          <span className="text-fg-muted flex items-center gap-1.5 text-xs hover:text-fg">
                            Select Policy →
                          </span>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Area Below Cards: Loading State, Awaiting Run Prompt, or Full Critique Display */}
              {evaluatingPolicy === activePolicy ? (
                <div className="p-10 rounded-2xl border-2 border-purple-500/30 bg-purple-500/5 flex flex-col items-center justify-center text-center space-y-4 animate-pulse">
                  <div className="w-14 h-14 rounded-2xl bg-purple-500/20 text-purple-600 dark:text-purple-400 flex items-center justify-center border border-purple-500/40 shadow-sm">
                    <RefreshCw size={26} className="animate-spin" />
                  </div>
                  <div className="space-y-1">
                    <h4 className="text-base font-bold text-fg">
                      Executing Judge Agent on {currentEvaluation.label}...
                    </h4>
                    <p className="text-sm text-fg-muted max-w-md font-sans">
                      Simulating 48 half-hour auction intervals in-memory via <code className={`font-mono text-xs px-1.5 py-0.5 rounded ${codeTagClass}`}>evaluate_policy()</code> and generating live Gemini microeconomic critique.
                    </p>
                  </div>
                  <div className="flex items-center gap-2 text-xs font-mono text-purple-600 dark:text-purple-400 font-semibold bg-purple-500/10 px-3 py-1.5 rounded-full border border-purple-500/20">
                    <Cpu size={13} />
                    <span>ADK LlmAgent: simulation_judge · Gemini Live Run</span>
                  </div>
                </div>
              ) : !evaluatedPolicies[activePolicy] ? (
                <div className="p-8 sm:p-12 rounded-2xl border-2 border-dashed border-hairline bg-card/60 flex flex-col items-center justify-center text-center space-y-4">
                  <div className="w-14 h-14 rounded-2xl bg-purple-500/10 text-purple-600 dark:text-purple-400 flex items-center justify-center border border-purple-500/20 shadow-sm">
                    <Cpu size={26} />
                  </div>
                  <div className="space-y-1.5 max-w-lg">
                    <h4 className="text-base font-bold text-fg">
                      Awaiting Judge Agent Run: {currentEvaluation.label}
                    </h4>
                    <p className="text-sm text-fg-muted font-sans leading-relaxed">
                      Execute the Judge Agent to simulate this policy across 48 auction intervals using <code className={`font-mono text-xs px-1.5 py-0.5 rounded ${codeTagClass}`}>evaluate_policy()</code> to evaluate budget pacing, flight survival, and formulate algorithmic critiques.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleEvaluatePolicy(activePolicy)}
                    className="px-6 py-3 bg-purple-600 hover:bg-purple-700 text-white font-semibold text-sm rounded-xl transition-all shadow-md flex items-center gap-2 cursor-pointer hover:scale-[1.02]"
                  >
                    <Play size={15} className="fill-white" />
                    <span>Run Judge Agent</span>
                  </button>
                </div>
              ) : (
                /* Selected Policy Critique Display */
                <div className={`p-6 rounded-2xl border-2 space-y-4 animate-rise transition-all ${
                  currentEvaluation.colorTheme === 'red'
                    ? 'border-red-300 dark:border-red-500/30 bg-red-50/50 dark:bg-red-500/5'
                    : currentEvaluation.colorTheme === 'amber'
                    ? 'border-amber-300 dark:border-amber-500/30 bg-amber-50/50 dark:bg-amber-500/5'
                    : 'border-emerald-300 dark:border-emerald-500/30 bg-emerald-50/50 dark:bg-emerald-500/5'
                }`}>
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-hairline pb-3 gap-2">
                    <span className="text-sm font-bold text-fg flex items-center gap-2">
                      <CheckCircle2 size={18} className={
                        currentEvaluation.colorTheme === 'red'
                          ? 'text-red-600 dark:text-red-400'
                          : currentEvaluation.colorTheme === 'amber'
                          ? 'text-amber-600 dark:text-amber-400'
                          : 'text-emerald-600 dark:text-emerald-400'
                      } />
                      <span>Judge Telemetry &amp; Critique: {currentEvaluation.label}</span>
                      <span className="text-fg-muted font-normal text-xs font-mono">({currentEvaluation.sourceStep})</span>
                    </span>
                    <span className={`text-xs font-mono font-bold px-3 py-1 rounded-full border ${
                      currentEvaluation.colorTheme === 'red'
                        ? 'bg-red-100 text-red-900 border-red-300 dark:bg-red-500/20 dark:text-red-300 dark:border-red-500/40'
                        : currentEvaluation.colorTheme === 'amber'
                        ? 'bg-amber-100 text-amber-950 border-amber-300 dark:bg-amber-500/20 dark:text-amber-300 dark:border-amber-500/40'
                        : 'bg-emerald-100 text-emerald-950 border-emerald-300 dark:bg-emerald-500/20 dark:text-emerald-300 dark:border-emerald-500/40'
                    }`}>
                      Score: {currentEvaluation.score}/100 · {currentEvaluation.verdict}
                    </span>
                  </div>

                  {/* 4 Quantitative Telemetry Cards */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs font-mono">
                    <div className="bg-card p-3.5 rounded-xl border border-hairline shadow-sm space-y-0.5">
                      <span className="text-fg-muted text-xs block uppercase tracking-wider font-semibold font-sans">Impressions Won</span>
                      <span className="text-fg font-bold text-base font-mono">{currentEvaluation.impressions.toLocaleString()}</span>
                    </div>
                    <div className="bg-card p-3.5 rounded-xl border border-hairline shadow-sm space-y-0.5">
                      <span className="text-fg-muted text-xs block uppercase tracking-wider font-semibold font-sans">Spend / Budget</span>
                      <span className="text-fg font-bold text-base font-mono">
                        ${currentEvaluation.spend.toFixed(2)} ({currentEvaluation.budget_utilization.toFixed(1)}%)
                      </span>
                    </div>
                    <div className="bg-card p-3.5 rounded-xl border border-hairline shadow-sm space-y-0.5">
                      <span className="text-fg-muted text-xs block uppercase tracking-wider font-semibold font-sans">Effective CPM</span>
                      <span className="text-fg font-bold text-base font-mono">${currentEvaluation.ecpm.toFixed(2)}</span>
                    </div>
                    <div className="bg-card p-3.5 rounded-xl border border-hairline shadow-sm space-y-0.5">
                      <span className="text-fg-muted text-xs block uppercase tracking-wider font-semibold font-sans">Flight Survival</span>
                      <span className={`font-bold text-base font-mono ${
                        currentEvaluation.colorTheme === 'red'
                          ? 'text-red-700 dark:text-red-400'
                          : currentEvaluation.colorTheme === 'amber'
                          ? 'text-amber-700 dark:text-amber-400'
                          : 'text-emerald-700 dark:text-emerald-400'
                      }`}>
                        {currentEvaluation.exhausted_hour}
                      </span>
                    </div>
                  </div>

                  {/* Judge Agent Markdown Output Codeblock */}
                  <div className="pt-2">
                    <MarkdownCodeHighlight
                      code={getEvaluationMarkdown(currentEvaluation)}
                      filename={`judge_critique_${currentEvaluation.key}.md`}
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Milestone CTA Banner */}
            {Object.values(evaluatedPolicies).some(Boolean) ? (
              <div className="p-6 bg-gradient-to-r from-purple-500/10 via-indigo-500/10 to-vibe-cyan/10 rounded-3xl border border-purple-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-xl animate-rise">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-purple-500/20 text-purple-600 dark:text-purple-400 flex items-center justify-center shrink-0 border border-purple-500/30 shadow-sm">
                    <CheckCircle2 size={22} />
                  </div>
                  <div>
                    <h4 className="text-base font-bold text-fg">Judge Agent Assembled &amp; Verified</h4>
                    <p className="text-sm text-fg-muted font-sans">
                      Now wire the Generator Agent and Judge Agent together into the closed-loop optimization graph.
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => navigate('flywheel')}
                  className="px-6 py-3 bg-vibe-cyan hover:bg-vibe-cyan/90 text-black font-semibold text-sm rounded-xl transition-all shadow-md flex items-center gap-2 cursor-pointer shrink-0"
                >
                  <span>Proceed to Step 7: Optimization Loop</span>
                  <ArrowRight size={15} />
                </button>
              </div>
            ) : (
              <div className="p-5 rounded-2xl border border-dashed border-hairline bg-card/30 flex items-center justify-between gap-4 text-fg-muted text-sm font-sans">
                <div className="flex items-center gap-2.5">
                  <Activity size={18} className="text-purple-500 shrink-0" />
                  <span>Select a candidate policy above and click <strong>Run Judge Agent</strong> to simulate auction performance and verify critique telemetry.</span>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

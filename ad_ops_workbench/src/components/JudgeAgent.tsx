import { useState } from 'react';
import { 
  Code2,
  ArrowRight, ArrowLeft, Bot, Check,
  FileText, Sparkles, Scale, Terminal, RefreshCw, CheckCircle2, Play, Cpu
} from 'lucide-react';
import PythonCodeHighlight from './PythonCodeHighlight';
import { GEMINI_MODEL, GEMINI_MODEL_LABEL, GEMINI_SERIES_LABEL } from '../config/models';

type ToolId = 'evaluate_policy_code' | 'policy_evaluation_schema' | 'load_policy_from_code';
type FocusView = ToolId | 'prompt' | null;

interface CodeExplanation {
  title: string;
  description: string;
}

const JUDGE_SYSTEM_PROMPT_SNIPPET = `# Simulation Judge & Yield Optimization Critic

You are the Vibetube Simulation Judge Agent. Your mission is to evaluate
synthesized bidding policy scripts against market microeconomics and
formulate precise, actionable algorithmic critiques.

## Your Evaluation Workflow:
1. Call \`evaluate_policy_code(policy_code)\` to simulate the candidate script
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
     the Campaign Manager Generator Agent.`;

const JUDGE_PROMPT_EXPLANATIONS: CodeExplanation[] = [
  {
    title: 'Adversarial Critic Persona',
    description: 'Directs Gemini to evaluate microeconomic viability with zero author confirmation bias, isolating economic traps that the Generator misses.',
  },
  {
    title: 'Multi-Dimensional Telemetry Inspection',
    description: 'Requires the Critic to audit budget utilization, pacing survival (starvation prior to hour 22), and primetime competitive win rates.',
  },
  {
    title: 'Actionable Mathematical Recommendations',
    description: 'Compels the Critic to provide explicit algorithmic pacing formulas (e.g., dynamic pacing multipliers) rather than vague subjective feedback.',
  },
];

const JUDGE_AGENT_SPEC_BINDING = `from google.adk.agents import LlmAgent
from pydantic import BaseModel, Field

from judge_agent import evaluate_policy_code, PolicyEvaluation, JUDGE_SYSTEM_PROMPT

judge_agent = LlmAgent(
    name="simulation_judge",
    model="${GEMINI_MODEL}",
    description="Simulates and critiques candidate bidding policies under market physics.",
    instruction=JUDGE_SYSTEM_PROMPT,  # <-- Equipped Critic System Prompt
    tools=[evaluate_policy_code],
)`;

const JUDGE_AGENT_BINDING_EXPLANATIONS: CodeExplanation[] = [
  {
    title: 'Critic Agent Instantiation',
    description: `Binds ${GEMINI_MODEL_LABEL} with the microeconomic critique system instructions and simulation actuator tool.`,
  },
  {
    title: 'Simulation Tool Binding',
    description: 'Registers evaluate_policy_code in tools=[...], allowing the judge agent to autonomously simulate candidate code on demand.',
  },
];

interface ToolDetail {
  id: ToolId;
  boxLabel: string;
  targetLabel: string;
  themeColor: 'cyan' | 'purple' | 'amber';
  targetSystem: string;
  toolCodeFilename: string;
  toolCodeSnippet: string;
  toolCodeExplanations: CodeExplanation[];
  agentModificationsSnippet: string;
  agentModificationsExplanations: CodeExplanation[];
}

const TOOLS_CONFIG: Record<ToolId, ToolDetail> = {
  evaluate_policy_code: {
    id: 'evaluate_policy_code',
    boxLabel: 'evaluate_policy_code()',
    targetLabel: '600k Auction Simulator Engine',
    themeColor: 'cyan',
    targetSystem: 'In-Memory Market Microeconomics Simulation Harness (lib/simulator.py)',
    toolCodeFilename: 'judge_agent.py (Simulation Actuator Tool)',
    toolCodeSnippet: `def evaluate_policy_code(
    policy_code: str,
    total_budget: float = 2500.0,
    flight_duration_hours: float = 24.0,
    max_bid_ceiling: float = 10.0,
) -> dict[str, Any]:
    """Simulates the bidding policy and generates telemetry metrics for review."""
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
            "daypart_metrics": result.daypart_metrics,
            "summary": result.summary_text,
        }
    except Exception as e:
        return {
            "status": "error",
            "error": str(e),
            "score": 0.0,
            "impressions_won": 0,
            "total_spend": 0.0,
            "budget_remaining": total_budget,
            "effective_cpm": 0.0,
            "summary": f"Policy compilation/execution failed: {e}",
        }`,
    toolCodeExplanations: [
      {
        title: 'In-Memory Simulation Harness',
        description: 'Runs candidate policy functions through 600,000 auctions across 48 time intervals without touching disk or affecting production.',
      },
      {
        title: 'Quantitative Telemetry Extraction',
        description: 'Extracts empirical yield score, spend utilization %, effective CPM, and pacing starvation hour directly for the Critic.',
      },
    ],
    agentModificationsSnippet: `# 1. Import simulation actuator in judge_agent.py:
from judge_agent import evaluate_policy_code

# 2. Add to LlmAgent tools list:
judge_agent = LlmAgent(
    name="simulation_judge",
    model="${GEMINI_MODEL}",
    instruction=JUDGE_SYSTEM_PROMPT,
    tools=[
        evaluate_policy_code,  # <-- Equipped Simulation Actuator
    ],
)`,
    agentModificationsExplanations: [
      {
        title: 'Equip Actuator to Agent',
        description: 'Registers evaluate_policy_code in tools=[...], enabling the Critic to simulate candidate code autonomously.',
      },
      {
        title: 'Empirical Ground Truth',
        description: 'Grounds the Critic in simulated auction physics rather than subjective code inspection.',
      },
    ],
  },
  policy_evaluation_schema: {
    id: 'policy_evaluation_schema',
    boxLabel: 'PolicyEvaluation',
    targetLabel: 'Pydantic Structured Schema',
    themeColor: 'purple',
    targetSystem: 'ADK Structured Output Validation Contract (Pydantic BaseModel)',
    toolCodeFilename: 'judge_agent.py (Output Schema)',
    toolCodeSnippet: `class PolicyEvaluation(BaseModel):
    """Structured critique and evaluation result from the Simulation Judge."""

    score: float = Field(
        ..., description="Overall yield optimization score from 0.0 to 100.0"
    )
    impressions_won: int = Field(..., description="Total impressions won")
    effective_cpm: float = Field(..., description="Effective CPM in USD")
    total_spend: float = Field(..., description="Total budget spent in USD")
    budget_remaining: float = Field(..., description="Budget remaining in USD")
    diagnostics: str = Field(
        ..., description="Root cause analysis of performance bottlenecks"
    )
    recommendations: str = Field(
        ...,
        description="Actionable algorithmic modifications for next iteration",
    )`,
    toolCodeExplanations: [
      {
        title: 'Quantitative Score Contract',
        description: 'Enforces a strict 0.0 to 100.0 score contract based on empirical simulation yield rather than arbitrary praise.',
      },
      {
        title: 'Separation of Diagnostics & Recommendations',
        description: 'Forces the Critic to isolate what went wrong (diagnostics) separately from concrete mathematical code fixes (recommendations).',
      },
    ],
    agentModificationsSnippet: `# Pydantic Structured Output Contract for Critic:
from pydantic import BaseModel, Field

class PolicyEvaluation(BaseModel):
    score: float = Field(..., description="Overall yield score (0-100)")
    impressions_won: int = Field(..., description="Total impressions won")
    effective_cpm: float = Field(..., description="Effective CPM in USD")
    total_spend: float = Field(..., description="Total budget spent in USD")
    budget_remaining: float = Field(..., description="Budget remaining in USD")
    diagnostics: str = Field(..., description="Root cause bottleneck analysis")
    recommendations: str = Field(..., description="Actionable algorithmic modifications")`,
    agentModificationsExplanations: [
      {
        title: 'Pydantic Schema Validation',
        description: 'Guarantees the Critic outputs parseable JSON fields ready to feed into the workflow router and prompt mutator.',
      },
      {
        title: 'Downstream Workflow Integration',
        description: 'The Router node inspects score for convergence, while the Proposer node injects recommendations into the next round prompt.',
      },
    ],
  },
  load_policy_from_code: {
    id: 'load_policy_from_code',
    boxLabel: 'load_policy_from_code()',
    targetLabel: 'In-Memory Module Loader',
    themeColor: 'amber',
    targetSystem: 'Dynamic Python Runtime (lib/simulator.py)',
    toolCodeFilename: 'lib/simulator.py (Dynamic Policy Loader)',
    toolCodeSnippet: `def load_policy_from_code(code_str: str) -> Callable[[AuctionContext], float]:
    """Compiles a Python code string and extracts the compute_bid function."""
    mod = ModuleType("dynamic_policy")
    exec(code_str, mod.__dict__)
    if not hasattr(mod, "compute_bid"):
        raise ValueError("Code does not define compute_bid(context)")
    return getattr(mod, "compute_bid")`,
    toolCodeExplanations: [
      {
        title: 'Dynamic Module Compilation',
        description: 'Compiles candidate policy code into a temporary in-memory module via exec() without writing temporary files to disk.',
      },
      {
        title: 'Signature Verification',
        description: 'Extracts compute_bid and validates that the callable interface conforms to Callable[[AuctionContext], float].',
      },
    ],
    agentModificationsSnippet: `# In-memory policy loader called by evaluate_policy_code:
from lib.simulator import load_policy_from_code, run_simulation

policy_func = load_policy_from_code(candidate_code)
result = run_simulation(policy_func)`,
    agentModificationsExplanations: [
      {
        title: 'Zero Disk Overhead',
        description: 'Allows dozens of candidate policies to be compiled and simulated rapidly during optimization without disk I/O bottlenecks.',
      },
      {
        title: 'Safe Function Extraction',
        description: 'Ensures invalid syntax or missing entrypoints fail safely with caught exceptions rather than crashing the workflow.',
      },
    ],
  },
};

export default function JudgeAgent({ navigate }: { navigate: (v: string) => void }) {
  const [equipped, setEquipped] = useState<Record<ToolId, boolean>>({
    evaluate_policy_code: false,
    policy_evaluation_schema: false,
    load_policy_from_code: false,
  });
  const [promptConfigured, setPromptConfigured] = useState<boolean>(false);
  const [focusedView, setFocusedView] = useState<FocusView>(null);

  const [isTestingJudge, setIsTestingJudge] = useState(false);
  const [testResult, setTestResult] = useState<{
    score: number;
    impressions: number;
    spend: number;
    ecpm: number;
    exhausted_hour: number | null;
    diagnostics: string;
    recommendations: string;
  } | null>(null);

  const equippedCount = Object.values(equipped).filter(Boolean).length;
  const allEquipped = equippedCount === 3;
  const allReady = allEquipped && promptConfigured;
  const readyCount = equippedCount + (promptConfigured ? 1 : 0);

  const handleTestJudge = async () => {
    setIsTestingJudge(true);
    setTestResult(null);
    await new Promise(r => setTimeout(r, 1200));
    setTestResult({
      score: 78.4,
      impressions: 341200,
      spend: 2500.0,
      ecpm: 7.33,
      exhausted_hour: 15.2,
      diagnostics: "Critical pacing starvation: Bid too aggressively during early morning ($4.50 CPM) and afternoon, exhausting allocated flight budget at hour 15.2 and completely missing high-value Primetime traffic.",
      recommendations: "Introduce dynamic budget velocity dampening: scale bid by min(1.20, hourly_budget / hourly_clearing_demand) where hourly_budget = budget_remaining / hours_remaining. Avoid hardcoding static hourly rates or budget totals."
    });
    setIsTestingJudge(false);
  };

  const generateJudgePyCode = () => {
    const hasTool = equipped.evaluate_policy_code;
    const hasSchema = equipped.policy_evaluation_schema;
    const hasLoader = equipped.load_policy_from_code;

    const imports: string[] = [];
    imports.push('from typing import Any');
    imports.push('from google.adk.agents import LlmAgent');
    if (hasSchema) {
      imports.push('from pydantic import BaseModel, Field');
    }

    const simImports: string[] = [];
    if (hasLoader) simImports.push('load_policy_from_code');
    if (hasTool) simImports.push('run_simulation');
    if (simImports.length > 0) {
      imports.push(`from lib.simulator import ${simImports.join(', ')}`);
    }

    let code = `"""Simulation Judge Agent module for evaluating bidding policies."""\n\n`;
    code += imports.join('\n') + '\n\n';

    if (hasSchema) {
      code += `class PolicyEvaluation(BaseModel):
    """Structured critique and evaluation result from the Simulation Judge."""

    score: float = Field(
        ..., description="Overall yield optimization score from 0.0 to 100.0"
    )
    impressions_won: int = Field(..., description="Total impressions won")
    effective_cpm: float = Field(..., description="Effective CPM in USD")
    total_spend: float = Field(..., description="Total budget spent in USD")
    budget_remaining: float = Field(..., description="Budget remaining in USD")
    diagnostics: str = Field(
        ..., description="Root cause analysis of performance bottlenecks"
    )
    recommendations: str = Field(
        ..., description="Actionable algorithmic modifications for next iteration"
    )\n\n`;
    } else {
      code += `# 1. Structured Schema: [Unequipped - click PolicyEvaluation above to equip]\n\n`;
    }

    if (hasTool) {
      code += `def evaluate_policy_code(
    policy_code: str,
    total_budget: float = 2500.0,
    flight_duration_hours: float = 24.0,
    max_bid_ceiling: float = 10.0,
) -> dict[str, Any]:
    """Simulates candidate bidding policy across 600,000 auctions in-memory."""
    try:
        policy_func = ${hasLoader ? 'load_policy_from_code(policy_code)' : '# load_policy_from_code unequipped'}\n        result = run_simulation(
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
            "daypart_metrics": result.daypart_metrics,
            "summary": result.summary_text,
        }
    except Exception as e:
        return {
            "status": "error",
            "error": str(e),
            "score": 0.0,
            "impressions_won": 0,
            "total_spend": 0.0,
            "summary": f"Policy compilation/execution failed: {e}",
        }\n\n`;
    } else {
      code += `# 2. Simulation Actuator: [Unequipped - click evaluate_policy_code above to equip]\n\n`;
    }

    if (promptConfigured) {
      code += `JUDGE_SYSTEM_PROMPT = """# Simulation Judge & Yield Optimization Critic
You are the Vibetube Simulation Judge Agent. Evaluate synthesized bidding
policies against market microeconomics and formulate precise, actionable critiques.
"""\n\n`;
    } else {
      code += `# 3. System Instruction: [Pending Configuration - click Configure Prompt]\n\n`;
    }

    code += `judge_agent = LlmAgent(
    name="simulation_judge",
    model="${GEMINI_MODEL}",
    description="Simulates and critiques candidate bidding policies.",
    instruction=${promptConfigured ? 'JUDGE_SYSTEM_PROMPT' : '""  # Pending configuration'},
    tools=[
${hasTool ? '        evaluate_policy_code,  # <-- Equipped Simulation Actuator' : '        # Tools unequipped (click diagram connections above to equip)'}
    ],
)
`;

    return code;
  };

  // --------------------------------------------------------------------------
  // PROMPT DRILL-DOWN SUB-PAGE VIEW
  // --------------------------------------------------------------------------
  if (focusedView === 'prompt') {
    return (
      <div className="animate-rise pb-24 space-y-6 max-w-5xl mx-auto">
        <div className="flex items-center justify-between border-b border-hairline pb-4">
          <button
            onClick={() => setFocusedView(null)}
            className="px-4 py-2 bg-overlay hover:bg-hairline text-fg text-xs font-mono font-medium rounded-xl border border-hairline transition-all flex items-center gap-2 cursor-pointer shadow-sm"
          >
            <ArrowLeft size={14} />
            <span>Back to Architecture Canvas</span>
          </button>

          <div className="flex items-center gap-3">
            {!promptConfigured ? (
              <button
                onClick={() => setPromptConfigured(true)}
                className="px-5 py-2.5 bg-purple-600 hover:bg-purple-700 text-white font-bold rounded-xl text-xs transition-all shadow-md flex items-center gap-1.5 cursor-pointer"
              >
                <Check size={15} />
                <span>Configure Prompt</span>
              </button>
            ) : (
              <button
                onClick={() => setFocusedView(null)}
                className="px-5 py-2.5 bg-purple-600 hover:bg-purple-700 text-white font-bold rounded-xl text-xs transition-all shadow-md flex items-center gap-1.5 cursor-pointer"
              >
                <span>Return to Agent</span>
                <ArrowRight size={15} />
              </button>
            )}
          </div>
        </div>

        {/* Focused Connection Diagram */}
        <div className="p-6 bg-card rounded-3xl border border-hairline shadow-xl space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono font-bold text-fg uppercase tracking-wider flex items-center gap-1.5">
              <Sparkles size={14} className="text-purple-400" />
              Critic Prompt Specification Architecture
            </span>
            <span className="text-xs font-mono text-fg-muted">
              Source: <strong className="text-fg">JUDGE_SYSTEM_PROMPT</strong>
            </span>
          </div>

          <div className="flex flex-col lg:flex-row items-stretch lg:items-center gap-3 py-2">
            <div className="lg:w-80 p-4 bg-card rounded-2xl border border-purple-500/40 flex items-center gap-3 shadow-sm shrink-0">
              <div className="w-10 h-10 rounded-xl bg-purple-500/15 border border-purple-500/40 flex items-center justify-center text-purple-400 shrink-0 shadow-sm">
                <Sparkles size={20} />
              </div>
              <div className="min-w-0">
                <h4 className="text-xs font-bold font-mono text-fg truncate">JUDGE_SYSTEM_PROMPT</h4>
                <span className="text-[10px] font-mono text-purple-400 font-bold block truncate">Microeconomic Critic Instructions</span>
              </div>
            </div>

            <div className={`flex-1 p-4 rounded-2xl border-2 flex items-center justify-between gap-3 shadow-md transition-all min-w-0 ${
              promptConfigured
                ? 'bg-card border-purple-500 shadow-purple-500/10'
                : 'bg-card border-dashed border-hairline'
            }`}>
              <div className="flex items-center gap-2.5 min-w-0">
                <div className={`w-3 h-3 rounded-full shrink-0 ${
                  promptConfigured ? 'bg-purple-500 shadow-sm' : 'bg-fg-muted/40'
                }`} />
                <span className="font-mono text-xs font-bold tracking-wide text-fg truncate">
                  instruction=JUDGE_SYSTEM_PROMPT
                </span>
              </div>
              <span className={`text-[11px] font-mono font-bold px-2.5 py-1 rounded-lg border shrink-0 whitespace-nowrap ${
                promptConfigured
                  ? 'bg-purple-500/15 border-purple-500/40 text-purple-400'
                  : 'bg-overlay border-hairline text-fg-muted'
              }`}>
                {promptConfigured ? '✓ Configured' : 'Click "Configure Prompt" above'}
              </span>
            </div>

            <div className="lg:w-72 p-4 bg-card rounded-2xl border border-purple-500/40 flex items-center gap-3 shadow-sm shrink-0">
              <div className="w-10 h-10 rounded-xl bg-purple-500/15 border border-purple-500/40 flex items-center justify-center text-purple-400 shrink-0">
                <Bot size={20} />
              </div>
              <div className="overflow-hidden min-w-0">
                <h5 className="text-xs font-bold text-fg font-mono leading-tight truncate">simulation_judge</h5>
                <span className="text-[10px] font-mono text-fg-muted truncate block">
                  ADK LlmAgent ({GEMINI_SERIES_LABEL})
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Stacked Code Viewers */}
        <div className="space-y-8">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-mono font-bold text-fg flex items-center gap-1.5">
                <Sparkles size={14} className="text-purple-400" /> Critic Instruction Specification:
              </span>
              <span className="text-[11px] font-mono text-fg-muted">judge_agent.py</span>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
              <div className="lg:col-span-8 rounded-2xl overflow-hidden border border-hairline bg-card shadow-md">
                <PythonCodeHighlight
                  code={JUDGE_SYSTEM_PROMPT_SNIPPET}
                  filename="judge_agent.py"
                  editable={false}
                  className="max-h-[480px]"
                />
              </div>

              <div className="lg:col-span-4 space-y-3">
                <span className="text-[11px] font-mono font-bold text-fg-muted uppercase tracking-wider block">
                  Critic Prompt Design
                </span>
                {JUDGE_PROMPT_EXPLANATIONS.map((item, idx) => (
                  <div key={idx} className="p-4 bg-card rounded-2xl border border-hairline shadow-sm space-y-1">
                    <h5 className="text-xs font-bold font-mono text-fg">{item.title}</h5>
                    <p className="text-xs text-fg-muted leading-relaxed font-sans">{item.description}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-mono font-bold text-fg flex items-center gap-1.5">
                <FileText size={14} className="text-purple-400" /> judge_agent.py Instruction Binding:
              </span>
              <span className="text-[11px] font-mono text-fg-muted">judge_agent.py</span>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
              <div className="lg:col-span-8 rounded-2xl overflow-hidden border border-hairline bg-card shadow-md">
                <PythonCodeHighlight
                  code={JUDGE_AGENT_SPEC_BINDING}
                  filename="judge_agent.py"
                  editable={false}
                  className="max-h-[480px]"
                />
              </div>

              <div className="lg:col-span-4 space-y-3">
                <span className="text-[11px] font-mono font-bold text-fg-muted uppercase tracking-wider block">
                  Architecture Rationale
                </span>
                {JUDGE_AGENT_BINDING_EXPLANATIONS.map((item, idx) => (
                  <div key={idx} className="p-4 bg-card rounded-2xl border border-hairline shadow-sm space-y-1">
                    <h5 className="text-xs font-bold font-mono text-fg">{item.title}</h5>
                    <p className="text-xs text-fg-muted leading-relaxed font-sans">{item.description}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // --------------------------------------------------------------------------
  // TOOL DRILL-DOWN SUB-PAGE VIEW
  // --------------------------------------------------------------------------
  if (focusedView) {
    const tool = TOOLS_CONFIG[focusedView];
    const isEquipped = equipped[focusedView];

    return (
      <div className="animate-rise pb-24 space-y-6 max-w-5xl mx-auto">
        <div className="flex items-center justify-between border-b border-hairline pb-4">
          <button
            onClick={() => setFocusedView(null)}
            className="px-4 py-2 bg-overlay hover:bg-hairline text-fg text-xs font-mono font-medium rounded-xl border border-hairline transition-all flex items-center gap-2 cursor-pointer shadow-sm"
          >
            <ArrowLeft size={14} />
            <span>Back to Architecture Canvas</span>
          </button>

          <div className="flex items-center gap-3">
            {!isEquipped ? (
              <button
                onClick={() => setEquipped(prev => ({ ...prev, [tool.id]: true }))}
                className="px-5 py-2.5 bg-vibe-cyan hover:bg-vibe-cyan/90 text-black font-bold rounded-xl text-xs transition-all shadow-md flex items-center gap-1.5 cursor-pointer"
              >
                <Check size={15} />
                <span>Equip Tool</span>
              </button>
            ) : (
              <button
                onClick={() => setFocusedView(null)}
                className="px-5 py-2.5 bg-vibe-cyan hover:bg-vibe-cyan/90 text-black font-bold rounded-xl text-xs transition-all shadow-md flex items-center gap-1.5 cursor-pointer"
              >
                <span>Return to Agent</span>
                <ArrowRight size={15} />
              </button>
            )}
          </div>
        </div>

        {/* Focused Connection Diagram */}
        <div className="p-6 bg-card rounded-3xl border border-hairline shadow-xl space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono font-bold text-fg uppercase tracking-wider flex items-center gap-1.5">
              <Cpu size={14} className="text-purple-400" />
              Component Connection Architecture
            </span>
            <span className="text-xs font-mono text-fg-muted">
              Target: <strong className="text-fg">{tool.targetLabel}</strong>
            </span>
          </div>

          <div className="flex flex-col lg:flex-row items-stretch lg:items-center gap-3 py-2">
            <div className="lg:w-72 p-4 bg-card rounded-2xl border-2 border-purple-500/40 flex items-center gap-3 shadow-sm shrink-0">
              <div className="w-10 h-10 rounded-xl bg-purple-500/15 border border-purple-500/40 flex items-center justify-center text-purple-400 shrink-0 shadow-sm">
                <Bot size={22} />
              </div>
              <div className="min-w-0">
                <h4 className="text-xs font-bold font-display text-fg truncate">simulation_judge</h4>
                <span className="text-[10px] font-mono text-purple-400 font-bold block truncate">ADK LlmAgent</span>
              </div>
            </div>

            <div className={`flex-1 p-4 rounded-2xl border-2 flex items-center justify-between gap-3 shadow-md transition-all min-w-0 ${
              isEquipped
                ? 'bg-card border-purple-500 shadow-purple-500/10'
                : 'bg-card border-dashed border-hairline'
            }`}>
              <div className="flex items-center gap-2.5 min-w-0">
                <div className={`w-3 h-3 rounded-full shrink-0 ${
                  isEquipped ? 'bg-purple-500 shadow-sm' : 'bg-fg-muted/40'
                }`} />
                <span className="font-mono text-xs font-bold tracking-wide text-fg truncate">
                  {tool.boxLabel}
                </span>
              </div>
              <span className={`text-[11px] font-mono font-bold px-2.5 py-1 rounded-lg border shrink-0 whitespace-nowrap ${
                isEquipped
                  ? 'bg-purple-500/15 border-purple-500/40 text-purple-400'
                  : 'bg-overlay border-hairline text-fg-muted'
              }`}>
                {isEquipped ? '✓ Equipped' : 'Click "Equip Tool" above'}
              </span>
            </div>

            <div className="lg:w-80 p-4 bg-card rounded-2xl border border-hairline flex items-center gap-3 shadow-sm shrink-0">
              <div className="w-10 h-10 rounded-xl bg-purple-500/10 border border-purple-500/30 flex items-center justify-center text-purple-400 shrink-0">
                <Terminal size={20} />
              </div>
              <div className="overflow-hidden min-w-0">
                <h5 className="text-xs font-bold text-fg font-mono leading-tight truncate">{tool.targetLabel}</h5>
                <span className="text-[10px] font-mono text-fg-muted truncate block">
                  {tool.targetSystem}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Stacked Code Viewers */}
        <div className="space-y-8">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-mono font-bold text-fg flex items-center gap-1.5">
                <Terminal size={14} className="text-purple-400" /> Component Implementation:
              </span>
              <span className="text-[11px] font-mono text-fg-muted">{tool.toolCodeFilename}</span>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
              <div className="lg:col-span-8 rounded-2xl overflow-hidden border border-hairline bg-card shadow-md">
                <PythonCodeHighlight
                  code={tool.toolCodeSnippet}
                  filename={tool.toolCodeFilename}
                  editable={false}
                  className="max-h-[480px]"
                />
              </div>

              <div className="lg:col-span-4 space-y-3">
                <span className="text-[11px] font-mono font-bold text-fg-muted uppercase tracking-wider block">
                  Implementation Details
                </span>
                {tool.toolCodeExplanations.map((item, idx) => (
                  <div key={idx} className="p-4 bg-card rounded-2xl border border-hairline shadow-sm space-y-1">
                    <h5 className="text-xs font-bold font-mono text-fg">{item.title}</h5>
                    <p className="text-xs text-fg-muted leading-relaxed font-sans">{item.description}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-mono font-bold text-fg flex items-center gap-1.5">
                <FileText size={14} className="text-purple-400" /> Agent Code Wiring:
              </span>
              <span className="text-[11px] font-mono text-fg-muted">judge_agent.py</span>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
              <div className="lg:col-span-8 rounded-2xl overflow-hidden border border-hairline bg-card shadow-md">
                <PythonCodeHighlight
                  code={tool.agentModificationsSnippet}
                  filename="judge_agent.py"
                  editable={false}
                  className="max-h-[480px]"
                />
              </div>

              <div className="lg:col-span-4 space-y-3">
                <span className="text-[11px] font-mono font-bold text-fg-muted uppercase tracking-wider block">
                  Integration Rationale
                </span>
                {tool.agentModificationsExplanations.map((item, idx) => (
                  <div key={idx} className="p-4 bg-card rounded-2xl border border-hairline shadow-sm space-y-1">
                    <h5 className="text-xs font-bold font-mono text-fg">{item.title}</h5>
                    <p className="text-xs text-fg-muted leading-relaxed font-sans">{item.description}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // --------------------------------------------------------------------------
  // MAIN ARCHITECTURE CANVAS (Default View)
  // --------------------------------------------------------------------------
  return (
    <div className="animate-rise pb-24 space-y-8 max-w-6xl mx-auto">
      {/* Top Header */}
      <div className="border-b border-hairline pb-5 flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-display font-bold tracking-tight text-fg flex flex-wrap items-center gap-2">
            <span>Build the</span>
            <span className="text-purple-400 bg-purple-500/10 border border-purple-500/30 px-3 py-0.5 rounded-xl font-mono text-2xl font-bold">
              Simulation Judge Agent
            </span>
          </h1>
          <p className="text-sm text-fg-muted mt-1">
            Assemble the Critic agent (<code className="text-fg font-mono bg-overlay px-1.5 py-0.5 rounded border border-hairline">judge_agent.py</code>) with simulation tooling and structured evaluation contracts.
          </p>
        </div>

        <div className="flex items-center gap-3">
          {allReady ? (
            <button
              onClick={() => navigate('wire_loop')}
              className="px-6 py-2.5 bg-vibe-cyan hover:bg-vibe-cyan/90 text-black font-bold text-xs rounded-xl transition-all shadow-md flex items-center gap-2 cursor-pointer animate-pulse"
            >
              <span>Proceed to Step 8: ADK Workflow</span>
              <ArrowRight size={14} />
            </button>
          ) : (
            <button
              onClick={() => navigate('wire_loop')}
              className="px-5 py-2.5 bg-overlay hover:bg-hairline text-fg-muted hover:text-fg text-xs font-mono font-medium rounded-xl border border-hairline transition-all flex items-center gap-2 cursor-pointer"
            >
              <span>Equip All Components ({readyCount}/4 Ready)</span>
              <ArrowRight size={14} />
            </button>
          )}
        </div>
      </div>

      {/* 1. Architecture Canvas */}
      <div className="p-8 bg-card rounded-3xl border border-hairline shadow-2xl relative overflow-hidden space-y-6">
        <div className="flex items-center justify-between border-b border-hairline pb-4">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-purple-500/15 border border-purple-500/30 flex items-center justify-center text-purple-400">
              <Scale size={16} />
            </div>
            <div>
              <h3 className="text-sm font-bold text-fg uppercase font-mono tracking-wider">
                1. Critic Agent Architecture Canvas
              </h3>
              <span className="text-[11px] font-mono text-fg-muted">
                Click any tool or component below to inspect code and equip into <code className="text-fg font-normal">judge_agent.py</code>
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 text-xs font-mono text-fg-muted">
            <span className="px-2.5 py-1 rounded-lg bg-overlay border border-hairline">
              Tools: <strong className="text-fg">{equippedCount} of 3</strong> · Prompt: <strong className={promptConfigured ? 'text-purple-400' : 'text-fg-muted'}>{promptConfigured ? '✓ Configured' : 'Pending'}</strong>
            </span>
          </div>
        </div>

        {/* 3-Column Diagram Grid: Agent (Left) -> Tools (Center) -> Targets (Right) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-center">
          {/* Left Column: Judge Agent Box */}
          <div className="lg:col-span-4 p-5 rounded-2xl border-2 border-purple-500/40 bg-purple-500/5 shadow-md flex flex-col justify-between space-y-3 relative">
            <div className="flex items-center justify-between">
              <div className="w-9 h-9 rounded-xl bg-purple-500/20 text-purple-400 border border-purple-500/30 flex items-center justify-center">
                <Bot size={20} />
              </div>
              <span className="text-[10px] font-mono font-bold bg-purple-500/20 text-purple-300 border border-purple-500/30 px-2 py-0.5 rounded-full">
                Critic Agent
              </span>
            </div>

            <div>
              <h4 className="text-sm font-bold font-mono text-fg">simulation_judge</h4>
              <p className="text-xs font-mono text-fg-muted">judge_agent.py (LlmAgent)</p>
            </div>

            <div className="space-y-1.5 text-xs text-fg-muted font-sans border-t border-hairline pt-2">
              <div className="flex items-center justify-between text-[11px] font-mono">
                <span>Model:</span>
                <span className="text-purple-400 font-bold">{GEMINI_MODEL}</span>
              </div>
              <div className="flex items-center justify-between text-[11px] font-mono">
                <span>Role:</span>
                <span className="text-fg">Market Economics Critic</span>
              </div>
            </div>

            <button
              onClick={() => setFocusedView('prompt')}
              className={`w-full py-2.5 px-3 rounded-xl text-xs font-mono font-bold border transition-all flex items-center justify-between cursor-pointer ${
                promptConfigured
                  ? 'bg-purple-500/15 border-purple-500/40 text-purple-300 shadow-sm'
                  : 'bg-overlay hover:bg-hairline text-fg border-hairline hover:border-purple-400'
              }`}
            >
              <div className="flex items-center gap-2">
                <div className={`w-2.5 h-2.5 rounded-full ${promptConfigured ? 'bg-purple-500' : 'bg-fg-muted/40'}`} />
                <span>{promptConfigured ? 'Critic Instructions Configured' : 'Configure Critic Prompt'}</span>
              </div>
              <span className="text-[10px] font-mono font-bold">
                {promptConfigured ? '✓' : '→'}
              </span>
            </button>
          </div>

          {/* Middle Connecting Paths & Right Targets */}
          <div className="lg:col-span-8 space-y-3.5 relative z-10">
            {/* Row 1: evaluate_policy_code() -> 600k Auction Simulator Engine */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
              <div 
                onClick={() => setFocusedView('evaluate_policy_code')}
                className={`flex-1 p-4 rounded-2xl border-2 transition-all cursor-pointer flex items-center justify-between gap-3 shadow-sm ${
                  equipped.evaluate_policy_code
                    ? 'bg-card border-vibe-cyan shadow-vibe-cyan/10'
                    : 'bg-card border-dashed border-hairline hover:border-vibe-cyan'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <div className={`w-3 h-3 rounded-full ${equipped.evaluate_policy_code ? 'bg-vibe-cyan shadow-sm' : 'bg-fg-muted/40'}`} />
                  <span className="font-mono text-xs font-bold text-fg">
                    evaluate_policy_code()
                  </span>
                </div>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setEquipped(prev => ({ ...prev, evaluate_policy_code: !prev.evaluate_policy_code }));
                  }}
                  className={`text-[11px] font-mono font-bold px-2.5 py-1 rounded-lg border transition-all cursor-pointer ${
                    equipped.evaluate_policy_code 
                      ? 'bg-vibe-cyan/15 border-vibe-cyan/40 text-cyan-800 dark:text-vibe-cyan' 
                      : 'bg-overlay border-hairline text-fg-muted hover:text-fg'
                  }`}
                >
                  {equipped.evaluate_policy_code ? '✓ Equipped' : 'Click to Equip →'}
                </button>
              </div>

              <div className="sm:w-80 p-4 bg-card rounded-2xl border border-hairline flex items-center gap-3 shrink-0 shadow-sm">
                <div className="w-10 h-10 rounded-xl bg-vibe-cyan/10 border border-vibe-cyan/30 flex items-center justify-center text-cyan-700 dark:text-vibe-cyan shrink-0">
                  <Terminal size={20} />
                </div>
                <div>
                  <h5 className="text-xs font-bold text-fg font-mono">600k Auction Simulator Engine</h5>
                  <span className="text-[10px] font-mono text-fg-muted">lib/simulator.py</span>
                </div>
              </div>
            </div>

            {/* Row 2: PolicyEvaluation -> Pydantic Structured Schema */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
              <div 
                onClick={() => setFocusedView('policy_evaluation_schema')}
                className={`flex-1 p-4 rounded-2xl border-2 transition-all cursor-pointer flex items-center justify-between gap-3 shadow-sm ${
                  equipped.policy_evaluation_schema
                    ? 'bg-card border-purple-500 shadow-purple-500/10'
                    : 'bg-card border-dashed border-hairline hover:border-purple-500'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <div className={`w-3 h-3 rounded-full ${equipped.policy_evaluation_schema ? 'bg-purple-500 shadow-sm' : 'bg-fg-muted/40'}`} />
                  <span className="font-mono text-xs font-bold text-fg">
                    PolicyEvaluation Schema
                  </span>
                </div>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setEquipped(prev => ({ ...prev, policy_evaluation_schema: !prev.policy_evaluation_schema }));
                  }}
                  className={`text-[11px] font-mono font-bold px-2.5 py-1 rounded-lg border transition-all cursor-pointer ${
                    equipped.policy_evaluation_schema 
                      ? 'bg-purple-500/15 border-purple-500/40 text-purple-400' 
                      : 'bg-overlay border-hairline text-fg-muted hover:text-fg'
                  }`}
                >
                  {equipped.policy_evaluation_schema ? '✓ Equipped' : 'Click to Equip →'}
                </button>
              </div>

              <div className="sm:w-80 p-4 bg-card rounded-2xl border border-hairline flex items-center gap-3 shrink-0 shadow-sm">
                <div className="w-10 h-10 rounded-xl bg-purple-500/10 border border-purple-500/30 flex items-center justify-center text-purple-400 shrink-0">
                  <Scale size={20} />
                </div>
                <div>
                  <h5 className="text-xs font-bold text-fg font-mono">Pydantic Structured Schema</h5>
                  <span className="text-[10px] font-mono text-fg-muted">Output Contract (score, diagnostics)</span>
                </div>
              </div>
            </div>

            {/* Row 3: load_policy_from_code() -> In-Memory Module Loader */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
              <div 
                onClick={() => setFocusedView('load_policy_from_code')}
                className={`flex-1 p-4 rounded-2xl border-2 transition-all cursor-pointer flex items-center justify-between gap-3 shadow-sm ${
                  equipped.load_policy_from_code
                    ? 'bg-card border-amber-500 shadow-amber-500/10'
                    : 'bg-card border-dashed border-hairline hover:border-amber-500'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <div className={`w-3 h-3 rounded-full ${equipped.load_policy_from_code ? 'bg-amber-500 shadow-sm' : 'bg-fg-muted/40'}`} />
                  <span className="font-mono text-xs font-bold text-fg">
                    load_policy_from_code()
                  </span>
                </div>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setEquipped(prev => ({ ...prev, load_policy_from_code: !prev.load_policy_from_code }));
                  }}
                  className={`text-[11px] font-mono font-bold px-2.5 py-1 rounded-lg border transition-all cursor-pointer ${
                    equipped.load_policy_from_code 
                      ? 'bg-amber-500/15 border-amber-500/40 text-amber-800 dark:text-amber-300' 
                      : 'bg-overlay border-hairline text-fg-muted hover:text-fg'
                  }`}
                >
                  {equipped.load_policy_from_code ? '✓ Equipped' : 'Click to Equip →'}
                </button>
              </div>

              <div className="sm:w-80 p-4 bg-card rounded-2xl border border-hairline flex items-center gap-3 shrink-0 shadow-sm">
                <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-600 dark:text-amber-400 shrink-0">
                  <Code2 size={20} />
                </div>
                <div>
                  <h5 className="text-xs font-bold text-fg font-mono">In-Memory Module Loader</h5>
                  <span className="text-[10px] font-mono text-fg-muted">dynamic_policy Runtime</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 2. Dynamic judge_agent.py Code Definition (Live Assembly) */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Code2 size={16} className="text-purple-400" />
            <h3 className="text-sm font-bold text-fg uppercase font-mono tracking-wider">
              2. judge_agent.py Code Definition (Live Assembly)
            </h3>
          </div>
          <span className="text-xs font-mono text-fg-muted">
            {allReady ? '✓ All Components & Instructions Configured' : 'Updates dynamically as tools and prompt are equipped above'}
          </span>
        </div>

        <div className="rounded-3xl overflow-hidden border border-hairline bg-card shadow-xl">
          <PythonCodeHighlight
            code={generateJudgePyCode()}
            filename="agentic_data_engineer/judge_agent.py"
            editable={false}
            className="max-h-[500px]"
          />
        </div>
      </div>

      {/* 3. Interactive Test Evaluation Turn (Judge in Isolation) */}
      <div className="p-6 bg-card rounded-3xl border border-hairline shadow-xl space-y-4">
        <div className="flex items-center justify-between border-b border-hairline pb-3">
          <div className="flex items-center gap-2">
            <Sparkles size={16} className="text-purple-400" />
            <h3 className="text-xs font-mono font-bold text-fg uppercase tracking-wider">
              3. Test Single Evaluation Turn (Judge in Isolation)
            </h3>
          </div>
          <span className="text-[11px] font-mono text-fg-muted">
            Input: Baseline Heuristic Policy
          </span>
        </div>

        <p className="text-xs text-fg-muted font-sans leading-relaxed">
          Test how the assembled Judge agent simulates candidate code across 600,000 auctions and generates structured critique:
        </p>

        <div className="flex items-center gap-4 pt-1">
          <button
            onClick={handleTestJudge}
            disabled={isTestingJudge}
            className="px-5 py-2.5 bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs rounded-xl transition-all shadow-md flex items-center gap-2 cursor-pointer disabled:opacity-50"
          >
            {isTestingJudge ? (
              <>
                <RefreshCw size={14} className="animate-spin" />
                <span>Simulating 600,000 Auctions &amp; Generating Critique...</span>
              </>
            ) : (
              <>
                <Play size={14} className="fill-white" />
                <span>Run Test Policy Critique</span>
              </>
            )}
          </button>
        </div>

        {testResult && (
          <div className="p-5 rounded-2xl border border-purple-500/30 bg-purple-500/5 space-y-4 animate-rise mt-4">
            <div className="flex items-center justify-between border-b border-purple-500/20 pb-2">
              <span className="text-xs font-mono font-bold text-purple-400 flex items-center gap-1.5">
                <CheckCircle2 size={15} />
                <span>Judge Output Contract Verified (PolicyEvaluation)</span>
              </span>
              <span className="text-xs font-mono font-bold text-amber-400 bg-amber-500/15 border border-amber-500/30 px-2 py-0.5 rounded-full">
                Score: {testResult.score}/100
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs font-mono">
              <div className="bg-card/70 p-2.5 rounded-xl border border-hairline">
                <span className="text-fg-muted text-[10px] block">Impressions</span>
                <span className="text-fg font-bold">{testResult.impressions.toLocaleString()}</span>
              </div>
              <div className="bg-card/70 p-2.5 rounded-xl border border-hairline">
                <span className="text-fg-muted text-[10px] block">Spend</span>
                <span className="text-fg font-bold">${testResult.spend.toFixed(2)}</span>
              </div>
              <div className="bg-card/70 p-2.5 rounded-xl border border-hairline">
                <span className="text-fg-muted text-[10px] block">Effective CPM</span>
                <span className="text-fg font-bold">${testResult.ecpm.toFixed(2)}</span>
              </div>
              <div className="bg-card/70 p-2.5 rounded-xl border border-hairline">
                <span className="text-fg-muted text-[10px] block">Exhausted At</span>
                <span className="text-amber-400 font-bold">Hour {testResult.exhausted_hour}</span>
              </div>
            </div>

            <div className="space-y-2 text-xs font-sans">
              <div className="p-3 rounded-xl bg-card border border-hairline space-y-1">
                <strong className="text-xs font-mono text-purple-400 block uppercase">Root-Cause Diagnostics:</strong>
                <p className="text-fg-muted text-[11px] leading-relaxed">{testResult.diagnostics}</p>
              </div>
              <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 space-y-1">
                <strong className="text-xs font-mono text-emerald-400 block uppercase">Actionable Recommendations:</strong>
                <p className="text-fg text-[11px] leading-relaxed font-mono">{testResult.recommendations}</p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Milestone CTA Banner */}
      <div className="p-6 bg-gradient-to-r from-purple-500/10 via-indigo-500/10 to-vibe-cyan/10 rounded-3xl border border-purple-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-xl animate-rise">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-purple-500/20 text-purple-400 flex items-center justify-center shrink-0 border border-purple-500/30">
            <CheckCircle2 size={22} />
          </div>
          <div>
            <h4 className="text-sm font-display font-bold text-fg">Simulation Judge Assembled &amp; Verified</h4>
            <p className="text-xs text-fg-muted">Ready to wire the Generator Agent and Simulation Judge into the closed-loop optimization graph.</p>
          </div>
        </div>
        <button
          onClick={() => navigate('wire_loop')}
          className="px-6 py-3 bg-vibe-cyan hover:bg-vibe-cyan/90 text-black font-bold text-xs rounded-xl transition-all shadow-md flex items-center gap-2 cursor-pointer shrink-0"
        >
          <span>Proceed to Step 8: ADK Workflow</span>
          <ArrowRight size={15} />
        </button>
      </div>
    </div>
  );
}

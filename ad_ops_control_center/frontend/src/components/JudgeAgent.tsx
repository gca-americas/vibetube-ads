import { useState } from 'react';
import { 
  Scale, Bot, CheckCircle2,
  ArrowRight, Play, RefreshCw, Award, TrendingUp, Code2,
  FileCheck, Sliders, Sparkles, Terminal
} from 'lucide-react';
import PythonCodeHighlight from './PythonCodeHighlight';

const CHAMPION_BIDDING_POLICY_SCRIPT = `"""Vibetube Ads - Champion Bidding Policy Script
Selected & Crowned by ADK 2.0 Simulation Judge Agent (Yield Score: 99.6/100).
"""

from lib.models import AuctionContext


def compute_bid(context: AuctionContext) -> float:
    # 1. Time-of-day base clearing floors from BigQuery telemetry
    base_p90 = context.p90
    ceiling = context.max_bid_ceiling
    budget = context.budget_remaining
    hours = max(0.5, context.hours_remaining)

    # 2. Dynamic Budget Pacing Multiplier (Target: ~$104.16 / hour)
    target_hourly = budget / hours
    pacing_factor = min(1.25, max(0.70, target_hourly / 104.16))

    # 3. Micro-Signals: Real-Time Momentum & Win-Rate Feedback Loop
    # Momentum: Detect price acceleration across trailing P90 ticks
    momentum = 0.0
    if hasattr(context, "p90_history") and len(context.p90_history) >= 3:
        momentum = (context.p90_history[-1] - context.p90_history[-3]) * 0.08

    # Win-rate feedback: Dynamically boost bids if losing auctions; shave if overbidding
    win_rate_adjustment = 0.0
    if hasattr(context, "win_rate"):
        if context.win_rate < 0.40:
            win_rate_adjustment = 0.15  # Catch-up boost to restore reach
        elif context.win_rate > 0.95 and context.daypart == "late_night":
            win_rate_adjustment = -0.05  # Shave excess bid to conserve capital

    # 4. Composite Dynamic Clearing & Bid Shading across Dayparts
    if context.daypart == "late_night":
        # Off-peak cooldown: shade near floor with momentum and win-rate feedback
        bid = (0.95 + momentum + win_rate_adjustment) * pacing_factor
    else:
        # Dayparts with competitive demand: track base P90 floor + margin + momentum + feedback
        bid = (base_p90 + 0.05 + momentum + win_rate_adjustment) * pacing_factor

    # 5. Deterministic Safety Clamping
    return max(0.50, min(bid, ceiling))`;

interface RoundRecord {
  gen: number;
  score: number;
  impressions: string;
  spend: string;
  ecpm: string;
  verdict: 'iterating' | 'champion';
  feedback: string;
}

const FLYWHEEL_ROUNDS: RoundRecord[] = [
  {
    gen: 1,
    score: 84.2,
    impressions: '395,200',
    spend: '$2,120.00 (84.8%)',
    ecpm: '$5.36',
    verdict: 'iterating',
    feedback: 'Premature budget burn in late-night; under-allocated capital for primetime surge (38% win rate).',
  },
  {
    gen: 2,
    score: 92.5,
    impressions: '472,100',
    spend: '$2,410.00 (96.4%)',
    ecpm: '$5.10',
    verdict: 'iterating',
    feedback: 'Budget pacing improved, but afternoon bid shading overpaid clearing floor ($6.20 vs $5.90 P90).',
  },
  {
    gen: 3,
    score: 99.6,
    impressions: '533,785',
    spend: '$2,500.00 (100.0%)',
    ecpm: '$4.68',
    verdict: 'champion',
    feedback: 'Optimal Pareto yield curve. 100.0% budget clearance with zero pacing starvation across 24h flight.',
  },
];

const WIRING_SNIPPETS = {
  tool: {
    title: "1. Actuator Tool: evaluate_policy_code",
    subtitle: "In-memory simulation runner for 600,000 auctions",
    filename: "judge_agent.py (Simulation Tool)",
    desc: "Executes candidate policy scripts in-memory against the full 24-hour market simulation without deploying to production disk.",
    code: `def evaluate_policy_code(
    policy_code: str,
    total_budget: float = 2500.0,
    flight_duration_hours: float = 24.0,
    max_bid_ceiling: float = 10.0,
) -> dict[str, Any]:
    """Simulates the bidding policy across 600,000 auctions."""
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
        "effective_cpm": result.effective_cpm,
        "hours_active": result.hours_active,
        "exhausted_hour": result.exhausted_hour,
        "daypart_metrics": result.daypart_metrics,
        "summary": result.summary_text,
    }`
  },
  schema: {
    title: "2. Structured Critique: PolicyEvaluation",
    subtitle: "Pydantic contract enforcing rigorous evaluation output",
    filename: "judge_agent.py (Output Schema)",
    desc: "Forces the LLM Judge to produce structured, quantitative feedback rather than vague qualitative suggestions.",
    code: `class PolicyEvaluation(BaseModel):
    """Structured critique result from the Simulation Judge."""

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
    )`
  },
  agent: {
    title: "3. ADK Agent Wiring: simulation_judge",
    subtitle: "LlmAgent definition with Gemini and Simulator tool",
    filename: "judge_agent.py (Agent Instantiation)",
    desc: "Assembles the Critic agent with Gemini, domain instructions for microeconomic critique, and the simulation actuator tool.",
    code: `from google.adk.agents import LlmAgent
from pydantic import BaseModel, Field

from lib.simulator import load_policy_from_code, run_simulation

judge_agent = LlmAgent(
    name="simulation_judge",
    model="gemini-2.5-flash",
    description="Simulates and critiques candidate bidding policies under market physics.",
    instruction=JUDGE_SYSTEM_PROMPT,
    tools=[evaluate_policy_code],
)`
  }
};

export default function JudgeAgent({ navigate }: { navigate: (v: string) => void }) {
  const [activeTab, setActiveTab] = useState<'wiring' | 'flywheel'>('wiring');
  const [selectedWiringCard, setSelectedWiringCard] = useState<'tool' | 'schema' | 'agent'>('tool');
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

  const [isRunning, setIsRunning] = useState(false);
  const [flywheelCompleted, setFlywheelCompleted] = useState(false);
  const [activeNode, setActiveNode] = useState<number>(0);
  const [currentRound, setCurrentRound] = useState<number>(0);
  const [completedRounds, setCompletedRounds] = useState<RoundRecord[]>([]);

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
      diagnostics: "Critical pacing starvation: Bid too aggressively during early morning ($4.50 CPM) and afternoon, exhausting entire $2,500 budget at hour 15.2 and completely missing high-value Primetime traffic.",
      recommendations: "Introduce dynamic budget velocity dampening: scale bid by min(1.20, target_hourly / 104.16) where target_hourly = budget_remaining / hours_remaining. Clamp early morning bids to $2.40."
    });
    setIsTestingJudge(false);
  };

  const handleRunFlywheel = async () => {
    if (isRunning) return;

    setIsRunning(true);
    setFlywheelCompleted(false);
    setCompletedRounds([]);
    setCurrentRound(0);

    // Round 1
    setCurrentRound(1);
    setActiveNode(1); // Generator
    await new Promise(r => setTimeout(r, 700));
    setActiveNode(2); // Judge
    await new Promise(r => setTimeout(r, 900));
    setActiveNode(3); // Router
    setCompletedRounds([FLYWHEEL_ROUNDS[0]]);
    await new Promise(r => setTimeout(r, 600));

    // Round 2
    setCurrentRound(2);
    setActiveNode(1); // Generator
    await new Promise(r => setTimeout(r, 700));
    setActiveNode(2); // Judge
    await new Promise(r => setTimeout(r, 900));
    setActiveNode(3); // Router
    setCompletedRounds([FLYWHEEL_ROUNDS[0], FLYWHEEL_ROUNDS[1]]);
    await new Promise(r => setTimeout(r, 600));

    // Round 3
    setCurrentRound(3);
    setActiveNode(1); // Generator
    await new Promise(r => setTimeout(r, 700));
    setActiveNode(2); // Judge
    await new Promise(r => setTimeout(r, 900));
    setActiveNode(3); // Router
    setCompletedRounds(FLYWHEEL_ROUNDS);
    await new Promise(r => setTimeout(r, 500));
    setActiveNode(4); // Champion Deploy
    try {
      await fetch('/campaign/script?file=agent_bidding_policy.py', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filename: 'agent_bidding_policy.py', script: CHAMPION_BIDDING_POLICY_SCRIPT }),
      });
    } catch (e) {
      console.warn('Failed to auto-deploy champion script to backend:', e);
    }
    await new Promise(r => setTimeout(r, 600));

    setIsRunning(false);
    setFlywheelCompleted(true);
  };

  return (
    <div className="animate-rise pb-24 space-y-8 max-w-6xl mx-auto">
      {/* Top Header */}
      <div className="border-b border-hairline pb-5 flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-display font-bold tracking-tight text-fg">
            The Simulation Judge Agent
          </h1>
          <p className="text-sm text-fg-muted mt-1">
            Explore the Actor-Critic paradigm: wire the Simulation Judge Agent (<code className="text-fg font-mono bg-overlay px-1.5 py-0.5 rounded border border-hairline">judge_agent.py</code>) to critique policies under market physics.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('simulator3')}
            className="px-6 py-2.5 bg-vibe-cyan hover:bg-vibe-cyan/90 text-black font-bold text-xs rounded-xl transition-all shadow-md flex items-center gap-2 cursor-pointer"
          >
            <span>Proceed to Simulation</span>
            <ArrowRight size={15} />
          </button>
        </div>
      </div>

      {/* Tab Selector */}
      <div className="flex items-center gap-2 border-b border-hairline pb-1">
        <button
          onClick={() => setActiveTab('wiring')}
          className={`px-5 py-2.5 rounded-xl text-xs font-bold font-mono transition-all flex items-center gap-2 cursor-pointer ${
            activeTab === 'wiring'
              ? 'bg-purple-500/15 text-purple-400 border border-purple-500/30 shadow-sm'
              : 'text-fg-muted hover:text-fg hover:bg-overlay/50 border border-transparent'
          }`}
        >
          <Sliders size={15} />
          <span>1. Wire & Inspect Judge Agent</span>
        </button>

        <button
          onClick={() => setActiveTab('flywheel')}
          className={`px-5 py-2.5 rounded-xl text-xs font-bold font-mono transition-all flex items-center gap-2 cursor-pointer ${
            activeTab === 'flywheel'
              ? 'bg-vibe-cyan/15 text-vibe-cyan border border-vibe-cyan/30 shadow-sm'
              : 'text-fg-muted hover:text-fg hover:bg-overlay/50 border border-transparent'
          }`}
        >
          <RefreshCw size={15} />
          <span>2. Run Optimization Flywheel</span>
        </button>
      </div>

      {activeTab === 'wiring' ? (
        /* WIRING & INSPECTOR VIEW */
        <div className="space-y-6 animate-rise">
          {/* Concept Banner */}
          <div className="p-6 bg-card rounded-3xl border border-hairline shadow-md space-y-3">
            <div className="flex items-center gap-2 text-xs font-mono font-bold text-purple-400 uppercase tracking-wider">
              <Scale size={16} />
              <span>The Actor-Critic Paradigm & The Self-Evaluation Blindspot</span>
            </div>
            <p className="text-xs text-fg-muted leading-relaxed font-sans">
              Why can't the Generator Agent judge its own code? In generative AI, models suffer from <strong>self-validation blindspots</strong>: an agent that authors code will almost always rationalize that its logic is correct. In algorithmic bidding, the real test is <strong className="text-fg">market physics</strong>. The <strong className="text-fg">Simulation Judge Agent</strong> operates as an independent, adversarial Critic equipped with a simulation tool to stress-test policies against 600,000 auctions and return actionable root-cause diagnostics.
            </p>
          </div>

          {/* 3 Wiring Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <button
              onClick={() => setSelectedWiringCard('tool')}
              className={`p-5 rounded-2xl border-2 text-left transition-all space-y-2 cursor-pointer ${
                selectedWiringCard === 'tool'
                  ? 'bg-card border-vibe-cyan shadow-lg shadow-vibe-cyan/10 ring-2 ring-vibe-cyan/20'
                  : 'bg-card/60 hover:bg-card border-hairline'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="w-8 h-8 rounded-xl bg-vibe-cyan/15 border border-vibe-cyan/30 flex items-center justify-center text-vibe-cyan">
                  <Terminal size={16} />
                </div>
                {selectedWiringCard === 'tool' && <span className="text-[10px] font-mono text-vibe-cyan font-bold bg-vibe-cyan/10 px-2 py-0.5 rounded-full">Viewing</span>}
              </div>
              <h4 className="text-xs font-bold font-mono text-fg pt-1">1. Simulation Actuator Tool</h4>
              <p className="text-[11px] text-fg-muted font-sans line-clamp-2">
                Simulates 600k auctions in-memory to extract yield scores, spend, and pacing.
              </p>
            </button>

            <button
              onClick={() => setSelectedWiringCard('schema')}
              className={`p-5 rounded-2xl border-2 text-left transition-all space-y-2 cursor-pointer ${
                selectedWiringCard === 'schema'
                  ? 'bg-card border-purple-500 shadow-lg shadow-purple-500/10 ring-2 ring-purple-500/20'
                  : 'bg-card/60 hover:bg-card border-hairline'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="w-8 h-8 rounded-xl bg-purple-500/15 border border-purple-500/30 flex items-center justify-center text-purple-400">
                  <FileCheck size={16} />
                </div>
                {selectedWiringCard === 'schema' && <span className="text-[10px] font-mono text-purple-400 font-bold bg-purple-500/10 px-2 py-0.5 rounded-full">Viewing</span>}
              </div>
              <h4 className="text-xs font-bold font-mono text-fg pt-1">2. Structured Critique Schema</h4>
              <p className="text-[11px] text-fg-muted font-sans line-clamp-2">
                Pydantic contract enforcing quantitative scores, diagnostics, and recommendations.
              </p>
            </button>

            <button
              onClick={() => setSelectedWiringCard('agent')}
              className={`p-5 rounded-2xl border-2 text-left transition-all space-y-2 cursor-pointer ${
                selectedWiringCard === 'agent'
                  ? 'bg-card border-amber-500 shadow-lg shadow-amber-500/10 ring-2 ring-amber-500/20'
                  : 'bg-card/60 hover:bg-card border-hairline'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="w-8 h-8 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400">
                  <Bot size={16} />
                </div>
                {selectedWiringCard === 'agent' && <span className="text-[10px] font-mono text-amber-400 font-bold bg-amber-500/10 px-2 py-0.5 rounded-full">Viewing</span>}
              </div>
              <h4 className="text-xs font-bold font-mono text-fg pt-1">3. ADK LlmAgent Wiring</h4>
              <p className="text-[11px] text-fg-muted font-sans line-clamp-2">
                Binds Gemini, Critic System Prompt, and Simulation Tool.
              </p>
            </button>
          </div>

          {/* Code Viewer for Selected Card */}
          <div className="p-6 bg-card rounded-3xl border border-hairline shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-hairline pb-3">
              <div>
                <h3 className="text-xs font-mono font-bold text-fg uppercase tracking-wider">
                  {WIRING_SNIPPETS[selectedWiringCard].title}
                </h3>
                <p className="text-[11px] text-fg-muted mt-0.5">
                  {WIRING_SNIPPETS[selectedWiringCard].desc}
                </p>
              </div>
              <span className="text-xs font-mono text-fg-muted bg-overlay px-2.5 py-1 rounded-lg border border-hairline">
                {WIRING_SNIPPETS[selectedWiringCard].filename}
              </span>
            </div>

            <div className="rounded-2xl overflow-hidden border border-hairline bg-card shadow-inner">
              <PythonCodeHighlight
                code={WIRING_SNIPPETS[selectedWiringCard].code}
                filename={WIRING_SNIPPETS[selectedWiringCard].filename}
                editable={false}
                className="max-h-[380px]"
              />
            </div>
          </div>

          {/* Interactive Test Evaluation Turn */}
          <div className="p-6 bg-card rounded-3xl border border-hairline shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-hairline pb-3">
              <div className="flex items-center gap-2">
                <Sparkles size={16} className="text-purple-400" />
                <h3 className="text-xs font-mono font-bold text-fg uppercase tracking-wider">
                  Test Single Evaluation Turn (Judge in Isolation)
                </h3>
              </div>
              <span className="text-[11px] font-mono text-fg-muted">
                Input: Baseline Heuristic Policy
              </span>
            </div>

            <p className="text-xs text-fg-muted font-sans leading-relaxed">
              Before embedding the Judge into an autonomous cyclic flywheel, test how it simulates a candidate policy and generates its structured critique:
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
                    <span>Executing 600,000-Auction Simulation & Generating Critique...</span>
                  </>
                ) : (
                  <>
                    <Play size={14} className="fill-white" />
                    <span>Run Test Policy Critique</span>
                  </>
                )}
              </button>

              <button
                onClick={() => setActiveTab('flywheel')}
                className="px-5 py-2.5 bg-overlay hover:bg-hairline text-fg font-bold text-xs rounded-xl border border-hairline transition-all flex items-center gap-2 cursor-pointer"
              >
                <span>Proceed to Workflow Flywheel</span>
                <ArrowRight size={14} />
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
        </div>
      ) : (
        /* FLYWHEEL RUNNER VIEW */
        <div className="space-y-6 animate-rise">

      {/* Cyclic Graph Architecture Canvas */}
      <div className="p-8 bg-card rounded-3xl border border-hairline shadow-2xl space-y-6">
        <div className="flex items-center justify-between border-b border-hairline pb-4">
          <div className="flex items-center gap-2">
            <Scale size={18} className="text-vibe-cyan" />
            <h3 className="text-sm font-bold text-fg uppercase font-mono tracking-wider flex items-center gap-2">
              <span>ADK 2.0 Cyclic Workflow Graph (</span>
              <code className="font-mono bg-overlay px-1.5 py-0.5 rounded border border-hairline text-fg font-normal">optimize_loop.py</code>
              <span>)</span>
            </h3>
          </div>
          <span className="text-xs font-mono text-fg-muted">
            Pattern: <strong>Actor-Critic Optimization Loop</strong>
          </span>
        </div>

        {/* Workflow Nodes Grid */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-center">
          {/* Node 1: Generator */}
          <div className={`p-4 rounded-2xl border-2 transition-all space-y-2 shadow-sm ${
            activeNode === 1 
              ? 'bg-card border-vibe-cyan shadow-vibe-cyan/20 ring-2 ring-vibe-cyan/30' 
              : activeNode > 1 || flywheelCompleted
                ? 'bg-card border-emerald-500/40 text-fg' 
                : 'bg-card/40 border-dashed border-hairline opacity-60'
          }`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Bot size={18} className={activeNode === 1 ? 'text-vibe-cyan animate-pulse' : 'text-fg-muted'} />
                <h4 className="text-xs font-bold font-mono text-fg">1. Generator Node</h4>
              </div>
              {isRunning && currentRound > 0 && activeNode === 1 && (
                <span className="text-[10px] font-mono text-vibe-cyan animate-pulse font-bold">Round {currentRound}</span>
              )}
            </div>
            <p className="text-[11px] text-fg-muted font-sans leading-relaxed">
              Prompts Bidding Policy Agent to synthesize candidate bidding policy.
            </p>
          </div>

          {/* Node 2: Simulation Judge */}
          <div className={`p-4 rounded-2xl border-2 transition-all space-y-2 shadow-sm ${
            activeNode === 2 
              ? 'bg-card border-purple-500 shadow-purple-500/20 ring-2 ring-purple-500/30' 
              : activeNode > 2 || flywheelCompleted
                ? 'bg-card border-emerald-500/40 text-fg' 
                : 'bg-card/40 border-dashed border-hairline opacity-60'
          }`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Scale size={18} className={activeNode === 2 ? 'text-purple-400 animate-pulse' : 'text-fg-muted'} />
                <h4 className="text-xs font-bold font-mono text-fg">2. Judge Node</h4>
              </div>
              {isRunning && currentRound > 0 && activeNode === 2 && (
                <span className="text-[10px] font-mono text-purple-400 animate-pulse font-bold">Simulating 600k</span>
              )}
            </div>
            <p className="text-[11px] text-fg-muted font-sans leading-relaxed">
              Simulates 600k auctions under live market physics and scores Yield (0 - 100).
            </p>
          </div>

          {/* Node 3: Router */}
          <div className={`p-4 rounded-2xl border-2 transition-all space-y-2 shadow-sm ${
            activeNode === 3 
              ? 'bg-card border-amber-500 shadow-amber-500/20 ring-2 ring-amber-500/30' 
              : activeNode > 3 || flywheelCompleted
                ? 'bg-card border-emerald-500/40 text-fg' 
                : 'bg-card/40 border-dashed border-hairline opacity-60'
          }`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <TrendingUp size={18} className={activeNode === 3 ? 'text-amber-400 animate-pulse' : 'text-fg-muted'} />
                <h4 className="text-xs font-bold font-mono text-fg">3. Router Node</h4>
              </div>
              {isRunning && currentRound > 0 && activeNode === 3 && (
                <span className="text-[10px] font-mono text-amber-400 font-bold">
                  {currentRound < 3 ? 'Route -> IMPROVE' : 'Route -> SHIP'}
                </span>
              )}
            </div>
            <p className="text-[11px] text-fg-muted font-sans leading-relaxed">
              Checks score threshold (&ge; 99.5). Cycles to <code className="text-fg font-mono">IMPROVE</code> or branches to <code className="text-fg font-mono">SHIP</code>.
            </p>
          </div>

          {/* Node 4: Champion Publisher */}
          <div className={`p-4 rounded-2xl border-2 transition-all space-y-2 shadow-sm ${
            activeNode === 4 || flywheelCompleted
              ? 'bg-card border-emerald-500 shadow-emerald-500/20 ring-2 ring-emerald-500/30' 
              : 'bg-card/40 border-dashed border-hairline opacity-60'
          }`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Award size={18} className={activeNode === 4 || flywheelCompleted ? 'text-emerald-500' : 'text-fg-muted'} />
                <h4 className="text-xs font-bold font-mono text-fg">4. Champion Deploy</h4>
              </div>
              {flywheelCompleted && (
                <span className="text-[10px] font-mono text-emerald-600 dark:text-emerald-400 font-bold">⭐ 99.6/100</span>
              )}
            </div>
            <p className="text-[11px] text-fg-muted font-sans leading-relaxed">
              Deploys champion policy directly to production runtime environment.
            </p>
          </div>
        </div>

        {/* Interactive Trigger */}
        <div className="flex items-center justify-between pt-2">
          <button
            onClick={handleRunFlywheel}
            disabled={isRunning}
            className="px-6 py-3 bg-vibe-cyan hover:bg-vibe-cyan/90 text-black font-bold text-xs rounded-xl transition-all shadow-md flex items-center gap-2 cursor-pointer disabled:opacity-50"
          >
            {isRunning ? (
              <>
                <RefreshCw size={15} className="animate-spin text-black" />
                <span>Simulating Multi-Round Optimization Flywheel (Round {currentRound} of 3)...</span>
              </>
            ) : flywheelCompleted ? (
              <>
                <RefreshCw size={15} />
                <span>Re-Run Flywheel (<code className="font-mono font-normal">optimize_loop.py</code>)</span>
              </>
            ) : (
              <>
                <Play size={15} className="fill-black" />
                <span>Run Cyclic Flywheel (<code className="font-mono font-normal">optimize_loop.py</code>)</span>
              </>
            )}
          </button>

          {flywheelCompleted && (
            <span className="text-xs font-mono text-emerald-700 dark:text-emerald-300 font-bold flex items-center gap-1.5 animate-rise">
              <CheckCircle2 size={16} className="text-emerald-600 dark:text-emerald-400" />
              <span>Champion Converged in 3 Iterations (Score: 99.6/100)</span>
            </span>
          )}
        </div>
      </div>

      {/* Flywheel Leaderboard Table Output */}
      {completedRounds.length > 0 && (
        <div className="p-6 bg-card rounded-3xl border border-hairline shadow-xl space-y-4 animate-rise">
          <div className="flex items-center justify-between border-b border-hairline pb-3">
            <span className="text-xs font-mono font-bold text-fg uppercase tracking-wider">
              Actor-Critic Optimization Flywheel Leaderboard
            </span>
            <span className="text-[11px] font-mono text-fg-muted">policies/agent_bidding_policy.py</span>
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left font-mono text-xs">
              <thead>
                <tr className="border-b border-hairline text-fg-muted">
                  <th className="py-2.5 px-3">Iteration</th>
                  <th className="py-2.5 px-3">Yield Score</th>
                  <th className="py-2.5 px-3">Impressions</th>
                  <th className="py-2.5 px-3">Total Spend</th>
                  <th className="py-2.5 px-3">eCPM</th>
                  <th className="py-2.5 px-3">Judge Critic Feedback</th>
                  <th className="py-2.5 px-3 text-right">Verdict</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-hairline">
                {completedRounds.map((round) => (
                  <tr 
                    key={round.gen} 
                    className={`transition-all animate-rise ${
                      round.verdict === 'champion' ? 'text-fg bg-emerald-500/10 font-medium' : 'text-fg-muted bg-overlay/40'
                    }`}
                  >
                    <td className="py-3 px-3 font-bold text-fg">{round.gen}</td>
                    <td className={`py-3 px-3 font-bold ${
                      round.score >= 95 ? 'text-emerald-700 dark:text-emerald-300' : 'text-amber-600 dark:text-amber-400'
                    }`}>
                      {round.score} / 100
                    </td>
                    <td className="py-3 px-3">{round.impressions}</td>
                    <td className="py-3 px-3">{round.spend}</td>
                    <td className="py-3 px-3">{round.ecpm}</td>
                    <td className="py-3 px-3 text-[11px] font-sans text-fg-muted max-w-xs">{round.feedback}</td>
                    <td className="py-3 px-3 text-right">
                      {round.verdict === 'champion' ? (
                        <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-800 dark:text-emerald-300 border border-emerald-500/40 text-[10px] font-bold whitespace-nowrap">
                          ⭐ Champion
                        </span>
                      ) : (
                        <span className="px-2.5 py-0.5 rounded-full bg-amber-500/15 text-amber-800 dark:text-amber-300 border border-amber-500/30 text-[10px] font-bold whitespace-nowrap">
                          🔄 Route to Improve
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Champion Winning Policy Code Viewer (Displayed Once Completed) */}
      {flywheelCompleted && (
        <div className="space-y-4 animate-rise pt-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs font-mono font-bold text-fg uppercase tracking-wider">
              <Code2 size={15} className="text-emerald-600 dark:text-emerald-400" />
              <span>Winning Champion Bidding Policy</span>
            </div>
            <span className="text-[11px] font-mono text-emerald-700 dark:text-emerald-300 font-bold bg-emerald-500/10 px-2.5 py-0.5 rounded-full border border-emerald-500/20">
              Score: 99.6/100 (Crowned Champion)
            </span>
          </div>

          <div className="p-6 bg-card rounded-3xl border border-hairline shadow-2xl space-y-6">
            <div className="rounded-2xl overflow-hidden border border-hairline bg-card shadow-md">
              <PythonCodeHighlight
                code={CHAMPION_BIDDING_POLICY_SCRIPT}
                filename="agent_bidding_policy.py"
                editable={false}
                className="max-h-[520px]"
              />
            </div>

            <div className="p-5 bg-emerald-500/10 border border-emerald-500/30 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-4 animate-rise shadow-sm">
              <div className="flex items-center gap-2.5 text-xs font-mono text-emerald-800 dark:text-emerald-300">
                <CheckCircle2 size={18} className="text-emerald-600 dark:text-emerald-400 shrink-0" />
                <div>
                  <strong className="block text-fg font-sans">Champion Policy Deployed to Simulation Runtime</strong>
                  <span className="text-fg-muted text-[11px]">Ready to execute the final 600,000-auction production simulation benchmark.</span>
                </div>
              </div>
              <button
                onClick={() => navigate('simulator3')}
                className="px-6 py-3 bg-vibe-cyan hover:bg-vibe-cyan/90 text-black font-bold text-xs rounded-xl transition-all shadow-md cursor-pointer flex items-center gap-2 shrink-0"
              >
                <span>Proceed to Simulation</span>
                <ArrowRight size={15} />
              </button>
            </div>
          </div>
        </div>
      )}
        </div>
      )}
    </div>
  );
}

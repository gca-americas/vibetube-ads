import { useState } from 'react';
import { 
  ArrowRight, ArrowLeft, CheckCircle2, FileText,
  ChevronDown, ChevronUp, Bot, Scale, GitFork, RotateCcw
} from 'lucide-react';
import PythonCodeHighlight from './PythonCodeHighlight';

const WORKFLOW_GRAPH_CODE = `from google.adk import Workflow

# ADK 2.0 Native Cyclic Workflow Graph
workflow = Workflow(
    name="yield_optimization_flywheel",
    edges=[
        # 1. Forward linear execution chain:
        ("START", generator, simulation_judge, router),
        
        # 2. Dynamic conditional branching:
        (router, {"improve": proposer, "ship": done}),
        
        # 3. Cyclic return edge back to Generator:
        (proposer, generator),
    ],
)`;

const FULL_OPTIMIZE_LOOP_CODE = `"""ADK 2.0 Native Workflow: Policy Optimization Loop."""

from pathlib import Path

from google.adk import Event, Workflow
from google.adk.runners import InMemoryRunner
from google.genai import types

from agent import root_agent
from judge_agent import judge_agent
from lib.simulator import load_policy_from_code, run_simulation

POLICY_PATH = Path(__file__).resolve().parent / "policies" / "agent_bidding_policy.py"

INITIAL_PROMPT = (
    "Synthesize an optimal dynamic bidding policy to maximize total impressions won "
    "by pacing budget across the entire campaign flight. "
    "Implement dynamic pacing using context.budget_remaining and context.hours_remaining."
)


def ask_agent(agent, prompt: str) -> str:
    """Executes a single conversational turn with an agent."""
    runner = InMemoryRunner(agent=agent)
    session = runner.session_service.create_session_sync(
        app_name=runner.app_name, user_id="optimizer"
    )
    message = types.Content(
        role="user", parts=[types.Part.from_text(text=prompt)]
    )

    response_text = ""
    for event in runner.run(user_id="optimizer", session_id=session.id, new_message=message):
        if event.content and event.content.parts:
            for part in event.content.parts:
                if part.text:
                    response_text += part.text
    return response_text


def generator(generator_prompt: str = INITIAL_PROMPT, round: int = 1):
    """Prompts the Generator Agent to synthesize a bidding policy."""
    print(f"\\n--- [Round {round}] Generator Agent Synthesizing Policy ---")
    ask_agent(root_agent, generator_prompt)

    candidate_code = POLICY_PATH.read_text(encoding="utf-8")
    yield Event(state={"candidate_code": candidate_code, "round": round})


def simulation_judge(candidate_code: str, round: int):
    """Stress-tests policy in 600,000 auctions and obtains critic feedback."""
    market_seed = [42, 142, 242, 342][min(round - 1, 3)]
    print(f"--- [Round {round}] Simulation Judge Evaluating Policy (Market Seed {market_seed}) ---")

    # 1. Simulate in market physics
    policy_func = load_policy_from_code(candidate_code)
    sim = run_simulation(policy_func, seed=market_seed)
    print(f"Round {round} Score: {sim.yield_score:.1f}/100 | Spend: \${sim.total_spend:.2f} | Impressions: {sim.total_impressions:,}")

    # 2. Ask Judge agent for root-cause critique
    critique_prompt = (
        f"Review the simulation results for this candidate bidding policy:\\n"
        f"{sim.summary_text}\\n\\n"
        f"Daypart Performance Breakdown:\\n{sim.daypart_metrics}\\n\\n"
        f"Candidate Code:\\n{candidate_code}\\n\\n"
        f"Provide root-cause diagnostics and concrete code recommendations."
    )
    judge_critique = ask_agent(judge_agent, critique_prompt)

    yield Event(
        state={
            "last_score": sim.yield_score,
            "diagnostics": sim.summary_text,
            "recommendations": judge_critique,
            "candidate_code": candidate_code,
            "round": round,
        }
    )


def router(last_score: float, round: int):
    """Branches to 'ship' if target reached, otherwise loops to 'improve'."""
    if last_score >= 99.5:
        print(f"\\n🎯 Target yield score reached ({last_score:.1f}/100)! Routing -> SHIP")
        yield Event(route="ship")
    elif round >= 4:
        print(f"\\n⏹️ Max round budget reached ({round}). Routing -> SHIP")
        yield Event(route="ship")
    else:
        print(f"\\n📈 Score {last_score:.1f}/100 below target. Routing -> IMPROVE")
        yield Event(route="improve")


def proposer(recommendations: str, round: int):
    """Mutates generator prompt with the Judge's critique for the next turn."""
    print(f"--- Proposer Node: Evolving Prompt for Round {round + 1} ---")
    next_prompt = (
        f"Synthesize an improved bidding policy for the campaign.\\n\\n"
        f"Previous Simulation Judge Critique & Recommendations:\\n"
        f"{recommendations}\\n\\n"
        f"Goal: Maximize total impressions won by pacing budget across the campaign flight without exhausting capital prematurely."
    )
    yield Event(state={"generator_prompt": next_prompt, "round": round + 1})


def done(candidate_code: str, last_score: float):
    """Deploys the winning policy to production."""
    POLICY_PATH.write_text(candidate_code, encoding="utf-8")
    print(f"✨ Successfully deployed champion policy (Score: {last_score:.1f}/100) to {POLICY_PATH.name}")
    yield Event(message=f"Champion deployed with score {last_score}")


workflow = Workflow(
    name="yield_optimization_flywheel",
    edges=[
        ("START", generator, simulation_judge, router),
        (router, {"improve": proposer, "ship": done}),
        (proposer, generator),  # <-- Cyclic Return Edge back to Generator
    ],
)


def main():
    """Runs the closed-loop optimization workflow."""
    runner = InMemoryRunner(agent=workflow)
    session = runner.session_service.create_session_sync(
        app_name=runner.app_name, user_id="optimizer"
    )
    initial_message = types.Content(
        role="user", parts=[types.Part.from_text(text="start")]
    )
    for event in runner.run(user_id="optimizer", session_id=session.id, new_message=initial_message):
        pass


if __name__ == "__main__":
    main()
`;

export default function WireOptimizationLoop({ navigate }: { navigate: (v: string) => void }) {
  const [showFullScript, setShowFullScript] = useState<boolean>(false);

  return (
    <div className="animate-rise pb-24 space-y-8 max-w-5xl mx-auto">
      {/* Top Header */}
      <div className="border-b border-hairline pb-5 flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className="text-[10px] font-mono font-bold text-indigo-400 bg-indigo-500/10 border border-indigo-500/30 px-2.5 py-0.5 rounded-full">
              google.adk.Workflow
            </span>
            <span className="text-[10px] font-mono text-fg-muted">ADK 2.0 Native Graph</span>
          </div>
          <h1 className="text-3xl font-display font-bold tracking-tight text-fg flex flex-wrap items-center gap-2">
            <span>ADK 2.0</span>
            <span className="text-indigo-400 bg-indigo-500/10 border border-indigo-500/30 px-3 py-0.5 rounded-xl font-mono text-2xl font-bold">
              Workflow Graph
            </span>
          </h1>
          <p className="text-sm text-fg-muted mt-1">
            Orchestrate multiple agents into an autonomous cyclic execution graph with declarative edges, shared state, and dynamic routing.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('judge_agent')}
            className="px-4 py-2.5 bg-overlay hover:bg-hairline text-fg-muted hover:text-fg text-xs font-mono font-medium rounded-xl border border-hairline transition-all flex items-center gap-1.5 cursor-pointer"
          >
            <ArrowLeft size={14} />
            <span>Step 7</span>
          </button>
          <button
            onClick={() => navigate('flywheel')}
            className="px-6 py-2.5 bg-vibe-cyan hover:bg-vibe-cyan/90 text-black font-bold text-xs rounded-xl transition-all shadow-md flex items-center gap-2 cursor-pointer shadow-vibe-cyan/20"
          >
            <span>Proceed to Step 9: Run Loop</span>
            <ArrowRight size={14} />
          </button>
        </div>
      </div>

      {/* 1. THE 4-STAGE DATA PIPELINE OVERVIEW */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        {/* Node 1 */}
        <div className="p-4 rounded-2xl bg-card border border-hairline shadow-sm space-y-2 flex flex-col justify-between">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="w-8 h-8 rounded-xl bg-vibe-cyan/10 border border-vibe-cyan/30 flex items-center justify-center text-cyan-700 dark:text-vibe-cyan">
                <Bot size={16} />
              </div>
              <span className="text-[10px] font-mono font-bold text-cyan-700 dark:text-vibe-cyan bg-vibe-cyan/10 px-2 py-0.5 rounded-full">
                1. Generator
              </span>
            </div>
            <div>
              <h4 className="text-xs font-bold font-mono text-fg">generator()</h4>
              <p className="text-[11px] text-fg-muted mt-1 leading-relaxed">
                Prompts Generator Agent (<code className="font-mono text-fg">agent.py</code>) and emits candidate policy code into state.
              </p>
            </div>
          </div>
          <div className="pt-2 border-t border-hairline/60 text-[10px] font-mono text-fg-muted">
            State Emitted: <span className="text-cyan-700 dark:text-vibe-cyan font-semibold">candidate_code</span>
          </div>
        </div>

        {/* Node 2 */}
        <div className="p-4 rounded-2xl bg-card border border-hairline shadow-sm space-y-2 flex flex-col justify-between">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="w-8 h-8 rounded-xl bg-purple-500/10 border border-purple-500/30 flex items-center justify-center text-purple-400">
                <Scale size={16} />
              </div>
              <span className="text-[10px] font-mono font-bold text-purple-400 bg-purple-500/10 px-2 py-0.5 rounded-full">
                2. Judge
              </span>
            </div>
            <div>
              <h4 className="text-xs font-bold font-mono text-fg">simulation_judge()</h4>
              <p className="text-[11px] text-fg-muted mt-1 leading-relaxed">
                Runs 600k auction physics and prompts Judge (<code className="font-mono text-fg">judge_agent.py</code>) for root-cause critique.
              </p>
            </div>
          </div>
          <div className="pt-2 border-t border-hairline/60 text-[10px] font-mono text-fg-muted">
            State Emitted: <span className="text-purple-400 font-semibold">last_score, critique</span>
          </div>
        </div>

        {/* Node 3 */}
        <div className="p-4 rounded-2xl bg-card border border-hairline shadow-sm space-y-2 flex flex-col justify-between">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="w-8 h-8 rounded-xl bg-amber-400/10 border border-amber-400/30 flex items-center justify-center text-amber-400">
                <GitFork size={16} />
              </div>
              <span className="text-[10px] font-mono font-bold text-amber-400 bg-amber-400/10 px-2 py-0.5 rounded-full">
                3. Router
              </span>
            </div>
            <div>
              <h4 className="text-xs font-bold font-mono text-fg">router()</h4>
              <p className="text-[11px] text-fg-muted mt-1 leading-relaxed">
                Evaluates yield score. If <code className="font-mono text-fg">&ge; 99.5</code>, ships champion; else loops to improve.
              </p>
            </div>
          </div>
          <div className="pt-2 border-t border-hairline/60 text-[10px] font-mono text-fg-muted">
            Routes: <span className="text-amber-400 font-semibold">"ship" | "improve"</span>
          </div>
        </div>

        {/* Node 4 */}
        <div className="p-4 rounded-2xl bg-card border border-hairline shadow-sm space-y-2 flex flex-col justify-between">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="w-8 h-8 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                <RotateCcw size={16} />
              </div>
              <span className="text-[10px] font-mono font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full">
                4. Proposer
              </span>
            </div>
            <div>
              <h4 className="text-xs font-bold font-mono text-fg">proposer() / done()</h4>
              <p className="text-[11px] text-fg-muted mt-1 leading-relaxed">
                Injects Judge critique into next prompt and cycles back, or writes winning script to disk.
              </p>
            </div>
          </div>
          <div className="pt-2 border-t border-hairline/60 text-[10px] font-mono text-fg-muted">
            Cycles back to: <span className="text-emerald-400 font-semibold">generator()</span>
          </div>
        </div>
      </div>

      {/* 2. THE HERO WIRING CODE: ADK 2.0 WORKFLOW DECLARATION */}
      <div className="space-y-3">
        <div className="flex items-center justify-between border-b border-hairline pb-2">
          <div className="flex items-center gap-2">
            <FileText size={16} className="text-vibe-cyan" />
            <h3 className="text-sm font-bold text-fg uppercase font-mono tracking-wider">
              The ADK 2.0 Cyclic Workflow Graph
            </h3>
          </div>
          <span className="text-xs font-mono text-fg-muted">
            google.adk.Workflow(edges=[...])
          </span>
        </div>

        <p className="text-xs text-fg-muted leading-relaxed">
          The 4 functions above are wired into an autonomous self-refinement engine using ADK 2.0's declarative <code className="font-mono text-fg">edges</code> list:
        </p>

        <div className="rounded-2xl overflow-hidden border border-hairline bg-card shadow-xl">
          <PythonCodeHighlight
            code={WORKFLOW_GRAPH_CODE}
            filename="Workflow Edge Declaration (optimize_loop.py)"
            editable={false}
          />
        </div>
      </div>

      {/* 3. EXPANDABLE ACCORDION FOR COMPLETE SCRIPT */}
      <div className="border border-hairline rounded-2xl bg-card/60 overflow-hidden shadow-md">
        <button
          onClick={() => setShowFullScript(!showFullScript)}
          className="w-full flex items-center justify-between p-4 text-left hover:bg-hairline/50 transition-colors cursor-pointer"
        >
          <div className="flex items-center gap-2.5">
            <FileText size={16} className="text-fg-muted" />
            <div>
              <h4 className="text-xs font-bold font-mono text-fg">
                {showFullScript ? 'Hide Complete optimize_loop.py Implementation' : 'View Complete optimize_loop.py Implementation'}
              </h4>
              <span className="text-[11px] text-fg-muted">
                Inspect the full synchronous Python module with all node functions (~120 lines)
              </span>
            </div>
          </div>
          <div className="flex items-center gap-1.5 text-xs font-mono text-vibe-cyan">
            <span>{showFullScript ? 'Collapse' : 'Expand'}</span>
            {showFullScript ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
          </div>
        </button>

        {showFullScript && (
          <div className="p-4 border-t border-hairline bg-card animate-rise">
            <PythonCodeHighlight
              code={FULL_OPTIMIZE_LOOP_CODE}
              filename="agentic_data_engineer/optimize_loop.py"
              editable={false}
              className="max-h-[500px]"
            />
          </div>
        )}
      </div>

      {/* Milestone CTA Banner */}
      <div className="p-6 bg-gradient-to-r from-indigo-500/10 via-purple-500/10 to-vibe-cyan/10 rounded-3xl border border-indigo-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-xl animate-rise">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-indigo-500/20 text-indigo-400 flex items-center justify-center shrink-0 border border-indigo-500/30">
            <CheckCircle2 size={22} />
          </div>
          <div>
            <h4 className="text-sm font-display font-bold text-fg">ADK 2.0 Workflow Understood</h4>
            <p className="text-xs text-fg-muted">The cyclic graph connects the Generator and Judge into an autonomous self-refinement flywheel. Ready to execute the loop.</p>
          </div>
        </div>
        <button
          onClick={() => navigate('flywheel')}
          className="px-6 py-3 bg-vibe-cyan hover:bg-vibe-cyan/90 text-black font-bold text-xs rounded-xl transition-all shadow-md flex items-center gap-2 cursor-pointer shrink-0"
        >
          <span>Proceed to Step 9: Run Loop</span>
          <ArrowRight size={15} />
        </button>
      </div>
    </div>
  );
}

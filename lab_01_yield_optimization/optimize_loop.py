"""ADK 2.0 Native Workflow: Actor-Critic Policy Optimization Loop.

Orchestrates iterative self-refinement between the Campaign Manager (Generator)
and the Simulation Judge (Critic) using a native ADK 2.0 cyclic Workflow graph.
"""

import asyncio
import sys
from dataclasses import dataclass
from pathlib import Path

# Add current directory to sys.path
CURRENT_DIR = Path(__file__).resolve().parent
if str(CURRENT_DIR) not in sys.path:
    sys.path.insert(0, str(CURRENT_DIR))

from agent import root_agent
from google.adk import Event, Workflow
from google.adk.runners import InMemoryRunner
from google.genai import types
from judge_agent import judge_agent
from lib.simulator import load_policy_from_code, run_simulation

POLICY_PATH = CURRENT_DIR / "policies" / "agent_bidding_policy.py"
MAX_ROUNDS = 4
CONVERGENCE_SCORE = 99.5


@dataclass
class IterationRecord:
    """Record of a single generator-judge iteration."""

    iteration: int
    score: float
    impressions: int
    spend: float
    utilization_pct: float
    effective_cpm: float
    code: str
    diagnostics: str
    recommendations: str


async def _run_agent_turn(agent, prompt: str) -> str:
    """Executes a single conversational turn with an ADK agent."""
    runner = InMemoryRunner(agent=agent)
    session = await runner.session_service.create_session(
        app_name=runner.app_name, user_id="optimizer-user"
    )
    response_texts = []
    async for event in runner.run_async(
        user_id="optimizer-user",
        session_id=session.id,
        new_message=types.Content(
            role="user", parts=[types.Part.from_text(text=prompt)]
        ),
    ):
        if event.content and event.content.parts:
            for part in event.content.parts:
                if part.text:
                    response_texts.append(part.text)
    return "\n".join(response_texts)


def create_optimization_workflow() -> Workflow:
    """Builds the native ADK 2.0 cyclic Workflow graph."""

    def seed(node_input: str = ""):
        """Initializes the workflow state before round 1."""
        print("=" * 80)
        print("🚀 Starting ADK 2.0 Native Workflow Policy Optimization Flywheel")
        print("Architecture: Cyclic Workflow Graph with Dynamic State Templates")
        print("=" * 80)

        initial_prompt = (
            "Synthesize an optimal dynamic bidding policy to maximize total "
            "impressions won by utilizing 100% of the $2,500 campaign budget "
            "across the 24-hour flight. Implement dynamic pacing using "
            "context.budget_remaining and context.hours_remaining."
        )
        yield Event(
            state={
                "round": 0,
                "best_score": 0.0,
                "history": [],
                "generator_prompt": initial_prompt,
                "last_score": 0.0,
                "candidate_code": "",
            }
        )

    async def generator(generator_prompt: str, round: int):
        """Generator Node: Prompts Campaign Manager Agent to deploy policy."""
        curr_round = round + 1
        print(f"\n--- [Workflow Round {curr_round}] Generator Node Executing ---")
        await _run_agent_turn(root_agent, generator_prompt)

        if not POLICY_PATH.exists():
            raise RuntimeError("Generator agent failed to write policy.")

        candidate_code = POLICY_PATH.read_text(encoding="utf-8")
        yield Event(state={"candidate_code": candidate_code})

    async def simulation_judge(candidate_code: str, round: int, history: list):
        """Judge Node: Runs mathematical simulation and obtains critic feedback."""
        curr_round = round + 1
        print(f"⚖️  [Workflow Round {curr_round}] Simulation Judge Node Executing...")

        sim_func = load_policy_from_code(candidate_code)
        sim_result = run_simulation(sim_func)

        judge_prompt = (
            "Review the simulation results for this candidate bidding policy:\n"
            f"{sim_result.summary_text}\n\n"
            f"Daypart Performance Breakdown:\n{sim_result.daypart_metrics}\n\n"
            f"Candidate Code:\n```python\n{candidate_code}\n```\n\n"
            "Provide root-cause diagnostics and concrete code recommendations."
        )
        judge_critique = await _run_agent_turn(judge_agent, judge_prompt)

        record = IterationRecord(
            iteration=curr_round,
            score=sim_result.yield_score,
            impressions=sim_result.total_impressions,
            spend=sim_result.total_spend,
            utilization_pct=sim_result.budget_utilization_pct,
            effective_cpm=sim_result.effective_cpm,
            code=candidate_code,
            diagnostics=sim_result.summary_text,
            recommendations=judge_critique,
        )
        updated_history = list(history) + [record]

        print(
            f"📊 Round {curr_round} Score: {record.score}/100 | "
            f"Impressions: {record.impressions:,} | "
            f"Spend: ${record.spend:.2f} ({record.utilization_pct}%) | "
            f"eCPM: ${record.effective_cpm:.2f}"
        )

        yield Event(
            state={
                "round": curr_round,
                "last_score": sim_result.yield_score,
                "diagnostics": sim_result.summary_text,
                "recommendations": judge_critique,
                "history": updated_history,
            }
        )

    def router(last_score: float, round: int, history: list):
        """Router Node: Declares branching boundaries ('improve' vs 'ship')."""
        if last_score >= CONVERGENCE_SCORE:
            print(
                f"\n🎯 Router Decision: Score threshold ({CONVERGENCE_SCORE}) "
                f"achieved in round {round}! Routing -> SHIP"
            )
            yield Event(route="ship")
        elif round >= MAX_ROUNDS:
            print(
                f"\n⏹️  Router Decision: Max round budget ({MAX_ROUNDS}) reached. "
                "Routing -> SHIP"
            )
            yield Event(route="ship")
        elif len(history) >= 2 and history[-1].score <= history[-2].score:
            print(
                f"\n⏹️  Router Decision: Score plateau reached ({history[-1].score:.1f} "
                f"<= {history[-2].score:.1f}). Routing -> SHIP"
            )
            yield Event(route="ship")
        else:
            print(
                f"\n📈 Router Decision: Improvement needed (Score: {last_score:.1f}). "
                "Routing -> IMPROVE"
            )
            yield Event(route="improve")

    def proposer(recommendations: str, round: int):
        """Proposer Node: Evolves generator prompt using critic critique."""
        print(f"🔄 [Workflow Round {round}] Proposer Node Synthesizing Next Prompt...")
        next_prompt = (
            "Synthesize an improved bidding policy for the campaign.\n\n"
            f"Previous Simulation Judge Critique & Recommendations:\n"
            f"{recommendations}\n\n"
            "Goal: Maximize total impressions by utilizing 100% of the $2,500 "
            "budget across 24 hours. Implement dynamic pacing based on "
            "context.budget_remaining and context.hours_remaining."
        )
        yield Event(state={"generator_prompt": next_prompt})

    def publish(generator_prompt: str):
        """Publish Node: Swaps prompt into state before re-entering generator."""
        yield Event(state={"generator_prompt": generator_prompt})

    def done(history: list):
        """Done Node: Finalizes leaderboard and deploys champion policy."""
        champion = max(history, key=lambda r: r.score)
        POLICY_PATH.write_text(champion.code, encoding="utf-8")

        print("\n" + "=" * 80)
        print("🏆 ADK 2.0 WORKFLOW OPTIMIZATION LEADERBOARD")
        print("=" * 80)
        print(
            f"{'Gen':<5} | {'Score':<10} | {'Impressions':<14} | "
            f"{'Spend ($ / %)':<20} | {'eCPM':<8} | {'Status'}"
        )
        print("-" * 80)
        for r in history:
            is_champ = "⭐ Champion" if r.iteration == champion.iteration else ""
            spend_str = f"${r.spend:.2f} ({r.utilization_pct}%)"
            print(
                f"{r.iteration:<5} | {r.score:<10.1f} | {r.impressions:<14,d} | "
                f"{spend_str:<20} | ${r.effective_cpm:<7.2f} | {is_champ}"
            )

        print("=" * 80)
        print(
            f"✨ Successfully deployed champion policy from Iteration "
            f"{champion.iteration} to {POLICY_PATH.name}"
        )
        print(
            f"Final Score: {champion.score}/100 | "
            f"Total Impressions: {champion.impressions:,} | "
            f"Spend: ${champion.spend:.2f} ({champion.utilization_pct}%)"
        )
        print("=" * 80)
        yield Event(message=f"Champion deployed with score {champion.score}")

    return Workflow(
        name="yield_optimization_flywheel",
        edges=[
            ("START", seed, generator, simulation_judge, router),
            (router, {"improve": proposer, "ship": done}),
            (proposer, publish, generator),  # <-- Cyclic Return Edge
        ],
    )


async def run_workflow_async():
    """Executes the ADK 2.0 Workflow engine."""
    workflow = create_optimization_workflow()
    runner = InMemoryRunner(agent=workflow, app_name="yield_flywheel")
    session = await runner.session_service.create_session(
        app_name="yield_flywheel", user_id="workflow_runner"
    )
    async for _ in runner.run_async(
        user_id="workflow_runner",
        session_id=session.id,
        new_message=types.Content(
            role="user", parts=[types.Part.from_text(text="start_flywheel")]
        ),
    ):
        pass


def main():
    """Main entrypoint."""
    asyncio.run(run_workflow_async())


if __name__ == "__main__":
    main()

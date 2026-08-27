"""Actor-Critic Policy Optimization Loop.

Orchestrates iterative self-refinement between the Campaign Manager (Generator)
and the Simulation Judge (Critic).
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
from google.adk.runners import InMemoryRunner
from google.genai import types
from judge_agent import judge_agent
from lib.simulator import load_policy_from_code, run_simulation

POLICY_PATH = CURRENT_DIR / "policies" / "agent_bidding_policy.py"


@dataclass
class IterationRecord:
    """Record of a single generator-judge iteration."""

    iteration: int
    score: float
    impressions: int
    spend: float
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


async def run_optimization_loop_async(
    min_iterations: int = 4, max_iterations: int = 8
) -> tuple[IterationRecord, list[IterationRecord]]:
    """Runs the generator-judge feedback loop with early-stopping convergence."""
    history: list[IterationRecord] = []
    feedback: str | None = None

    print("=" * 80)
    print("🚀 Starting Vibetube Actor-Critic Policy Optimization Loop")
    print(f"Rules: Min {min_iterations} iterations | Early-stopping on plateau")
    print("=" * 80)

    for i in range(1, max_iterations + 1):
        print(f"\n--- [Iteration {i}] Generating Candidate Policy ---")

        # 1. Prompt the Campaign Manager Generator Agent
        if feedback:
            user_prompt = (
                "Synthesize an improved bidding policy for the campaign.\n\n"
                f"Previous Simulation Judge Critique & Recommendations:\n{feedback}\n\n"
                "Incorporate these recommendations to maximize impressions and "
                "budget pacing."
            )
        else:
            user_prompt = (
                "Synthesize an optimal dynamic bidding policy to maximize total "
                "impressions won under the campaign budget and authorized bid ceiling."
            )

        print("🤖 Generator Agent executing...")
        await _run_agent_turn(root_agent, user_prompt)

        if not POLICY_PATH.exists():
            print("❌ Generator failed to deploy policy script.")
            break

        candidate_code = POLICY_PATH.read_text(encoding="utf-8")

        # 2. Run simulation and obtain judge critique
        print("⚖️  Simulation Judge evaluating candidate policy...")
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
            iteration=i,
            score=sim_result.yield_score,
            impressions=sim_result.total_impressions,
            spend=sim_result.total_spend,
            effective_cpm=sim_result.effective_cpm,
            code=candidate_code,
            diagnostics=sim_result.summary_text,
            recommendations=judge_critique,
        )
        history.append(record)

        print(
            f"📊 Iteration {i} Score: {record.score}/100 | "
            f"Impressions: {record.impressions:,} | "
            f"eCPM: ${record.effective_cpm:.2f}"
        )

        # 3. Check Stopping Criteria
        if i >= min_iterations:
            best_first_3 = max(r.score for r in history[:3])
            iter_4_score = history[3].score

            if i == min_iterations:
                if iter_4_score <= best_first_3:
                    print(
                        f"\n⏹️  Stopping Criteria Met: Iteration 4 "
                        f"({iter_4_score:.1f}) did not beat best of "
                        f"first 3 ({best_first_3:.1f})."
                    )
                    break
                else:
                    print(
                        f"\n📈 Iteration 4 ({iter_4_score:.1f}) beat initial "
                        f"benchmark ({best_first_3:.1f})! Continuing search..."
                    )
            else:
                # On iteration 5+, stop when score stops improving
                if history[-1].score <= history[-2].score:
                    print(
                        f"\n⏹️  Stopping Criteria Met: Score plateau reached "
                        f"(Gen {i}: {history[-1].score:.1f} <= "
                        f"Gen {i-1}: {history[-2].score:.1f})."
                    )
                    break

        feedback = (
            f"Score: {record.score}/100\n"
            f"Performance: {record.diagnostics}\n"
            f"Recommendations:\n{record.recommendations}"
        )

    # 4. Select and deploy champion policy
    champion = max(history, key=lambda r: r.score)
    POLICY_PATH.write_text(champion.code, encoding="utf-8")

    print("\n" + "=" * 80)
    print("🏆 OPTIMIZATION LEADERBOARD")
    print("=" * 80)
    print(
        f"{'Gen':<5} | {'Score':<10} | {'Impressions':<14} | "
        f"{'Spend':<10} | {'eCPM':<8} | {'Status'}"
    )
    print("-" * 80)
    for r in history:
        is_champ = "⭐ Champion" if r.iteration == champion.iteration else ""
        print(
            f"{r.iteration:<5} | {r.score:<10.1f} | {r.impressions:<14,d} | "
            f"${r.spend:<9.2f} | ${r.effective_cpm:<7.2f} | {is_champ}"
        )

    print("=" * 80)
    print(
        f"✨ Successfully deployed champion policy from Iteration "
        f"{champion.iteration} to {POLICY_PATH.name}"
    )
    print(
        f"Final Score: {champion.score}/100 | "
        f"Total Impressions: {champion.impressions:,}"
    )
    print("=" * 80)

    return champion, history


def run_optimization_loop(
    min_iterations: int = 4, max_iterations: int = 8
) -> tuple[IterationRecord, list[IterationRecord]]:
    """Synchronous entrypoint for optimization loop."""
    return asyncio.run(
        run_optimization_loop_async(
            min_iterations=min_iterations, max_iterations=max_iterations
        )
    )


if __name__ == "__main__":
    run_optimization_loop()

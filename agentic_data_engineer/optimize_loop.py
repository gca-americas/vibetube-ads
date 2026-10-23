"""ADK 2.0 Native Workflow: Policy Optimization Loop."""

import json
from pathlib import Path

from google.adk import Event, Workflow
from google.adk.runners import InMemoryRunner
from google.genai import types

from agent import root_agent
from judge_agent import judge_agent
from lib.simulator import load_policy_from_code, run_simulation

POLICY_PATH = Path(__file__).resolve().parent / "policies" / "agent_bidding_policy.py"
HISTORY_PATH = Path(__file__).resolve().parent / "policies" / "optimization_history.json"

INITIAL_PROMPT = (
    "Synthesize an initial bidding policy for Round 1 of the optimization flywheel. "
    "Retrieve active campaign constraints and analyze historical auction telemetry to formulate a baseline strategy. "
    "Keep this initial candidate straightforward so the Simulation Judge can evaluate baseline market behavior and recommend algorithmic calibrations."
)

ROUND_RECORDS: list[dict] = []
MAX_ROUNDS: int = 3


def _save_history(completed: bool = False, current_round: int = 0, current_phase: str = "idle"):
    try:
        champion_score = None
        champion_script = ""
        if ROUND_RECORDS:
            best = max(ROUND_RECORDS, key=lambda r: r.get("score") or 0.0)
            champion_score = best.get("score")
            champion_script = best.get("candidate_code", "")
        if not champion_script and POLICY_PATH.exists():
            champion_script = POLICY_PATH.read_text(encoding="utf-8")

        HISTORY_PATH.write_text(
            json.dumps(
                {
                    "completed": completed,
                    "current_round": current_round,
                    "current_phase": current_phase,
                    "rounds": ROUND_RECORDS,
                    "champion_score": champion_score,
                    "champion_script": champion_script,
                },
                indent=2,
            ),
            encoding="utf-8",
        )
    except Exception as e:
        print(f"Failed to update optimization history: {e}", flush=True)


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
    print(f"\n--- [Round {round}] Generator Agent Synthesizing Policy ---", flush=True)
    _save_history(completed=False, current_round=round, current_phase="generator_turn")
    ask_agent(root_agent, generator_prompt)

    if not POLICY_PATH.exists():
        raise FileNotFoundError(
            f"Generator agent did not deploy policy to {POLICY_PATH}. "
            "Ensure root_agent called deploy_bidding_policy tool."
        )
    candidate_code = POLICY_PATH.read_text(encoding="utf-8")
    yield Event(state={"candidate_code": candidate_code, "round": round})


def simulation_judge(candidate_code: str, round: int):
    """Stress-tests policy in 600,000 auctions and obtains critic feedback."""
    market_seed = [42, 142, 242, 342][min(round - 1, 3)]
    print(f"--- [Round {round}] Simulation Judge Evaluating Policy (Market Seed {market_seed}) ---", flush=True)
    _save_history(completed=False, current_round=round, current_phase="judge_evaluating")

    # 1. Simulate in market physics
    policy_func = load_policy_from_code(candidate_code)
    sim = run_simulation(policy_func, seed=market_seed)
    print(
        f"Round {round} Score: {sim.yield_score:.1f}/100 | Spend: ${sim.total_spend:.2f} | Impressions: {sim.total_impressions:,}",
        flush=True,
    )

    # 2. Ask Judge agent for root-cause critique
    critique_prompt = (
        f"Review the simulation results for this candidate bidding policy:\n"
        f"{sim.summary_text}\n\n"
        f"Daypart Performance Breakdown:\n{sim.daypart_metrics}\n\n"
        f"Candidate Code:\n{candidate_code}\n\n"
        f"Provide root-cause diagnostics and concrete code recommendations."
    )
    judge_critique = ask_agent(judge_agent, critique_prompt)

    is_champion = sim.yield_score >= 99.5
    record = {
        "round": round,
        "title": f"Round {round}: {'Champion Convergence' if is_champion else 'Algorithmic Refinement'}",
        "policySummary": f"Yield Score: {sim.yield_score:.1f}/100 | Win Rate: {sim.overall_win_rate:.1f}% | Market Seed: {market_seed}",
        "score": round_score(sim.yield_score),
        "impressions": f"{sim.total_impressions:,}",
        "spend": f"${sim.total_spend:.2f} ({sim.budget_utilization_pct:.1f}%)",
        "ecpm": f"${sim.effective_cpm:.2f}",
        "diagnostics": sim.summary_text,
        "feedbackToGenerator": judge_critique,
        "status": "champion" if is_champion else "refining",
        "candidate_code": candidate_code,
    }
    ROUND_RECORDS.append(record)
    _save_history(completed=False, current_round=round, current_phase="feedback_loop")

    yield Event(
        state={
            "last_score": sim.yield_score,
            "diagnostics": sim.summary_text,
            "recommendations": judge_critique,
            "candidate_code": candidate_code,
            "round": round,
        }
    )


def round_score(val: float) -> float:
    return round(val, 1)


def router(last_score: float, round: int):
    """Branches to 'ship' if target reached, otherwise loops to 'improve'."""
    if last_score >= 99.5:
        print(f"\n🎯 Target yield score reached ({last_score:.1f}/100)! Routing -> SHIP", flush=True)
        yield Event(route="ship")
    elif round >= MAX_ROUNDS:
        print(f"\n⏹️ Max round budget reached ({round}/{MAX_ROUNDS}). Routing -> SHIP", flush=True)
        yield Event(route="ship")
    else:
        print(f"\n📈 Score {last_score:.1f}/100 below target. Routing -> IMPROVE", flush=True)
        yield Event(route="improve")


def proposer(recommendations: str, round: int):
    """Mutates generator prompt with the Judge's critique for the next turn."""
    print(f"--- Proposer Node: Evolving Prompt for Round {round + 1} ---", flush=True)
    next_prompt = (
        f"Synthesize an improved bidding policy for the campaign.\n\n"
        f"Previous Simulation Judge Critique & Recommendations:\n"
        f"{recommendations}\n\n"
        f"Goal: Maximize total impressions won by pacing budget across the campaign flight without exhausting capital prematurely."
    )
    yield Event(state={"generator_prompt": next_prompt, "round": round + 1})


def done(candidate_code: str, last_score: float):
    """Deploys the winning (highest-scoring) policy across all rounds to production."""
    winning_code = candidate_code
    winning_score = last_score
    winning_round_num = len(ROUND_RECORDS)
    if ROUND_RECORDS:
        for r in ROUND_RECORDS:
            r["status"] = "refining"
            r["title"] = f"Round {r['round']}: Algorithmic Refinement"
        best = max(ROUND_RECORDS, key=lambda r: r.get("score") or 0.0)
        best["status"] = "champion"
        best["title"] = f"Round {best['round']}: Crowned Champion Algorithm"
        winning_code = best.get("candidate_code") or candidate_code
        winning_score = best.get("score") if best.get("score") is not None else last_score
        winning_round_num = best.get("round", len(ROUND_RECORDS))

    POLICY_PATH.write_text(winning_code, encoding="utf-8")
    print(
        f"✨ Successfully deployed champion policy from Round {winning_round_num} (Score: {winning_score:.1f}/100) to {POLICY_PATH.name}",
        flush=True,
    )
    _save_history(completed=True, current_round=len(ROUND_RECORDS), current_phase="converged")
    yield Event(message=f"Champion deployed from Round {winning_round_num} with score {winning_score}")


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
    import argparse

    global MAX_ROUNDS
    parser = argparse.ArgumentParser(description="Run ADK policy optimization loop")
    parser.add_argument(
        "--max-rounds",
        type=int,
        default=3,
        help="Maximum number of optimization rounds (2 to 5, default: 3)",
    )
    args, _ = parser.parse_known_args()
    MAX_ROUNDS = max(2, min(5, args.max_rounds))

    ROUND_RECORDS.clear()
    _save_history(completed=False, current_round=0, current_phase="idle")

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

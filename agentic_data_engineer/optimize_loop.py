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
    "Synthesize an optimal dynamic bidding policy to maximize total impressions won "
    "by pacing budget across the entire campaign flight. "
    "Implement dynamic pacing using context.budget_remaining and context.hours_remaining."
)

ROUND_RECORDS: list[dict] = []


def _save_history(completed: bool = False, current_round: int = 0, current_phase: str = "idle"):
    try:
        HISTORY_PATH.write_text(
            json.dumps(
                {
                    "completed": completed,
                    "current_round": current_round,
                    "current_phase": current_phase,
                    "rounds": ROUND_RECORDS,
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

    is_champion = (sim.yield_score >= 99.5) or (round >= 4)
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
    elif round >= 4:
        print(f"\n⏹️ Max round budget reached ({round}). Routing -> SHIP", flush=True)
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
    """Deploys the winning policy to production."""
    POLICY_PATH.write_text(candidate_code, encoding="utf-8")
    print(f"✨ Successfully deployed champion policy (Score: {last_score:.1f}/100) to {POLICY_PATH.name}", flush=True)
    if ROUND_RECORDS:
        ROUND_RECORDS[-1]["status"] = "champion"
        ROUND_RECORDS[-1]["title"] = f"Round {len(ROUND_RECORDS)}: Crowned Champion Algorithm"
    _save_history(completed=True, current_round=len(ROUND_RECORDS), current_phase="converged")
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

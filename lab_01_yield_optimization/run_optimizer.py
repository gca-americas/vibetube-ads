import time
import argparse
from yield_agent import run_agent_cycle


def main():
    parser = argparse.ArgumentParser(
        description="Vibetube Autonomous Yield Optimizer Loop"
    )
    parser.add_argument(
        "--interval",
        type=int,
        default=15,
        help="Seconds between optimization cycles (default: 15)",
    )
    args = parser.parse_args()

    print(
        f"🚀 Starting Vibetube Autonomous Yield Optimizer Loop (Interval: {args.interval}s)..."
    )
    print("Press Ctrl+C to terminate the loop.\n")

    iteration = 1
    try:
        while True:
            print(f"\n--- [Cycle #{iteration} @ {time.strftime('%X')}] ---")
            run_agent_cycle()
            iteration += 1
            time.sleep(args.interval)
    except KeyboardInterrupt:
        print("\n🛑 Optimization loop stopped by user.")


if __name__ == "__main__":
    main()

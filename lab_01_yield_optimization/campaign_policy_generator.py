#!/usr/bin/env python3
"""Campaign Policy Generator.

Top-level Campaign Manager Agent responsible for generating a Python bidding policy
implementing `def compute_bid(context: dict) -> float`.
"""

import os
import re
from pathlib import Path
from google.genai import types, Client

PROJECT_ID = os.environ.get("GOOGLE_CLOUD_PROJECT", "vibeflix-sandbox")
LOCATION = os.environ.get("GOOGLE_CLOUD_LOCATION", "us-central1")
MODEL_ID = "gemini-2.5-flash"
SPEC_PATH = Path(__file__).parent / "bidding_policy_spec.md"


def extract_python_code(response_text: str) -> str:
    """Extracts python code block from markdown response."""
    blocks = re.findall(r"```python\s*([\s\S]*?)\s*```", response_text)
    for block in blocks:
        if "def compute_bid" in block:
            return block.strip()
    return response_text.strip()


def run_campaign_manager_agent() -> str:
    """Invokes Gemini 2.5 Flash with the external specification."""
    print("=" * 60)
    print("🎯 Campaign Manager Agent: Generating compute_bid script")
    print("=" * 60)

    system_instruction = SPEC_PATH.read_text(encoding="utf-8")
    client = Client(vertexai=True, project=PROJECT_ID, location=LOCATION)

    chat = client.chats.create(
        model=MODEL_ID,
        config=types.GenerateContentConfig(
            system_instruction=system_instruction,
            temperature=0.2,
        ),
    )
    prompt = (
        "Generate the production Python `def compute_bid(context: dict) -> float` "
        "bidding policy script based on the specification."
    )
    response = chat.send_message(prompt)

    generated_code = extract_python_code(response.text)
    print("\n📝 Generated Python Script:")
    print("-" * 60)
    print(generated_code)
    print("-" * 60)

    return generated_code


if __name__ == "__main__":
    run_campaign_manager_agent()

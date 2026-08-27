"""Vibetube Campaign Manager Agent Package."""

import os

# Default to Vertex AI backend with Application Default Credentials (ADC)
os.environ.setdefault("GOOGLE_GENAI_USE_VERTEXAI", "true")
os.environ.setdefault("GOOGLE_CLOUD_PROJECT", "vibeflix-sandbox")
os.environ.setdefault("GOOGLE_CLOUD_LOCATION", "us-central1")

from .agent import root_agent

__all__ = ["root_agent"]

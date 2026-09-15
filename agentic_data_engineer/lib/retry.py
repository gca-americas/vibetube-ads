"""Shared retry configuration for Gemini API calls."""

from google.genai import types

retry_config = types.GenerateContentConfig(
    http_options=types.HttpOptions(
        retry_options=types.HttpRetryOptions(
            attempts=6,
            initial_delay=2.0,
            max_delay=60.0,
            http_status_codes=[429, 500, 503, 504],
        )
    )
)

"""Centralized application configuration and environment settings."""

import os
from dataclasses import dataclass, field
from pathlib import Path

from google.genai import types


def _resolve_project_id() -> str:
    for env_var in ("GOOGLE_CLOUD_PROJECT", "GCP_PROJECT_ID", "DEVSHELL_PROJECT_ID"):
        val = os.getenv(env_var)
        if val and val.strip() and val.strip() != "(unset)":
            return val.strip()
    home_file = Path.home() / "project_id.txt"
    if home_file.exists():
        try:
            content = home_file.read_text(encoding="utf-8").strip()
            if content and content != "(unset)":
                return content
        except Exception:
            pass
    return ""


def _load_dotenv(env_path: Path | None = None) -> None:
    """Loads key-value pairs from a .env file into os.environ if present."""
    candidates = (
        [env_path]
        if env_path
        else [
            Path(__file__).resolve().parent / ".env",
            Path(__file__).resolve().parent.parent / ".env",
            Path(__file__).resolve().parent.parent.parent / ".env",
        ]
    )
    for path in candidates:
        if path.exists():
            for line in path.read_text(encoding="utf-8").splitlines():
                line = line.strip()
                if line and not line.startswith("#") and "=" in line:
                    key, val = line.split("=", 1)
                    os.environ.setdefault(key.strip(), val.strip().strip("\"'"))


_load_dotenv()


@dataclass(frozen=True)
class Settings:
    """Application runtime settings and environment parameters."""

    project_id: str = field(default_factory=_resolve_project_id)
    location: str = os.getenv("GOOGLE_CLOUD_LOCATION", "global")
    ad_server_url: str = os.getenv("AD_SERVER_URL", "http://localhost:8080")
    log_level: str = os.getenv("LOG_LEVEL", "INFO")
    dataset_id: str = os.getenv("BQ_DATASET_ID", "vibetube_telemetry")
    agent_resource_id: str = os.getenv(
        "BQ_DATA_ENGINEERING_AGENT_ID", "vibetube-bq-agent"
    )
    model_name: str = os.getenv("GEMINI_MODEL", "gemini-3.5-flash-lite")


settings = Settings()

# Configure Google Enterprise Agent Platform and Gemini Data Agents API
os.environ.setdefault("GOOGLE_GENAI_USE_VERTEXAI", "True")
os.environ.setdefault("GOOGLE_CLOUD_PROJECT", settings.project_id)
# Gemini 3.x models on Google Enterprise Agent Platform are hosted under the global endpoint
genai_location = "global" if settings.model_name.startswith("gemini-3") else settings.location
os.environ["GOOGLE_CLOUD_LOCATION"] = genai_location

from .retry import retry_config


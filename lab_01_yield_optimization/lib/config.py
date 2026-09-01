"""Centralized application configuration and environment settings."""

import os
from dataclasses import dataclass
from pathlib import Path


def _load_dotenv(env_path: Path | None = None) -> None:
    """Loads key-value pairs from a .env file into os.environ if present."""
    path = env_path or Path(__file__).parent / ".env"
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

    project_id: str = os.getenv("GOOGLE_CLOUD_PROJECT", "vibeflix-sandbox")
    location: str = os.getenv("GOOGLE_CLOUD_LOCATION", "us-central1")
    ad_server_url: str = os.getenv("AD_SERVER_URL", "http://localhost:8080")
    log_level: str = os.getenv("LOG_LEVEL", "INFO")
    dataset_id: str = os.getenv("BQ_DATASET_ID", "vibetube_telemetry")
    agent_resource_id: str = os.getenv(
        "BQ_DATA_ENGINEERING_AGENT_ID", "vibetube-bq-agent"
    )


settings = Settings()

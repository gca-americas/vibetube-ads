#!/usr/bin/env python3
"""Google Cloud BigQuery Data Engineering Agent A2A Client.

Sends analytical inquiries to Google Cloud's BigQuery Data Engineering Agent
over the Agent-to-Agent (A2A) protocol. All schema discovery, SQL authoring,
and BigQuery execution are handled server-side by the Data Engineering Agent.
"""

import json
import logging
import time
import uuid

import google.auth
import google.auth.transport.requests
import requests
from lib.config import settings

logger = logging.getLogger("bq_agent")


class BigQueryAgentClient:
    """A2A Protocol Client for Google Cloud's BigQuery Data Engineering Agent."""

    def __init__(
        self,
        project_id: str = settings.project_id,
        location: str = settings.location,
        dataset_id: str = settings.dataset_id,
        agent_resource_id: str = settings.agent_resource_id,
    ):
        self.project_id = project_id
        self.location = location
        self.dataset_id = dataset_id
        self.agent_resource_id = agent_resource_id
        self.session_id = f"a2a-sess-{uuid.uuid4().hex[:12]}"
        self._credentials = None
        self._auth_req = google.auth.transport.requests.Request()
        self._init_auth()

    def _init_auth(self):
        """Initializes Google Cloud Application Default Credentials (ADC)."""
        try:
            self._credentials, _ = google.auth.default(
                scopes=["https://www.googleapis.com/auth/cloud-platform"]
            )
        except Exception as e:
            logger.warning("ADC credentials initialization: %s", e)

    def _get_bearer_token(self) -> str:
        """Refreshes and returns the OAuth2 Bearer token for Google Cloud APIs."""
        if self._credentials:
            if not self._credentials.valid:
                self._credentials.refresh(self._auth_req)
            return self._credentials.token
        return ""

    def send_a2a_message(self, prompt: str) -> dict:
        """Sends an inquiry to the BigQuery Data Engineering Agent over A2A."""
        message_id = f"msg-{uuid.uuid4().hex[:8]}"
        timestamp = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())

        # Standard A2A Protocol Envelope
        a2a_payload = {
            "protocol": "a2a/v1",
            "message_id": message_id,
            "session_id": self.session_id,
            "timestamp": timestamp,
            "sender": {
                "agent_id": "agent://vibetube/campaign-manager",
                "role": "Campaign Strategist & Yield Optimizer",
            },
            "recipient": {
                "agent_id": "agent://google.cloud/bigquery-data-engineering-agent",
                "resource": (
                    f"projects/{self.project_id}/locations/{self.location}/"
                    f"dataAgents/{self.agent_resource_id}"
                ),
            },
            "task": "telemetry_analytics_inquiry",
            "context": {
                "project_id": self.project_id,
                "dataset_id": self.dataset_id,
            },
            "payload": {
                "prompt": prompt,
            },
        }

        logger.info(
            "A2A Protocol Dispatch: Session=%s, Target=%s, Prompt='%s'",
            self.session_id,
            a2a_payload["recipient"]["agent_id"],
            prompt,
        )

        token = self._get_bearer_token()
        headers = {
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json",
        }

        # Gemini Data Agents / Vertex AI Reasoning Engine API Endpoints
        endpoint_urls = [
            (
                f"https://discoveryengine.googleapis.com/v1alpha/projects/"
                f"{self.project_id}/locations/global/dataAgents/"
                f"{self.agent_resource_id}:chat"
            ),
            (
                f"https://{self.location}-aiplatform.googleapis.com/v1/"
                f"projects/{self.project_id}/locations/{self.location}/"
                f"reasoningEngines/{self.agent_resource_id}:query"
            ),
        ]

        for endpoint_url in endpoint_urls:
            try:
                res = requests.post(
                    endpoint_url,
                    json={"input": a2a_payload},
                    headers=headers,
                    timeout=15,
                )
                if res.ok:
                    data = res.json()
                    response_text = data.get("output", {}).get("text", str(data))
                    logger.info(
                        "A2A Response from BigQuery Data Agent: %s",
                        response_text,
                    )
                    return {
                        "status": "success",
                        "session_id": self.session_id,
                        "response_text": response_text,
                    }
            except Exception:
                pass

        error_msg = (
            f"BigQuery Data Engineering Agent endpoint reachable for"
            f" `{self.project_id}`. Ensure the Gemini Data Agents API is enabled"
            f" and AGENT_ID `{self.agent_resource_id}` is provisioned."
        )
        return {
            "status": "endpoint_pending",
            "session_id": self.session_id,
            "response_text": error_msg,
        }


if __name__ == "__main__":
    client = BigQueryAgentClient()
    test_inquiry = (
        "In the `vibetube_telemetry.auction_events` table, calculate the 90th "
        "percentile (P90) clearing CPM and average win rate grouped by daypart."
    )
    result = client.send_a2a_message(test_inquiry)
    logger.info("A2A Result: %s", result["response_text"])

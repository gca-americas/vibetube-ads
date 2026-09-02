#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

# 1. Resolve Active GCP Project and Region
PROJECT_ID=$(gcloud config get-value project 2>/dev/null || true)
if [ -z "$PROJECT_ID" ]; then
  echo "❌ Error: No Google Cloud project configured."
  echo "Please set your active project: gcloud config set project <YOUR_PROJECT_ID>"
  exit 1
fi

REGION="${GOOGLE_CLOUD_LOCATION:-us-central1}"

echo "=================================================================="
echo "  🚀 Deploying Vibetube Ads to Google Cloud"
echo "  Project : $PROJECT_ID"
echo "  Region  : $REGION"
echo "=================================================================="

# 2. Enable Required Google Cloud APIs
echo ""
echo "Step 1/4: Enabling required Google Cloud APIs..."
gcloud services enable \
  run.googleapis.com \
  cloudbuild.googleapis.com \
  artifactregistry.googleapis.com \
  bigquery.googleapis.com \
  aiplatform.googleapis.com \
  --project="$PROJECT_ID"

# 3. Seed BigQuery Telemetry Dataset & Table
echo ""
echo "Step 2/4: Initializing BigQuery telemetry warehouse..."
python3 -c "import google.cloud.bigquery" 2>/dev/null || {
  echo "Installing BigQuery Python client..."
  pip3 install --quiet google-cloud-bigquery 2>/dev/null || python3 -m pip install --quiet google-cloud-bigquery 2>/dev/null || true
}

GOOGLE_CLOUD_PROJECT="$PROJECT_ID" GOOGLE_CLOUD_LOCATION="$REGION" python3 "$SCRIPT_DIR/init_bigquery.py"

# 4. Build and Deploy Container to Cloud Run
echo ""
echo "Step 3/4: Building and deploying Ad Ops Control Center to Cloud Run..."
gcloud run deploy vibetube-ads \
  --source "$ROOT_DIR" \
  --region "$REGION" \
  --platform managed \
  --allow-unauthenticated \
  --set-env-vars GOOGLE_CLOUD_PROJECT="$PROJECT_ID",GOOGLE_CLOUD_LOCATION="$REGION",GOOGLE_GENAI_USE_VERTEXAI=True \
  --project="$PROJECT_ID"

# 5. Capture Deployed Cloud Run URL
SERVICE_URL=$(gcloud run services describe vibetube-ads --region "$REGION" --project "$PROJECT_ID" --format='value(status.url)')

# 6. Configure Local Environment for ADK Agent Execution
echo ""
echo "Step 4/4: Configuring local ADK environment (.env)..."
cat << ENV_EOF > "$ROOT_DIR/lab_01_yield_optimization/.env"
GOOGLE_GENAI_USE_VERTEXAI=True
GOOGLE_CLOUD_PROJECT=$PROJECT_ID
GOOGLE_CLOUD_LOCATION=$REGION
AD_SERVER_URL=$SERVICE_URL
ENV_EOF

echo ""
echo "=================================================================="
echo "  🎉 Vibetube Ads Deployed Successfully!"
echo ""
echo "  👉 Application URL: $SERVICE_URL"
echo ""
echo "  Open the URL above in your browser to access the"
echo "  Ad Ops Control Center."
echo "=================================================================="

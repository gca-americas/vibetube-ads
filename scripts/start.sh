#!/bin/bash

echo "Starting the Ad Ops Control Center ..."

cd "$(dirname "$0")/../ad_ops_control_center" || exit

# Create a virtual environment if it doesn't exist
if [ ! -d "venv" ]; then
    python3 -m venv venv
fi

# Activate the virtual environment
source venv/bin/activate

# Install requirements quietly
pip install -q -r requirements.txt

# Start the Streamlit app
streamlit run app.py

#!/bin/bash

# Navigate to the ad server directory
cd "$(dirname "$0")/../ad_server" || exit

# Build and run the ad server
go build -o vibetube-ad-server .
./vibetube-ad-server

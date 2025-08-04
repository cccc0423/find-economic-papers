#!/bin/bash

# Script to create files.json listing all CSV files in the data directory
# This file can be used for reference or future functionality

echo "Creating files.json with list of CSV files..."

# Create JSON array of CSV files, sorted alphabetically
ls -1 data/*.csv | jq -R -s 'split("\n") | map(select(length > 0)) | sort' > data/files.json

echo "Created files.json with $(cat data/files.json | jq length) files"
echo "Done!"
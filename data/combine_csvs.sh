#!/bin/bash

# Script to combine all CSV files into a single file for better web performance
# This reduces the number of HTTP requests from 60+ to just 1

echo "Combining all CSV files into all_papers.csv..."

# Get the header from the first CSV file
head -1 *.csv | head -1 > all_papers.csv

# Append all data (excluding headers) from all CSV files
for file in *.csv; do
    if [ "$file" != "all_papers.csv" ]; then
        echo "Processing $file..."
        tail -n +2 "$file" >> all_papers.csv
    fi
done

echo "Successfully combined $(ls *.csv | grep -v all_papers.csv | wc -l) files into all_papers.csv"
echo "Total papers: $(tail -n +2 all_papers.csv | wc -l)"
echo "Done!"
# Find Economic Papers

A web application for searching and browsing academic papers from major economics journals, with a Python scraper for collecting data.

## Features

- **Web Interface**: Interactive search with keyword filtering, year range selection, and journal filtering
- **Mobile Responsive**: Optimized for both desktop and mobile viewing
- **Fast Loading**: Single combined CSV file for optimal performance
- **Advanced Search**: Support for exact phrase matching with quotes and keyword intersection

## Supported Journals

- American Economic Review
- The Quarterly Journal of Economics
- Journal of Political Economy
- The Review of Economic Studies
- Econometrica
- The Review of Economics and Statistics
- Journal of Econometrics
- Journal of Economic Literature
- AEJ: Applied Economics
- AEJ: Economic Policy

## Web Application

The web application provides a user-friendly interface to search through collected papers:

1. Open `index.html` in a web browser
2. Use the search interface to filter papers by:
   - Keywords (supports exact phrases in quotes)
   - Publication year range
   - Journal selection
3. Click on paper titles to view abstracts

### Deployment

For optimal performance on GitHub Pages or other static hosting:

1. Run the data combination script:
```bash
cd data
bash combine_csvs.sh
```

This combines all individual CSV files into a single `all_papers.csv` file, reducing load times significantly.

## Data Collection (Scraper)

### Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd find-economic-papers
```

2. Create a virtual environment:
```bash
python3 -m venv venv
```

3. Activate the virtual environment:
```bash
# On macOS/Linux:
source venv/bin/activate

# On Windows:
venv\Scripts\activate
```

4. Install dependencies:
```bash
pip install -r requirements.txt
```

### Usage

Run the scraper:
```bash
python scraper.py
```

Follow the interactive prompts to:
1. Select which journals to scrape (enter numbers separated by spaces, or 'all')
2. Choose the year range for paper collection

The scraper will create CSV files with the collected paper information.

### Data Processing

After scraping, combine the individual CSV files for web deployment:
```bash
cd data
bash combine_csvs.sh
```

## File Structure

```
find-economic-papers/
├── index.html              # Main web interface
├── css/style.css           # Styling for web interface
├── js/script.js           # JavaScript for search functionality
├── data/                  # Data directory
│   ├── combine_csvs.sh    # Script to combine CSV files
│   ├── all_papers.csv     # Combined data file (generated)
│   └── *.csv             # Individual journal/year CSV files
├── scraper.py            # Python scraper script
├── requirements.txt      # Python dependencies
└── README.md            # This file
```

## Output Data Format

The CSV files contain:
- Paper titles
- Authors
- Journal names
- Publication years
- Abstracts
- Links to papers (when available)

## Requirements

### Web Application
- Modern web browser with JavaScript enabled
- Static web server (for local development) or hosting service

### Scraper
- Python 3.7+
- requests
- beautifulsoup4

## Note

This tool is for academic research purposes. Please respect the websites' terms of service and use responsibly.
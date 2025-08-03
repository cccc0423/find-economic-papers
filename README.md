# Economic Papers Scraper

A Python web scraper for collecting academic papers from major economics journals.

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

## Installation

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

## Usage

Run the scraper:
```bash
python scraper.py
```

Follow the interactive prompts to:
1. Select which journals to scrape (enter numbers separated by spaces, or 'all')
2. Choose the year range for paper collection

The scraper will create a CSV file with the collected paper information.

## Output

The scraper generates a CSV file containing:
- Paper titles
- Authors
- Journal names
- Publication years
- Links to papers (when available)

## Requirements

- Python 3.7+
- requests
- beautifulsoup4

## Note

This tool is for academic research purposes. Please respect the websites' terms of service and use responsibly.
# Find Economic Papers

A web application for searching and browsing academic papers from major economics journals, with a Python scraper for collecting data and GitHub Actions for automation.

## Features

- **Automated Data Updates**: A GitHub Action runs monthly to scrape the latest papers from the current year, ensuring the data is always up-to-date.
- **Web Interface**: Interactive search with keyword filtering, year range selection, and journal filtering.
- **Mobile Responsive**: Optimized for both desktop and mobile viewing.
- **Advanced Search**: Support for exact phrase matching with quotes and keyword intersection.

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
- Journal of Labor Economics
- Journal of Public Economics
- Journal of European Economic Association
- Journal of Finance
- Journal of Financial Economics
- The Review of Financial Studies

## Web Application

The web application provides a user-friendly interface to search through collected papers. Simply open `index.html` in a modern web browser.

## Automation with GitHub Actions

This repository is configured to automatically update its data using GitHub Actions.

- **Schedule**: The workflow runs automatically on the first day of every month.
- **Process**: It scrapes all supported journals for the **current calendar year**.
- **Manual Trigger**: You can also manually run the workflow from the "Actions" tab of the GitHub repository.

The workflow handles fetching the data, updating the necessary CSV files, and committing them back to the repository.

## Data Collection (Manual Scraper Usage)

While the project is automated, you can still run the scraper manually to fetch data for specific journals or years.

### Installation

1.  Clone the repository:
    ```bash
    git clone <repository-url>
    cd find-economic-papers
    ```

2.  Create and activate a virtual environment:
    ```bash
    # Create the environment
    python3 -m venv venv

    # Activate it (on macOS/Linux)
    source venv/bin/activate
    ```

3.  Install dependencies:
    ```bash
    pip install -r requirements.txt
    ```

### Usage

The scraper now accepts command-line arguments.

**Examples:**

- **Scrape the current year for all journals (default behavior):**
  ```bash
  python scraper.py
  ```

- **Scrape a specific year (e.g., 2023) for all journals:**
  ```bash
  python scraper.py --years 2023
  ```

- **Scrape multiple specific years:**
  ```bash
  python scraper.py --years "2023,2022,2021"
  ```

- **Scrape only specific journals for the current year:**
  ```bash
  python scraper.py --journals "American Economic Review,Econometrica"
  ```

### Data Processing

After scraping, you may want to update the `files.json` file, which is used by the web interface to know which CSV files are available.
```bash
bash create_files_json.sh
```
The GitHub Actions workflow runs this automatically.

## File Structure

```
find-economic-papers/
├── .github/workflows/scheduled_scrape.yml  # GitHub Actions workflow
├── index.html              # Main web interface
├── css/style.css           # Styling for web interface
├── js/script.js            # JavaScript for search functionality
├── data/                   # Data directory
│   ├── files.json          # Index of all available CSV files
│   └── *.csv               # Individual journal/year CSV files
├── scraper.py              # Python scraper script
├── create_files_json.sh    # Script to update files.json
├── requirements.txt        # Python dependencies
└── README.md               # This file
```

## Requirements

### Web Application
- A modern web browser with JavaScript enabled.

### Scraper
- Python 3.7+
- `requests`
- `beautifulsoup4`

## Note

This tool is for academic research purposes. Please respect the websites' terms of service and use responsibly.

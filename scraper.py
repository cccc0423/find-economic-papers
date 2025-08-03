import requests
from bs4 import BeautifulSoup
import csv
import os
import re

def get_year_urls(soup, base_url):
    """Creates a mapping of years to the URLs where their papers are listed."""
    year_urls = {}
    # Older years are on separate pages (e.g., default1.htm)
    for link in soup.find_all('a', href=lambda href: href and 'default' in href):
        if link.next_sibling and isinstance(link.next_sibling, str):
            year_text = link.next_sibling.strip().strip('()')
            if year_text.isdigit():
                year = int(year_text)
                year_urls[year] = requests.compat.urljoin(base_url, link['href'])

    # Recent years are on the main page
    all_years_on_page = set()
    for b_tag in soup.find_all('b'):
        text = b_tag.get_text()
        parts = text.split(',')
        if len(parts) > 1:
            year_part = parts[-1].strip()
            if year_part.isdigit():
                all_years_on_page.add(int(year_part))

    recent_years = all_years_on_page - set(year_urls.keys())
    for year in recent_years:
        year_urls[year] = base_url

    return year_urls

def scrape_abstract_and_url(paper_url):
    """Scrapes the abstract and journal URL from a paper's page."""
    abstract = ""
    journal_url = ""
    try:
        response = requests.get(paper_url)
        response.raise_for_status()
        soup = BeautifulSoup(response.content, 'html.parser')

        # Find the <b> tag with "Abstract:" and get the text that follows
        abstract_tag = soup.find('b', string='Abstract:')
        if abstract_tag:
            abstract = abstract_tag.next_sibling.strip()

        # Find Downloads section - look for <b>Downloads:</b> followed by (external link)
        downloads_tag = soup.find('b', string='Downloads:')
        if downloads_tag:
            # Look for the pattern: Downloads: (external link)<br><a href="...">
            current = downloads_tag
            while current:
                current = current.next_sibling
                if current and hasattr(current, 'name') and current.name == 'a':
                    # Found the first <a> tag after Downloads:, extract the text content
                    journal_url = current.get_text().strip()
                    break
                elif current and hasattr(current, 'name') and current.name == 'p':
                    # If we hit another paragraph, stop searching
                    break

    except requests.exceptions.RequestException as e:
        print(f"Error fetching data from {paper_url}: {e}")
    return abstract, journal_url

def scrape_papers_for_year(page_soup, journal_name, year, base_url):
    """Scrapes all papers for a specific year from a given page soup."""
    papers = []
    # Find all volume headers for the selected year
    for b_tag in page_soup.find_all('b'):
        if str(year) in b_tag.text:
            dl_tag = b_tag.find_next_sibling('dl')
            if dl_tag:
                for dt in dl_tag.find_all('dt'):
                    title_tag = dt.find('a')
                    if title_tag:
                        title = title_tag.text.strip()
                        # Construct the absolute URL for the paper's page
                        paper_url = requests.compat.urljoin(base_url, title_tag['href'])
                        abstract, journal_url = scrape_abstract_and_url(paper_url)
                        dd_tag = dt.find_next_sibling('dd')
                        if dd_tag:
                            authors = dd_tag.text.strip()
                            papers.append({
                                'journal': journal_name, 
                                'year': year, 
                                'title': title, 
                                'authors': authors, 
                                'abstract': abstract,
                                'url': journal_url
                            })
    return papers

def main():
    """Main function to scrape journals and save to CSV."""
    journals = {
        "American Economic Review": "https://econpapers.repec.org/article/aeaaecrev/",
        "The Quarterly Journal of Economics": "https://econpapers.repec.org/article/oupqjecon/",
        "Journal of Political Economy": "https://econpapers.repec.org/article/ucpjpolec/",
        "The Review of Economic Studies": "https://econpapers.repec.org/article/ouprestud/",
        "Econometrica": "https://econpapers.repec.org/article/wlyemetrp/",
        "The Review of Economics and Statistics": "https://econpapers.repec.org/article/tprrestat/",
        "Journal of Econometrics": "https://econpapers.repec.org/article/eeeeconom/",
        "Journal of Economic Literature": "https://econpapers.repec.org/article/aeajeclit/",
        "AEJ: Applied Economics": "https://econpapers.repec.org/article/aeaaejapp/",
        "AEJ: Economic Policy": "https://econpapers.repec.org/article/aeaaejpol/",
    }

    print("Available journals:")
    for i, journal_name in enumerate(journals.keys(), 1):
        print(f"{i}. {journal_name}")

    selected_journal_indices = input("Select journals to scrape (e.g., 1 2 4, or 'all'): ").lower().strip("'\"")
    if selected_journal_indices == 'all':
        selected_journals = list(journals.keys())
    else:
        selected_journals = [list(journals.keys())[int(i) - 1] for i in selected_journal_indices.split()]

    for journal_name in selected_journals:
        url = journals[journal_name]
        print(f"\nFetching available years for {journal_name}...")
        try:
            response = requests.get(url)
            response.raise_for_status()
            soup = BeautifulSoup(response.content, 'html.parser')
            year_urls = get_year_urls(soup, url)
            available_years = sorted(year_urls.keys(), reverse=True)

            if not available_years:
                print(f"Could not find available years for {journal_name}.")
                continue

            print(f"Available years: {available_years}")
            selected_years_str = input(f"Select years for {journal_name} (e.g., 2023 2022, or 'all'): ").lower()
            if selected_years_str == 'all':
                selected_years = available_years
            else:
                selected_years = [int(y) for y in selected_years_str.split()]

            for year in selected_years:
                if year not in year_urls:
                    print(f"Warning: Year {year} not available for {journal_name}. Skipping...")
                    continue
                print(f"Scraping {journal_name} for year {year}...")
                page_url = year_urls[year]
                if page_url == url:
                    page_soup = soup
                else:
                    page_response = requests.get(page_url)
                    page_response.raise_for_status()
                    page_soup = BeautifulSoup(page_response.content, 'html.parser')
                
                papers = scrape_papers_for_year(page_soup, journal_name, year, page_url)
                print(f"Found {len(papers)} papers in {journal_name} for {year}.")
                
                if papers:
                    # Create safe filename
                    safe_journal_name = re.sub(r'[^\w\s-]', '', journal_name).strip().replace(' ', '_')
                    filename = f"{safe_journal_name}_{year}.csv"
                    filepath = os.path.join('data', filename)
                    
                    with open(filepath, 'w', newline='', encoding='utf-8') as csvfile:
                        fieldnames = ['journal', 'year', 'title', 'authors', 'abstract', 'url']
                        writer = csv.DictWriter(csvfile, fieldnames=fieldnames)
                        writer.writeheader()
                        writer.writerows(papers)
                    print(f"Data saved to {filepath}")
                else:
                    print(f"No papers found for {journal_name} {year}.")

        except requests.exceptions.RequestException as e:
            print(f"Error processing {journal_name}: {e}")

    print("\nScraping complete. Data saved to individual files in the 'data' directory.")

if __name__ == "__main__":
    main()

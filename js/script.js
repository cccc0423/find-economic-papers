let allPapers = [];
let allJournals = [];

// Load data from CSV files in data directory
async function loadData() {
    try {
        // Load the combined CSV file
        allPapers = await loadCSVFile('data/all_papers.csv');
        
        if (allPapers.length === 0) {
            document.getElementById('results').innerHTML = 
                '<div class="no-results">在 data 資料夾中沒有找到資料</div>';
            return;
        }
        
        initializeJournals();
        setupEventListeners();
        performSearch(); // 初始顯示所有結果
        
    } catch (error) {
        console.error('Error loading data:', error);
        document.getElementById('results').innerHTML = 
            '<div class="no-results">無法載入資料檔案，請確認 data/all_papers.csv 存在</div>';
    }
}

// This function is no longer needed since we use a single combined file
// Kept for potential future use
async function getDataFiles() {
    return ['all_papers.csv'];
}

// Load individual CSV file
async function loadCSVFile(filePath) {
    return new Promise((resolve, reject) => {
        fetch(filePath)
            .then(response => {
                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }
                return response.text();
            })
            .then(csvText => {
                Papa.parse(csvText, {
                    header: true,
                    skipEmptyLines: true,
                    complete: function(results) {
                        resolve(results.data);
                    },
                    error: function(error) {
                        reject(error);
                    }
                });
            })
            .catch(error => {
                console.warn(`Failed to load ${filePath}:`, error);
                resolve([]); // Return empty array instead of rejecting
            });
    });
}

// Initialize Journals
function initializeJournals() {
    const journals = [...new Set(allPapers.map(paper => paper.journal))].sort();
    allJournals = journals;
    
    const journalSelect = document.getElementById('journalSelect');
    journalSelect.innerHTML = journals.map(journal => `
        <div class="journal-option">
            <input type="checkbox" id="journal-${journal}" value="${journal}" checked>
            <label for="journal-${journal}">${journal}</label>
        </div>
    `).join('');
}

// Setup event listeners for search inputs
function setupEventListeners() {
    document.getElementById('keywords').addEventListener('input', performSearch);
    document.getElementById('yearFrom').addEventListener('input', performSearch);
    document.getElementById('yearTo').addEventListener('input', performSearch);
    
    // When a journal checkbox is changed, re-perform the search
    document.getElementById('journalSelect').addEventListener('change', performSearch);
}

// Perform search based on inputs
function performSearch() {
    const keywords = document.getElementById('keywords').value.toLowerCase().trim();
    const yearFrom = parseInt(document.getElementById('yearFrom').value) || 0;
    const yearTo = parseInt(document.getElementById('yearTo').value) || 9999;
    
    // Extract selected journals
    const selectedJournals = [];
    document.querySelectorAll('#journalSelect input[type="checkbox"]:checked').forEach(checkbox => {
        selectedJournals.push(checkbox.value);
    });

    // Filter papers based on criteria
    let filteredPapers = allPapers.filter(paper => {
        // Year
        const paperYear = parseInt(paper.year);
        if (paperYear < yearFrom || paperYear > yearTo) return false;
        
        // Journal
        if (!selectedJournals.includes(paper.journal)) return false;
        
        // Keywords
        if (keywords) {
            // Parse keywords: handle exact phrases in quotes and individual words
            const exactPhrases = [];
            const individualWords = [];
            
            // Regex to find quoted phrases or individual words
            const regex = /"([^"]*)"|(\S+)/g;
            let match;
            while ((match = regex.exec(keywords)) !== null) {
                if (match[1]) { // Quoted phrase
                    exactPhrases.push(match[1].toLowerCase());
                } else if (match[2]) { // Individual word
                    individualWords.push(match[2].toLowerCase());
                }
            }

            const searchText = `${paper.journal} ${paper.year} ${paper.title} ${paper.authors} ${paper.abstract}`.toLowerCase();
            
            // Check for exact phrase matches (AND condition for all phrases)
            const allPhrasesMatch = exactPhrases.every(phrase => searchText.includes(phrase));
            if (!allPhrasesMatch) return false;

            // Check for individual word matches (AND condition for all words)
            // If there are no individual words, this condition is considered true
            const allIndividualWordsMatch = individualWords.length === 0 || individualWords.every(word => searchText.includes(word));
            if (!allIndividualWordsMatch) return false;
        }
        
        return true;
    });

    // Sort results by year (descending), then by title
    filteredPapers.sort((a, b) => {
        const yearA = parseInt(a.year);
        const yearB = parseInt(b.year);
        if (yearA !== yearB) {
            return yearB - yearA; // 由新到舊排序
        }
        return a.title.localeCompare(b.title);
    });

    displayResults(filteredPapers);
}

// Display results in the UI
function displayResults(papers) {
    const resultsInfo = document.getElementById('resultsInfo');
    const results = document.getElementById('results');
    
    resultsInfo.textContent = `找到 ${papers.length} 篇論文`;
    resultsInfo.style.display = 'block';

    if (papers.length === 0) {
        results.innerHTML = '<div class="no-results">沒有找到符合條件的論文</div>';
        return;
    }

    results.innerHTML = papers.map(paper => `
        <div class="paper-card">
            <div class="paper-header">
                <div class="paper-title">
                    ${paper.url ? 
                        `<a href="${paper.url}" target="_blank" class="paper-title-link">${paper.title}</a>` :
                        paper.title
                    }
                </div>
                <div class="paper-meta">
                    <div class="meta-item">
                        <span class="meta-label">期刊:</span>
                        <span>${paper.journal}</span>
                    </div>
                    <div class="meta-item">
                        <span class="meta-label">年份:</span>
                        <span>${paper.year}</span>
                    </div>
                    <div class="meta-item">
                        <span class="meta-label">作者:</span>
                        <span>${paper.authors}</span>
                    </div>
                </div>
            </div>
            <button class="abstract-toggle" onclick="toggleAbstract(this)">
                摘要 ▼
            </button>
            <div class="abstract-content">
                ${paper.abstract}
            </div>
        </div>
    `).join('');
}

// 切換摘要顯示
function toggleAbstract(button) {
    const content = button.nextElementSibling;
    const isShowing = content.classList.contains('show');
    
    if (isShowing) {
        content.classList.remove('show');
        button.textContent = '摘要 ▼';
    } else {
        content.classList.add('show');
        button.textContent = '摘要 ▲';
    }
}

// Initialize the app
document.addEventListener('DOMContentLoaded', loadData);
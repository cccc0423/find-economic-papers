let allPapers = [];
let allJournals = [];

// Load data from CSV files in data directory
async function loadData() {
    try {
        // First, get list of CSV files in data directory
        const files = await getDataFiles();
        if (files.length === 0) {
            document.getElementById('results').innerHTML = 
                '<div class="no-results">在 data 資料夾中沒有找到任何 CSV 檔案</div>';
            return;
        }
        
        // Load all CSV files
        const loadPromises = files.map(file => loadCSVFile(`data/${file}`));
        const allData = await Promise.all(loadPromises);
        
        // Combine all papers from all files
        allPapers = allData.flat();
        
        initializeJournals();
        setupEventListeners();
        performSearch(); // 初始顯示所有結果
        
    } catch (error) {
        console.error('Error loading data:', error);
        document.getElementById('results').innerHTML = 
            '<div class="no-results">無法載入資料檔案，請確認 data 資料夾存在且包含 CSV 檔案</div>';
    }
}

// Get list of CSV files in data directory
async function getDataFiles() {
    try {
        // Since we can't directly list directory contents in browser,
        // we'll try to load a manifest file or use a predefined list
        // For now, we'll try to fetch files based on common patterns
        const journals = [
            "American_Economic_Review",
            "The_Quarterly_Journal_of_Economics", 
            "Journal_of_Political_Economy",
            "The_Review_of_Economic_Studies",
            "Econometrica",
            "The_Review_of_Economics_and_Statistics",
            "Journal_of_Econometrics",
            "Journal_of_Economic_Literature",
            "AEJ_Applied_Economics",
            "AEJ_Economic_Policy"
        ];
        
        const years = [];
        for (let year = 2000; year <= 2025; year++) {
            years.push(year);
        }
        
        const availableFiles = [];
        
        // Check which files exist by trying to fetch them
        for (const journal of journals) {
            for (const year of years) {
                const filename = `${journal}_${year}.csv`;
                try {
                    const response = await fetch(`data/${filename}`, { method: 'HEAD' });
                    if (response.ok) {
                        availableFiles.push(filename);
                    }
                } catch (e) {
                    // File doesn't exist, continue
                }
            }
        }
        
        return availableFiles;
    } catch (error) {
        console.error('Error getting data files:', error);
        return [];
    }
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
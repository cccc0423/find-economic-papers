let allPapers = [];
let allJournals = [];
let loadedJournals = new Set(); // Track which journals have been loaded
let loadingJournals = new Set(); // Track which journals are currently being loaded
let searchDebounceTimer = null;
let searchCache = new Map(); // Cache for search results
let currentResults = [];
let displayedCount = 50; // Initial number of results to display

// Initialize the app without loading any data
async function loadData() {
    try {
        // Initialize with predefined journal list
        initializeJournals();
        setupEventListeners();
        
        // Show empty state initially
        document.getElementById('results').innerHTML = 
            '<div class="no-results">請選擇期刊以載入資料</div>';
        
    } catch (error) {
        console.error('Error initializing app:', error);
        document.getElementById('results').innerHTML = 
            '<div class="no-results">應用程式初始化失敗</div>';
    }
}

// Load journal data on demand
async function loadJournalDataIfNeeded(journalName, isChecked) {
    if (!isChecked || loadedJournals.has(journalName) || loadingJournals.has(journalName)) {
        return;
    }
    
    loadingJournals.add(journalName);
    
    try {
        // Show loading indicator
        updateLoadingStatus(`載入 ${journalName} 資料中...`);
        
        // Convert journal name to filename format
        const filePrefix = journalName
            .replace(/:/g, '')
            .replace(/\s+/g, '_')
            .replace('AEJ_Applied_Economics', 'AEJ_Applied_Economics')
            .replace('AEJ_Economic_Policy', 'AEJ_Economic_Policy');
        
        // Load all years for this journal
        const years = [2020, 2021, 2022, 2023, 2024, 2025];
        const loadPromises = years.map(year => {
            const filename = `${filePrefix}_${year}.csv`;
            return loadCSVFile(`data/${filename}`);
        });
        
        const yearData = await Promise.all(loadPromises);
        const journalPapers = yearData.flat().filter(paper => paper && Object.keys(paper).length > 0);
        
        // Add to allPapers
        allPapers = allPapers.concat(journalPapers);
        loadedJournals.add(journalName);
        
        updateLoadingStatus('');
        
    } catch (error) {
        console.error(`Error loading data for ${journalName}:`, error);
        updateLoadingStatus(`載入 ${journalName} 資料失敗`);
        setTimeout(() => updateLoadingStatus(''), 3000);
    } finally {
        loadingJournals.delete(journalName);
    }
}

// Update loading status with better UX
function updateLoadingStatus(message) {
    const resultsInfo = document.getElementById('resultsInfo');
    if (message) {
        resultsInfo.innerHTML = `
            <div class="loading-status">
                <div class="loading-spinner"></div>
                <span>${message}</span>
            </div>
        `;
        resultsInfo.style.display = 'block';
    } else {
        resultsInfo.style.display = 'none';
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

// Initialize Journals with predefined list
function initializeJournals() {
    // Predefined list of journals
    const journals = [
        "American Economic Review",
        "The Quarterly Journal of Economics", 
        "Journal of Political Economy",
        "The Review of Economic Studies",
        "Econometrica",
        "The Review of Economics and Statistics",
        "Journal of Econometrics",
        "Journal of Economic Literature",
        "AEJ: Applied Economics",
        "AEJ: Economic Policy",
        "Journal of European Economic Association",
        "Journal of Finance",
        "Journal of Financial Economics",
        "Journal of Labor Economics",
        "Journal of Public Economics",
        "The Review of Financial Studies"
    ].sort();
    
    allJournals = journals;
    
    const journalSelect = document.getElementById('journalSelect');
    journalSelect.innerHTML = journals.map(journal => `
        <div class="journal-option">
            <input type="checkbox" id="journal-${journal}" value="${journal}">
            <label for="journal-${journal}">${journal}</label>
        </div>
    `).join('');
}

// Setup event listeners for search inputs
function setupEventListeners() {
    document.getElementById('keywords').addEventListener('input', debouncedSearch);
    document.getElementById('yearFrom').addEventListener('input', debouncedSearch);
    document.getElementById('yearTo').addEventListener('input', debouncedSearch);
    
    // When a journal checkbox is changed, load data if needed and perform search
    document.getElementById('journalSelect').addEventListener('change', async (event) => {
        if (event.target.type === 'checkbox') {
            await loadJournalDataIfNeeded(event.target.value, event.target.checked);
            performSearch();
        }
    });
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

    currentResults = filteredPapers;
    displayResults(currentResults);
}

// Debounced search function
function debouncedSearch() {
    if (searchDebounceTimer) {
        clearTimeout(searchDebounceTimer);
    }
    
    // Show searching indicator
    const resultsInfo = document.getElementById('resultsInfo');
    resultsInfo.textContent = '搜尋中...';
    resultsInfo.style.display = 'block';
    
    searchDebounceTimer = setTimeout(() => {
        performSearchWithCache();
    }, 300);
}

// Perform search with caching
function performSearchWithCache() {
    const keywords = document.getElementById('keywords').value.toLowerCase().trim();
    const yearFrom = parseInt(document.getElementById('yearFrom').value) || 0;
    const yearTo = parseInt(document.getElementById('yearTo').value) || 9999;
    
    // Extract selected journals
    const selectedJournals = [];
    document.querySelectorAll('#journalSelect input[type="checkbox"]:checked').forEach(checkbox => {
        selectedJournals.push(checkbox.value);
    });
    
    // Create cache key
    const cacheKey = `${keywords}-${yearFrom}-${yearTo}-${selectedJournals.sort().join(',')}`;
    
    // Check cache first
    if (searchCache.has(cacheKey)) {
        currentResults = searchCache.get(cacheKey);
        displayResults(currentResults);
        return;
    }
    
    // Perform actual search
    performSearch();
    
    // Cache results (limit cache size to prevent memory issues)
    if (searchCache.size > 100) {
        const firstKey = searchCache.keys().next().value;
        searchCache.delete(firstKey);
    }
    searchCache.set(cacheKey, currentResults);
}

// Display results in the UI with pagination
function displayResults(papers) {
    const resultsInfo = document.getElementById('resultsInfo');
    const results = document.getElementById('results');
    
    if (papers.length === 0) {
        resultsInfo.textContent = '沒有找到符合條件的論文';
        results.innerHTML = '<div class="no-results">沒有找到符合條件的論文</div>';
        return;
    }

    const totalCount = papers.length;
    const showingCount = Math.min(displayedCount, totalCount);
    
    resultsInfo.innerHTML = `
        找到 ${totalCount} 篇論文 ${totalCount > displayedCount ? `（顯示前 ${showingCount} 篇）` : ''}
        ${totalCount > displayedCount ? '<span class="load-more-hint">向下滾動載入更多</span>' : ''}
    `;
    resultsInfo.style.display = 'block';

    const papersToShow = papers.slice(0, displayedCount);
    
    results.innerHTML = `
        <div class="results-container">
            ${papersToShow.map(paper => renderPaperCard(paper)).join('')}
            ${totalCount > displayedCount ? '<div class="load-more-trigger" id="loadMoreTrigger"></div>' : ''}
        </div>
    `;
    
    // Setup intersection observer for infinite scroll
    if (totalCount > displayedCount) {
        setupInfiniteScroll();
    }
}

// Render individual paper card
function renderPaperCard(paper) {
    return `
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
                        <span class="meta-label">期刊：</span>
                        <span>${paper.journal}</span>
                    </div>
                    <div class="meta-item">
                        <span class="meta-label">年份：</span>
                        <span>${paper.year}</span>
                    </div>
                    <div class="meta-item">
                        <span class="meta-label">作者：</span>
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
    `;
}

// Setup infinite scroll using Intersection Observer
function setupInfiniteScroll() {
    const loadMoreTrigger = document.getElementById('loadMoreTrigger');
    if (!loadMoreTrigger) return;
    
    const observer = new IntersectionObserver((entries) => {
        if (entries[0].isIntersecting) {
            loadMoreResults();
        }
    }, {
        rootMargin: '100px'
    });
    
    observer.observe(loadMoreTrigger);
}

// Load more results
function loadMoreResults() {
    const currentlyDisplayed = document.querySelectorAll('.paper-card').length;
    const remainingResults = currentResults.length - currentlyDisplayed;
    
    if (remainingResults <= 0) return;
    
    const nextBatch = Math.min(25, remainingResults);
    const startIndex = currentlyDisplayed;
    const endIndex = startIndex + nextBatch;
    
    const resultsContainer = document.querySelector('.results-container');
    const loadMoreTrigger = document.getElementById('loadMoreTrigger');
    
    // Add loading indicator
    const loadingIndicator = document.createElement('div');
    loadingIndicator.className = 'loading-more';
    loadingIndicator.textContent = '載入更多...';
    resultsContainer.insertBefore(loadingIndicator, loadMoreTrigger);
    
    // Simulate slight delay for better UX
    setTimeout(() => {
        const newItems = currentResults.slice(startIndex, endIndex)
            .map(paper => renderPaperCard(paper))
            .join('');
        
        loadingIndicator.outerHTML = newItems;
        
        // Update results info
        const resultsInfo = document.getElementById('resultsInfo');
        const newDisplayedCount = Math.min(endIndex, currentResults.length);
        resultsInfo.innerHTML = `
            找到 ${currentResults.length} 篇論文 ${currentResults.length > newDisplayedCount ? `（顯示前 ${newDisplayedCount} 篇）` : ''}
            ${currentResults.length > newDisplayedCount ? '<span class="load-more-hint">向下滾動載入更多</span>' : ''}
        `;
        
        // Remove load more trigger if all results are shown
        if (newDisplayedCount >= currentResults.length && loadMoreTrigger) {
            loadMoreTrigger.remove();
        }
    }, 200);
}

// Switch abstract visibility
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

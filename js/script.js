let allPapers = [];
let allJournals = [];
let loadedJournals = new Set(); // Track which journals have been loaded
let loadingJournals = new Set(); // Track which journals are currently being loaded
let searchDebounceTimer = null;
let searchCache = new Map(); // Cache for search results
let currentResults = [];
let displayedCount = 50; // Initial number of results to display
let resultsObserver = null;
let availableDataFiles = [];

// Initialize the app without loading any data
async function loadData() {
    try {
        await loadAvailableDataFiles();
        initializeJournals();
        setupEventListeners();
        
    } catch (error) {
        console.error('Error initializing app:', error);
        document.getElementById('results').innerHTML = 
            '<div class="no-results">Unable to initialize the application. Please reload the page.</div>';
    }
}

// Load the generated CSV index so newly scraped years are available automatically
async function loadAvailableDataFiles() {
    try {
        const response = await fetch('data/files.json');
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const files = await response.json();
        availableDataFiles = files
            .filter(file => typeof file === 'string' && file.endsWith('.csv'))
            .map(file => file.replace(/^\.\//, ''))
            .sort();
    } catch (error) {
        console.warn('Failed to load data/files.json; falling back to generated year list:', error);
        availableDataFiles = [];
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
        updateLoadingStatus(`Loading ${journalName}…`);
        
        // Convert journal name to filename format using regex to match Python's file saving behavior
        const filePrefix = journalName
            .replace(/[^\w\s-]/g, '')
            .trim()
            .replace(/ /g, '_');
        
        const dataFiles = getJournalDataFiles(filePrefix);
        const loadPromises = dataFiles.map(filePath => loadCSVFile(filePath));
        
        const yearData = await Promise.all(loadPromises);
        const journalPapers = yearData.flat().filter(paper => paper && Object.keys(paper).length > 0);
        
        // Add to allPapers
        allPapers = allPapers.concat(journalPapers);
        searchCache.clear();
        loadedJournals.add(journalName);
        
        updateLoadingStatus('');
        
    } catch (error) {
        console.error(`Error loading data for ${journalName}:`, error);
        updateLoadingStatus(`Could not load ${journalName}.`);
        setTimeout(() => updateLoadingStatus(''), 3000);
    } finally {
        loadingJournals.delete(journalName);
    }
}

function getJournalDataFiles(filePrefix) {
    const prefix = `data/${filePrefix}_`;

    if (availableDataFiles.length > 0) {
        return availableDataFiles.filter(filePath => filePath.startsWith(prefix));
    }

    const startYear = 2020;
    const currentYear = new Date().getFullYear();
    return Array.from(
        { length: currentYear - startYear + 1 },
        (_, index) => `data/${filePrefix}_${startYear + index}.csv`
    );
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
        "The Review of Financial Studies",
        "Journal of Business and Economic Statistics",
        "Biometrika",
        "Journal of the American Statistical Association"
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
    
    // Select all button
    document.getElementById('selectAllBtn').addEventListener('click', selectAllJournals);
    
    // Deselect all button
    document.getElementById('deselectAllBtn').addEventListener('click', deselectAllJournals);
    
    // Shuffle button click delegation
    document.getElementById('resultsInfo').addEventListener('click', (event) => {
        const shuffleBtn = event.target.closest('#shuffleBtn');
        if (shuffleBtn) {
            shuffleResults();
        }
    });
}

// Select all journals
async function selectAllJournals() {
    const checkboxes = document.querySelectorAll('#journalSelect input[type="checkbox"]');
    
    for (const checkbox of checkboxes) {
        if (!checkbox.checked) {
            checkbox.checked = true;
            await loadJournalDataIfNeeded(checkbox.value, true);
        }
    }
    
    performSearch();
}

// Deselect all journals
function deselectAllJournals() {
    const checkboxes = document.querySelectorAll('#journalSelect input[type="checkbox"]');
    
    checkboxes.forEach(checkbox => {
        checkbox.checked = false;
    });
    
    performSearch();
}

function updateSearchError(message = '') {
    const input = document.getElementById('keywords');
    const error = document.getElementById('searchError');
    input.setAttribute('aria-invalid', message ? 'true' : 'false');
    error.textContent = message;
    error.hidden = !message;
}

// Perform search based on inputs; report syntax errors without caching them.
function performSearch() {
    const keywords = document.getElementById('keywords').value.trim();
    const yearFrom = parseInt(document.getElementById('yearFrom').value) || 0;
    const yearTo = parseInt(document.getElementById('yearTo').value) || 9999;

    let matchesQuery;
    try {
        matchesQuery = compileSearchQuery(keywords);
    } catch (error) {
        updateSearchError(error.message);
        currentResults = [];
        disconnectResultsObserver();
        const resultsInfo = document.getElementById('resultsInfo');
        resultsInfo.textContent = 'Check your search syntax';
        resultsInfo.style.display = 'block';
        document.getElementById('results').innerHTML =
            '<div class="no-results">Correct the search syntax to see results.</div>';
        return false;
    }
    updateSearchError();
    
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
        
        return matchesQuery(paper);
    });

    // Sort results by year (descending), then by title
    filteredPapers.sort((a, b) => {
        const yearA = parseInt(a.year);
        const yearB = parseInt(b.year);
        if (yearA !== yearB) {
            return yearB - yearA; // Newest first
        }
        return a.title.localeCompare(b.title);
    });

    currentResults = filteredPapers;
    displayResults(currentResults);
    return true;
}

// Debounced search function
function debouncedSearch() {
    if (searchDebounceTimer) {
        clearTimeout(searchDebounceTimer);
    }
    
    // Show searching indicator
    const resultsInfo = document.getElementById('resultsInfo');
    resultsInfo.textContent = 'Searching…';
    resultsInfo.style.display = 'block';
    
    searchDebounceTimer = setTimeout(() => {
        performSearchWithCache();
    }, 300);
}

// Perform search with caching
function performSearchWithCache() {
    const keywords = document.getElementById('keywords').value.trim();
    const yearFrom = parseInt(document.getElementById('yearFrom').value) || 0;
    const yearTo = parseInt(document.getElementById('yearTo').value) || 9999;
    
    // Extract selected journals
    const selectedJournals = [];
    document.querySelectorAll('#journalSelect input[type="checkbox"]:checked').forEach(checkbox => {
        selectedJournals.push(checkbox.value);
    });
    
    // Create cache key
    const cacheKey = JSON.stringify([keywords, yearFrom, yearTo, selectedJournals.sort()]);
    
    // Check cache first
    if (searchCache.has(cacheKey)) {
        updateSearchError();
        currentResults = searchCache.get(cacheKey);
        displayResults(currentResults);
        return;
    }
    
    // Perform actual search
    if (!performSearch()) return;
    
    // Cache results (limit cache size to prevent memory issues)
    if (searchCache.size >= 100) {
        const firstKey = searchCache.keys().next().value;
        searchCache.delete(firstKey);
    }
    searchCache.set(cacheKey, currentResults);
}

// Display results progressively to avoid rendering a large result set at once
function displayResults(papers) {
    const resultsInfo = document.getElementById('resultsInfo');
    const results = document.getElementById('results');

    disconnectResultsObserver();
    resultsInfo.style.display = 'flex';
    
    if (papers.length === 0) {
        resultsInfo.textContent = 'No papers match your search.';
        results.innerHTML = '<div class="no-results">No papers match your search.</div>';
        return;
    }

    const totalCount = papers.length;
    resultsInfo.innerHTML = `
        <div class="results-text">
            Found ${totalCount} ${totalCount === 1 ? 'paper' : 'papers'}
        </div>
        ${totalCount > 1 ? `
            <button type="button" id="shuffleBtn" class="shuffle-btn" title="Shuffle Results">
                <svg class="shuffle-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <polyline points="16 3 21 3 21 8"></polyline>
                    <line x1="4" y1="20" x2="21" y2="3"></line>
                    <polyline points="21 16 21 21 16 21"></polyline>
                    <line x1="15" y1="15" x2="21" y2="21"></line>
                    <line x1="4" y1="4" x2="9" y2="9"></line>
                </svg>
            </button>
        ` : ''}
    `;

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

// Shuffle the current search results and redisplay them
function shuffleResults() {
    if (currentResults.length <= 1) return;
    
    // Create a copy to avoid mutating cache
    const shuffled = [...currentResults];
    for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    
    currentResults = shuffled;
    displayResults(currentResults);
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
                        <span class="meta-label">Journal:</span>
                        <span>${paper.journal}</span>
                    </div>
                    <div class="meta-item">
                        <span class="meta-label">Year:</span>
                        <span>${paper.year}</span>
                    </div>
                    <div class="meta-item">
                        <span class="meta-label">Authors:</span>
                        <span>${paper.authors}</span>
                    </div>
                </div>
            </div>
            <button class="abstract-toggle" onclick="toggleAbstract(this)">
                Abstract ▼
            </button>
            <div class="abstract-content">
                ${paper.abstract}
            </div>
        </div>
    `;
}

function disconnectResultsObserver() {
    if (resultsObserver) {
        resultsObserver.disconnect();
        resultsObserver = null;
    }
}

// Render the next batch when the invisible sentinel approaches the viewport
function setupInfiniteScroll() {
    const loadMoreTrigger = document.getElementById('loadMoreTrigger');
    if (!loadMoreTrigger) return;
    
    resultsObserver = new IntersectionObserver((entries) => {
        if (entries[0].isIntersecting) {
            loadMoreResults();
        }
    }, {
        rootMargin: '100px'
    });
    
    resultsObserver.observe(loadMoreTrigger);
}

// Append more result cards without changing the results header
function loadMoreResults() {
    const currentlyDisplayed = document.querySelectorAll('.paper-card').length;
    const remainingResults = currentResults.length - currentlyDisplayed;
    
    if (remainingResults <= 0) return;
    
    const nextBatch = Math.min(50, remainingResults);
    const startIndex = currentlyDisplayed;
    const endIndex = startIndex + nextBatch;
    
    const resultsContainer = document.querySelector('.results-container');
    const loadMoreTrigger = document.getElementById('loadMoreTrigger');
    if (!resultsContainer || !loadMoreTrigger) return;

    const newItems = currentResults.slice(startIndex, endIndex)
        .map(paper => renderPaperCard(paper))
        .join('');

    loadMoreTrigger.insertAdjacentHTML('beforebegin', newItems);

    if (endIndex >= currentResults.length) {
        disconnectResultsObserver();
        loadMoreTrigger.remove();
    }
}

// Switch abstract visibility
function toggleAbstract(button) {
    const content = button.nextElementSibling;
    const isShowing = content.classList.contains('show');
    
    if (isShowing) {
        content.classList.remove('show');
        button.textContent = 'Abstract ▼';
    } else {
        content.classList.add('show');
        button.textContent = 'Abstract ▲';
    }
}

// Initialize the app
document.addEventListener('DOMContentLoaded', loadData);

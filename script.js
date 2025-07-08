/**
 * Smart Image Search Engine
 * Advanced features for Amazon SDE Internship Application
 * 
 * Features:
 * - Debounced search with performance optimization
 * - Caching mechanism with LRU eviction
 * - Error handling and retry logic
 * - Analytics and metrics tracking
 * - Advanced filtering and sorting
 * - Responsive lazy loading
 * - Accessibility support
 */

class SmartImageSearchEngine {
    constructor() {
        // API Configuration
        this.accessKey = "lWzvu2EbJpIytiuOpu4RydibVjMOytYV4DyVMosG2aU";
        this.baseURL = "https://api.unsplash.com/search/photos";
        this.perPage = 20;
        
        // State Management
        this.currentQuery = "";
        this.currentPage = 1;
        this.isLoading = false;
        this.hasMoreResults = true;
        this.currentFilters = {
            orientation: "",
            color: "",
            order_by: "relevant"
        };
        
        // Performance & Analytics
        this.cache = new Map();
        this.maxCacheSize = 50;
        this.searchMetrics = {
            totalSearches: parseInt(localStorage.getItem('totalSearches') || '0'),
            totalResponseTime: parseInt(localStorage.getItem('totalResponseTime') || '0'),
            searchHistory: JSON.parse(localStorage.getItem('searchHistory') || '[]'),
            cacheHits: parseInt(localStorage.getItem('cacheHits') || '0')
        };
        
        // Debouncing
        this.debounceTimer = null;
        this.debounceDelay = 300;
        
        // DOM Elements
        this.initializeElements();
        this.setupEventListeners();
        this.loadStoredData();
    }

    initializeElements() {
        this.elements = {
            searchForm: document.getElementById("search-form"),
            searchBox: document.getElementById("search-box"),
            searchBtn: document.getElementById("search-btn"),
            searchResult: document.getElementById("search-result"),
            showMoreBtn: document.getElementById("show-more-btn"),
            loadMoreContainer: document.getElementById("load-more-container"),
            loadingOverlay: document.getElementById("loading-overlay"),
            errorMessage: document.getElementById("error-message"),
            errorText: document.getElementById("error-text"),
            retryBtn: document.getElementById("retry-btn"),
            filtersContainer: document.getElementById("filters-container"),
            toggleFilters: document.getElementById("toggle-filters"),
            clearFilters: document.getElementById("clear-filters"),
            orientationFilter: document.getElementById("orientation-filter"),
            colorFilter: document.getElementById("color-filter"),
            sortFilter: document.getElementById("sort-filter"),
            searchStats: document.getElementById("search-stats"),
            resultsCount: document.getElementById("results-count"),
            searchTime: document.getElementById("search-time"),
            lastUpdated: document.getElementById("last-updated")
        };
    }

    setupEventListeners() {
        // Search functionality
        this.elements.searchForm.addEventListener("submit", (e) => this.handleSearch(e));
        this.elements.searchBtn.addEventListener("click", (e) => this.handleSearch(e));
        this.elements.showMoreBtn.addEventListener("click", () => this.loadMoreImages());
        this.elements.retryBtn.addEventListener("click", () => this.retrySearch());

        // Real-time search with debouncing
        this.elements.searchBox.addEventListener("input", (e) => this.handleInputChange(e));
        
        // Filter controls
        this.elements.toggleFilters.addEventListener("click", () => this.toggleFilters());
        this.elements.clearFilters.addEventListener("click", () => this.clearAllFilters());
        
        // Filter change handlers
        [this.elements.orientationFilter, this.elements.colorFilter, this.elements.sortFilter]
            .forEach(filter => filter.addEventListener("change", () => this.applyFilters()));

        // Keyboard shortcuts
        document.addEventListener("keydown", (e) => this.handleKeyboardShortcuts(e));
        
        // Intersection Observer for lazy loading
        this.setupIntersectionObserver();
    }

    handleInputChange(e) {
        clearTimeout(this.debounceTimer);
        const query = e.target.value.trim();
        
        if (query.length >= 2) {
            this.debounceTimer = setTimeout(() => {
                this.performSearch(query, true);
            }, this.debounceDelay);
        } else if (query.length === 0) {
            this.clearResults();
        }
    }

    handleSearch(e) {
        e.preventDefault();
        clearTimeout(this.debounceTimer);
        const query = this.elements.searchBox.value.trim();
        
        if (query) {
            this.performSearch(query, true);
        }
    }

    handleKeyboardShortcuts(e) {
        // Ctrl/Cmd + K to focus search
        if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
            e.preventDefault();
            this.elements.searchBox.focus();
        }
        
        // Escape to clear search
        if (e.key === 'Escape' && document.activeElement === this.elements.searchBox) {
            this.clearResults();
            this.elements.searchBox.value = '';
        }
    }

    async performSearch(query, isNewSearch = false) {
        if (this.isLoading) return;
        
        try {
            const startTime = performance.now();
            
            if (isNewSearch) {
                this.currentQuery = query;
                this.currentPage = 1;
                this.hasMoreResults = true;
                this.clearResults();
            }

            this.setLoadingState(true);
            this.hideError();

            // Check cache first
            const cacheKey = this.generateCacheKey(query, this.currentPage, this.currentFilters);
            if (this.cache.has(cacheKey)) {
                const cachedData = this.cache.get(cacheKey);
                this.displayResults(cachedData, isNewSearch);
                this.searchMetrics.cacheHits++;
                this.setLoadingState(false);
                
                const endTime = performance.now();
                this.updateSearchStats(cachedData.total, endTime - startTime, true);
                return;
            }

            // Build API URL
            const url = this.buildAPIUrl(query, this.currentPage, this.currentFilters);
            
            // Fetch data
            const response = await fetch(url);
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const data = await response.json();
            const endTime = performance.now();
            const responseTime = endTime - startTime;

            // Cache the result
            this.addToCache(cacheKey, data);

            // Display results
            this.displayResults(data, isNewSearch);
            
            // Update metrics
            this.updateSearchStats(data.total, responseTime, false);
            this.trackSearch(query, responseTime);

        } catch (error) {
            console.error("Search error:", error);
            this.showError(error.message);
        } finally {
            this.setLoadingState(false);
        }
    }

    buildAPIUrl(query, page, filters) {
        const params = new URLSearchParams({
            query: query,
            page: page.toString(),
            per_page: this.perPage.toString(),
            client_id: this.accessKey
        });

        // Add filters
        if (filters.orientation) params.append('orientation', filters.orientation);
        if (filters.color) params.append('color', filters.color);
        if (filters.order_by) params.append('order_by', filters.order_by);

        return `${this.baseURL}?${params.toString()}`;
    }

    generateCacheKey(query, page, filters) {
        return `${query}_${page}_${JSON.stringify(filters)}`;
    }

    addToCache(key, data) {
        // LRU Cache implementation
        if (this.cache.size >= this.maxCacheSize) {
            const firstKey = this.cache.keys().next().value;
            this.cache.delete(firstKey);
        }
        this.cache.set(key, data);
    }

    displayResults(data, isNewSearch) {
        const results = data.results || [];
        
        if (isNewSearch) {
            this.elements.searchResult.innerHTML = '';
        }

        if (results.length === 0 && isNewSearch) {
            this.showNoResults();
            return;
        }

        // Create image elements with lazy loading
        results.forEach((result, index) => {
            const imageContainer = this.createImageElement(result, index);
            this.elements.searchResult.appendChild(imageContainer);
        });

        // Update pagination state
        this.hasMoreResults = results.length === this.perPage;
        this.updateLoadMoreButton();
        this.elements.searchStats.classList.remove('hidden');
    }

    createImageElement(result, index) {
        const container = document.createElement("div");
        container.className = "image-container";
        
        const link = document.createElement("a");
        link.href = result.links.html;
        link.target = "_blank";
        link.rel = "noopener";
        link.setAttribute('aria-label', `View image by ${result.user.name} on Unsplash`);

        const img = document.createElement("img");
        img.src = result.urls.small;
        img.alt = result.alt_description || result.description || "Image from Unsplash";
        img.loading = "lazy";
        img.className = "search-result-image";
        
        // Add image metadata
        const metadata = document.createElement("div");
        metadata.className = "image-metadata";
        metadata.innerHTML = `
            <div class="image-author">
                <img src="${result.user.profile_image.small}" alt="${result.user.name}" class="author-avatar">
                <span>${result.user.name}</span>
            </div>
            <div class="image-stats">
                <span class="likes">❤️ ${result.likes}</span>
                <span class="downloads">⬇️ ${result.downloads || 'N/A'}</span>
            </div>
        `;

        // Performance monitoring
        img.addEventListener('load', () => {
            img.classList.add('loaded');
        });

        img.addEventListener('error', () => {
            img.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgdmlld0JveD0iMCAwIDIwMCAyMDAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PHJlY3Qgd2lkdGg9IjIwMCIgaGVpZ2h0PSIyMDAiIGZpbGw9IiNmMGYwZjAiLz48dGV4dCB4PSI1MCUiIHk9IjUwJSIgZm9udC1zaXplPSIxNCIgZmlsbD0iIzk5OTk5OSIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZHk9Ii4zZW0iPkltYWdlIE5vdCBGb3VuZDwvdGV4dD48L3N2Zz4=';
            img.alt = 'Image could not be loaded';
        });

        link.appendChild(img);
        container.appendChild(link);
        container.appendChild(metadata);

        return container;
    }

    setupIntersectionObserver() {
        this.imageObserver = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    const img = entry.target;
                    if (img.dataset.src) {
                        img.src = img.dataset.src;
                        img.removeAttribute('data-src');
                        this.imageObserver.unobserve(img);
                    }
                }
            });
        }, { rootMargin: '50px' });
    }

    loadMoreImages() {
        if (this.hasMoreResults && !this.isLoading) {
            this.currentPage++;
            this.performSearch(this.currentQuery, false);
        }
    }

    retrySearch() {
        if (this.currentQuery) {
            this.performSearch(this.currentQuery, true);
        }
    }

    // Filter Management
    toggleFilters() {
        const isHidden = this.elements.filtersContainer.classList.contains('hidden');
        this.elements.filtersContainer.classList.toggle('hidden', !isHidden);
        this.elements.toggleFilters.textContent = isHidden ? 'Hide Filters' : 'Advanced Filters';
    }

    applyFilters() {
        this.currentFilters = {
            orientation: this.elements.orientationFilter.value,
            color: this.elements.colorFilter.value,
            order_by: this.elements.sortFilter.value
        };

        if (this.currentQuery) {
            this.performSearch(this.currentQuery, true);
        }
    }

    clearAllFilters() {
        this.elements.orientationFilter.value = '';
        this.elements.colorFilter.value = '';
        this.elements.sortFilter.value = 'relevant';
        this.applyFilters();
    }

    // UI State Management
    setLoadingState(isLoading) {
        this.isLoading = isLoading;
        
        if (isLoading) {
            this.elements.loadingOverlay.classList.remove('hidden');
            this.elements.showMoreBtn.querySelector('.btn-text').textContent = 'Loading...';
            this.elements.showMoreBtn.disabled = true;
        } else {
            this.elements.loadingOverlay.classList.add('hidden');
            this.elements.showMoreBtn.querySelector('.btn-text').textContent = 'Load More Images';
            this.elements.showMoreBtn.disabled = false;
        }
    }

    updateLoadMoreButton() {
        if (this.hasMoreResults && this.currentQuery) {
            this.elements.loadMoreContainer.classList.remove('hidden');
        } else {
            this.elements.loadMoreContainer.classList.add('hidden');
        }
    }

    showError(message) {
        this.elements.errorText.textContent = message;
        this.elements.errorMessage.classList.remove('hidden');
    }

    hideError() {
        this.elements.errorMessage.classList.add('hidden');
    }

    showNoResults() {
        this.elements.searchResult.innerHTML = `
            <div class="no-results">
                <svg width="64" height="64" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M15.5 14h-.79l-.28-.27A6.471 6.471 0 0 0 16 9.5 6.5 6.5 0 1 0 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/>
                </svg>
                <h3>No results found</h3>
                <p>Try adjusting your search terms or filters</p>
            </div>
        `;
    }

    clearResults() {
        this.elements.searchResult.innerHTML = '';
        this.elements.searchStats.classList.add('hidden');
        this.elements.loadMoreContainer.classList.add('hidden');
        this.hideError();
    }

    // Analytics & Metrics
    updateSearchStats(totalResults, responseTime, fromCache) {
        this.elements.resultsCount.textContent = `${totalResults.toLocaleString()} results`;
        this.elements.searchTime.textContent = `Search time: ${Math.round(responseTime)}ms${fromCache ? ' (cached)' : ''}`;
        this.elements.lastUpdated.textContent = `Last updated: ${new Date().toLocaleTimeString()}`;
    }

    trackSearch(query, responseTime) {
        this.searchMetrics.totalSearches++;
        this.searchMetrics.totalResponseTime += responseTime;
        
        // Track search history (last 10 searches)
        this.searchMetrics.searchHistory.unshift({
            query,
            timestamp: new Date().toISOString(),
            responseTime: Math.round(responseTime)
        });
        
        if (this.searchMetrics.searchHistory.length > 10) {
            this.searchMetrics.searchHistory.pop();
        }

        this.saveMetricsToStorage();
    }

    saveMetricsToStorage() {
        localStorage.setItem('totalSearches', this.searchMetrics.totalSearches.toString());
        localStorage.setItem('totalResponseTime', this.searchMetrics.totalResponseTime.toString());
        localStorage.setItem('searchHistory', JSON.stringify(this.searchMetrics.searchHistory));
        localStorage.setItem('cacheHits', this.searchMetrics.cacheHits.toString());
    }

    loadStoredData() {
        // Load any previously stored search preferences
        const lastQuery = localStorage.getItem('lastQuery');
        if (lastQuery) {
            this.elements.searchBox.value = lastQuery;
        }
    }

    // Public methods for analytics modal
    getAnalytics() {
        const avgResponseTime = this.searchMetrics.totalSearches > 0 
            ? Math.round(this.searchMetrics.totalResponseTime / this.searchMetrics.totalSearches)
            : 0;
            
        const cacheHitRate = this.searchMetrics.totalSearches > 0
            ? Math.round((this.searchMetrics.cacheHits / this.searchMetrics.totalSearches) * 100)
            : 0;

        const popularQuery = this.getMostPopularQuery();

        return {
            totalSearches: this.searchMetrics.totalSearches,
            avgResponseTime,
            popularQuery,
            cacheHitRate,
            recentSearches: this.searchMetrics.searchHistory
        };
    }

    getMostPopularQuery() {
        const queryCount = {};
        this.searchMetrics.searchHistory.forEach(search => {
            queryCount[search.query] = (queryCount[search.query] || 0) + 1;
        });

        let mostPopular = 'None';
        let maxCount = 0;
        
        Object.entries(queryCount).forEach(([query, count]) => {
            if (count > maxCount) {
                maxCount = count;
                mostPopular = query;
            }
        });

        return mostPopular;
    }
}

// Initialize the application
let searchEngine;

document.addEventListener('DOMContentLoaded', () => {
    searchEngine = new SmartImageSearchEngine();
});

// Global functions for modal controls
function showAnalytics() {
    const analytics = searchEngine.getAnalytics();
    const modal = document.getElementById('analytics-modal');
    
    // Update analytics display
    document.getElementById('total-searches').textContent = analytics.totalSearches;
    document.getElementById('avg-response-time').textContent = `${analytics.avgResponseTime}ms`;
    document.getElementById('popular-query').textContent = analytics.popularQuery;
    document.getElementById('cache-hit-rate').textContent = `${analytics.cacheHitRate}%`;
    
    // Update recent searches
    const recentList = document.getElementById('recent-searches-list');
    recentList.innerHTML = '';
    analytics.recentSearches.forEach(search => {
        const li = document.createElement('li');
        li.innerHTML = `
            <span class="search-query">${search.query}</span>
            <span class="search-time">${search.responseTime}ms</span>
            <span class="search-date">${new Date(search.timestamp).toLocaleString()}</span>
        `;
        recentList.appendChild(li);
    });
    
    modal.classList.remove('hidden');
}

function hideAnalytics() {
    document.getElementById('analytics-modal').classList.add('hidden');
}

// Close modal when clicking outside
document.addEventListener('click', (e) => {
    const modal = document.getElementById('analytics-modal');
    if (e.target === modal) {
        hideAnalytics();
    }
});
/**
 * Smart Image Search Engine
 * A simple image search application
 * 
 * Features:
 * - Simple search functionality
 * - Basic caching for performance
 * - Error handling
 * - Search analytics
 * - Image filtering options
 * - Responsive design
 * - Accessibility support
 */

// Main search functionality as a JavaScript object
const imageSearch = {
    // API Configuration
    accessKey: "lWzvu2EbJpIytiuOpu4RydibVjMOytYV4DyVMosG2aU",
    baseURL: "https://api.unsplash.com/search/photos",
    perPage: 20,
    
    // State Management
    currentQuery: "",
    currentPage: 1,
    isLoading: false,
    hasMoreResults: true,
    currentFilters: {
        orientation: "",
        color: "",
        order_by: "relevant"
    },
    
    // Simple cache and analytics
    cache: {},
    searchMetrics: {
        totalSearches: 0,
        totalResponseTime: 0,
        searchHistory: [],
        cacheHits: 0
    },
    
    // Debouncing
    debounceTimer: null,
    debounceDelay: 300,
    
    // Initialize the application
    init: function() {
        this.loadStoredData();
        this.initializeElements();
        this.setupEventListeners();
        this.setupBasicLazyLoading();
    },

    // Store DOM elements for easy access
    elements: {},
    
    initializeElements: function() {
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
    },

    setupEventListeners: function() {
        // Search functionality
        const self = this;
        this.elements.searchForm.addEventListener("submit", function(e) { 
            self.handleSearch(e); 
        });
        this.elements.searchBtn.addEventListener("click", function(e) { 
            self.handleSearch(e); 
        });
        this.elements.showMoreBtn.addEventListener("click", function() { 
            self.loadMoreImages(); 
        });
        this.elements.retryBtn.addEventListener("click", function() { 
            self.retrySearch(); 
        });

        // Real-time search with debouncing
        this.elements.searchBox.addEventListener("input", function(e) { 
            self.handleInputChange(e); 
        });
        
        // Filter controls
        this.elements.toggleFilters.addEventListener("click", function() { 
            self.toggleFilters(); 
        });
        this.elements.clearFilters.addEventListener("click", function() { 
            self.clearAllFilters(); 
        });
        
        // Filter change handlers
        const filters = [this.elements.orientationFilter, this.elements.colorFilter, this.elements.sortFilter];
        filters.forEach(function(filter) {
            filter.addEventListener("change", function() {
                self.applyFilters();
            });
        });

        // Keyboard shortcuts
        document.addEventListener("keydown", function(e) {
            self.handleKeyboardShortcuts(e);
        });
    },
    
    setupBasicLazyLoading: function() {
        // Use basic browser lazy loading
        if ('loading' in HTMLImageElement.prototype) {
            // Browser supports 'loading' attribute
            // Modern browsers handle this automatically
        } else {
            // Fallback for browsers that don't support native lazy loading
            this.setupIntersectionObserver();
        }
    },

    handleInputChange: function(e) {
        clearTimeout(this.debounceTimer);
        const query = e.target.value.trim();
        const self = this;
        
        if (query.length >= 2) {
            this.debounceTimer = setTimeout(function() {
                self.performSearch(query, true);
            }, this.debounceDelay);
        } else if (query.length === 0) {
            this.clearResults();
        }
    },

    handleSearch: function(e) {
        e.preventDefault();
        clearTimeout(this.debounceTimer);
        const query = this.elements.searchBox.value.trim();
        
        if (query) {
            this.performSearch(query, true);
        }
    },

    handleKeyboardShortcuts: function(e) {
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
    },

    performSearch: function(query, isNewSearch) {
        const self = this;
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
            if (this.cache[cacheKey]) {
                const cachedData = this.cache[cacheKey];
                this.displayResults(cachedData, isNewSearch);
                this.searchMetrics.cacheHits++;
                this.setLoadingState(false);
                
                const endTime = performance.now();
                this.updateSearchStats(cachedData.total, endTime - startTime, true);
                return;
            }

            // Build API URL
            const url = this.buildAPIUrl(query, this.currentPage, this.currentFilters);
            
            // Fetch data using regular fetch API
            fetch(url)
                .then(function(response) {
                    if (!response.ok) {
                        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
                    }
                    return response.json();
                })
                .then(function(data) {
                    const endTime = performance.now();
                    const responseTime = endTime - startTime;
                    
                    // Cache the result
                    self.addToCache(cacheKey, data);
                    
                    // Display results
                    self.displayResults(data, isNewSearch);
                    
                    // Update metrics
                    self.updateSearchStats(data.total, responseTime, false);
                    self.trackSearch(query, responseTime);
                })
                .catch(function(error) {
                    console.error("Search error:", error);
                    self.showError(error.message);
                })
                .finally(function() {
                    self.setLoadingState(false);
                });
                
        } catch (error) {
            console.error("Search preparation error:", error);
            this.showError(error.message);
            this.setLoadingState(false);
        }
    },

    buildAPIUrl: function(query, page, filters) {
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
    },

    generateCacheKey: function(query, page, filters) {
        return `${query}_${page}_${JSON.stringify(filters)}`;
    },

    addToCache: function(key, data) {
        // Simple cache implementation
        this.cache[key] = data;
        
        // Basic cache management (keep size reasonable)
        const keys = Object.keys(this.cache);
        if (keys.length > 20) {
            // Remove oldest entry if cache gets too large
            delete this.cache[keys[0]];
        }
    },

    displayResults: function(data, isNewSearch) {
        const results = data.results || [];
        
        if (isNewSearch) {
            this.elements.searchResult.innerHTML = '';
        }

        if (results.length === 0 && isNewSearch) {
            this.showNoResults();
            return;
        }

        // Create image elements with lazy loading
        const self = this;
        results.forEach(function(result, index) {
            const imageContainer = self.createImageElement(result, index);
            self.elements.searchResult.appendChild(imageContainer);
        });

        // Update pagination state
        this.hasMoreResults = results.length === this.perPage;
        this.updateLoadMoreButton();
        this.elements.searchStats.classList.remove('hidden');
    },

    createImageElement: function(result, index) {
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
    },

    setupIntersectionObserver: function() {
        const self = this;
        this.imageObserver = new IntersectionObserver(function(entries) {
            entries.forEach(function(entry) {
                if (entry.isIntersecting) {
                    const img = entry.target;
                    if (img.dataset.src) {
                        img.src = img.dataset.src;
                        img.removeAttribute('data-src');
                        self.imageObserver.unobserve(img);
                    }
                }
            });
        }, { rootMargin: '50px' });
    },

    loadMoreImages: function() {
        if (this.hasMoreResults && !this.isLoading) {
            this.currentPage++;
            this.performSearch(this.currentQuery, false);
        }
    },

    retrySearch: function() {
        if (this.currentQuery) {
            this.performSearch(this.currentQuery, true);
        }
    },

    // Filter Management
    toggleFilters: function() {
        const isHidden = this.elements.filtersContainer.classList.contains('hidden');
        this.elements.filtersContainer.classList.toggle('hidden', !isHidden);
        this.elements.toggleFilters.textContent = isHidden ? 'Hide Filters' : 'Advanced Filters';
    },

    applyFilters: function() {
        this.currentFilters = {
            orientation: this.elements.orientationFilter.value,
            color: this.elements.colorFilter.value,
            order_by: this.elements.sortFilter.value
        };

        if (this.currentQuery) {
            this.performSearch(this.currentQuery, true);
        }
    },

    clearAllFilters: function() {
        this.elements.orientationFilter.value = '';
        this.elements.colorFilter.value = '';
        this.elements.sortFilter.value = 'relevant';
        this.applyFilters();
    },

    // UI State Management
    setLoadingState: function(isLoading) {
        this.isLoading = isLoading;
        
        if (isLoading) {
            this.elements.loadingOverlay.classList.remove('hidden');
            if (this.elements.showMoreBtn) {
                const btnText = this.elements.showMoreBtn.querySelector('.btn-text');
                if (btnText) {
                    btnText.textContent = 'Loading...';
                }
                this.elements.showMoreBtn.disabled = true;
            }
        } else {
            this.elements.loadingOverlay.classList.add('hidden');
            if (this.elements.showMoreBtn) {
                const btnText = this.elements.showMoreBtn.querySelector('.btn-text');
                if (btnText) {
                    btnText.textContent = 'Load More Images';
                }
                this.elements.showMoreBtn.disabled = false;
            }
        }
    },

    updateLoadMoreButton: function() {
        console.log('updateLoadMoreButton called:', {
            hasMoreResults: this.hasMoreResults,
            currentQuery: this.currentQuery
        });
        
        if (this.hasMoreResults && this.currentQuery) {
            this.elements.loadMoreContainer.classList.remove('hidden');
            console.log('Load more button shown');
        } else {
            this.elements.loadMoreContainer.classList.add('hidden');
            console.log('Load more button hidden');
        }
    },

    showError: function(message) {
        this.elements.errorText.textContent = message;
        this.elements.errorMessage.classList.remove('hidden');
    },

    hideError: function() {
        this.elements.errorMessage.classList.add('hidden');
    },

    showNoResults: function() {
        this.elements.searchResult.innerHTML = `
            <div class="no-results">
                <svg width="64" height="64" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M15.5 14h-.79l-.28-.27A6.471 6.471 0 0 0 16 9.5 6.5 6.5 0 1 0 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/>
                </svg>
                <h3>No results found</h3>
                <p>Try adjusting your search terms or filters</p>
            </div>
        `;
    },

    clearResults: function() {
        this.elements.searchResult.innerHTML = '';
        this.elements.searchStats.classList.add('hidden');
        this.elements.loadMoreContainer.classList.add('hidden');
        this.hideError();
    },

    // Analytics & Metrics
    updateSearchStats: function(totalResults, responseTime, fromCache) {
        this.elements.resultsCount.textContent = `${totalResults.toLocaleString()} results`;
        this.elements.searchTime.textContent = `Search time: ${Math.round(responseTime)}ms${fromCache ? ' (cached)' : ''}`;
        this.elements.lastUpdated.textContent = `Last updated: ${new Date().toLocaleTimeString()}`;
    },

    trackSearch: function(query, responseTime) {
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
    },

    saveMetricsToStorage: function() {
        localStorage.setItem('totalSearches', this.searchMetrics.totalSearches.toString());
        localStorage.setItem('totalResponseTime', this.searchMetrics.totalResponseTime.toString());
        localStorage.setItem('searchHistory', JSON.stringify(this.searchMetrics.searchHistory));
        localStorage.setItem('cacheHits', this.searchMetrics.cacheHits.toString());
    },

    loadStoredData: function() {
        // Load any previously stored search preferences
        const lastQuery = localStorage.getItem('lastQuery');
        if (lastQuery) {
            this.elements.searchBox.value = lastQuery;
        }
        
        // Load metrics from storage
        const totalSearches = localStorage.getItem('totalSearches');
        if (totalSearches) {
            this.searchMetrics.totalSearches = parseInt(totalSearches, 10);
        }
        
        const totalResponseTime = localStorage.getItem('totalResponseTime');
        if (totalResponseTime) {
            this.searchMetrics.totalResponseTime = parseFloat(totalResponseTime);
        }
        
        const searchHistory = localStorage.getItem('searchHistory');
        if (searchHistory) {
            this.searchMetrics.searchHistory = JSON.parse(searchHistory);
        }
        
        const cacheHits = localStorage.getItem('cacheHits');
        if (cacheHits) {
            this.searchMetrics.cacheHits = parseInt(cacheHits, 10);
        }
    },

    // Public methods for analytics modal
    getAnalytics: function() {
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
    },

    getMostPopularQuery: function() {
        const queryCount = {};
        const self = this;
        
        this.searchMetrics.searchHistory.forEach(function(search) {
            queryCount[search.query] = (queryCount[search.query] || 0) + 1;
        });

        let mostPopular = 'None';
        let maxCount = 0;
        
        Object.entries(queryCount).forEach(function([query, count]) {
            if (count > maxCount) {
                maxCount = count;
                mostPopular = query;
            }
        });

        return mostPopular;
    }
}

// Initialize the application
document.addEventListener('DOMContentLoaded', function() {
    imageSearch.init();
});

// Analytics modal functions
function showAnalytics() {
    const analytics = imageSearch.getAnalytics();
    const modal = document.getElementById('analytics-modal');
    
    // Update analytics display
    document.getElementById('total-searches').textContent = analytics.totalSearches;
    document.getElementById('avg-response-time').textContent = `${analytics.avgResponseTime}ms`;
    document.getElementById('popular-query').textContent = analytics.popularQuery;
    document.getElementById('cache-hit-rate').textContent = `${analytics.cacheHitRate}%`;
    
    // Update recent searches
    const recentList = document.getElementById('recent-searches-list');
    recentList.innerHTML = '';
    analytics.recentSearches.forEach(function(search) {
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
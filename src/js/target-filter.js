/**
 * target-filter.js
 * Target filtering functionality with preset support
 */

/* configurable parameters */
const INITIAL_RESULTS_BATCH = 5;
const LAZY_LOAD_BATCH_SIZE = 5;
const MAX_TOTAL_RESULTS = 1000;
const RANDOMIZE_RESULTS = true;

const TargetFilter = {
    // Lazy loading state
    allResults: [],
    displayedCount: 0,
    isLoading: false,

    // Filter definitions
    filters: {
        catalog: {
            type: 'multi-select',
            label: 'Catalog',
            values: new Set(),
            available: []
        },
        type: {
            type: 'multi-select',
            label: 'Type',
            values: new Set(),
            available: []
        },
        month: {
            type: 'single-select',
            label: 'Observable in Month',
            value: null,
            available: [
                { value: null, label: 'Any month' },
                { value: 1, label: 'January' },
                { value: 2, label: 'February' },
                { value: 3, label: 'March' },
                { value: 4, label: 'April' },
                { value: 5, label: 'May' },
                { value: 6, label: 'June' },
                { value: 7, label: 'July' },
                { value: 8, label: 'August' },
                { value: 9, label: 'September' },
                { value: 10, label: 'October' },
                { value: 11, label: 'November' },
                { value: 12, label: 'December' }
            ]
        },
        size: {
            type: 'numeric-min',
            label: 'Size (arc min)',
            value: null,
            placeholder: 'Min size...'
        },
        magnitude: {
            type: 'numeric-max',
            label: 'Magnitude',
            value: null,
            placeholder: 'Max magnitude...'
        }
    },

    /**
     * Initialize - scan database for available options
     */
    initialize() {
        console.log('Initializing TargetFilter...');

        const catalogSet = new Set();
        const typeSet = new Set();

        // Scan entire database
        DataManager.targetDatabase.forEach(target => {
            if (target.catalogue) catalogSet.add(target.catalogue);
            if (target.type) typeSet.add(target.type);
        });

        // Populate available options
        this.filters.catalog.available = Array.from(catalogSet).sort();
        this.filters.type.available = Array.from(typeSet).sort();

        console.log(`Found ${this.filters.catalog.available.length} catalogs, ${this.filters.type.available.length} types`);
    },

    /**
     * Apply current filters to targets
     */
    applyFilters(targets) {
        let filtered = targets;

        // Catalog filter
        if (this.filters.catalog.values.size > 0) {
            filtered = filtered.filter(t =>
                t.catalogue && this.filters.catalog.values.has(t.catalogue)
            );
        }

        // Type filter
        if (this.filters.type.values.size > 0) {
            filtered = filtered.filter(t =>
                t.type && this.filters.type.values.has(t.type)
            );
        }

        // Month filter
        if (this.filters.month.value !== null) {
            filtered = filtered.filter(t =>
                this.isVisibleInMonth(t, this.filters.month.value)
            );
        }

        // Size filter
        if (this.filters.size.value !== null) {
            filtered = filtered.filter(t =>
                t.size_max && t.size_max >= this.filters.size.value
            );
        }

        // Magnitude filter
        if (this.filters.magnitude.value !== null) {
            filtered = filtered.filter(t =>
                t.mag && t.mag <= this.filters.magnitude.value
            );
        }

        return filtered;
    },

    /**
     * Check if target is visible in given month (handles wrap-around)
     */
    isVisibleInMonth(target, month) {
        const selectedLocation = SettingsManager.getSelectedLocation();
        const visibilityStart = target.visibilityStart?.[selectedLocation];
        const visibilityEnd = target.visibilityEnd?.[selectedLocation];

        if (!visibilityStart || !visibilityEnd) {
            return false;
        }

        const start = visibilityStart;
        const end = visibilityEnd;

        if (end >= start) {
            return month >= start && month <= end;
        }

        // Wrap-around case
        const unwrappedEnd = end > 12 ? end - 12 : end;
        return month >= start || month <= unwrappedEnd;
    },

    /**
     * Natural sort comparator for target names (handles C9 vs C10 correctly)
     */
    naturalSort(a, b) {
        const ax = [], bx = [];

        a.object.replace(/(\d+)|(\D+)/g, (_, num, str) => {
            ax.push([num || Infinity, str || '']);
        });
        b.object.replace(/(\d+)|(\D+)/g, (_, num, str) => {
            bx.push([num || Infinity, str || '']);
        });

        while (ax.length && bx.length) {
            const an = ax.shift();
            const bn = bx.shift();
            const nn = (an[0] - bn[0]) || an[1].localeCompare(bn[1]);
            if (nn) return nn;
        }

        return ax.length - bx.length;
    },

    /**
     * Shuffle array using Fisher-Yates algorithm
     */
    shuffleArray(array) {
        const shuffled = [...array];
        for (let i = shuffled.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
        }
        return shuffled;
    },

    /**
     * Get current filter state (for presets)
     */
    getFilterState() {
        return {
            catalog: Array.from(this.filters.catalog.values),
            type: Array.from(this.filters.type.values),
            month: this.filters.month.value,
            size: this.filters.size.value,
            magnitude: this.filters.magnitude.value
        };
    },

    /**
     * Load filter state (from preset)
     */
    loadFilterState(state) {
        this.filters.catalog.values = new Set(state.catalog || []);
        this.filters.type.values = new Set(state.type || []);
        this.filters.month.value = state.month ?? null;
        this.filters.size.value = state.size ?? null;
        this.filters.magnitude.value = state.magnitude ?? null;
    },

    /**
     * Reset all filters
     */
    resetFilters() {
        this.filters.catalog.values.clear();
        this.filters.type.values.clear();
        this.filters.month.value = null;
        this.filters.size.value = null;
        this.filters.magnitude.value = null;
    },

    /**
     * Check if any filters are active
     */
    hasActiveFilters() {
        return this.filters.catalog.values.size > 0 ||
            this.filters.type.values.size > 0 ||
            this.filters.month.value !== null ||
            this.filters.size.value !== null ||
            this.filters.magnitude.value !== null;
    },

    /**
     * Initialize UI elements
     */
    initUI() {
        this.populateDropdowns();
        this.attachEventHandlers();
        this.restoreUIState();
    },

    /**
     * Restore UI state from filter values
     */
    restoreUIState() {
        // Restore catalog checkboxes
        this.filters.catalog.values.forEach(value => {
            const checkbox = document.getElementById(`catalog-${value}`);
            if (checkbox) checkbox.checked = true;
        });
        this.updateDropdownLabel('catalog');

        // Restore type checkboxes
        this.filters.type.values.forEach(value => {
            const checkbox = document.getElementById(`type-${value}`);
            if (checkbox) checkbox.checked = true;
        });
        this.updateDropdownLabel('type');

        // Restore month select
        const monthSelect = document.getElementById('target-filter-month');
        if (monthSelect && this.filters.month.value !== null) {
            monthSelect.value = this.filters.month.value;
        }

        // Restore size input
        const sizeInput = document.getElementById('target-filter-size');
        if (sizeInput && this.filters.size.value !== null) {
            sizeInput.value = this.filters.size.value;
        }

        // Restore magnitude input
        const magInput = document.getElementById('target-filter-magnitude');
        if (magInput && this.filters.magnitude.value !== null) {
            magInput.value = this.filters.magnitude.value;
        }

        // Auto-apply filters if any are active
        if (this.hasActiveFilters()) {
            const allTargets = DataManager.targetDatabase;
            const filtered = this.applyFilters(allTargets);
            this.displayFilterResults(filtered);
        }
    },

    /**
     * Populate dropdown menus with checkboxes
     */
    populateDropdowns() {
        // Populate catalog dropdown
        const catalogMenu = document.getElementById('target-filter-catalog-menu');
        if (catalogMenu) {
            catalogMenu.innerHTML = this.filters.catalog.available
                .map(catalog => `
                    <div class="target-filter-dropdown-item">
                        <input type="checkbox" id="catalog-${catalog}" value="${catalog}">
                        <label for="catalog-${catalog}">${catalog}</label>
                    </div>
                `).join('');
        }

        // Populate type dropdown
        const typeMenu = document.getElementById('target-filter-type-menu');
        if (typeMenu) {
            typeMenu.innerHTML = this.filters.type.available
                .map(type => {
                    const displayName = OBJECT_TYPES[type] || type;
                    return `
                        <div class="target-filter-dropdown-item">
                            <input type="checkbox" id="type-${type}" value="${type}">
                            <label for="type-${type}">${displayName}</label>
                        </div>
                    `;
                }).join('');
        }
    },

    /**
     * Attach event handlers for filter UI
     */
    attachEventHandlers() {
        // Catalog dropdown toggle
        const catalogTrigger = document.getElementById('target-filter-catalog-trigger');
        const catalogDropdown = catalogTrigger?.parentElement;
        if (catalogTrigger && catalogDropdown) {
            catalogTrigger.addEventListener('click', (e) => {
                e.stopPropagation();
                catalogDropdown.classList.toggle('open');
                // Close type dropdown
                document.querySelector('#target-filter-type-trigger')?.parentElement.classList.remove('open');
            });
        }

        // Type dropdown toggle
        const typeTrigger = document.getElementById('target-filter-type-trigger');
        const typeDropdown = typeTrigger?.parentElement;
        if (typeTrigger && typeDropdown) {
            typeTrigger.addEventListener('click', (e) => {
                e.stopPropagation();
                typeDropdown.classList.toggle('open');
                // Close catalog dropdown
                document.querySelector('#target-filter-catalog-trigger')?.parentElement.classList.remove('open');
            });
        }

        // Close dropdowns when clicking outside
        document.addEventListener('click', () => {
            document.querySelectorAll('.target-filter-dropdown').forEach(dd => {
                dd.classList.remove('open');
            });
        });

        // Catalog checkboxes
        const catalogMenu = document.getElementById('target-filter-catalog-menu');
        if (catalogMenu) {
            catalogMenu.addEventListener('click', (e) => {
                e.stopPropagation();
                if (e.target.type === 'checkbox') {
                    const value = e.target.value;
                    if (e.target.checked) {
                        this.filters.catalog.values.add(value);
                    } else {
                        this.filters.catalog.values.delete(value);
                    }
                    this.updateDropdownLabel('catalog');
                }
            });
        }

        // Type checkboxes
        const typeMenu = document.getElementById('target-filter-type-menu');
        if (typeMenu) {
            typeMenu.addEventListener('click', (e) => {
                e.stopPropagation();
                if (e.target.type === 'checkbox') {
                    const value = e.target.value;
                    if (e.target.checked) {
                        this.filters.type.values.add(value);
                    } else {
                        this.filters.type.values.delete(value);
                    }
                    this.updateDropdownLabel('type');
                }
            });
        }

        // Month select
        const monthSelect = document.getElementById('target-filter-month');
        if (monthSelect) {
            monthSelect.addEventListener('change', (e) => {
                this.filters.month.value = e.target.value ? parseInt(e.target.value) : null;
            });
        }

        // Size input
        const sizeInput = document.getElementById('target-filter-size');
        if (sizeInput) {
            sizeInput.addEventListener('input', (e) => {
                this.filters.size.value = e.target.value ? parseFloat(e.target.value) : null;
            });
        }

        // Magnitude input
        const magInput = document.getElementById('target-filter-magnitude');
        if (magInput) {
            magInput.addEventListener('input', (e) => {
                this.filters.magnitude.value = e.target.value ? parseFloat(e.target.value) : null;
            });
        }

        // Apply button
        const applyBtn = document.getElementById('target-filter-apply-btn');
        if (applyBtn) {
            applyBtn.addEventListener('click', () => {
                this.applyFiltersToSearch();
            });
        }

        // Reset button
        const resetBtn = document.getElementById('target-filter-reset-btn');
        if (resetBtn) {
            resetBtn.addEventListener('click', () => {
                this.resetFiltersUI();
            });
        }
    },

    /**
     * Clear available options (when database is cleared)
     */
    clearAvailableOptions() {
        this.filters.catalog.available = [];
        this.filters.type.available = [];
        this.resetFilters();
    },

    /**
     * Update dropdown label to show selection count
     */
    updateDropdownLabel(filterName) {
        const filter = this.filters[filterName];
        const label = document.getElementById(`target-filter-${filterName}-label`);
        if (!label) return;

        const count = filter.values.size;
        if (count === 0) {
            label.textContent = `All ${filterName}s`;
        } else if (count === 1) {
            const value = Array.from(filter.values)[0];
            // Use human-readable name for types
            const displayValue = filterName === 'type' ? (OBJECT_TYPES[value] || value) : value;
            label.textContent = displayValue;
        } else {
            label.textContent = `${count} ${filterName}s selected`;
        }
    },

    /**
     * Apply filters to entire database and display results
     */
    applyFiltersToSearch() {
        // Clear search text (filters work on entire DB, not search)
        const searchInput = document.getElementById('target-name');
        if (searchInput) {
            searchInput.value = '';
        }

        // Get initial target set based on filter scope
        const filterScope = document.querySelector('input[name="target-filter-scope"]:checked')?.value;
        let targets;

        if (filterScope === 'todo') {
            // Start with To Do List targets only
            targets = ToDoManager.getToDoTargets();
        } else {
            // Start with entire database
            targets = DataManager.targetDatabase;
        }

        // Apply filters to the selected target set
        const filtered = this.applyFilters(targets);

        // Display results
        this.displayFilterResults(filtered);
    },

    /**
     * Display filtered results with lazy loading
     */
    displayFilterResults(results) {
        const resultsDiv = document.getElementById('target-filter-results');
        const countDiv = document.getElementById('target-filter-results-count');

        if (!resultsDiv || !countDiv) return;

        // Update count
        if (results.length === 0) {
            countDiv.textContent = 'No targets match filters';
            resultsDiv.innerHTML = '<div style="padding: 1rem; text-align: center; color: var(--text-secondary);">No results found</div>';
            return;
        }

        // Process results (randomize or sort)
        const processed = RANDOMIZE_RESULTS ? 
              this.shuffleArray(results) : 
              results.sort((a, b) => this.naturalSort(a, b));

        // Store all results and reset state
        this.allResults = processed.slice(0, MAX_TOTAL_RESULTS);
        this.displayedCount = 0;
        resultsDiv.innerHTML = '';

        // Update count display
        const totalToShow = Math.min(this.allResults.length, MAX_TOTAL_RESULTS);
        countDiv.textContent = `Showing 0 of ${totalToShow} results`;

        // Display initial batch
        this.loadMoreResults();
        console.log('After loadMoreResults:', this.displayedCount, 'of', this.allResults.length);

        // Attach scroll listener for lazy loading
        this.attachScrollListener();
    },

    /**
     * Load and display next batch of results
     */
    loadMoreResults() {
        console.log('loadMoreResults called:', this.displayedCount, 'isLoading:', this.isLoading);
        if (this.isLoading) return;
        if (this.displayedCount >= this.allResults.length) return;

        this.isLoading = true;
        const resultsDiv = document.getElementById('target-filter-results');
        const countDiv = document.getElementById('target-filter-results-count');

        if (!resultsDiv) {
            this.isLoading = false;
            return;
        }

        // Calculate batch
        const batchSize = this.displayedCount === 0 ? INITIAL_RESULTS_BATCH : LAZY_LOAD_BATCH_SIZE;
        const start = this.displayedCount;
        const end = Math.min(start + batchSize, this.allResults.length);
        const batch = this.allResults.slice(start, end);

        // Render batch
        batch.forEach(target => {
            const resultDiv = document.createElement('div');
            resultDiv.className = 'target-result';

            const commonName = target.common ? target.common.split(',')[0].trim() : '';
            const constellation = target.constellation ? (CONSTELLATIONS[target.constellation] || target.constellation) : '';
            const commonNameDisplay = commonName || '';
            const typeDisplay = target.type ? (OBJECT_TYPES[target.type] || target.type) : 'Unknown type';

            resultDiv.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: baseline;">
                <div class="target-name">${target.object}</div>
                <div style="font-size: 0.85rem; color: var(--text-secondary);">${typeDisplay}</div>
            </div>
            <div style="font-size: 0.85rem; color: var(--text-secondary);">
                ${commonNameDisplay}${commonNameDisplay && constellation ? ', ' : ''}${constellation}
            </div>
        `;

            resultDiv.addEventListener('click', () => {
                VisibilityTargets.select(target);
            });

            resultsDiv.appendChild(resultDiv);
        });

        this.displayedCount = end;

        // Update count
        if (countDiv) {
            countDiv.textContent = `Showing ${this.displayedCount} of ${this.allResults.length} results`;
        }

        this.isLoading = false;
    },

    /**
     * Attach scroll listener for lazy loading
     */
    attachScrollListener() {
        const resultsDiv = document.getElementById('target-filter-results');
        if (!resultsDiv) return;

        // Remove old listener if exists
        if (this.scrollHandler) {
            resultsDiv.removeEventListener('scroll', this.scrollHandler);
        }

        // Create new handler
        this.scrollHandler = () => {
            const scrollThreshold = 100; // Load more when within 100px of bottom
            const scrollPosition = resultsDiv.scrollTop + resultsDiv.clientHeight;
            const scrollHeight = resultsDiv.scrollHeight;

            if (scrollPosition >= scrollHeight - scrollThreshold) {
                this.loadMoreResults();
            }
        };

        resultsDiv.addEventListener('scroll', this.scrollHandler);
    },

    /**
     * Reset all filters and UI
     */
    resetFiltersUI() {
        this.resetFilters();

        // Clear checkboxes
        document.querySelectorAll('.target-filter-dropdown-menu input[type="checkbox"]').forEach(cb => {
            cb.checked = false;
        });

        // Reset labels
        this.updateDropdownLabel('catalog');
        this.updateDropdownLabel('type');

        // Reset other inputs
        const monthSelect = document.getElementById('target-filter-month');
        if (monthSelect) monthSelect.value = '';

        const sizeInput = document.getElementById('target-filter-size');
        if (sizeInput) sizeInput.value = '';

        const magInput = document.getElementById('target-filter-magnitude');
        if (magInput) magInput.value = '';

        // Clear results display
        const resultsDiv = document.getElementById('target-filter-results');
        const countDiv = document.getElementById('target-filter-results-count');
        if (resultsDiv) resultsDiv.innerHTML = '';
        if (countDiv) countDiv.textContent = 'No filters applied';

        UIManager.showToast('Filters reset', 'success');
    }

};

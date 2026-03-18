/**
 * target-filter.js
 * Target filtering functionality with preset support
 */

/* configurable parameters */
const INITIAL_RESULTS_BATCH = 10;
const LAZY_LOAD_BATCH_SIZE = 10;
const MAX_TOTAL_RESULTS = 20000;
const RANDOMIZE_RESULTS = true;
const MAX_IMAGING_PROGRAM_TARGETS = 199;


const TargetFilter = {
    // Lazy loading state
    allResults: [],
    displayedCount: 0,
    isLoading: false,

    // Filter scope (all or todo)
    filterScope: 'all',

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
        } else {
            // No catalogs selected = show no results
            filtered = [];
        }

        // Type filter
        if (this.filters.type.values.size > 0) {
            filtered = filtered.filter(t =>
                t.type && this.filters.type.values.has(t.type)
            );
        } else {
            // No types selected = show no results
            filtered = [];
        }

        // Month filter
        if (this.filters.month.value !== null) {
            filtered = filtered.filter(t =>
                this.isVisibleInMonth(t, this.filters.month.value)
            );
        }

        // Size filter - targets with no size data are always included
        if (this.filters.size.value !== null) {
            filtered = filtered.filter(t =>
                !t.size_max || t.size_max >= this.filters.size.value
            );
        }

        // Magnitude filter - targets with no magnitude are always included
        if (this.filters.magnitude.value !== null) {
            filtered = filtered.filter(t =>
                !t.mag || t.mag <= this.filters.magnitude.value
            );
        }

        return this.deduplicateByOther(filtered);
    },

    /**
     * Deduplicate filter results by cross-reference (Other field).
     * When two targets refer to each other, keep only the one from the
     * preferred catalog. Unlisted catalogs are treated as lowest priority.
     */
    deduplicateByOther(targets) {
        const pref = APP_CONFIG.CATALOG_PREFERENCE;
        const rank = (t) => {
            const i = pref.indexOf(t.catalogue);
            return i === -1 ? pref.length : i;
        };

        // Build a set of object names in the result set
        const inResults = new Set(targets.map(t => t.object));

        // Build map of object → target for quick lookup
        const byObject = new Map(targets.map(t => [t.object, t]));

        // Track which objects to drop
        const drop = new Set();

        for (const target of targets) {
            if (drop.has(target.object)) continue;

            const others = (target.other || '').split(',').map(s => s.trim()).filter(Boolean);
            for (const other of others) {
                if (inResults.has(other) && !drop.has(other)) {
                    const rival = byObject.get(other);
                    if (rank(target) <= rank(rival)) {
                        drop.add(rival.object);
                    } else {
                        drop.add(target.object);
                        break;
                    }
                }
            }
        }

        return targets.filter(t => !drop.has(t.object));
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

        // Wrap-around case: end > 12 means it crosses into next year
        if (visibilityEnd > 12) {
            // e.g., start=11, end=15 means Nov, Dec, Jan(13), Feb(14), Mar(15)
            const unwrappedEnd = visibilityEnd - 12;
            return month >= visibilityStart || month <= unwrappedEnd;
        } else {
            // Normal case: no wrap-around
            return month >= visibilityStart && month <= visibilityEnd;
        }
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
     * Select all catalogs
     */
    selectAllCatalogs() {
        this.filters.catalog.available.forEach(catalog => {
            const checkbox = document.getElementById(`catalog-${catalog}`);
            if (checkbox) {
                checkbox.checked = true;
                this.filters.catalog.values.add(catalog);
            }
        });
        this.updateDropdownLabel('catalog');
        this.applyFiltersToSearch();

        // Close the dropdown
        const catalogDropdown = document.querySelector('#target-filter-catalog-trigger')?.parentElement;
        if (catalogDropdown) {
            catalogDropdown.classList.remove('open');
        }
    },

    /**
     * Deselect all catalogs
     */
    deselectAllCatalogs() {
        this.filters.catalog.available.forEach(catalog => {
            const checkbox = document.getElementById(`catalog-${catalog}`);
            if (checkbox) {
                checkbox.checked = false;
            }
        });
        this.filters.catalog.values.clear();
        this.updateDropdownLabel('catalog');
        this.applyFiltersToSearch();
    },

    /**
     * Select all types
     */
    selectAllTypes() {
        this.filters.type.available.forEach(type => {
            const checkbox = document.getElementById(`type-${type}`);
            if (checkbox) {
                checkbox.checked = true;
                this.filters.type.values.add(type);
            }
        });
        this.updateDropdownLabel('type');
        this.applyFiltersToSearch();

        // Close the dropdown
        const typeDropdown = document.querySelector('#target-filter-type-trigger')?.parentElement;
        if (typeDropdown) {
            typeDropdown.classList.remove('open');
        }
    },

    /**
     * Deselect all types
     */
    deselectAllTypes() {
        this.filters.type.available.forEach(type => {
            const checkbox = document.getElementById(`type-${type}`);
            if (checkbox) {
                checkbox.checked = false;
            }
        });
        this.filters.type.values.clear();
        this.updateDropdownLabel('type');
        this.applyFiltersToSearch();
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

        // Default to all catalogs selected if none are selected
        if (this.filters.catalog.values.size === 0) {
            this.selectAllCatalogs();
        }

        // Default to all types selected if none are selected
        if (this.filters.type.values.size === 0) {
            this.selectAllTypes();
        }

        // Set default values for size and magnitude if not already set
        if (this.filters.size.value === null) {
            this.filters.size.value = SettingsManager.getFilterMinSize();
            const sizeInput = document.getElementById('target-filter-size');
            if (sizeInput) sizeInput.value = this.filters.size.value;
        }
        if (this.filters.magnitude.value === null) {
            this.filters.magnitude.value = SettingsManager.getFilterMaxMag();
            const magInput = document.getElementById('target-filter-magnitude');
            if (magInput) magInput.value = this.filters.magnitude.value;
        }

        // Apply filters automatically on initialization
        this.applyFiltersToSearch();
    },

    /**
     * Restore UI state from filter values
     */
    restoreUIState() {
        // Restore filter scope radio button
        const filterRadio = document.querySelector(`input[name="target-filter-scope"][value="${this.filterScope}"]`);
        if (filterRadio) {
            filterRadio.checked = true;
        }

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
            const checkboxesHTML = this.filters.catalog.available
                  .map(catalog => `
                    <div class="target-filter-dropdown-item">
                        <input type="checkbox" id="catalog-${catalog}" value="${catalog}">
                        <label for="catalog-${catalog}">${catalog}</label>
                    </div>
                `).join('');

            catalogMenu.innerHTML = `
                <div style="display: flex; gap: 0.5rem; padding: 0.5rem; border-bottom: 1px solid var(--border-color);">
                    <button type="button" class="btn-sm" id="catalog-select-all">Select All</button>
                    <button type="button" class="btn-sm" id="catalog-select-none">Select None</button>
                </div>
                ${checkboxesHTML}
            `;
        }

        // Populate type dropdown
        const typeMenu = document.getElementById('target-filter-type-menu');
        if (typeMenu) {
            const checkboxesHTML = this.filters.type.available
                .map(type => {
                    const displayName = OBJECT_TYPES[type] || type;
                    return `
                        <div class="target-filter-dropdown-item">
                            <input type="checkbox" id="type-${type}" value="${type}">
                            <label for="type-${type}">${displayName}</label>
                        </div>
                    `;
                }).join('');

            typeMenu.innerHTML = `
                <div style="display: flex; gap: 0.5rem; padding: 0.5rem; border-bottom: 1px solid var(--border-color);">
                    <button type="button" class="btn-sm" id="type-select-all">Select All</button>
                    <button type="button" class="btn-sm" id="type-select-none">Select None</button>
                </div>
                ${checkboxesHTML}
            `;
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
        if (!this._documentClickHandler) {
            this._documentClickHandler = () => {
                document.querySelectorAll('.target-filter-dropdown').forEach(dd => {
                    dd.classList.remove('open');
                });
            };
            document.addEventListener('click', this._documentClickHandler);
        }

        // Catalog checkbox changes
        const catalogMenu = document.getElementById('target-filter-catalog-menu');
        if (catalogMenu) {
            // Stop propagation on all clicks to prevent dropdown from closing
            catalogMenu.addEventListener('click', (e) => {
                e.stopPropagation();
            });

            catalogMenu.addEventListener('change', (e) => {
                if (e.target.type === 'checkbox' && e.target.id.startsWith('catalog-')) {
                    const value = e.target.value;
                    if (e.target.checked) {
                        this.filters.catalog.values.add(value);
                    } else {
                        this.filters.catalog.values.delete(value);
                    }
                    this.updateDropdownLabel('catalog');
                    this.applyFiltersToSearch();
                }
            });

            // Select All/None buttons
            catalogMenu.addEventListener('click', (e) => {
                if (e.target.id === 'catalog-select-all') {
                    this.selectAllCatalogs();
                } else if (e.target.id === 'catalog-select-none') {
                    this.deselectAllCatalogs();
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
                    this.applyFiltersToSearch();
                }
            });

            // Select All/None buttons
            typeMenu.addEventListener('click', (e) => {
                if (e.target.id === 'type-select-all') {
                    this.selectAllTypes();
                } else if (e.target.id === 'type-select-none') {
                    this.deselectAllTypes();
                }
            });
        }

        // Filter scope radio buttons (All Targets vs To Do List)
        const filterRadios = document.querySelectorAll('input[name="target-filter-scope"]');
        filterRadios.forEach(radio => {
            radio.addEventListener('change', () => {
                this.filterScope = radio.value;
                this.applyFiltersToSearch();
            });
        });

        // Month select
        const monthSelect = document.getElementById('target-filter-month');
        if (monthSelect) {
            monthSelect.addEventListener('change', (e) => {
                this.filters.month.value = e.target.value ? parseInt(e.target.value) : null;
                this.applyFiltersToSearch();
            });
        }

        // Size input
        const sizeInput = document.getElementById('target-filter-size');
        if (sizeInput) {
            sizeInput.addEventListener('input', (e) => {
                this.filters.size.value = e.target.value ? parseFloat(e.target.value) : null;
                this.applyFiltersToSearch();
            });
        }

        // Magnitude input
        const magInput = document.getElementById('target-filter-magnitude');
        if (magInput) {
            magInput.addEventListener('input', (e) => {
                this.filters.magnitude.value = e.target.value ? parseFloat(e.target.value) : null;
                this.applyFiltersToSearch();
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
            label.textContent = `No selection`;
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

        this.loadMoreResults(); // Display initial batch
        this.attachScrollListener(); // for lazy loading
        this.updateImagingProgramButton(); // Update Create button

        // Update Create Imaging Program button
        this.updateImagingProgramButton();

        // Attach click handler (do this after updating button state)
        const createProgramBtn = document.getElementById('create-imaging-program-btn');
        if (createProgramBtn) {
            // Remove old handler if exists
            const newBtn = createProgramBtn.cloneNode(true);
            createProgramBtn.parentNode.replaceChild(newBtn, createProgramBtn);

            // Attach new handler
            newBtn.addEventListener('click', () => {
                this.openCreateProgramModal();
            });
        }

        // Attach Send to Optimizer button handler
        const sendToOptimizerBtn = document.getElementById('send-to-optimizer-btn');
        if (sendToOptimizerBtn) {
            const newBtn = sendToOptimizerBtn.cloneNode(true);
            sendToOptimizerBtn.parentNode.replaceChild(newBtn, sendToOptimizerBtn);

            newBtn.addEventListener('click', () => {
                OptimizerView.receiveFilterPool(this.allResults);
                UIManager.showToast(`${this.allResults.length} targets sent to Optimizer`, 'success');
            });
        }
    },

    /**
     * Load and display next batch of results
     */
    loadMoreResults() {
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
            <div class="target-result-row">
                <div class="target-name">${target.object}</div>
                <div class="target-result-secondary">${typeDisplay}</div>
            </div>
            <div class="target-result-row">
                <div class="target-result-secondary">${commonNameDisplay}</div>
                <div class="target-result-secondary">${constellation}</div>
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
     * Update the Create Imaging Program button visibility and state
     */
    updateImagingProgramButton() {
        const button = document.getElementById('create-imaging-program-btn');
        if (!button) return;

        const resultCount = this.allResults.length;

        if (resultCount === 0) {
            // No results - hide button
            button.style.display = 'none';
        } else if (resultCount > MAX_IMAGING_PROGRAM_TARGETS) {
            // Too many results - show enabled but with warning tooltip
            button.style.display = 'block';
            button.disabled = false;
            button.title = `Too many results (${resultCount}). Click to see details.`;
        } else {
            // Valid range - show enabled
            button.style.display = 'block';
            button.disabled = false;
            button.title = `Create imaging program with ${resultCount} target(s)`;
        }
    },

    /**
     * Open modal to create imaging program from filtered results
     */
    openCreateProgramModal() {
        const targetCount = this.allResults.length;

        // Check if results exceed maximum
        if (targetCount > MAX_IMAGING_PROGRAM_TARGETS) {
            UIManager.openModal('filter-results-too-many-template', 'Too Many Results', (action) => {
                if (action === 'ok') {
                    UIManager.closeModal();
                }
            });

            // Update count in warning modal
            const tooManyCount = document.getElementById('too-many-count');
            if (tooManyCount) {
                tooManyCount.textContent = targetCount;
            }

            return;
        }

        UIManager.openModal('create-program-from-filter-template', 'Create Imaging Program', async (action, modalBody) => {
            if (action === 'create') {
                await this.createImagingProgram(modalBody);
            } else if (action === 'cancel') {
                UIManager.closeModal();
            }
        });

        // Update target count in modal
        const countSpan = document.getElementById('filter-target-count');
        if (countSpan) {
            countSpan.textContent = targetCount;
        }
    },

    /**
     * Create imaging program from filtered results
     */
    async createImagingProgram(modalBody) {
        const programNameInput = document.getElementById('program-name-input');
        const programName = programNameInput?.value.trim();

        if (!programName) {
            UIManager.showToast('Please enter a program name', 'error');
            return;
        }

        // Create program with target designations (names only)
        const targetDesignations = this.allResults.map(target => target.object);

        const programData = {
            name: programName,
            status: 'Started',
            targetDesignations: targetDesignations
        };

        try {
            await ImagingLogManager.createProgram(programData);
            UIManager.closeModal();
            UIManager.showToast(`Program "${programName}" created with ${targetDesignations.length} targets`, 'success');

            // Switch to Imaging Log view
            window.location.hash = '#imaging-log';

            // Switch to Programs tab after view loads
            setTimeout(() => {
                if (typeof ImagingLogView !== 'undefined' && ImagingLogView.switchTab) {
                    ImagingLogView.switchTab('programs');
                }
            }, 100);
        } catch (error) {
            console.error('Error creating program:', error);
            UIManager.showToast('Error creating program: ' + error.message, 'error');
        }
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

        // Reset other inputs to defaults
        const monthSelect = document.getElementById('target-filter-month');
        if (monthSelect) monthSelect.value = '';

        const sizeInput = document.getElementById('target-filter-size');
        if (sizeInput) {
            sizeInput.value = SettingsManager.getFilterMinSize();
            this.filters.size.value = SettingsManager.getFilterMinSize();
        }

        const magInput = document.getElementById('target-filter-magnitude');
        if (magInput) {
            magInput.value = SettingsManager.getFilterMaxMag();
            this.filters.magnitude.value = SettingsManager.getFilterMaxMag();
        }

        // Clear results display
        const resultsDiv = document.getElementById('target-filter-results');
        const countDiv = document.getElementById('target-filter-results-count');
        if (resultsDiv) resultsDiv.innerHTML = '';
        if (countDiv) countDiv.textContent = 'No filters applied';

        // Default to all catalogs and types selected
        this.selectAllCatalogs();
        this.selectAllTypes();

        UIManager.showToast('Filters reset', 'success');
    },

/**
     * Cleanup UI listeners — call when view is destroyed
     */
    destroyUI() {
        if (this._documentClickHandler) {
            document.removeEventListener('click', this._documentClickHandler);
            this._documentClickHandler = null;
        }
    }
};

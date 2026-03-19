/**
 * visibility-targets.js
 * Target search and selection functionality
 */

const VisibilityTargets = {
    searchTimeout: null,
    currentTarget: null, // Track the selected target
    allResults: [],
    displayedCount: 0,
    isLoading: false,
    scrollHandler: null,

    /**
     * Initialize target functionality
     */
    init() {
        this.attachEventHandlers();
        this.attachFilterToggleHandler();
        this.updatePinnedDisplay();
    },

    /**
     * Attach event handlers
     */
    attachEventHandlers() {
        const targetInput = document.getElementById('target-name');
        if (targetInput) {
            targetInput.addEventListener('input', (e) => this.handleSearch(e.target.value));
            targetInput.addEventListener('focus', (e) => {
                e.target.select();
            });
        }

        const pinBtn = document.getElementById('pin-target-btn');
        if (pinBtn) {
            pinBtn.addEventListener('click', () => this.pinCurrent());
        }
    },

    /**
     * Attach filter toggle handler
     */
    attachFilterToggleHandler() {
        const filterRadios = document.querySelectorAll('input[name="target-filter-scope"]');
        filterRadios.forEach(radio => {
            radio.addEventListener('change', () => {
                // Re-run search if there's a query
                const targetInput = document.getElementById('target-name');
                if (targetInput && targetInput.value.length >= 2) {
                    this.search(targetInput.value);
                }
            });
        });
    },

    /**
     * Handle target search
     */
    handleSearch(query) {
        clearTimeout(this.searchTimeout);

        if (query.length < 2) {
            localStorage.setItem('lastSearchQuery', '');
            this.hideResults();
            this.clearFields();
            const countDiv = document.getElementById('target-search-results-count');
            if (countDiv) countDiv.textContent = '';
            return;
        }

        localStorage.setItem('lastSearchQuery', query);

        this.searchTimeout = setTimeout(() => {
            this.search(query);
        }, 300);
    },

    /**
     * Search for targets
     */
    search(query) {
        // Check filter scope first
        const filterScope = document.querySelector('input[name="target-filter-scope"]:checked')?.value;

        let results;
        if (filterScope === 'todo') {
            // Search within To Do List only
            const toDoTargets = ToDoManager.getToDoTargets();
            const lowerQuery = query.toLowerCase();
            results = toDoTargets.filter(target =>
                target.object.toLowerCase().includes(lowerQuery) ||
                    (target.common && target.common.toLowerCase().includes(lowerQuery))
            );
        } else {
            // Search entire database
            results = DataManager.searchTargets(query);
        }

        // Sort: exact matches first, then starts-with, then contains
        const lowerQuery = query.toLowerCase();
        results.sort((a, b) => {
            const aObj = a.object.toLowerCase();
            const bObj = b.object.toLowerCase();
            // Check exact matches
            if (aObj === lowerQuery && bObj !== lowerQuery) return -1;
            if (bObj === lowerQuery && aObj !== lowerQuery) return 1;
            // Check starts-with
            if (aObj.startsWith(lowerQuery) && !bObj.startsWith(lowerQuery)) return -1;
            if (bObj.startsWith(lowerQuery) && !aObj.startsWith(lowerQuery)) return 1;
            // Both match same way, maintain order
            return 0;
        });
        this.allResults = results;
        this.displayedCount = 0;
        this.displayResults();
    },


    /**
     * Display search results — initial render, then lazy load on scroll
     */
    displayResults() {
        const resultsDiv = document.getElementById('target-search-results');
        const countDiv = document.getElementById('target-search-results-count');
        if (!resultsDiv) return;

        resultsDiv.innerHTML = '';
        if (countDiv) countDiv.textContent = '';
        if (countDiv) resultsDiv.before(countDiv);

        if (this.allResults.length === 0) {
            resultsDiv.innerHTML = '<div style="padding: 0.75rem; color: var(--text-secondary);">No targets found</div>';
            resultsDiv.style.display = 'block';
            return;
        }

        resultsDiv.style.display = 'block';
        this.loadMoreResults();
        this.attachScrollListener();
    },

    /**
     * Load and display next batch of results
     */
    loadMoreResults() {
        if (this.isLoading) return;
        if (this.displayedCount >= this.allResults.length) return;

        this.isLoading = true;
        const resultsDiv = document.getElementById('target-search-results');
        const countDiv = document.getElementById('target-search-results-count');
        if (!resultsDiv) { this.isLoading = false; return; }

        const SEARCH_INITIAL_BATCH = 10;
        const SEARCH_LAZY_BATCH = 10;
        const batchSize = this.displayedCount === 0 ? SEARCH_INITIAL_BATCH : SEARCH_LAZY_BATCH;
        const start = this.displayedCount;
        const end = Math.min(start + batchSize, this.allResults.length);
        const batch = this.allResults.slice(start, end);

        batch.forEach(target => {
            const resultDiv = document.createElement('div');
            resultDiv.className = 'target-result';

            const typeDisplay = target.type ? (OBJECT_TYPES[target.type] || target.type) : 'Unknown type';
            const constellation = target.constellation ? (CONSTELLATIONS[target.constellation] || target.constellation) : '';

            const commonName = target.common ? target.common.split(',')[0].trim() : '';
            resultDiv.innerHTML = `
                <div class="target-result-row">
                    <div class="target-name">${target.object}</div>
                    <div class="target-result-secondary">${typeDisplay}</div>
                </div>
                <div class="target-result-row">
                    <div class="target-result-secondary">${commonName}</div>
                    <div class="target-result-secondary">${constellation}</div>
                </div>
            `;

            resultDiv.addEventListener('click', () => this.select(target));
            resultsDiv.appendChild(resultDiv);
        });

        this.displayedCount = end;

        if (countDiv) {
            countDiv.textContent = `Showing ${this.displayedCount} of ${this.allResults.length} results`;
        }

        this.isLoading = false;
    },

    /**
     * Attach scroll listener for lazy loading
     */
    attachScrollListener() {
        const resultsDiv = document.getElementById('target-search-results');
        if (!resultsDiv) return;

        if (this.scrollHandler) {
            resultsDiv.removeEventListener('scroll', this.scrollHandler);
        }

        this.scrollHandler = () => {
            const scrollPosition = resultsDiv.scrollTop + resultsDiv.clientHeight;
            const scrollHeight = resultsDiv.scrollHeight;
            if (scrollPosition >= scrollHeight - 20) {
                this.loadMoreResults();
            }
        };

        resultsDiv.addEventListener('scroll', this.scrollHandler);
    },

    /**
     * Hide search results
     */
    hideResults() {
        const resultsDiv = document.getElementById('target-search-results');
        if (resultsDiv) {
            resultsDiv.style.display = 'none';
        }
        const countDiv = document.getElementById('target-search-results-count');
        if (countDiv) countDiv.textContent = '';
    },

    /**
     * Select a target
     */
    select(target) {
        // Store the current target
        this.currentTarget = target;

        // Only set if DailyVisibilityCalculations exists
        if (typeof DailyVisibilityCalculations !== 'undefined') {
            DailyVisibilityCalculations.currentTarget = target;
        }
        if (typeof YearlyObservabilityCalculations !== 'undefined') {
            YearlyObservabilityCalculations.currentTarget = target;
        }

        // Only update DOM if elements exist (we're on Target Selection view)
        const targetNameInput = document.getElementById('target-name');
        if (targetNameInput) {
            targetNameInput.value = target.object;
        }

        // Show the target info display section
        const infoDisplay = document.getElementById('target-info-display');
        if (infoDisplay) {
            infoDisplay.style.display = 'block';
        }

        // Populate fields only if they exist
        const targetType = document.getElementById('target-type');
        const targetConstellation = document.getElementById('target-constellation');
        const targetCommonNameEl = document.getElementById('target-common-name');
        const targetOtherInfo = document.getElementById('target-other-info');

        if (targetType) {
            targetType.textContent = target.type ? (OBJECT_TYPES[target.type] || target.type) : '—';
        }
        if (targetConstellation) {
            targetConstellation.textContent = target.constellation ? (CONSTELLATIONS[target.constellation] || target.constellation) : '—';
        }
        if (targetCommonNameEl) {
            if (target.common) {
                const names = target.common.split(',').map(n => n.trim());
                targetCommonNameEl.innerHTML = names.map(name =>
                    `<a href="https://en.wikipedia.org/w/index.php?search=${encodeURIComponent(name).replace(/%20/g, '+')}&go=Go" target="_blank" class="wiki-link">${name}</a>`
                ).join(', ');
            } else {
                targetCommonNameEl.textContent = '—';
            }
        }
        if (targetOtherInfo) {
            targetOtherInfo.textContent = target.other || '—';
        }

        // Setup detail button only if it exists
        const detailBtn = document.getElementById('show-detail-btn');
        if (detailBtn) {
            // Remove old listeners by cloning
            const newDetailBtn = detailBtn.cloneNode(true);
            detailBtn.parentNode.replaceChild(newDetailBtn, detailBtn);

            // Add new click handler
            newDetailBtn.addEventListener('click', () => {
                UIManager.openObjectDetailModal(target);
            });
        }

        // Reset results state to just the selected target
        this.allResults = [target];
        this.displayedCount = 1;

        // Replace search results with single selected target
        const searchResults = document.getElementById('target-search-results');
        if (searchResults) {
            const typeDisplay = target.type ? (OBJECT_TYPES[target.type] || target.type) : 'Unknown type';
            const constellation = target.constellation ? (CONSTELLATIONS[target.constellation] || target.constellation) : '';
            const commonName = target.common ? target.common.split(',')[0].trim() : '';
            searchResults.innerHTML = `
                <div class="target-result selected">
                    <div class="target-result-row">
                        <div class="target-name">${target.object}</div>
                        <div class="target-result-secondary">${typeDisplay}</div>
                    </div>
                    <div class="target-result-row">
                        <div class="target-result-secondary">${commonName}</div>
                        <div class="target-result-secondary">${constellation}</div>
                    </div>
                </div>`;
            searchResults.style.display = 'block';
        }

        // Save last selected target (save full target object)
        localStorage.setItem('lastSelectedTarget', JSON.stringify(target));
        localStorage.setItem('lastSearchQuery', target.object);

        // Update count to reflect single selection
        const countDiv = document.getElementById('target-search-results-count');
        if (countDiv) countDiv.textContent = 'Showing 1 of 1 unique results';

        // Update sidebar current target display
        UIManager.updateSidebarCurrentTarget(target.object);
    },

    /**
     * Load last selected target
     */
    loadLastTarget() {
        const lastTarget = localStorage.getItem('lastSelectedTarget');
        if (lastTarget) {
            try {
                const target = JSON.parse(lastTarget);
                this.currentTarget = target;

                // Restore UI manually without clearing results panel
                const targetNameInput = document.getElementById('target-name');
                const infoDisplay = document.getElementById('target-info-display');
                const targetType = document.getElementById('target-type');
                const targetConstellation = document.getElementById('target-constellation');
                const targetCommonNameEl = document.getElementById('target-common-name');
                const targetOtherInfo = document.getElementById('target-other-info');

                // Only set if DailyVisibilityCalculations exists
                if (typeof DailyVisibilityCalculations !== 'undefined') {
                    DailyVisibilityCalculations.currentTarget = target;
                }
                if (typeof YearlyObservabilityCalculations !== 'undefined') {
                    YearlyObservabilityCalculations.currentTarget = target;
                }

                if (targetNameInput) targetNameInput.value = target.object;
                if (infoDisplay) infoDisplay.style.display = 'block';
                if (targetType) targetType.textContent = target.type ? (OBJECT_TYPES[target.type] || target.type) : '—';
                if (targetConstellation) targetConstellation.textContent = target.constellation ? (CONSTELLATIONS[target.constellation] || target.constellation) : '—';
                if (targetCommonNameEl) {
                    if (target.common) {
                        const names = target.common.split(',').map(n => n.trim());
                        targetCommonNameEl.innerHTML = names.map(name =>
                            `<a href="https://en.wikipedia.org/w/index.php?search=${encodeURIComponent(name).replace(/%20/g, '+')}&go=Go" target="_blank" class="wiki-link">${name}</a>`
                        ).join(', ');
                    } else {
                        targetCommonNameEl.textContent = '—';
                    }
                }
                if (targetOtherInfo) targetOtherInfo.textContent = target.other || '—';

                UIManager.updateSidebarCurrentTarget(target.object);

                // Restore search results panel
                const lastQuery = localStorage.getItem('lastSearchQuery');
                if (lastQuery && targetNameInput) {
                    targetNameInput.value = lastQuery;
                    if (infoDisplay) infoDisplay.style.display = 'none';
                    this.search(lastQuery);
                } else if (targetNameInput) {
                    targetNameInput.value = '';
                    const infoDisplay = document.getElementById('target-info-display');
                    if (infoDisplay) infoDisplay.style.display = 'none';
                }

            } catch (e) {
                console.error('Failed to load last target:', e);
            }
        }
    },

    clearFields() {
        this.currentTarget = null;

        const infoDisplay = document.getElementById('target-info-display');
        if (infoDisplay) {
            infoDisplay.style.display = 'none';
        }

        document.getElementById('target-search-results').innerHTML = '';
    },

    /**
     * Pin current target
     */
    async pinCurrent() {
        if (!this.currentTarget) {
            UIManager.showToast('Please select a target first', 'error');
            return;
        }

        const success = await DataManager.pinTarget({
            name: this.currentTarget.object,
            ra: this.currentTarget.ra,
            dec: this.currentTarget.dec,
            common: this.currentTarget.common || ''
        });

        if (success) {
            UIManager.showToast(`Target "${this.currentTarget.object}" pinned`, 'success');
            UIManager.markDataChanged();
            this.updatePinnedDisplay();
        } else {
            UIManager.showToast(`Target "${this.currentTarget.object}" is already pinned`, 'warning');
        }
    },

    /**
     * Unpin a target
     */
    async unpin(name) {
        const success = await DataManager.unpinTarget(name);
        if (success) {
            UIManager.showToast(`Target "${name}" unpinned`, 'success');
            UIManager.markDataChanged();
            this.updatePinnedDisplay();
        }
    },

    /**
     * Use a pinned target
     */
    usePinned(target) {
        // Try to get full details from database first
        const fullTarget = DataManager.getTarget(target.name);

        if (fullTarget) {
            // Use the full target data with all fields
            this.select(fullTarget);
        } else {
            // Fallback: search for it
            const searchResults = DataManager.searchTargets(target.name);
            const found = searchResults.find(t => t.object === target.name);

            if (found) {
                this.select(found);
            } else {
                // Last resort: use the limited pinned data
                document.getElementById('target-name').value = target.name;
                this.currentTarget = {
                    object: target.name,
                    ra: target.ra,
                    dec: target.dec,
                    common: target.common || ''
                };
                UIManager.showToast('Limited target data available', 'warning');
            }
        }
    },

    /**
     * Update pinned targets display
     */
    updatePinnedDisplay() {
        const displayDiv = document.getElementById('pinned-targets-display');
        if (!displayDiv) return;

        // Get fresh pinned targets data
        const pinned = DataManager.getPinnedTargets();

        if (pinned.length === 0) {
            displayDiv.innerHTML = '<p style="color: var(--text-secondary); text-align: center; padding: 1rem;">No pinned targets yet</p>';
            return;
        }

        displayDiv.innerHTML = '';
        pinned.forEach(target => {
            const badge = document.createElement('div');
            badge.style.cssText = `
                display: inline-flex;
                align-items: center;
                gap: 0.5rem;
                padding: 0.5rem 0.75rem;
                background: var(--card-bg);
                border: 1px solid var(--border-color);
                border-radius: 6px;
                margin: 0.25rem;
                cursor: pointer;
                transition: background 0.2s;
            `;

            // Build label with common name if available
            const label = target.common
                  ? `${target.name} (${target.common})`
                  : target.name;

            badge.innerHTML = `
                <span style="color: var(--text-color);">${label}</span>
                <button style="background: none; border: none; color: var(--error-color); cursor: pointer; padding: 0; font-size: 1rem; line-height: 1;">×</button>
            `;

            badge.addEventListener('mouseenter', () => {
                badge.style.background = 'var(--card-hover)';
            });

            badge.addEventListener('mouseleave', () => {
                badge.style.background = 'var(--card-bg)';
            });

            const nameSpan = badge.querySelector('span');
            nameSpan.addEventListener('click', () => this.usePinned(target));

            const removeBtn = badge.querySelector('button');
            removeBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.unpin(target.name);
            });

            displayDiv.appendChild(badge);
        });
    }
};

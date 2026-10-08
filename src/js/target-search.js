/**
 * visibility-targets.js
 * Target search and selection functionality
 */

const VisibilityTargets = {
    searchTimeout: null,
    searchActive: false,
    currentTarget: null, // Track the selected target

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
            this.restoreDefaultResults();
            this.searchActive = false;
            return;
        }

        if (!this.searchActive) {
            this.searchActive = true;
            if (typeof TargetFilter !== 'undefined') {
                TargetFilter.resetFiltersUISilent();
            }
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
        if (typeof TargetFilter !== 'undefined') {
            TargetFilter.displayFilterResults(results, true);
        }
    },


    /**
     * Restore the right-hand results card to its default filtered view
     * (used when the search box is cleared back below the minimum length).
     * Preserves the search input's text — applyFiltersToSearch() clears it
     * as a side effect, which is correct for direct filter interactions but
     * wrong here (this fires on every single first keystroke, since 1 char
     * is below the 2-char search minimum).
     */
    restoreDefaultResults() {
        if (typeof TargetFilter !== 'undefined') {
            const searchInput = document.getElementById('target-name');
            const savedValue = searchInput ? searchInput.value : null;

            TargetFilter.applyFiltersToSearch();

            if (searchInput && savedValue !== null) {
                searchInput.value = savedValue;
            }
        }
    },

    /**
     * Make a target the Current Target and open its detail modal
     */
    select(target) {
        this.changeCurrentTarget(target);
        UIManager.openObjectDetailModal(target);
    },

    /**
     * Make a target the Current Target and have the open view redraw for it
     */
    changeCurrentTarget(target) {
        this.setCurrentTarget(target);
        document.dispatchEvent(new CustomEvent('current-target-changed'));
    },

    /**
     * Make a target the Current Target for every view, without opening its details
     */
    setCurrentTarget(target) {
        this.currentTarget = target;

        // Only set if DailyVisibilityCalculations exists
        if (typeof DailyVisibilityCalculations !== 'undefined') {
            DailyVisibilityCalculations.currentTarget = target;
        }
        if (typeof YearlyObservabilityView !== 'undefined') {
            YearlyObservabilityView.currentTarget = target;
        }

        // Save last selected target (save full target object)
        localStorage.setItem('lastSelectedTarget', JSON.stringify(target));

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
                this.setCurrentTarget(JSON.parse(lastTarget));

                // Restore search box and re-run the last search if there was one
                const targetNameInput = document.getElementById('target-name');
                const lastQuery = localStorage.getItem('lastSearchQuery');
                if (lastQuery && targetNameInput) {
                    targetNameInput.value = lastQuery;
                    this.search(lastQuery);
                } else if (targetNameInput) {
                    targetNameInput.value = '';
                }

            } catch (e) {
                console.error('Failed to load last target:', e);
            }
        }
    },

    clearFields() {
        this.currentTarget = null;
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

        let targetToSelect;
        let limited = false;

        if (fullTarget) {
            targetToSelect = fullTarget;
        } else {
            // Fallback: search for it
            const searchResults = DataManager.searchTargets(target.name);
            const found = searchResults.find(t => t.object === target.name);

            if (found) {
                targetToSelect = found;
            } else {
                // Last resort: use the limited pinned data
                targetToSelect = {
                    object: target.name,
                    ra: target.ra,
                    dec: target.dec,
                    common: target.common || ''
                };
                limited = true;
            }
        }

        // Views that show the current target switch to it at once, for
        // comparing pinned targets; elsewhere it opens in the detail modal
        if (App.currentView?.followsCurrentTarget) {
            this.changeCurrentTarget(targetToSelect);
        } else {
            this.select(targetToSelect);
        }
        if (limited) {
            UIManager.showToast('Limited target data available', 'warning');
        }
    },

    /**
     * Update pinned targets display
     */
    updatePinnedDisplay() {
        const displayDiv = document.getElementById('sidebar-pinned-targets');
        if (!displayDiv) return;

        // Get fresh pinned targets data
        const pinned = DataManager.getPinnedTargets();

        if (pinned.length === 0) {
            displayDiv.innerHTML = '<p class="sidebar-pinned-empty">No pinned targets yet</p>';
            return;
        }

        displayDiv.innerHTML = '';
        pinned.forEach(target => {
            const chip = document.createElement('div');
            chip.className = 'sidebar-pinned-chip';

            // Build label with common name if available
            const label = target.common
                  ? `${target.name} (${target.common})`
                  : target.name;

            chip.innerHTML = `
                <span class="sidebar-pinned-chip-name">${label}</span>
                <button class="sidebar-pinned-chip-remove">×</button>
            `;

            const nameSpan = chip.querySelector('.sidebar-pinned-chip-name');
            nameSpan.addEventListener('click', () => this.usePinned(target));

            const removeBtn = chip.querySelector('.sidebar-pinned-chip-remove');
            removeBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.unpin(target.name);
            });

            displayDiv.appendChild(chip);
        });
    }
};

/**
 * visibility-targets.js
 * Target search and selection functionality
 */

const VisibilityTargets = {
    searchTimeout: null,
    pendingSelectTarget: null,
    pendingSelectLimited: false,
    searchActive: false,
    currentTarget: null, // Track the selected target
    _suppressNextOutsideClick: false,

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

        const closeBtn = document.getElementById('target-detail-close-btn');
        if (closeBtn) {
            closeBtn.addEventListener('click', () => this.hideDetailPanel());
        }

        const pinBtn = document.getElementById('target-detail-pin-btn');
        if (pinBtn) {
            pinBtn.addEventListener('click', () => this.pinCurrent());
        }

        const todoBtn = document.getElementById('target-detail-todo-btn');
        if (todoBtn) {
            todoBtn.addEventListener('click', () => this.toggleToDo());
        }

        this._outsideClickHandler = (e) => {
            if (this._suppressNextOutsideClick) {
                this._suppressNextOutsideClick = false;
                return;
            }
            const panel = document.getElementById('target-detail-panel');
            if (!panel || !panel.classList.contains('active')) return;
            if (panel.contains(e.target)) return;
            this.hideDetailPanel();
        };
        document.addEventListener('click', this._outsideClickHandler);

        this._escapeHandler = (e) => {
            if (e.key !== 'Escape') return;
            const panel = document.getElementById('target-detail-panel');
            if (panel && panel.classList.contains('active')) {
                this.hideDetailPanel();
            }
        };
        document.addEventListener('keydown', this._escapeHandler);
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
            TargetFilter.displayFilterResults(results);
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
     * Select a target
     */
    select(target) {
        this._suppressNextOutsideClick = true;

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

        this.showDetailPanel(target);

        // Save last selected target (save full target object)
        localStorage.setItem('lastSelectedTarget', JSON.stringify(target));
        localStorage.setItem('lastSearchQuery', target.object);

        // Update sidebar current target display
        UIManager.updateSidebarCurrentTarget(target.object);
    },

    /**
     * Show the floating detail panel for a target, full-cover over the Results card.
     * Reuses the same template and population logic as UIManager's object detail
     * modal, so the panel shows the full detail content, not a summary.
     */
    showDetailPanel(target) {
        const panel = document.getElementById('target-detail-panel');
        const body = document.getElementById('target-detail-body');
        if (!panel || !body) return;

        const nameEl = document.getElementById('target-detail-name');
        if (nameEl) nameEl.textContent = target.object;

        const imagingBadgeEl = document.getElementById('target-detail-imaging-badge');
        if (imagingBadgeEl) {
            const designators = (typeof TargetFilter !== 'undefined')
                  ? TargetFilter.getTargetDesignators(target)
                  : [target.object];

            let status = 'none';
            if (typeof ToDoView !== 'undefined') {
                for (const d of designators) {
                    const s = ToDoView.getImagingStatus(d);
                    if (s === 'complete') {
                        status = 'complete';
                        break;
                    }
                    if (s === 'active') {
                        status = 'active';
                    }
                }
            }

            const icon = (typeof ToDoView !== 'undefined' && ToDoView.IMAGING_STATUS_ICONS[status])
                  ? ToDoView.IMAGING_STATUS_ICONS[status]
                  : '';
            imagingBadgeEl.innerHTML = icon;
            imagingBadgeEl.title = `Imaging: ${status}`;
        }

        const template = document.getElementById('target-detail-template');
        if (template) {
            body.innerHTML = '';
            body.appendChild(template.content.cloneNode(true));
        }

        if (typeof UIManager !== 'undefined' && UIManager.populateObjectDetail) {
            const freshTarget = (typeof DataManager !== 'undefined')
                  ? (DataManager.getTargets().find(t => t.object === target.object) || target)
                  : target;
            UIManager.populateObjectDetail(freshTarget);
        }

        this.updateDetailToDoButton();

        panel.classList.add('active');

        // Grow the results card to fit the panel's full content instead of
        // internal-scrolling. scrollHeight reflects the true content height
        // even while the panel is still visually constrained to the card's
        // current size via inset:0.
        const card = document.getElementById('filter-results-card');
        if (card) {
            requestAnimationFrame(() => {
                card.style.minHeight = panel.scrollHeight + 'px';
            });
        }
    },

    /**
     * Hide the floating detail panel (shrink back to results)
     */
    hideDetailPanel() {
        const panel = document.getElementById('target-detail-panel');
        if (panel) panel.classList.remove('active');

        const card = document.getElementById('filter-results-card');
        if (card) card.style.minHeight = '';
    },

    /**
     * Reflect current To Do state on the detail panel's To Do button
     */
    updateDetailToDoButton() {
        const todoBtn = document.getElementById('target-detail-todo-btn');
        if (!todoBtn || !this.currentTarget) return;
        const inToDo = ToDoManager.isInToDoList(this.currentTarget.object);
        todoBtn.textContent = inToDo ? '☑ Remove from To Do' : '☐ Add to To Do';
    },

    /**
     * Toggle the currently selected target's To Do list membership
     */
    async toggleToDo() {
        if (!this.currentTarget) return;
        const targetId = this.currentTarget.object;

        if (ToDoManager.isInToDoList(targetId)) {
            await ToDoManager.removeFromToDoList(targetId);
            UIManager.showToast(`Removed "${targetId}" from To Do list`, 'success');
        } else {
            await ToDoManager.addToToDoList(targetId);
            UIManager.showToast(`Added "${targetId}" to To Do list`, 'success');
        }

        UIManager.markDataChanged();
        this.updateDetailToDoButton();

        // Refresh badges on whatever's currently shown in the results list
        if (typeof TargetFilter !== 'undefined') {
            TargetFilter.displayFilterResults(TargetFilter.allResults);
        }
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

                // Only set if DailyVisibilityCalculations exists
                if (typeof DailyVisibilityCalculations !== 'undefined') {
                    DailyVisibilityCalculations.currentTarget = target;
                }
                if (typeof YearlyObservabilityCalculations !== 'undefined') {
                    YearlyObservabilityCalculations.currentTarget = target;
                }

                UIManager.updateSidebarCurrentTarget(target.object);

                // Restore search box and re-run the last search if there was one;
                // the detail panel itself stays closed until the person picks a result
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
        this.hideDetailPanel();
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

        const currentView = window.location.hash.slice(1).split('?')[0];
        if (currentView === 'target-select') {
            this.select(targetToSelect);
            if (limited) {
                UIManager.showToast('Limited target data available', 'warning');
            }
        } else {
            // Navigate to Target Selection view; select() runs after render
            this.pendingSelectTarget = targetToSelect;
            this.pendingSelectLimited = limited;
            window.location.hash = '#target-select';
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

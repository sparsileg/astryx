/**
 * ui-manager.js
 * Manages common UI elements (modals, theme selector, toasts, etc.)
 */

const UIManager = {
    currentModal: null,

    /**
     * Initialize UI components
     */
    init() {
        this.setupThemeSelector();
        this.setupSystemMenu();
        this.setupModalCloseHandlers();
        this.initializeSidebarLocationDropdown();
    },

    /**
     * Setup theme selector dropdown
     */
    setupThemeSelector() {
        const themeSelect = document.getElementById('theme-select');
        if (themeSelect) {
            // Set initial value
            themeSelect.value = SettingsManager.getTheme();

            // Listen for changes
            themeSelect.addEventListener('change', async (e) => {
                await SettingsManager.updateTheme(e.target.value);

                // Wait for CSS to load before re-rendering
                const themeLink = document.getElementById('theme-css');
                if (themeLink) {
                    themeLink.addEventListener('load', () => {
                        // Re-render yearly observability if it's currently displayed
                        const yearlyObservabilityContainer = document.getElementById('yearly-observability-container');
                        if (yearlyObservabilityContainer && yearlyObservabilityContainer.style.display !== 'none' && window.lastYearlyObservabilityGraphData) {
                            VisibilityCalculations.renderYearlyObservabilityGraph(
                                window.lastYearlyObservabilityGraphData.altitudeData,
                                window.lastYearlyObservabilityGraphData.inputs
                            );
                        }
                    }, { once: true }); // Only listen once
                }
            });
        }
    },

    /**
     * Setup system menu
     */
    setupSystemMenu() {
        const systemBtn = document.getElementById('system-menu-btn');
        const systemMenu = document.getElementById('system-menu');

        if (systemBtn && systemMenu) {
            systemBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                const isActive = systemMenu.classList.contains('active');

                if (isActive) {
                    this.closeSystemMenu();
                } else {
                    this.openSystemMenu();
                }
            });

            // Close when clicking outside
            document.addEventListener('click', (e) => {
                if (!systemMenu.contains(e.target) && !systemBtn.contains(e.target)) {
                    this.closeSystemMenu();
                }
            });

            // Populate tutorials submenu dynamically
            const tutorialsSubmenu = document.getElementById('tutorials-submenu');
            if (tutorialsSubmenu && typeof TUTORIAL_REGISTRY !== 'undefined') {
                Object.values(TUTORIAL_REGISTRY.tutorials).forEach(tutorial => {
                    const item = document.createElement('div');
                    item.className = 'menu-item submenu-item';
                    item.dataset.action = `tutorial-${tutorial.id}`;
                    item.innerHTML = tutorial.title;
                    tutorialsSubmenu.appendChild(item);
                });
            }

            // Handle menu item clicks
            systemMenu.querySelectorAll('.menu-item').forEach(item => {
                item.addEventListener('click', (e) => {
                    const action = item.dataset.action;
                    // Handle cascading menus
                    if (action === 'admin-tools') {
                        e.stopPropagation();
                        this.toggleAdminToolsSubmenu();
                        return;
                    }
                    // Handle tutorials submenu toggle
                    if (action === 'tutorials') {
                        e.stopPropagation();
                        this.toggleTutorialsSubmenu();
                        return;
                    }
                    // Handle help submenu toggle
                    if (action === 'help') {
                        e.stopPropagation();
                        this.toggleHelpSubmenu();
                        return;
                    }
                    // Handle tutorial launches
                    if (action.startsWith('tutorial-')) {
                        const tutorialId = action.replace('tutorial-', '');
                        TutorialEngine.start(tutorialId);
                        this.closeSystemMenu();
                        return;
                    }
                    // Handle submenu items - don't close menu yet
                    if (item.classList.contains('submenu-item')) {
                        this.handleSystemAction(action);
                        this.closeSystemMenu();
                        return;
                    }
                    // Handle regular menu items
                    this.handleSystemAction(action);
                    this.closeSystemMenu();
                });
            });
        }
    },

    /**
     * Toggle Admin Tools submenu
     */
    toggleAdminToolsSubmenu() {
        const parent = document.querySelector('[data-action="admin-tools"]');
        const submenu = document.getElementById('admin-tools-submenu');
        if (parent && submenu) {
            parent.classList.toggle('expanded');
            submenu.classList.toggle('expanded');
        }
    },

    /**
     * Toggle Tutorials submenu
     */
    toggleTutorialsSubmenu() {
        const parent = document.querySelector('[data-action="tutorials"]');
        const submenu = document.getElementById('tutorials-submenu');
        if (parent && submenu) {
            parent.classList.toggle('expanded');
            submenu.classList.toggle('expanded');
        }
    },

    /**
     * Toggle Help submenu
     */
    toggleHelpSubmenu() {
        const parent = document.querySelector('[data-action="help"]');
        const submenu = document.getElementById('help-submenu');
        if (parent && submenu) {
            parent.classList.toggle('expanded');
            submenu.classList.toggle('expanded');
        }
    },

    /**
     * Open a help page in a new browser tab
     */
    openHelpPage(filename) {
        window.open(`help/${filename}`, '_blank');
    },

    /**
     * Open system menu
     */
    openSystemMenu() {
        const systemBtn = document.getElementById('system-menu-btn');
        const systemMenu = document.getElementById('system-menu');

        if (systemBtn && systemMenu) {
            systemBtn.classList.add('active');
            systemMenu.classList.add('active');

            // Position menu below button
            const rect = systemBtn.getBoundingClientRect();
            systemMenu.style.top = `${rect.bottom + 5}px`;
            systemMenu.style.left = `${rect.left}px`;
        }
    },

    /**
     * Close system menu
     */
    closeSystemMenu() {
        const systemBtn = document.getElementById('system-menu-btn');
        const systemMenu = document.getElementById('system-menu');
        if (systemBtn && systemMenu) {
            systemBtn.classList.remove('active');
            systemMenu.classList.remove('active');
            // Collapse all submenus
            systemMenu.querySelectorAll('.menu-submenu.expanded').forEach(el => el.classList.remove('expanded'));
            systemMenu.querySelectorAll('.menu-parent.expanded').forEach(el => el.classList.remove('expanded'));
        }
    },

    /**
     * Handle system menu actions
     */
    handleSystemAction(action) {
        switch (action) {
        case 'settings':
            this.openSettingsModal();
            break;
        case 'calculate-best-months':
            this.openBestMonthsModal();
            break;
        case 'manage-locations':
            this.openManageLocationsModal();
            break;
        case 'manage-equipment':
            this.openManageEquipmentModal();
            break;
        case 'import-targets':
            this.openImportTargetsModal();
            break;
        case 'new-backup':
            this.openNewBackupModal();
            break;
        case 'new-restore':
            this.openNewRestoreModal();
            break;
        case 'check-target-updates':
            this.checkForTargetUpdates();
            break;
        case 'clear-all-targets':
            this.clearAllTargets();
            break;
        case 'tutorials':
            // Submenu is populated dynamically — no action needed here
            break;
        case 'help-target-database':
            this.openHelpPage('target-database.html');
            break;
        case 'help-best-months':
            this.openHelpPage('best-months.html');
            break;
        case 'help-yearly-observability':
            this.openHelpPage('yearly-observability.html');
            break;
        case 'help-sequence-planner':
            this.openHelpPage('sequence-planner.html');
            break;
        case 'about':
            this.openAboutModal();
            break;
        }
    },

    /**
     * Setup modal close handlers
     */
    setupModalCloseHandlers() {
        const modal = document.getElementById('modal');
        if (modal) {
            // Close button
            const closeBtn = document.getElementById('modal-close');
            if (closeBtn) {
                closeBtn.addEventListener('click', () => this.closeModal());
            }
        }

        // Escape key closes modal
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.currentModal) {
                this.closeModal();
            }
        });
    },

    /**
     * Open a modal with content from template
     */
    openModal(templateId, title, onAction) {
        const modal = document.getElementById('modal');
        const modalTitle = document.getElementById('modal-title');
        const modalBody = document.getElementById('modal-body');
        const headerButtons = document.getElementById('modal-header-buttons');
        const modalContent = document.querySelector('.modal-content');
        if (!modal || !modalTitle || !modalBody) return;

        // Remove narrow-modal class from previous modal
        if (modalContent) {
            modalContent.classList.remove('narrow-modal');
        }

        // Clear any existing custom header buttons
        const existingTodoBtn = document.getElementById('modal-todo-btn');
        if (existingTodoBtn) {
            existingTodoBtn.remove();
        }
        const existingSaveBtn = document.getElementById('modal-save-btn');
        if (existingSaveBtn) {
            existingSaveBtn.remove();
        }

        // Set title
        modalTitle.textContent = title;

        // Add Save button for session, project, program, settings, backup, and restore modals
        if (headerButtons) {
            let saveBtn = null;

            if (templateId === 'manage-session-template') {
                saveBtn = document.createElement('button');
                saveBtn.id = 'modal-save-btn';
                saveBtn.className = 'btn-primary btn-sm';
                saveBtn.textContent = 'Save Session';
                saveBtn.addEventListener('click', () => {
                    if (onAction) {
                        onAction('save', modalBody);
                    }
                });
            } else if (templateId === 'manage-project-template') {
                saveBtn = document.createElement('button');
                saveBtn.id = 'modal-save-btn';
                saveBtn.className = 'btn-primary btn-sm';
                saveBtn.textContent = 'Save Project';
                saveBtn.addEventListener('click', () => {
                    if (onAction) {
                        onAction('save', modalBody);
                    }
                });
            } else if (templateId === 'import-program-template') {
                saveBtn = document.createElement('button');
                saveBtn.id = 'modal-save-btn';
                saveBtn.className = 'btn-primary btn-sm';
                saveBtn.textContent = 'Save Program';
                saveBtn.addEventListener('click', () => {
                    if (onAction) {
                        onAction('import', modalBody);
                    }
                });
            } else if (templateId === 'settings-template') {
                saveBtn = document.createElement('button');
                saveBtn.id = 'modal-save-btn';
                saveBtn.className = 'btn-primary btn-sm';
                saveBtn.textContent = 'Save Settings';
                saveBtn.addEventListener('click', () => {
                    if (onAction) {
                        onAction('save', modalBody);
                    }
                });
            } else if (templateId === 'manage-locations-template') {
                saveBtn = document.createElement('button');
                saveBtn.id = 'modal-save-btn';
                saveBtn.className = 'btn-primary btn-sm';
                saveBtn.textContent = 'Save Location';
                saveBtn.addEventListener('click', () => {
                    this.saveLocationFromForm();
                });
            } else if (templateId === 'manage-telescopes-template') {
                saveBtn = document.createElement('button');
                saveBtn.id = 'modal-save-btn';
                saveBtn.className = 'btn-primary btn-sm';
                saveBtn.textContent = 'Save Telescope';
                saveBtn.addEventListener('click', () => {
                    this.handleSaveTelescope();
                });
            } else if (templateId === 'manage-sensors-template') {
                saveBtn = document.createElement('button');
                saveBtn.id = 'modal-save-btn';
                saveBtn.className = 'btn-primary btn-sm';
                saveBtn.textContent = 'Save Sensor';
                saveBtn.addEventListener('click', () => {
                    this.handleSaveSensor();
                });
            } else if (templateId === 'manage-filters-template') {
                saveBtn = document.createElement('button');
                saveBtn.id = 'modal-save-btn';
                saveBtn.className = 'btn-primary btn-sm';
                saveBtn.textContent = 'Save Filter';
                saveBtn.addEventListener('click', () => {
                    this.handleSaveFilter();
                });
            } else if (templateId === 'backup-modal-template') {
                saveBtn = document.createElement('button');
                saveBtn.id = 'modal-save-btn';
                saveBtn.className = 'btn-primary btn-sm';
                saveBtn.textContent = 'Save Backup';
                saveBtn.addEventListener('click', () => {
                    if (onAction) {
                        onAction('save', modalBody);
                    }
                });
            } else if (templateId === 'restore-confirm-template') {
                saveBtn = document.createElement('button');
                saveBtn.id = 'modal-save-btn';
                saveBtn.className = 'btn-primary btn-sm';
                saveBtn.textContent = 'Restore';
                saveBtn.disabled = true;
                saveBtn.style.opacity = '0.5';
                saveBtn.addEventListener('click', () => {
                    if (onAction) {
                        onAction('restore', modalBody);
                    }
                });
            } else if (templateId === 'restore-picker-template') {
                saveBtn = document.createElement('button');
                saveBtn.id = 'modal-save-btn';
                saveBtn.className = 'btn-primary btn-sm';
                saveBtn.textContent = 'Continue';
                saveBtn.disabled = true;
                saveBtn.style.opacity = '0.5';
                saveBtn.addEventListener('click', () => {
                    if (onAction) {
                        onAction('continue', modalBody);
                    }
                });
            }

            if (saveBtn) {
                headerButtons.appendChild(saveBtn);
            }
        }

        // Load template content
        const template = document.getElementById(templateId);
        if (template) {
            const content = template.content.cloneNode(true);
            modalBody.innerHTML = '';
            modalBody.appendChild(content);

            // Setup action handlers for buttons in template
            if (onAction) {
                modalBody.querySelectorAll('[data-action]').forEach(btn => {
                    btn.addEventListener('click', () => {
                        const action = btn.dataset.action;
                        onAction(action, modalBody);
                    });
                });
            }
        }

        // Show modal
        modal.classList.add('active');
        this.currentModal = templateId;
    },

    /**
     * Close current modal
     */
    closeModal() {
        const modal = document.getElementById('modal');
        if (modal) {
            modal.classList.remove('active');
            this.currentModal = null;
        }

        // Hide Help button
        const helpBtn = document.getElementById('modal-help');
        if (helpBtn) {
            helpBtn.style.display = 'none';
            helpBtn.onclick = null;
        }

        // Hide subtitle
        const subtitle = document.getElementById('modal-subtitle');
        if (subtitle) {
            subtitle.style.display = 'none';
            subtitle.textContent = '';
        }
    },


    /**
     * Open settings modal
     */
    openSettingsModal() {
        this.openModal('settings-template', 'Settings', async (action, modalBody) => {
            if (action === 'save') {
                await this.saveSettingsFromModal(modalBody);
                this.closeModal();
            } else if (action === 'cancel') {
                this.closeModal();
            }
        });

        // Populate current settings
        this.populateSettingsModal();
    },

    /**
     * Open about modal
     */
    openAboutModal() {
        this.openModal('about-template', 'About', (action, modalBody) => {
            if (action === 'close') {
                this.closeModal();
            }
        });
    },

    /**
     * Open manage locations modal
     */
    openManageLocationsModal() {
        this.openModal('manage-locations-template', 'Manage Locations', (action, modalBody) => {
            if (action === 'close') {
                this.closeModal();
            }
        });

        this.populateManageLocationsModal();
    },

    /**
     * Populate manage locations modal
     */
    populateManageLocationsModal() {
        const locationsList = document.getElementById('location-list');
        const locations = DataManager.getLocations();

        if (locationsList) {
            locationsList.innerHTML = '';

            if (Object.keys(locations).length === 0) {
                locationsList.innerHTML = '<p style="padding: 1rem; color: var(--text-secondary); text-align: center;">No locations added yet</p>';
            } else {
                Object.entries(locations).forEach(([name, loc]) => {
                    const locationItem = document.createElement('div');
                    locationItem.className = 'location-list-item';
                    locationItem.style.cssText = 'padding: 0.75rem; border-bottom: 1px solid var(--border-color); display: flex; justify-content: space-between; align-items: center;';

                    locationItem.innerHTML = `
                        <div>
                            <strong>${name}</strong><br>
                            <small style="color: var(--text-secondary);">
                                ${loc.latitude.toFixed(4)}°, ${loc.longitude.toFixed(4)}° |
                                Elev: ${loc.elevation}m |
                                TZ: ${loc.timezone > 0 ? '+' : ''}${loc.timezone} |
                                Bortle: ${loc.bortle}
                            </small>
                        </div>
                        <div style="display: flex; gap: 0.5rem;">
                            <button class="btn-sm btn-secondary" data-location="${name}" data-action="edit">Edit</button>
                            <button class="btn-sm btn-danger" data-location="${name}" data-action="delete">Delete</button>
                        </div>
                    `;

                    locationsList.appendChild(locationItem);
                });
            }

            // Add event listeners for edit/delete buttons
            locationsList.querySelectorAll('[data-action="edit"]').forEach(btn => {
                btn.addEventListener('click', () => this.editLocation(btn.dataset.location));
            });

            locationsList.querySelectorAll('[data-action="delete"]').forEach(btn => {
                btn.addEventListener('click', () => this.deleteLocation(btn.dataset.location));
            });
        }
    },

    /**
     * Edit a location
     */
    editLocation(locationName) {
        const location = DataManager.getLocation(locationName);
        if (!location) return;

        // Populate form
        document.getElementById('manage-location-name').value = locationName;
        document.getElementById('manage-latitude').value = location.latitude;
        document.getElementById('manage-longitude').value = location.longitude;
        document.getElementById('manage-elevation').value = location.elevation;
        document.getElementById('manage-timezone').value = location.timezone;
        document.getElementById('manage-bortle').value = location.bortle;

        // Populate horizon data
        const horizonTextarea = document.getElementById('manage-horizon');
        if (location.horizon && location.horizon.length > 0) {
            const horizonText = location.horizon.map(point => `${point.azimuth} ${point.elevation}`).join('\n');
            horizonTextarea.value = horizonText;
        } else {
            // Show default 4-point horizon
            horizonTextarea.value = '0 0\n90 0\n180 0\n270 0';
        }

        // Update form title
        document.getElementById('location-form-title').textContent = `Edit Location: ${locationName}`;

        // Store original name for editing in header button
        const saveBtn = document.getElementById('modal-save-btn');
        if (saveBtn) {
            saveBtn.dataset.editingLocation = locationName;
        }
    },

    /**
     * Delete a location
     */
    async deleteLocation(locationName) {
        if (!confirm(`Are you sure you want to delete location "${locationName}"?`)) {
            return;
        }

        await DataManager.deleteLocation(locationName);
        this.showToast(`Location "${locationName}" deleted`, 'success');
        this.markDataChanged();
        this.populateManageLocationsModal();
        document.dispatchEvent(new CustomEvent('locations-updated'));
        setTimeout(() => {
            const mc = document.querySelector('.modal-content');
            if (mc) mc.scrollTop = 0;
        }, 150);
    },

    /**
     * Save location from form
     */
    async saveLocationFromForm() {
        const nameInput = document.getElementById('manage-location-name');
        const latInput = document.getElementById('manage-latitude');
        const lonInput = document.getElementById('manage-longitude');
        const elevInput = document.getElementById('manage-elevation');
        const tzInput = document.getElementById('manage-timezone');
        const bortleInput = document.getElementById('manage-bortle');
        const horizonInput = document.getElementById('manage-horizon');

        const name = nameInput.value.trim();
        const latitude = parseFloat(latInput.value);
        const longitude = parseFloat(lonInput.value);
        const elevation = parseInt(elevInput.value);
        const timezone = parseInt(tzInput.value);
        const bortle = parseInt(bortleInput.value);

        // Validation
        if (!name) {
            this.showToast('Please enter a location name', 'error');
            return;
        }
        if (isNaN(latitude) || latitude < -90 || latitude > 90) {
            this.showToast('Latitude must be between -90 and 90', 'error');
            return;
        }
        if (isNaN(longitude) || longitude < -180 || longitude > 180) {
            this.showToast('Longitude must be between -180 and 180', 'error');
            return;
        }
        if (isNaN(elevation) || elevation < 0) {
            this.showToast('Elevation must be a positive number', 'error');
            return;
        }
        if (isNaN(timezone)) {
            this.showToast('Please enter a valid timezone offset', 'error');
            return;
        }
        if (isNaN(bortle) || bortle < 1 || bortle > 9) {
            this.showToast('Bortle scale must be between 1 and 9', 'error');
            return;
        }

        // Parse and validate horizon data
        const horizonText = horizonInput.value.trim();
        let horizon;

        if (horizonText === '') {
            // Empty textarea - revert to default 4-point horizon
            horizon = [
                { azimuth: 0, elevation: 0 },
                { azimuth: 90, elevation: 0 },
                { azimuth: 180, elevation: 0 },
                { azimuth: 270, elevation: 0 }
            ];
        } else {
            // Parse horizon data
            const lines = horizonText.split('\n').filter(line => line.trim() !== '');

            if (lines.length < 4) {
                this.showToast('Horizon profile must have at least 4 points', 'error');
                return;
            }

            horizon = [];
            for (let i = 0; i < lines.length; i++) {
                const parts = lines[i].trim().split(/\s+/);

                if (parts.length !== 2) {
                    this.showToast(`Invalid horizon format at line ${i + 1}. Expected: azimuth elevation`, 'error');
                    return;
                }

                const azimuth = parseFloat(parts[0]);
                const elevation = parseFloat(parts[1]);

                if (isNaN(azimuth) || azimuth < 0 || azimuth > 360) {
                    this.showToast(`Invalid azimuth at line ${i + 1}. Must be 0-360 degrees`, 'error');
                    return;
                }

                if (isNaN(elevation) || elevation < -90 || elevation > 90) {
                    this.showToast(`Invalid elevation at line ${i + 1}. Must be -90 to 90 degrees`, 'error');
                    return;
                }

                horizon.push({ azimuth, elevation });
            }
        }

        // Check if editing
        const saveBtn = document.getElementById('modal-save-btn');
        const editingLocation = saveBtn?.dataset.editingLocation;

        // Save location
        await DataManager.saveLocation(name, {
            latitude,
            longitude,
            elevation,
            timezone,
            bortle,
            horizon
        });

        this.showToast(`Location "${name}" saved successfully`, 'success');
        this.markDataChanged();
        this.closeModal();
        // Notify other components to refresh their location lists
        document.dispatchEvent(new CustomEvent('locations-updated'));
    },

    /**
     * Clear location form
     */
    clearLocationForm() {
        document.getElementById('manage-location-name').value = '';
        document.getElementById('manage-latitude').value = '';
        document.getElementById('manage-longitude').value = '';
        document.getElementById('manage-elevation').value = '';
        document.getElementById('manage-timezone').value = '';
        document.getElementById('manage-bortle').value = '4';
        document.getElementById('location-form-title').textContent = 'Add New Location';

        const saveBtn = document.getElementById('save-location-btn');
        if (saveBtn.dataset.editingLocation) {
            delete saveBtn.dataset.editingLocation;
        }
    },

    /**
     * Open Manage Equipment modal
     */
    openManageEquipmentModal() {
        this.openModal('manage-equipment-template', 'Manage Equipment');

        setTimeout(() => {
            // Set up button handlers
            const telescopesBtn = document.getElementById('manage-equipment-telescopes-btn');
            const sensorsBtn = document.getElementById('manage-equipment-sensors-btn');
            const filtersBtn = document.getElementById('manage-equipment-filters-btn');

            if (telescopesBtn) {
                telescopesBtn.addEventListener('click', () => {
                    this.closeModal();
                    this.openManageTelescopesModal();
                });
            }

            if (sensorsBtn) {
                sensorsBtn.addEventListener('click', () => {
                    this.closeModal();
                    this.openManageSensorsModal();
                });
            }

            if (filtersBtn) {
                filtersBtn.addEventListener('click', () => {
                    this.closeModal();
                    this.openManageFiltersModal();
                });
            }
        }, 0);
    },

    /**
     * Open best months tools modal
     */
    openBestMonthsModal() {
        this.openModal('best-months-template', 'Calculate Best Observing Months', (action, modalBody) => {
            if (action === 'calculate') {
                this.startVisibilityCalculation(modalBody);
            } else if (action === 'cancel-calc') {
                BestMonths.cancelCalculation();
            }
        });

        this.populateBestMonthsModal();
    },

    /**
     * Populate best months tools modal
     */
    populateBestMonthsModal() {
        const locationSelect = document.getElementById('best-months-location-select');

        if (locationSelect) {
            const locations = DataManager.getLocations();
            locationSelect.innerHTML = '<option value="">Select a location...</option>';
            locationSelect.innerHTML += '<option value="__ALL__">All Locations</option>';

            Object.keys(locations).forEach(name => {
                const option = document.createElement('option');
                option.value = name;
                option.textContent = name;
                locationSelect.appendChild(option);
            });

            // Select current location if set
            const currentLocation = SettingsManager.getSelectedLocation();
            if (currentLocation) {
                locationSelect.value = currentLocation;
            }
        }
    },

    /**
     * Start best month calculation
     */
    async startVisibilityCalculation(modalBody) {
        const locationName = modalBody.querySelector('#best-months-location-select')?.value;
        const calculateAllLocations = (locationName === '__ALL__');

        if (!locationName || locationName === '') {
            this.showToast('Please select a location', 'error');
            return;
        }

        // Get parameters from system settings (used only for visibility window calculation)
        const minAltitude = SettingsManager.getMinAltitudeYearly() || 35;
        const minDarkHours = 2; // Default continuous dark hours for visibility window

        // Hide calculate button, show progress
        const calculateBtn = modalBody.querySelector('[data-action="calculate"]');
        const cancelBtn = modalBody.querySelector('[data-action="cancel-calc"]');
        const progressDiv = modalBody.querySelector('#best-months-progress');
        const progressBar = modalBody.querySelector('#best-months-progress-bar');
        const progressText = modalBody.querySelector('#best-months-progress-text');
        const resultsDiv = modalBody.querySelector('#best-months-results');

        if (calculateBtn) calculateBtn.style.display = 'none';
        if (cancelBtn) cancelBtn.style.display = 'inline-block';
        if (progressDiv) progressDiv.style.display = 'block';
        if (resultsDiv) resultsDiv.style.display = 'none';

        try {
            if (calculateAllLocations) {
                // Calculate for all locations
                await this.calculateForAllLocations(modalBody, minAltitude, minDarkHours);
            } else {
                // Calculate for single location
                await this.calculateForSingleLocation(modalBody, locationName, minAltitude, minDarkHours);
            }
        } catch (error) {
            console.error('Calculation error:', error);
            this.showToast('Calculation failed: ' + error.message, 'error');
            if (calculateBtn) calculateBtn.style.display = 'inline-block';
            if (cancelBtn) cancelBtn.style.display = 'none';
            if (progressDiv) progressDiv.style.display = 'none';
        }
    },

    /**
     * Calculate best months for single location
     */
    async calculateForSingleLocation(modalBody, locationName, minAltitude, minDarkHours) {
        const calculateBtn = modalBody.querySelector('[data-action="calculate"]');
        const cancelBtn = modalBody.querySelector('[data-action="cancel-calc"]');
        const progressDiv = modalBody.querySelector('#best-months-progress');
        const progressBar = modalBody.querySelector('#best-months-progress-bar');
        const progressText = modalBody.querySelector('#best-months-progress-text');
        const resultsDiv = modalBody.querySelector('#best-months-results');

        // Track timing for estimation
        const startTime = Date.now();
        let estimatedTimeText = '';

        // Progress callback
        const progressCallback = (processed, total, targetName) => {
            const percent = Math.round((processed / total) * 100);
            if (progressBar) progressBar.style.width = percent + '%';

            // Calculate time estimation after processing at least 10 targets
            if (processed >= 10) {
                const elapsedMs = Date.now() - startTime;
                const avgTimePerTarget = elapsedMs / processed;
                const remainingTargets = total - processed;
                const estimatedRemainingMs = avgTimePerTarget * remainingTargets;

                // Format estimated time
                const estimatedSeconds = Math.round(estimatedRemainingMs / 1000);
                if (estimatedSeconds < 60) {
                    estimatedTimeText = `Estimated time: ${estimatedSeconds}s`;
                } else {
                    const minutes = Math.floor(estimatedSeconds / 60);
                    const seconds = estimatedSeconds % 60;
                    estimatedTimeText = `Estimated time: ${minutes}m ${seconds}s`;
                }
            } else {
                estimatedTimeText = 'Calculating estimate...';
            }

            if (progressText) {
                progressText.innerHTML = `Processing ${processed}/${total}: ${targetName}<br><span style="font-size: 0.9em; color: var(--text-secondary);">${estimatedTimeText}</span>`;
            }
        };

        const result = await BestMonths.calculateBestMonths(
            locationName,
            minAltitude,
            minDarkHours,
            progressCallback
        );

        // Hide progress, show results
        if (progressDiv) progressDiv.style.display = 'none';
        if (cancelBtn) cancelBtn.style.display = 'none';
        if (calculateBtn) calculateBtn.style.display = 'inline-block';

        if (result.cancelled) {
            this.showToast('Calculation cancelled', 'info');
            if (resultsDiv) {
                resultsDiv.style.display = 'block';
                resultsDiv.innerHTML = '<p style="color: var(--text-secondary);">Calculation was cancelled.</p>';
            }
        } else {
            this.showToast('Calculation complete!', 'success');
            if (resultsDiv) {
                resultsDiv.style.display = 'block';
                resultsDiv.innerHTML = `
                    <h4>Calculation Summary</h4>
                    <p><strong>Total targets:</strong> ${result.totalTargets}</p>
                    <p><strong>Visible targets:</strong> ${result.visibleCount}</p>
                    <p><strong>Not meeting criteria:</strong> ${result.notVisibleCount}</p>
                    <p style="color: var(--text-secondary); margin-top: 1rem; font-size: 0.9rem; line-height: 1.5;">
                        <strong>Best month:</strong> Calculated using type-specific altitude thresholds (30° or 40°) and weighted scoring.<br>
                        <strong>Visibility window:</strong> Uses system settings (Min Altitude: ${minAltitude}°, Continuous Dark Hours: ${minDarkHours}h).
                    </p>
               `;
            }

            // Dispatch event to notify visibility view
            document.dispatchEvent(new CustomEvent('best-months-updated', {
                detail: { locationName, minAltitude }
            }));
        }
    },

    /**
     * Calculate best months for all locations
     */
    async calculateForAllLocations(modalBody, minAltitude, minDarkHours) {
        const calculateBtn = modalBody.querySelector('[data-action="calculate"]');
        const cancelBtn = modalBody.querySelector('[data-action="cancel-calc"]');
        const progressDiv = modalBody.querySelector('#best-months-progress');
        const progressBar = modalBody.querySelector('#best-months-progress-bar');
        const progressText = modalBody.querySelector('#best-months-progress-text');
        const resultsDiv = modalBody.querySelector('#best-months-results');

        const startTime = Date.now();

        // Progress callback for all-locations mode
        const progressCallback = (progress) => {
            if (progress.phase === 'location') {
                // Just started a new location
                if (progressText) {
                    progressText.innerHTML = `
                        <strong>Location ${progress.locationIndex} of ${progress.totalLocations}: ${progress.currentLocation}</strong><br>
                        <span style="font-size: 0.9em; color: var(--text-secondary);">Initializing...</span>
                    `;
                }
                if (progressBar) progressBar.style.width = '0%';
            } else if (progress.phase === 'target') {
                // Processing targets within current location
                const percent = Math.round((progress.processedTargets / progress.totalTargets) * 100);
                if (progressBar) progressBar.style.width = percent + '%';

                // Calculate time estimation
                let estimatedTimeText = '';
                if (progress.processedTargets >= 10) {
                    const elapsedMs = Date.now() - startTime;
                    const avgTimePerTarget = elapsedMs / progress.processedTargets;
                    const remainingTargets = (progress.totalTargets - progress.processedTargets) +
                          ((progress.totalLocations - progress.locationIndex) * progress.totalTargets);
                    const estimatedRemainingMs = avgTimePerTarget * remainingTargets;

                    const estimatedSeconds = Math.round(estimatedRemainingMs / 1000);
                    if (estimatedSeconds < 60) {
                        estimatedTimeText = `Est. total time: ${estimatedSeconds}s`;
                    } else {
                        const minutes = Math.floor(estimatedSeconds / 60);
                        const seconds = estimatedSeconds % 60;
                        estimatedTimeText = `Est. total time: ${minutes}m ${seconds}s`;
                    }
                }

                if (progressText) {
                    progressText.innerHTML = `
                        <strong>Location ${progress.locationIndex} of ${progress.totalLocations}: ${progress.currentLocation}</strong><br>
                        Processing ${progress.processedTargets}/${progress.totalTargets}: ${progress.currentTarget}<br>
                        <span style="font-size: 0.9em; color: var(--text-secondary);">${estimatedTimeText}</span>
                    `;
                }
            }
        };

        const result = await BestMonths.calculateBestMonthsForAllLocations(
            minAltitude,
            minDarkHours,
            progressCallback
        );

        // Hide progress, show results
        if (progressDiv) progressDiv.style.display = 'none';
        if (cancelBtn) cancelBtn.style.display = 'none';
        if (calculateBtn) calculateBtn.style.display = 'inline-block';

        if (result.cancelled) {
            this.showToast('Calculation cancelled', 'info');
            if (resultsDiv) {
                resultsDiv.style.display = 'block';
                resultsDiv.innerHTML = `<p style="color: var(--text-secondary);">Calculation was cancelled after processing ${result.locationsProcessed} location(s).</p>`;
            }
        } else {
            this.showToast('All locations calculated!', 'success');

            // Build summary for all locations
            let summaryHTML = '<h4>Calculation Summary - All Locations</h4>';
            Object.entries(result.locationResults).forEach(([locationName, locResult]) => {
                summaryHTML += `
                    <div style="margin-bottom: 1rem; padding: 0.75rem; background: var(--input-bg); border-radius: 6px;">
                        <strong>${locationName}</strong><br>
                        <span style="font-size: 0.9rem;">
                            Total: ${locResult.totalTargets} |
                            Visible: ${locResult.visibleCount} |
                            Not visible: ${locResult.notVisibleCount}
                        </span>
                    </div>
                `;
            });
            summaryHTML += `
                <p style="color: var(--text-secondary); margin-top: 1rem; font-size: 0.9rem; line-height: 1.5;">
                    <strong>Best month:</strong> Calculated using type-specific altitude thresholds (30° or 40°) and weighted scoring.<br>
                    <strong>Visibility window:</strong> Uses system settings (Min Altitude: ${minAltitude}°, Continuous Dark Hours: ${minDarkHours}h).
                </p>
            `;

            if (resultsDiv) {
                resultsDiv.style.display = 'block';
                resultsDiv.innerHTML = summaryHTML;
            }

            // Dispatch event for last location processed
            const lastLocation = Object.keys(result.locationResults).pop();
            document.dispatchEvent(new CustomEvent('best-months-updated', {
                detail: { locationName: lastLocation, minAltitude }
            }));
        }
    },

    /**
     * Populate settings modal with current values
     */
    populateSettingsModal() {
        const dstConfig = SettingsManager.getDSTConfig();
        const dstModeSelect = document.getElementById('dst-mode');
        if (dstModeSelect) {
            dstModeSelect.value = dstConfig.mode;
            // Show/hide custom dates
            const customDates = document.getElementById('custom-dates');
            if (customDates) {
                customDates.style.display = dstConfig.mode === 'custom' ? 'block' : 'none';
            }
            // Set custom dates if they exist
            if (dstConfig.startDate) {
                const startInput = document.getElementById('dst-start');
                if (startInput) {
                    startInput.value = dstConfig.startDate.toISOString().split('T')[0];
                }
            }
            if (dstConfig.endDate) {
                const endInput = document.getElementById('dst-end');
                if (endInput) {
                    endInput.value = dstConfig.endDate.toISOString().split('T')[0];
                }
            }
            // Listen for mode changes
            dstModeSelect.addEventListener('change', () => {
                if (customDates) {
                    customDates.style.display = dstModeSelect.value === 'custom' ? 'block' : 'none';
                }
            });
        }

        // Global minimum altitude
        const minAltSelect = document.getElementById('global-min-altitude');
        if (minAltSelect) {
            minAltSelect.value = SettingsManager.getGlobalMinAltitude();
        }

        // Filter defaults
        const filterMinSizeInput = document.getElementById('filter-min-size');
        if (filterMinSizeInput) {
            filterMinSizeInput.value = SettingsManager.getFilterMinSize();
        }

        const filterMaxMagInput = document.getElementById('filter-max-mag');
        if (filterMaxMagInput) {
            filterMaxMagInput.value = SettingsManager.getFilterMaxMag();
        }

        // Auto-backup toggle
        const autoBackupCheckbox = document.getElementById('auto-backup-enabled');
        if (autoBackupCheckbox) {
            autoBackupCheckbox.checked = SettingsManager.getAutoBackupEnabled();
        }

        // Backup delay
        const backupDelaySelect = document.getElementById('backup-delay-minutes');
        if (backupDelaySelect) {
            backupDelaySelect.value = SettingsManager.getBackupDelayMinutes();
        }

        // Backup reminder interval
        const backupReminderSelect = document.getElementById('backup-reminder-days');
        if (backupReminderSelect) {
            backupReminderSelect.value = SettingsManager.getBackupReminderDays();
        }

        // Optimizer candidate count
        const optimizerCountInput = document.getElementById('optimizer-candidate-count');
        if (optimizerCountInput) {
            optimizerCountInput.value = SettingsManager.getOptimizerCandidateCount();
        }
    },

    /**
     * Save settings from modal
     */
    async saveSettingsFromModal(modalBody) {
        const dstMode = modalBody.querySelector('#dst-mode')?.value;
        const config = { mode: dstMode };
        if (dstMode === 'custom') {
            const startDate = modalBody.querySelector('#dst-start')?.value;
            const endDate = modalBody.querySelector('#dst-end')?.value;
            if (startDate && endDate) {
                config.startDate = new Date(startDate);
                config.endDate = new Date(endDate);
            }
        }
        await SettingsManager.updateDSTConfig(config);

        const minAlt = modalBody.querySelector('#global-min-altitude')?.value;
        if (minAlt) {
            await SettingsManager.updateGlobalMinAltitude(parseInt(minAlt));
        }

        const autoBackup = modalBody.querySelector('#auto-backup-enabled')?.checked ?? true;
        await SettingsManager.setAutoBackupEnabled(autoBackup);

        const backupDelay = modalBody.querySelector('#backup-delay-minutes')?.value;
        if (backupDelay) {
            await SettingsManager.setBackupDelayMinutes(parseInt(backupDelay));
        }

        const backupReminderDays = modalBody.querySelector('#backup-reminder-days')?.value;
        if (backupReminderDays) {
            await SettingsManager.setBackupReminderDays(parseInt(backupReminderDays));
        }

        const filterMinSizeRaw = modalBody.querySelector('#filter-min-size')?.value.trim();
        if (filterMinSizeRaw !== undefined && filterMinSizeRaw !== '') {
            const filterMinSize = parseFloat(filterMinSizeRaw);
            if (isNaN(filterMinSize) || filterMinSize < 0.1 || filterMinSize > 999) {
                this.showToast('Min Target Size must be between 0.1 and 999', 'error');
                modalBody.querySelector('#filter-min-size').focus();
                return;
            }
            await SettingsManager.setFilterMinSize(filterMinSize);
        }

        const filterMaxMagRaw = modalBody.querySelector('#filter-max-mag')?.value.trim();
        if (filterMaxMagRaw !== undefined && filterMaxMagRaw !== '') {
            const filterMaxMag = parseFloat(filterMaxMagRaw);
            if (isNaN(filterMaxMag) || filterMaxMag < -5 || filterMaxMag > 20) {
                this.showToast('Max Magnitude must be between -5 and 20', 'error');
                modalBody.querySelector('#filter-max-mag').focus();
                return;
            }
            await SettingsManager.setFilterMaxMag(filterMaxMag);
        }

        const optimizerCount = modalBody.querySelector('#optimizer-candidate-count')?.value;
        if (optimizerCount) {
            await SettingsManager.setOptimizerCandidateCount(parseInt(optimizerCount));
        }

        this.showToast('Settings saved successfully', 'success');
        this.markDataChanged();
    },

    /**
     * Clear all targets from database
     */
    async clearAllTargets() {
        // Show confirmation dialog
        const confirmed = confirm(
            'Are you sure you want to clear all targets?\n\n' +
                'This will delete all targets from the database.\n' +
                'Locations and pinned targets will be preserved.\n\n' +
                'This action cannot be undone.'
        );

        if (!confirmed) {
            return;
        }

        try {
            await DBManager.clear(APP_CONFIG.STORES.TARGETS);

            // Reset best months metadata so recalculation is triggered after new import
            await SettingsManager.setLastBestMonthsCalculated(null);
            await SettingsManager.setLastBestMonthsAltitude(null);
            await SettingsManager.setLastBestMonthsDarkHours(null);
            await SettingsManager.setLastBestMonthsLocation(null);

            // clear filter options so they can be reloaded fresh upon new target import
            TargetFilter.clearAvailableOptions();

            // Reset filter UI (clear dropdown labels and results)
            TargetFilter.resetFiltersUI();

            // Clear currently selected target (if on visibility view)
            if (typeof VisibilityTargets !== 'undefined' && VisibilityTargets.clearFields) {
                try {
                    VisibilityTargets.clearFields();
                } catch (e) {
                    // Ignore if not on visibility view
                }
            }

            // Reload DataManager to clear the in-memory cache
            await DataManager.init();

            this.showToast('All targets cleared successfully', 'success');

            // Refresh visibility view if it's current
            if (window.location.hash === '#target-select') {
                document.dispatchEvent(new CustomEvent('targets-updated'));
            }
        } catch (error) {
            console.error('Error clearing targets:', error);
            this.showToast('Error clearing targets: ' + error.message, 'error');
        }
    },


    locationHasBestMonths(locationName) {
        const targets = DataManager.getTargets();
        if (!targets || targets.length === 0) return false;
        // Sample first 10 targets to check if location has best months data
        const sample = targets.slice(0, 10);
        return sample.some(t => t.bestMonth && t.bestMonth[locationName] !== undefined);
    },

    async markDataChanged() {
        await SettingsManager.setLastChangeTimestamp(Date.now());
        if (!SettingsManager.getAutoBackupEnabled()) return;
        BackupManager.scheduleAutoBackup();
    },

    async autoCalculateBestMonths(locationName) {
        const minAltitude = SettingsManager.getMinAltitudeYearly() || 35;
        const minDarkHours = 2;

        this.showProgressToast(`Calculating Best Months for ${locationName}: 0%`);

        try {
            await BestMonths.calculateBestMonths(locationName, minAltitude, minDarkHours, (processed, total) => {
                const percent = Math.round((processed / total) * 100);
                this.updateProgressToast(`Calculating Best Months for ${locationName}: ${percent}%`);
            });

            this.dismissProgressToast();
            this.showToast(`Best Months calculated for ${locationName}`, 'success');
        } catch (error) {
            this.dismissProgressToast();
            this.showToast(`Best Months calculation failed: ${error.message}`, 'error');
            console.error('Auto Best Months error:', error);
        }
    },

    async checkForTargetUpdates() {
        const meta = await DataManager.fetchTargetMeta();
        if (!meta) {
            this.showToast('Target update file not available', 'warning');
            return;
        }

        const storedVersion = await DataManager.getTargetVersion();
        const currentVersion = storedVersion ? String(storedVersion) : null;
        const metaVersion = String(meta.version);

        if (currentVersion && Number(currentVersion) >= Number(metaVersion)) {
            this.showToast('Target database is already up to date', 'success');
            return;
        }

        this.showToast('Updating target database...', 'info');
        const loaded = await DataManager.fetchAndLoadTargets(meta);
        if (loaded) {
            TargetFilter.initialize();
            await App.updateVersionDisplay();
            this.showToast('Target database updated - reloading...', 'success');
            setTimeout(() => location.reload(), 1500);
        } else {
            this.showToast('Failed to update target database', 'error');
        }
    },

    openImportTargetsModal() {
        this.openModal('import-targets-template', 'Import Target Database', async (action, modalBody) => {
            if (action === 'import') {
                await this.importTargets(modalBody);
            } else if (action === 'cancel') {
                this.closeModal();
            }
        });
    },

    /**
     * Import targets from CSV file
     */
    async importTargets(modalBody) {
        const fileInput = modalBody.querySelector('#target-file');
        const file = fileInput?.files[0];

        if (!file) {
            this.showToast('Please select a file', 'error');
            return;
        }

        try {
            // Parse version from filename (e.g. astryx-targets-1737934800.csv)
            const versionMatch = file.name.match(/astryx-targets-(\d+)\.csv$/);
            const targetVersion = versionMatch ? versionMatch[1] : null;
            const text = await file.text();
            const parsed = CSVUtils.parseTargetCSV(text);

            if (parsed.errors.length > 0) {
                const statusDiv = modalBody.querySelector('#import-status');
                if (statusDiv) {
                    statusDiv.innerHTML = `<pre style="white-space: pre-wrap; color: var(--error-color);">${parsed.errors.join('\n')}</pre>`;
                }
            }

            if (parsed.targets.length > 0) {
                const count = await DataManager.importTargets(parsed.targets, targetVersion);
                TargetFilter.initialize();
                await App.updateVersionDisplay();
                this.showToast(`Successfully imported ${count} target(s)`, 'success');

                if (parsed.errors.length === 0) {
                    this.closeModal();
                }

                // Refresh visibility view if it's current
                if (window.currentView === 'visibility') {
                    document.dispatchEvent(new CustomEvent('targets-updated'));
                }

                // Auto-calculate best months for current location
                const locationName = SettingsManager.getSelectedLocation();
                if (locationName && !this.locationHasBestMonths(locationName)) {
                    await this.autoCalculateBestMonths(locationName);
                }
            }
        } catch (error) {
            console.error('Error importing targets:', error);
            this.showToast('Error importing targets: ' + error.message, 'error');
        }
    },




    /**
     * Show toast notification
     */
    showProgressToast(message) {
        const existing = document.getElementById('progress-toast');
        if (existing) existing.remove();

        const toast = document.createElement('div');
        toast.id = 'progress-toast';
        toast.className = 'toast toast-info';
        toast.textContent = message;

        document.body.appendChild(toast);
        setTimeout(() => toast.classList.add('show'), 10);
    },

    updateProgressToast(message) {
        const toast = document.getElementById('progress-toast');
        if (toast) toast.textContent = message;
    },

    dismissProgressToast() {
        const toast = document.getElementById('progress-toast');
        if (toast) {
            toast.classList.remove('show');
            setTimeout(() => { if (toast.parentNode) toast.parentNode.removeChild(toast); }, 300);
        }
    },

    showToast(message, type = 'info', duration = 3000) {
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        toast.textContent = message;

        document.body.appendChild(toast);

        // Trigger animation
        setTimeout(() => toast.classList.add('show'), 10);

        // Remove after duration
        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => document.body.removeChild(toast), 300);
        }, duration);
    },

    _raToHMS(h) {
        const hh = Math.floor(h);
        const mTotal = (h - hh) * 60;
        const mm = Math.floor(mTotal);
        const ss = ((mTotal - mm) * 60).toFixed(1);
        return `${String(hh).padStart(2,'0')}h ${String(mm).padStart(2,'0')}m ${String(ss).padStart(4,'0')}s`;
    },

    _decToDMS(deg) {
        const sign = deg < 0 ? '−' : '+';
        const abs = Math.abs(deg);
        const d = Math.floor(abs);
        const mTotal = (abs - d) * 60;
        const m = Math.floor(mTotal);
        const s = ((mTotal - m) * 60).toFixed(1);
        return `${sign}${String(d).padStart(2,'0')}° ${String(m).padStart(2,'0')}′ ${String(s).padStart(4,'0')}″`;
    },

    formatRA(decimalHours, decimalDeg) {
        const precessed = TimeUtils.precessFromJ2000(decimalHours, decimalDeg);
        return `${this._raToHMS(precessed.ra)} (${precessed.epochLabel})`;
    },

    formatDec(decimalHours, decimalDeg) {
        const precessed = TimeUtils.precessFromJ2000(decimalHours, decimalDeg);
        return `${this._decToDMS(precessed.dec)} (${precessed.epochLabel})`;
    },

    /**
     * Open target detail modal
     */
    openObjectDetailModal(target) {
        this.openModal('target-detail-template', `Target Details: ${target.object}`, (action, modalBody) => {
            if (action === 'close') {
                this.closeModal();
            }
        });

        // Fetch fresh target from DataManager to ensure we have latest bestMonth data
        const freshTarget = DataManager.getTargets().find(t => t.object === target.object);

        // Populate target details with fresh data
        this.populateObjectDetail(freshTarget || target);
        this.addToDoListButton(target);
    },

    /**
     * Add To Do List button to modal header
     */
    addToDoListButton(target) {
        const headerButtons = document.getElementById('modal-header-buttons');
        if (!headerButtons) return;

        // Remove any existing todo button
        const existingBtn = document.getElementById('modal-todo-btn');
        if (existingBtn) {
            existingBtn.remove();
        }

        // Create the button 'btn-primary btn-sm'
        const todoBtn = document.createElement('button');
        todoBtn.id = 'modal-todo-btn';
        todoBtn.className = 'btn-primary';
        todoBtn.style.cursor = 'pointer';


        const updateButtonState = () => {
            const isInList = ToDoManager.isInToDoList(target.object);

            if (isInList) {
                todoBtn.textContent = 'Remove from To Do List';
            } else {
                todoBtn.textContent = 'Add to To Do List';
            }
        };

        // Set initial state
        updateButtonState();

        // Add click handler
        todoBtn.addEventListener('click', async () => {
            const isInList = ToDoManager.isInToDoList(target.object);

            if (isInList) {
                // Remove from list
                await ToDoManager.removeFromToDoList(target.object);
                this.showToast(`Removed ${target.object} from To Do List`, 'success');
                UIManager.markDataChanged();
            } else {
                // Add to list
                await ToDoManager.addToToDoList(target.object);
                this.showToast(`Added ${target.object} to To Do List`, 'success');
                UIManager.markDataChanged();
            }

            // Update button state
            updateButtonState();
        });

        headerButtons.appendChild(todoBtn);
    },

    /**
     * Populate object detail modal with target data
     */
    populateObjectDetail(target) {
        const detailObject = document.getElementById('detail-object');
        if (target.object) {
            detailObject.innerHTML = `<a href="https://en.wikipedia.org/w/index.php?search=${encodeURIComponent(target.object).replace(/%20/g, '+')}&go=Go" target="_blank" class="wiki-link">${target.object}</a>`;
        } else {
            detailObject.textContent = '—';
        }
        const detailType = document.getElementById('detail-type');
        if (target.type) {
            const typeDisplay = OBJECT_TYPES[target.type] || target.type;
            detailType.innerHTML = `<a href="https://en.wikipedia.org/w/index.php?search=${encodeURIComponent(typeDisplay).replace(/%20/g, '+')}&go=Go" target="_blank" class="wiki-link">${typeDisplay}</a>`;
        } else {
            detailType.textContent = '—';
        }

        const detailCommon = document.getElementById('detail-common');
        if (target.common) {
            const names = target.common.split(',').map(n => n.trim());
            detailCommon.innerHTML = names.map(name =>
                `<a href="https://en.wikipedia.org/w/index.php?search=${encodeURIComponent(name).replace(/%20/g, '+')}&go=Go" target="_blank" class="wiki-link">${name}</a>`
            ).join(', ');
        } else {
            detailCommon.textContent = '—';
        }

        document.getElementById('detail-other').textContent = target.other || '—';
        document.getElementById('detail-catalogue').textContent = target.catalogue || '—';
        document.getElementById('detail-ra').textContent = (target.ra != null && target.dec != null) ? UIManager.formatRA(target.ra, target.dec) : '—';
        document.getElementById('detail-dec').textContent = (target.ra != null && target.dec != null) ? UIManager.formatDec(target.ra, target.dec) : '—';
        document.getElementById('detail-const').textContent = target.constellation ? (CONSTELLATIONS[target.constellation] || target.constellation) : '—';
        document.getElementById('detail-size-max').textContent = target.size_max ? `${target.size_max}'` : '—';
        document.getElementById('detail-size-min').textContent = target.size_min ? `${target.size_min}'` : '—';
        document.getElementById('detail-mag').textContent = target.mag || '—';
        document.getElementById('detail-subr').textContent = target.subr || '—';
        this.populateObservabilitySection(target);
    },

    /**
     * Populate observability section of object detail modal
     */
    populateObservabilitySection(target) {
        const observabilitySection = document.getElementById('target-detail-observability');
        if (!observabilitySection) return;

        const lastAltitude = SettingsManager.getLastBestMonthsAltitude();
        const lastDarkHours = SettingsManager.getLastBestMonthsDarkHours();
        const lastCalculated = SettingsManager.getLastBestMonthsCalculated();

        // Format timestamp
        let calculatedDisplay = 'Never calculated';
        if (lastCalculated) {
            // Parse YYYYMMDD-HHMMSSZ format
            const year = lastCalculated.substr(0, 4);
            const month = lastCalculated.substr(4, 2);
            const day = lastCalculated.substr(6, 2);
            const time = lastCalculated.substr(9, 6);
            calculatedDisplay = `${year}-${month}-${day} ${time.substr(0,2)}:${time.substr(2,2)}:${time.substr(4,2)} UTC`;
        }

        // build Observability title from location
        const obTitle = document.getElementById('target-detail-ob-title');
        const obsLocation = SettingsManager.getSelectedLocation();
        obTitle.innerHTML = `Observability from ${obsLocation}`;

        // Build criteria display
        const criteriaHTML = `
        <div class="detail-item">
            <span class="detail-label">Criteria:</span>
            <span class="detail-value">Min Altitude ${lastAltitude || 'N/A'}°<br>${lastDarkHours || 'N/A'}h darkness</span>
        </div>
        <div class="detail-item">
            <span class="detail-label">Calculated:</span>
            <span class="detail-value">${calculatedDisplay}</span>
        </div>
    `;

        // Get current location
        const selectedLocation = SettingsManager.getSelectedLocation();

        // Check if target meets criteria - all properties are now per-location
        const bestMonth = target.bestMonth?.[selectedLocation];
        const visibilityStart = target.visibilityStart?.[selectedLocation];
        const visibilityEnd = target.visibilityEnd?.[selectedLocation];
        const peakAltitude = target.peakAltitude?.[selectedLocation];

        if (!bestMonth || !visibilityStart) {
            observabilitySection.innerHTML = criteriaHTML + `
            <div class="detail-item">
                <span class="detail-value" style="color: var(--text-secondary); font-style: italic;">
                    Not observable with current criteria
                </span>
            </div>
        `;
            return;
        }

        // Convert month numbers to names
        const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
                            'July', 'August', 'September', 'October', 'November', 'December'];

        const bestMonthName = monthNames[bestMonth - 1];
        const startMonthName = monthNames[visibilityStart - 1];

        // Handle wrap-around for end month
        let endMonth = visibilityEnd;
        if (endMonth > 12) endMonth = endMonth - 12; // Convert 13->1, 14->2, etc.
        const endMonthName = monthNames[endMonth - 1];

        observabilitySection.innerHTML = criteriaHTML + `
        <div class="detail-item">
            <span class="detail-label">Best Month:</span>
            <span class="detail-value">${bestMonthName}</span>
        </div>
        <div class="detail-item">
            <span class="detail-label">Observable:</span>
            <span class="detail-value">${startMonthName} - ${endMonthName}</span>
        </div>
        <div class="detail-item">
            <span class="detail-label">Peak Altitude:</span>
            <span class="detail-value">${peakAltitude}°</span>
        </div>
    `;
    },

    /**
     * Initialize sidebar location dropdown
     */
    initializeSidebarLocationDropdown() {
        const locationSelect = document.getElementById('sidebar-location-select');
        if (!locationSelect) return;

        // Populate dropdown
        this.updateSidebarLocationDropdown();

        // Load saved location
        const savedLocation = SettingsManager.getSelectedLocation();
        if (savedLocation) {
            locationSelect.value = savedLocation;
        }

        // Handle changes
        locationSelect.addEventListener('change', async (e) => {
            const locationName = e.target.value;
            if (locationName) {
                await SettingsManager.setSelectedLocation(locationName);
                if (!this.locationHasBestMonths(locationName)) {
                    await this.autoCalculateBestMonths(locationName);
                }
            }
        });

        // Listen for location updates
        document.addEventListener('locations-updated', () => {
            this.updateSidebarLocationDropdown();
        });
    },

    /**
     * Update sidebar location dropdown
     */
    updateSidebarLocationDropdown() {
        const locationSelect = document.getElementById('sidebar-location-select');
        if (!locationSelect) return;

        const locations = DataManager.getLocations();
        const currentValue = locationSelect.value;

        locationSelect.innerHTML = '<option value="">Select a location...</option>';

        Object.keys(locations).forEach(name => {
            const option = document.createElement('option');
            option.value = name;
            option.textContent = name;
            locationSelect.appendChild(option);
        });

        // Restore selection if still valid
        if (currentValue && locations[currentValue]) {
            locationSelect.value = currentValue;
        }
    },

    updateSidebarCurrentTarget(targetName) {
        const el = document.getElementById('sidebar-current-target');
        if (el) {
            el.textContent = `Current Target: ${targetName || 'None'}`;
        }
    },

    /**
     * Create Daily Visibility chart
     */
    createDailyVisibilityChart() {
        // Ensure a current target is set
        if (typeof VisibilityTargets !== 'undefined') {
            if (!VisibilityTargets.currentTarget) {
                VisibilityTargets.loadLastTarget();
            }
            if (!VisibilityTargets.currentTarget) {
                // Fall back to default target
                const defaultTarget = DataManager.getTargets().find(t => t.object === APP_CONFIG.DEFAULT_TARGET);
                if (defaultTarget) VisibilityTargets.currentTarget = defaultTarget;
            }
        }

        const target = VisibilityTargets?.currentTarget;
        if (!target) {
            UIManager.showToast('No target available for Daily Visibility', 'error');
            return;
        }

        const locationName = SettingsManager.getSelectedLocation();
        if (!locationName) {
            UIManager.showToast('No location selected', 'error');
            return;
        }

        const minAltitude = SettingsManager.getGlobalMinAltitude();
        const useHorizon = true;
        const dateStr = TimeUtils.formatDateForInput(new Date());

        const skyglowData = VisibilityCalculations.assembleSkyglowData(
            target, dateStr, locationName, minAltitude, useHorizon
        );

        if (!skyglowData) {
            UIManager.showToast('Could not calculate visibility for this date/location', 'error');
            return;
        }

        window.skyglowData = skyglowData;
        window.location.hash = '#skyglow';
    },


    /**
     * Pre-calculate yearly observability data then navigate to the view
     */
    createYearlyObservabilityChart() {
        // Ensure a target is set
        if (typeof VisibilityTargets !== 'undefined') {
            if (!VisibilityTargets.currentTarget) {
                VisibilityTargets.loadLastTarget();
            }
            if (!VisibilityTargets.currentTarget) {
                const defaultTarget = DataManager.getTargets().find(t => t.object === APP_CONFIG.DEFAULT_TARGET);
                if (defaultTarget) VisibilityTargets.currentTarget = defaultTarget;
            }
        }

        if (typeof VisibilityCalculations !== 'undefined') {
            if (typeof VisibilityTargets !== 'undefined' && VisibilityTargets.currentTarget) {
                VisibilityCalculations.currentTarget = VisibilityTargets.currentTarget;
            }
            // Pre-calculate and store before navigating — eliminates blink
            const inputs = VisibilityCalculations.getYearlyInputs();
            if (inputs.targetName && !isNaN(inputs.ra) && !isNaN(inputs.dec)) {
                const altitudeData = VisibilityCalculations.calculateYearlyAltitudeData(inputs);
                window.lastYearlyObservabilityGraphData = { altitudeData, inputs };
            }
        }

        window.location.hash = '#yearly-observability';
    },

    /**
     * Open Manage Telescopes modal
     */
    openManageTelescopesModal() {
        this.openModal('manage-telescopes-template', 'Manage Telescopes', (action, modalBody) => {
            if (action === 'save') {
                this.handleSaveTelescope(modalBody);
            }
        });

        setTimeout(() => this.initializeManageTelescopesModal(), 0);
    },

    /**
     * Initialize Manage Telescopes modal
     */
    initializeManageTelescopesModal() {
        this.refreshTelescopeList();
    },

    /**
     * Refresh telescope list in modal
     */
    refreshTelescopeList() {
        const listDiv = document.getElementById('telescope-list');
        if (!listDiv) return;

        const telescopes = DataManager.getTelescopes();
        const telescopeNames = Object.keys(telescopes);

        if (telescopeNames.length === 0) {
            listDiv.innerHTML = '<p style="color: var(--text-secondary); font-style: italic;">No telescopes defined yet.</p>';
            const mc = document.querySelector('.modal-content');
            if (mc) mc.scrollTop = 0;
            return;
        }

        listDiv.innerHTML = telescopeNames.map(name => {
            const tel = telescopes[name];
            return `
                <div class="info-card" style="padding: 1rem; margin-bottom: 0.75rem;">
                    <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 1rem;">
                        <div style="flex: 1;">
                            <strong style="color: var(--primary-color); font-size: 1.05rem;">${name}</strong>
                            <div style="margin-top: 0.5rem; font-size: 0.9rem; color: var(--text-secondary);">
                                Focal Length: ${tel.focalLength} mm<br>
                                Aperture: ${tel.aperture} mm<br>
                                Multiplier: ${tel.multiplier}x
                            </div>
                        </div>
                        <button class="btn-sm btn-danger" onclick="UIManager.deleteTelescope('${name}')">Delete</button>
                    </div>
                </div>
            `;
        }).join('');

        const mc = document.querySelector('.modal-content');
        if (mc) mc.scrollTop = 0;
    },

    /**
     * Handle save telescope
     */
    async handleSaveTelescope(modalBody) {
        const name = document.getElementById('telescope-name')?.value.trim();
        const focalLength = parseFloat(document.getElementById('telescope-focal-length')?.value);
        const aperture = parseFloat(document.getElementById('telescope-aperture')?.value);
        const multiplier = parseFloat(document.getElementById('telescope-multiplier')?.value);

        if (!name || !focalLength || !aperture || !multiplier) {
            this.showToast('Please fill in all fields', 'error');
            return;
        }

        if (focalLength <= 0 || aperture <= 0 || multiplier <= 0) {
            this.showToast('Values must be greater than zero', 'error');
            return;
        }

        await DataManager.saveTelescope(name, {
            focalLength,
            aperture,
            multiplier
        });

        this.showToast(`Telescope "${name}" saved successfully`, 'success');
        this.markDataChanged();

        // Clear form
        document.getElementById('telescope-name').value = '';
        document.getElementById('telescope-focal-length').value = '';
        document.getElementById('telescope-aperture').value = '';
        document.getElementById('telescope-multiplier').value = '1.0';

        // Refresh list
        this.refreshTelescopeList();
        document.dispatchEvent(new CustomEvent('telescopes-updated'));
        setTimeout(() => {
            const mc = document.querySelector('.modal-content');
            if (mc) mc.scrollTop = 0;
        }, 150);
        this.closeModal();
    },

    /**
     * Delete telescope
     */
    async deleteTelescope(name) {
        if (!confirm(`Delete telescope "${name}"?`)) {
            return;
        }

        await DataManager.deleteTelescope(name);
        this.showToast(`Telescope "${name}" deleted`, 'success');
        this.markDataChanged();
        this.refreshTelescopeList();

        // Dispatch event for dropdown refresh
        document.dispatchEvent(new CustomEvent('telescopes-updated'));
    },

    /**
     * Open Manage Sensors modal
     */
    openManageSensorsModal() {
        this.openModal('manage-sensors-template', 'Manage Sensors', (action, modalBody) => {
            if (action === 'save') {
                this.handleSaveSensor(modalBody);
            }
        });

        setTimeout(() => this.initializeManageSensorsModal(), 0);
    },

    /**
     * Initialize Manage Sensors modal
     */
    initializeManageSensorsModal() {
        this.refreshSensorList();
    },

    /**
     * Refresh sensor list in modal
     */
    refreshSensorList() {
        const listDiv = document.getElementById('sensor-list');
        if (!listDiv) return;
        const sensors = DataManager.getSensors();
        const sensorNames = Object.keys(sensors);
        if (sensorNames.length === 0) {
            listDiv.innerHTML = '<p style="color: var(--text-secondary); font-style: italic;">No sensors defined yet.</p>';
            const mc = document.querySelector('.modal-content');
            if (mc) mc.scrollTop = 0;
            return;
        }
        listDiv.innerHTML = sensorNames.map(name => {
            const sensor = sensors[name];
            return `
                <div class="info-card" style="padding: 1rem; margin-bottom: 0.75rem;">
                    <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 1rem;">
                        <div style="flex: 1;">
                            <strong style="color: var(--primary-color); font-size: 1.05rem;">${name}</strong>
                            <div style="margin-top: 0.5rem; font-size: 0.9rem; color: var(--text-secondary);">
                                Resolution: ${sensor.resolutionX} × ${sensor.resolutionY} pixels<br>
                                Pixel Size: ${sensor.pixelSizeX} × ${sensor.pixelSizeY} µm
                            </div>
                        </div>
                        <button class="btn-sm btn-danger" onclick="UIManager.deleteSensor('${name}')">Delete</button>
                    </div>
                </div>
            `;
        }).join('');
        const mc = document.querySelector('.modal-content');
        if (mc) mc.scrollTop = 0;
    },

    /**
     * Handle save sensor
     */
    async handleSaveSensor(modalBody) {
        const name = document.getElementById('sensor-name')?.value.trim();
        const resolutionX = parseInt(document.getElementById('sensor-resolution-x')?.value);
        const resolutionY = parseInt(document.getElementById('sensor-resolution-y')?.value);
        const pixelSizeX = parseFloat(document.getElementById('sensor-pixel-size-x')?.value);
        const pixelSizeY = parseFloat(document.getElementById('sensor-pixel-size-y')?.value);

        if (!name || !resolutionX || !resolutionY || !pixelSizeX || !pixelSizeY) {
            this.showToast('Please fill in all fields', 'error');
            return;
        }

        if (resolutionX <= 0 || resolutionY <= 0 || pixelSizeX <= 0 || pixelSizeY <= 0) {
            this.showToast('Values must be greater than zero', 'error');
            return;
        }

        await DataManager.saveSensor(name, {
            resolutionX,
            resolutionY,
            pixelSizeX,
            pixelSizeY
        });

        this.showToast(`Sensor "${name}" saved successfully`, 'success');
        this.markDataChanged();

        // Clear form
        document.getElementById('sensor-name').value = '';
        document.getElementById('sensor-resolution-x').value = '';
        document.getElementById('sensor-resolution-y').value = '';
        document.getElementById('sensor-pixel-size-x').value = '';
        document.getElementById('sensor-pixel-size-y').value = '';

        // Refresh list
        this.refreshSensorList();
        document.dispatchEvent(new CustomEvent('sensors-updated'));
        setTimeout(() => {
            const mc = document.querySelector('.modal-content');
            if (mc) mc.scrollTop = 0;
        }, 150);
        this.closeModal();
    },

    /**
     * Delete sensor
     */
    async deleteSensor(name) {
        if (!confirm(`Delete sensor "${name}"?`)) {
            return;
        }
        await DataManager.deleteSensor(name);
        this.showToast(`Sensor "${name}" deleted`, 'success');
        this.markDataChanged();
        this.refreshSensorList();
        // Dispatch event for dropdown refresh
        document.dispatchEvent(new CustomEvent('sensors-updated'));
    },

    // ============================================================================
    // Filter Management
    // ============================================================================

    /**
     * Open Manage Filters modal
     */
    openManageFiltersModal() {
        this.openModal('manage-filters-template', 'Manage Filters', (action, modalBody) => {
            if (action === 'save') {
                this.handleSaveFilter(modalBody);
            }
        });

        setTimeout(() => this.initializeManageFiltersModal(), 0);
    },

    /**
     * Initialize Manage Filters modal
     */
    initializeManageFiltersModal() {
        this.refreshFilterList();
    },

    /**
     * Refresh filter list in modal
     */
    refreshFilterList() {
        const listDiv = document.getElementById('filters-list');
        if (!listDiv) return;
        const filters = DataManager.getFilters();
        const filterNames = Object.keys(filters).sort();
        if (filterNames.length === 0) {
            listDiv.innerHTML = '<p style="color: var(--text-secondary); font-style: italic;">No filters defined yet.</p>';
            const mc = document.querySelector('.modal-content');
            if (mc) mc.scrollTop = 0;
            return;
        }
        listDiv.innerHTML = filterNames.map(name => {
            return `
                <div class="info-card" style="padding: 1rem; margin-bottom: 0.75rem;">
                    <div style="display: flex; justify-content: space-between; align-items: center; gap: 1rem;">
                        <strong style="color: var(--primary-color); font-size: 1.05rem;">${name}</strong>
                        <button class="btn-sm btn-danger" onclick="UIManager.deleteFilter('${name}')">Delete</button>
                    </div>
                </div>
            `;
        }).join('');
        const mc = document.querySelector('.modal-content');
        if (mc) mc.scrollTop = 0;
    },

    /**
     * Handle save filter
     */
    async handleSaveFilter(modalBody) {
        const name = document.getElementById('filter-name')?.value.trim();

        if (!name) {
            this.showToast('Please enter a filter name', 'error');
            return;
        }

        // Check if already exists
        if (DataManager.getFilter(name)) {
            this.showToast(`Filter "${name}" already exists`, 'error');
            return;
        }

        await DataManager.saveFilter(name);
        this.showToast(`Filter "${name}" saved successfully`, 'success');
        this.markDataChanged();

        // Clear form
        document.getElementById('filter-name').value = '';

        // Refresh list
        this.refreshFilterList();
        document.dispatchEvent(new CustomEvent('filters-updated'));
        setTimeout(() => {
            const mc = document.querySelector('.modal-content');
            if (mc) mc.scrollTop = 0;
        }, 150);
    },

    /**
     * Delete filter
     */
    async deleteFilter(name) {
        if (!confirm(`Delete filter "${name}"?`)) {
            return;
        }

        await DataManager.deleteFilter(name);
        this.showToast(`Filter "${name}" deleted`, 'success');
        this.markDataChanged();
        this.refreshFilterList();

        // Dispatch event for dropdown refresh
        document.dispatchEvent(new CustomEvent('filters-updated'));
    },


    /**
     * Open NEW Backup modal
     */
    async openNewBackupModal() {
        this.openModal('backup-modal-template', 'Backup Database', (action, modalBody) => {
            if (action === 'save') {
                BackupManager.handleNewBackup(modalBody);
            }
        });

        // Setup backup modal controls
        setTimeout(async () => {
            const selectUserDataBtn = document.getElementById('backup-select-userdata');
            const selectTargetsBtn  = document.getElementById('backup-select-targets');

            const userDataIds = [
                'backup-settings', 'backup-locations', 'backup-telescopes',
                'backup-sensors', 'backup-filters', 'backup-pinned',
                'backup-todo', 'backup-imaging', 'backup-programs'
            ];
            const targetId = 'backup-targets';

            const userDataStoreNames = {
                'backup-settings':   'settings',
                'backup-locations':  'locations',
                'backup-telescopes': 'telescopes',
                'backup-sensors':    'sensors',
                'backup-filters':    'filters',
                'backup-pinned':     'pinned-targets',
                'backup-todo':       'todo-list',
                'backup-imaging':    'projects-sessions',
                'backup-programs':   'programs'
            };

            const updateFilename = () => {
                const filenameInput = document.getElementById('backup-filename');
                if (!filenameInput) return;

                const base = `${APP_CONFIG.APP_NAME}-v${APP_CONFIG.APP_VERSION}-d${APP_CONFIG.DB_VERSION}`;
                const dtg  = TimeUtils.nowDTG();
                const targetsChecked   = document.getElementById(targetId)?.checked;
                const checkedUserData  = userDataIds.filter(id => document.getElementById(id)?.checked);

                if (targetsChecked) {
                    filenameInput.value = `${base}-targets-${dtg}`;
                } else if (checkedUserData.length === 0) {
                    filenameInput.value = '';
                } else if (checkedUserData.length === 1) {
                    const storeName = userDataStoreNames[checkedUserData[0]];
                    filenameInput.value = `${base}-${storeName}-${dtg}`;
                } else if (checkedUserData.length === userDataIds.length) {
                    filenameInput.value = `${base}-userdata-${dtg}`;
                } else {
                    filenameInput.value = `${base}-partial-userdata-${dtg}`;
                }
            };

            if (selectUserDataBtn) {
                selectUserDataBtn.addEventListener('click', () => {
                    // Uncheck and disable targets
                    const targetCb = document.getElementById(targetId);
                    if (targetCb) { targetCb.checked = false; targetCb.disabled = true; }

                    // Check and enable all user data
                    userDataIds.forEach(id => {
                        const cb = document.getElementById(id);
                        if (cb) { cb.checked = true; cb.disabled = false; }
                    });

                    updateFilename();
                    BackupManager.updateBackupSizeEstimates();
                });
            }

            if (selectTargetsBtn) {
                selectTargetsBtn.addEventListener('click', () => {
                    // Uncheck and disable all user data
                    userDataIds.forEach(id => {
                        const cb = document.getElementById(id);
                        if (cb) { cb.checked = false; cb.disabled = true; }
                    });

                    // Check and enable targets
                    const targetCb = document.getElementById(targetId);
                    if (targetCb) { targetCb.checked = true; targetCb.disabled = false; }

                    updateFilename();
                    BackupManager.updateBackupSizeEstimates();
                });
            }

            // Default to Select User Data state on open
            const targetCbInit = document.getElementById(targetId);
            if (targetCbInit) { targetCbInit.checked = false; targetCbInit.disabled = true; }
            userDataIds.forEach(id => {
                const cb = document.getElementById(id);
                if (cb) { cb.checked = true; cb.disabled = false; }
            });

            // Get actual counts and update display
            const counts = await BackupManager.countDataStoreItems();
            BackupManager.updateBackupCounts(counts);

            // Update size estimates initially
            await BackupManager.updateBackupSizeEstimates();

            // Set initial filename
            updateFilename();

            // Add change listeners to all checkboxes to update size and filename
            const checkboxes = document.querySelectorAll('#modal-body input[type="checkbox"]');
            checkboxes.forEach(cb => {
                cb.addEventListener('change', () => {
                    updateFilename();
                    BackupManager.updateBackupSizeEstimates();
                });
            });
        }, 0);
    },



    /**
     * Open NEW Restore modal (placeholder for now)
     */
    openNewRestoreModal() {
        this.openModal('restore-picker-template', 'Select Backup File', (action, modalBody) => {
            if (action === 'continue') {
                BackupManager.handleRestoreFileSelected(modalBody);
            }
        });

        // Setup file picker
        setTimeout(() => {
            const browseBtn = document.getElementById('restore-browse-btn');
            const fileInput = document.getElementById('restore-file-input');
            const selectedFileDiv = document.getElementById('restore-selected-file');

            if (browseBtn && fileInput) {
                browseBtn.addEventListener('click', () => {
                    fileInput.click();
                });

                fileInput.addEventListener('change', (e) => {
                    const file = e.target.files[0];
                    if (file) {
                        selectedFileDiv.textContent = `Selected: ${file.name} (${BackupManager.formatBytes(file.size)})`;
                        selectedFileDiv.style.color = 'var(--primary-color)';
                        selectedFileDiv.style.fontStyle = 'normal';

                        // Store file for later use
                        BackupManager.restoreFile = file;

                        // Enable Continue button (we'll add this next)
                        const continueBtn = document.getElementById('modal-save-btn');
                        if (continueBtn) {
                            continueBtn.disabled = false;
                            continueBtn.style.opacity = '1';
                        }
                    }
                });
            }
        }, 0);
    }

};

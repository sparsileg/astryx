/**
 * app.js
 * Application initialization and routing
 */

const App = {
    container: null,
    currentView: null,

    /**
     * Initialize application
     */
    async init() {
        console.log('Initializing ' + APP_CONFIG.APP_NAME + '...');

        try {
            // Initialize database
            await DBManager.init();

            // Load settings and data
            await SettingsManager.init();
            await DataManager.init();
            TargetFilter.initialize();
            await ToDoManager.init();

            // Check for target database updates
            await this.checkForTargetUpdates();

            // Initialize UI
            UIManager.init();

            // Apply saved theme
            SettingsManager.applyTheme(SettingsManager.getTheme());

            // Setup navigation
            this.setupNavigation();

            // sidebar toggle
            this.initSidebarToggle();

            // Setup routing
            this.setupRouter();

            // Initial route
            this.route();

            // Set app title
            const appTitleText = document.getElementById('app-title');
            if (appTitleText) {
                appTitleText.textContent  = `${APP_CONFIG.APP_TITLE} `;
            }

            // Display app name
            const appNameText = document.getElementById('app-name');
            if (appNameText) {
                appNameText.textContent  = `${APP_CONFIG.APP_NAME} `;
            }

            // Display version numbers
            const appVersionText = document.getElementById('app-version');
            if (appVersionText) {
                const targetVersion = await DataManager.getTargetVersion();
                appVersionText.textContent += `v${APP_CONFIG.APP_VERSION} `;
                appVersionText.textContent += `d${APP_CONFIG.DB_VERSION} `;
                appVersionText.textContent += `t${targetVersion || 'none'}`;
            }

            // Auto-calculate Best Months for selected location if needed
            const selectedLocation = SettingsManager.getSelectedLocation();
            if (selectedLocation && !UIManager.locationHasBestMonths(selectedLocation)) {
                await UIManager.autoCalculateBestMonths(selectedLocation);
            }

            console.log(APP_CONFIG.APP_NAME + ' initialized successfully');
        } catch (error) {
            console.error('Failed to initialize' + APP_CONFIG.APP_NAME + ':', error);
            this.showInitializationError(error);
        }
    },

    /**
     * Check for target database updates via fetch
     */
    async checkForTargetUpdates() {
        const meta = await DataManager.fetchTargetMeta();
        if (!meta) return; // Offline or no meta file - skip silently

        const storedVersion = await DataManager.getTargetVersion();
        const currentVersion = storedVersion ? String(storedVersion) : null;
        const metaVersion = String(meta.version);

        if (currentVersion === metaVersion) {
            console.log(`Target database is current (version ${currentVersion})`);
            return;
        }

        console.log(`Target database update available: ${currentVersion || 'none'} → ${metaVersion}`);
        const loaded = await DataManager.fetchAndLoadTargets(meta);
        if (loaded) {
            TargetFilter.initialize();
            setTimeout(() => location.reload(), 500);
        }
    },

    /**
     * Setup navigation event handlers
     */
    setupNavigation() {
        // Sidebar navigation items
        const navItems = document.querySelectorAll('.nav-item');
        navItems.forEach(item => {
            item.addEventListener('click', (e) => {
                e.preventDefault();
                const view = item.dataset.view;
                if (view) {
                    // Handle modal-based nav items
                    if (view === 'daily-visibility') {
                        UIManager.openDailyVisibilityModal();
                        return;
                    }
                    if (view === 'yearly-observability') {
                        UIManager.openYearlyObservabilityModal();
                        return;
                    }

                    // If clicking on visibility while already on visibility, hide yearly observability container
                    if (view === 'target-select' && window.location.hash === '#target-select') {
                        const yearlyObservabilityContainer = document.getElementById('yearly-observability-container');
                        if (yearlyObservabilityContainer) {
                            yearlyObservabilityContainer.remove();
                        }
                        const twoColGrid = document.querySelector('.ts-two-col-grid');
                        if (twoColGrid) {
                            twoColGrid.style.display = 'grid';
                        }

                        // Force the view to re-render which will reset the title
                        this.loadView('visibility');
                        return; // Don't continue to the hash setting
                    }

                    window.location.hash = `#${view}`;
                }
            });
        });

        // App title click returns to home
        const appTitle = document.querySelector('.sidebar-header h1');
        if (appTitle) {
            appTitle.addEventListener('click', () => {
                // Same cleanup logic when clicking the app title
                const yearlyObservabilityContainer = document.getElementById('yearly-observability-container');
                if (yearlyObservabilityContainer) {
                    yearlyObservabilityContainer.remove();
                }
                const twoColGrid = document.querySelector('.ts-two-col-grid');
                if (twoColGrid) {
                    twoColGrid.style.display = 'grid';
                }

                window.location.hash = '#target-select';
            });
        }
    },


    initSidebarToggle() {
        const sidebar = document.querySelector('.sidebar');
        const toggleBtn = document.getElementById('sidebar-toggle');

        if (sidebar && toggleBtn) {
            toggleBtn.addEventListener('click', () => {
                sidebar.classList.toggle('collapsed');

                // Save state
                const isCollapsed = sidebar.classList.contains('collapsed');
                localStorage.setItem('sidebarCollapsed', isCollapsed);
            });

            // Restore state on load
            const savedState = localStorage.getItem('sidebarCollapsed');
            if (savedState === 'true') {
                sidebar.classList.add('collapsed');
            }
        } else {
            console.log('Sidebar or toggle button not found!');
        }
    },


    /**
     * Setup hash-based router
     */
    setupRouter() {
        window.addEventListener('hashchange', () => {
            this.route();
        });
    },

    /**
     * Route to appropriate view based on hash
     */
    route() {
        const hash = window.location.hash.slice(1) || 'visibility';
        const [view, queryString] = hash.split('?');
        const params = this.parseQueryString(queryString);

        this.loadView(view, params);
    },

    /**
     * Parse query string into object
     */
    parseQueryString(queryString) {
        if (!queryString) return {};

        const params = {};
        queryString.split('&').forEach(param => {
            const [key, value] = param.split('=');
            params[key] = decodeURIComponent(value);
        });

        return params;
    },

    /**
     * Load a view
     */
    loadView(viewName, params = {}) {
        console.log('LOAD VIEW:', viewName);

        // Cleanup current view
        if (this.currentView && this.currentView.destroy) {
            this.currentView.destroy();
        }

        // Get container
        const container = document.getElementById('app');
        if (!container) {
            console.error('App container not found');
            return;
        }
        this.container = container;

        // Update sidebar active state
        this.updateSidebarActiveState(viewName);

        // Load appropriate view
        switch (viewName) {
            /* to do list */
        case 'todo':
            this.currentView = ToDoView;
            ToDoView.render(container, params);
            break;

            /* target selection */
        case 'target-select':
            this.currentView = TargetSelectionView;
            TargetSelectionView.render(container, params);
            break;

        case 'daily-visibility':
            UIManager.openDailyVisibilityModal();
            break;

        case 'results':
            this.currentView = ResultsView;
            ResultsView.render(container, params);
            break;

        case 'skyglow':
            this.currentView = SkyglowView;
            SkyglowView.render(container, params);
            break;

            /* yearly observability */
        case 'yearly-observability':
            this.currentView = YearlyObservabilityView;
            YearlyObservabilityView.render(container, params);
            break;

            /* field of view */
        case 'fov':
            this.currentView = FOVView;
            FOVView.render();
            break;

            /* sequence planner */
        case 'seqplan':
            document.getElementById('app').innerHTML = '';
            const seqPlanTemplate = document.getElementById('seq-plan-view-template');
            const seqPlanContent = seqPlanTemplate.content.cloneNode(true);
            document.getElementById('app').appendChild(seqPlanContent);
            SeqPlanView.init();
            break;

            /* imaging log */
        case 'imaging-log':
            document.getElementById('app').innerHTML = '';
            const imagingLogTemplate = document.getElementById('imaging-log-view-template');
            const imagingLogContent = imagingLogTemplate.content.cloneNode(true);
            document.getElementById('app').appendChild(imagingLogContent);
            ImagingLogView.init();
            break;

            /* utilities */
        case 'utilities':
            document.getElementById('app').innerHTML = '';
            const utilitiesTemplate = document.getElementById('utilities-view-template');
            const utilitiesContent = utilitiesTemplate.content.cloneNode(true);
            document.getElementById('app').appendChild(utilitiesContent);
            UtilitiesView.init();
            break;

            /* target optimizer */
        case 'optimizer':
            document.getElementById('app').innerHTML = '';
            const optimizerTemplate = document.getElementById('optimizer-view-template');
            const optimizerContent = optimizerTemplate.content.cloneNode(true);
            document.getElementById('app').appendChild(optimizerContent);
            OptimizerView.init();
            break;

        default:
            // Default to target selection
            window.location.hash = '#target-select';
            break;
        }
    },

    /**
     * Update sidebar active state (disabled - no highlighting)
     */
    updateSidebarActiveState(viewName) {
        // Do nothing - sidebar items remain unhighlighted
    },

    /**
     * Show initialization error
     */
    showInitializationError(error) {
        const template = document.getElementById('initialization-error-template');
        if (template) {
            const content = template.content.cloneNode(true);
            const errorDetails = content.getElementById('error-details');
            if (errorDetails) {
                errorDetails.textContent = error.message || 'Unknown error';
            }

            document.body.innerHTML = '';
            document.body.appendChild(content);
        } else {
            document.body.innerHTML = `
                <div style="display: flex; align-items: center; justify-content: center; height: 100vh; flex-direction: column; text-align: center; padding: 2rem;">
                    <h1 style="color: #ef4444; margin-bottom: 1rem;">Initialization Error</h1>
                    <p>${APP_CONFIG.APP_NAME} failed to initialize properly.</p>
                    <p style="color: #666; font-family: monospace; margin: 1rem 0;">${error.message || 'Unknown error'}</p>
                    <button onclick="location.reload()" style="padding: 0.75rem 1.5rem; background: #3b82f6; color: white; border: none; border-radius: 6px; cursor: pointer; margin: 0.5rem;">
                        Reload Application
                    </button>
                    <button onclick="localStorage.clear(); indexedDB.deleteDatabase(${APP_CONFIG.DB_NAME}); location.reload()" style="padding: 0.75rem 1.5rem; background: #ef4444; color: white; border: none; border-radius: 6px; cursor: pointer; margin: 0.5rem;">
                        Clear Data & Reload
                    </button>
                </div>
            `;
        }
    }
};

// Initialize app when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => App.init());
} else {
    App.init();
}

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

        let cliCommand = null;
        let targetsReloadPending = false;
        try {
            // Initialize database
            await DBManager.init();

            // A command-line run (desktop, issue #292) loads the stored data
            // its task needs, runs it and exits, with none of the startup
            // side effects below: no target update, backups, tutorials or toasts
            cliCommand = await CliTasks.getCommand();
            if (cliCommand) {
                await this.loadStoredData();
                await CliTasks.run(cliCommand);
                return;
            }

            await this.loadStoredData();
            TargetFilter.initialize();
            await ToDoManager.init();

            // Check for target database updates
            targetsReloadPending = await this.checkForTargetUpdates();

            // Initialize UI
            UIManager.init();
            DropdownPosition.init();

            // Populate sidebar pinned targets strip (persistent across all views)
            VisibilityTargets.updatePinnedDisplay();

            // Apply saved theme
            SettingsManager.applyTheme(SettingsManager.getTheme());
            SettingsManager.applyFontSize(SettingsManager.getFontSize());

            // Setup navigation
            this.setupNavigation();

            // Global delegated handler to close all custom dropdowns
            document.addEventListener('click', () => {
                document.querySelectorAll('.astryx-dropdown.open').forEach(d => d.classList.remove('open'));
            });

            // sidebar toggle
            this.initSidebarToggle();
            this.initSidebarResize();

            // Setup routing
            this.setupRouter();

            // Views showing stored target data re-render when it changes. The
            // targets were reloaded either way, so the current target becomes
            // the new record (Issue #333)
            document.addEventListener('targets-updated', () => {
                VisibilityTargets.refreshCurrentTarget();
                this.refreshTargetDataView();
            });
            document.addEventListener('best-months-updated', (e) => {
                VisibilityTargets.refreshCurrentTarget();
                if (e.detail.locationName === SettingsManager.getSelectedLocation()) {
                    this.refreshTargetDataView();
                }
            });

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
        } catch (error) {
            console.error('Failed to initialize ' + APP_CONFIG.APP_NAME + ':', error);
            if (cliCommand) {
                await CliTasks.fail(error);
                return;
            }
            this.showInitializationError(error);
            return;
        }

        // The app is usable from here: a failed step shows a toast and the
        // steps after it still run (Issue #356)
        await this.startupStep('The first view', () => this.route());
        await this.startupStep('The version display', () => App.updateVersionDisplay());

        // Initialize auto-backup timer (resume if pending from last session)
        await this.startupStep('Automatic backups', () => BackupManager.initAutoBackup());

        // Initialize backup reminder system
        await this.startupStep('The backup reminder', () => BackupReminder.init());

        // Clear expired sky images once per start, off the startup path
        setTimeout(() => DSSCache.purge(), APP_CONFIG.DSS_PURGE_DELAY_MS);

        // A restore reloads at once, and says it worked here (Issue #354)
        const restoredMessage = localStorage.getItem(BackupManagerWeb.RESTORED_MESSAGE_KEY);
        if (restoredMessage) {
            localStorage.removeItem(BackupManagerWeb.RESTORED_MESSAGE_KEY);
            UIManager.showToast(restoredMessage, 'success');
        }

        await this.startupStep('Tutorials', async () => {
            // Resume tutorial if flagged before a reload
            const resumeTutorial = localStorage.getItem('resumeTutorialAfterReload');
            if (resumeTutorial) {
                localStorage.removeItem('resumeTutorialAfterReload');
                setTimeout(() => TutorialEngine.start(resumeTutorial), 500);
            }

            // Check for in-progress tutorial and update menu accordingly
            const inProgressTutorial = await TutorialManager.findInProgressTutorial();
            UIManager.updateTutorialMenuItems(inProgressTutorial);
        });

        await this.startupStep('Removing Best Months of deleted locations',
            () => DataManager.pruneDroppedLocations());

        // Offer a newer target database from astryx.tools (desktop), then
        // calculate Best Months the selected location lacks, and those a
        // catalogue update removed (skip if a target-DB reload is pending —
        // it would kill the calc mid-run)
        await this.startupStep('Target database update and Best Months', async () => {
            if (!targetsReloadPending && !await this.offerRemoteTargetUpdate()) {
                await UIManager.calculateMissingBestMonths();
            }
        });

        console.log(APP_CONFIG.APP_NAME + ' initialized successfully');
    },

    /**
     * Run one start-up step the app can do without: a failure is reported
     * and leaves the app running (Issue #356)
     */
    async startupStep(what, step) {
        try {
            await step();
        } catch (error) {
            console.error(`${what} failed at start-up:`, error);
            UIManager.showToast(`${what} failed: ${error.message}`, 'error', APP_CONFIG.TOAST_LONG_DURATION_MS);
        }
    },

    /**
     * Load the stored settings and data, stopping start-up when either read
     * fails. Carrying on with the defaults would save them over every stored
     * setting at the next change (Issue #347).
     */
    async loadStoredData() {
        if (!await SettingsManager.init()) throw this.storedDataError('settings');
        if (!await DataManager.init()) throw this.storedDataError('data');
    },

    /**
     * A failed read: the stored data is untouched, so the error page offers
     * a reload, not Clear Data (Issue #347)
     */
    storedDataError(what) {
        const error = new Error(`${APP_CONFIG.APP_NAME} couldn't read its ${what}`);
        error.storedDataIntact = true;
        return error;
    },

    /**
     * Load a newer bundled target database. Automatic: a new one comes with
     * an installed release (or a web deploy).
     */
    async checkForTargetUpdates() {
        const source = await DataManager.fetchNewestTargetMeta([DataManager.bundledTargetSource()]);
        if (!source || !await DataManager.isNewerThanStored(source.meta)) return false;

        const loaded = await DataManager.fetchAndLoadTargets(source.meta, source.base);
        if (loaded) {
            TargetFilter.initialize();
            setTimeout(() => location.reload(), 500);
        }
        return loaded; // true = reload scheduled; caller should skip further init work
    },

    /**
     * Desktop: offer a newer target database from astryx.tools (Issue #344).
     * Asked before anything is downloaded, so No leaves the targets and
     * their Best Months as they were. True when a reload is scheduled.
     */
    async offerRemoteTargetUpdate() {
        if (!DataManager.remoteTargetsEnabled()) return false;
        const source = await DataManager.fetchNewestTargetMeta([DataManager.remoteTargetSource()]);
        if (!source || !await DataManager.isNewerThanStored(source.meta)) return false;

        const confirmed = await UIManager.confirm(
            `A newer target database is available (${source.meta.count.toLocaleString()} targets, ` +
                `was ${DataManager.getTargets().length.toLocaleString()}). Update now?\n\n` +
                'Astryx will reload and recalculate Best Months for your locations.'
        );
        return confirmed && UIManager.installTargetUpdate(source);
    },

    /**
     * The versions the sidebar line and About show, from one place so the
     * two can't disagree. On desktop the database schema version is
     * SQLite's, not DB_VERSION (Issue #363).
     */
    async versionInfo() {
        const database = DBManager.databaseInfo();
        return {
            app: APP_CONFIG.APP_VERSION,
            schemaLetter: database.letter,
            schemaVersion: database.schemaVersion,
            schema: BackupManagerWeb.describeSchemaVersion(database.schemaVersion, database.platform),
            target: await DataManager.getTargetVersion() ?? 'none',
            folder: database.folder,
        };
    },

    async updateVersionDisplay() {
        const appVersionText = document.getElementById('app-version');
        if (appVersionText) {
            const v = await this.versionInfo();
            appVersionText.textContent = `v${v.app} ${v.schemaLetter}${v.schemaVersion} t${v.target}`;
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
                        UIManager.createDailyVisibilityChart();
                        return;
                    }

                    if (view === 'yearly-observability') {
                        UIManager.createYearlyObservabilityChart();
                        return;
                    }

                    // Already on Target Selection: the hash won't change, so re-render directly
                    if (view === 'target-select' && window.location.hash === '#target-select') {
                        this.loadView('target-select');
                        return;
                    }

                    window.location.hash = `#${view}`;
                }
            });
        });

        // App title click returns to home
        const appTitle = document.querySelector('.sidebar-header h1');
        if (appTitle) {
            appTitle.addEventListener('click', () => {
                window.location.hash = '#target-select';
            });
        }
    },


    // Drag the sidebar's right edge to set its width; double-click resets it (Issue #285)
    initSidebarResize() {
        const sidebar = document.querySelector('.sidebar');
        const resizer = sidebar?.querySelector('.sidebar-resizer');
        if (!resizer) {
            Log.debug('Sidebar resizer not found!');
            return;
        }

        const minRem = APP_CONFIG.SIDEBAR_MIN_WIDTH_REM;
        const maxRem = APP_CONFIG.SIDEBAR_MAX_WIDTH_REM;
        const setWidth = (rem) => sidebar.style.setProperty('--sidebar-width', `${rem}rem`);
        const saveWidth = (rem) => {
            try {
                if (rem === null) localStorage.removeItem('sidebarWidthRem');
                else localStorage.setItem('sidebarWidthRem', rem);
            } catch (e) {
                Log.debug('Sidebar width not saved:', e);
            }
        };

        let saved = null;
        try {
            saved = parseFloat(localStorage.getItem('sidebarWidthRem'));
        } catch (e) {
            Log.debug('Sidebar width not read:', e);
        }
        if (Number.isFinite(saved)) setWidth(Math.min(maxRem, Math.max(minRem, saved)));

        let widthRem = null;
        resizer.addEventListener('pointerdown', (e) => {
            if (e.button !== 0) return;
            e.preventDefault();
            resizer.setPointerCapture(e.pointerId);
            sidebar.classList.add('resizing');
            widthRem = null;
        });
        resizer.addEventListener('pointermove', (e) => {
            if (!resizer.hasPointerCapture(e.pointerId)) return;
            const remPx = parseFloat(getComputedStyle(document.documentElement).fontSize);
            const px = e.clientX - sidebar.getBoundingClientRect().left;
            widthRem = Math.min(maxRem, Math.max(minRem, px / remPx));
            setWidth(widthRem);
        });
        const endDrag = (e) => {
            if (!resizer.hasPointerCapture(e.pointerId)) return;
            resizer.releasePointerCapture(e.pointerId);
            sidebar.classList.remove('resizing');
            if (widthRem !== null) saveWidth(widthRem);
        };
        resizer.addEventListener('pointerup', endDrag);
        resizer.addEventListener('pointercancel', endDrag);
        resizer.addEventListener('dblclick', () => {
            sidebar.style.removeProperty('--sidebar-width');
            saveWidth(null);
        });
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
            Log.debug('Sidebar or toggle button not found!');
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

    refreshTargetDataView() {
        if (this.currentView?.showsTargetData) {
            this.route();
        }
    },

    /**
     * Route to appropriate view based on hash
     */
    route() {
        // Anything after a ? is ignored: no view takes parameters, and
        // decoding a stray % stopped start-up (Issue #356)
        const hash = window.location.hash.slice(1) || 'visibility';
        this.loadView(hash.split('?')[0]);
    },

    /**
     * Load a view
     */
    loadView(viewName) {
        Log.debug('LOAD VIEW:', viewName);

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
            ToDoView.render(container);
            break;

            /* target selection */
        case 'target-select':
            this.currentView = TargetSelectionView;
            TargetSelectionView.render(container);
            break;

        case 'daily-visibility':
            this.currentView = DailyVisibilityView;
            DailyVisibilityView.render(container);
            break;

            /* yearly observability */
        case 'yearly-observability':
            this.currentView = YearlyObservabilityView;
            YearlyObservabilityView.render(container);
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
            this.currentView = SeqPlanView;
            SeqPlanView.init();
            break;

            /* imaging log */
        case 'imaging-log':
            document.getElementById('app').innerHTML = '';
            const imagingLogTemplate = document.getElementById('imaging-log-view-template');
            const imagingLogContent = imagingLogTemplate.content.cloneNode(true);
            document.getElementById('app').appendChild(imagingLogContent);
            this.currentView = ImagingLogView;
            ImagingLogView.init();
            break;

            /* log analysis */
        case 'log-analysis':
            document.getElementById('app').innerHTML = '';
            const logAnalysisTemplate = document.getElementById('log-analysis-view-template');
            const logAnalysisContent = logAnalysisTemplate.content.cloneNode(true);
            document.getElementById('app').appendChild(logAnalysisContent);
            this.currentView = LogAnalysisView;
            LogAnalysisView.init();
            break;

            /* utilities */
        case 'utilities':
            document.getElementById('app').innerHTML = '';
            const utilitiesTemplate = document.getElementById('utilities-view-template');
            const utilitiesContent = utilitiesTemplate.content.cloneNode(true);
            document.getElementById('app').appendChild(utilitiesContent);
            this.currentView = UtilitiesView;
            UtilitiesView.init();
            break;

        /* target optimizer */
        case 'optimizer':
            document.getElementById('app').innerHTML = '';
            const optimizerTemplate = document.getElementById('optimizer-view-template');
            const optimizerContent = optimizerTemplate.content.cloneNode(true);
            document.getElementById('app').appendChild(optimizerContent);
            this.currentView = OptimizerView;
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
        const content = document.getElementById('initialization-error-template').content.cloneNode(true);
        content.getElementById('error-details').textContent = error.message ?? 'Unknown error';
        // A failed read changed nothing: say so (Issue #347)
        if (error.storedDataIntact) {
            content.getElementById('init-error-cause').hidden = true;
            content.getElementById('init-error-data-intact').hidden = false;
        }
        // Nothing on this page deletes data: the web explains clearing it in
        // the browser, and desktop says where its database is (Issue #356)
        if (DBManager === DBManagerTauri) {
            content.getElementById('init-error-database-path').textContent = DBManager.databaseInfo()?.folder
                ?? "the folder the User Guide's \"Where Astryx Keeps Your Data\" names";
            content.getElementById('init-error-desktop-help').hidden = false;
        } else {
            content.getElementById('init-error-web-help').hidden = false;
        }

        document.body.innerHTML = '';
        document.body.appendChild(content);

        document.querySelector('[data-action="reload"]').addEventListener('click', () => location.reload());
    }
};

// Initialize app when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => App.init());
} else {
    App.init();
}

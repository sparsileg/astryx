/**
 * imaging-log-view.js
 * UI controller for Imaging Log view
 */

const ImagingLogView = {
    currentTab: 'projects',
    currentProjectId: null,
    currentSessionId: null,
    expandedProjectIds: new Set(),
    selectedTargets: [],
    _projectListRenderId: 0, // Issue #334: a render overtaken by a newer one is dropped

    /**
     * Initialize view
     */
    async init() {
        Log.debug('Initializing Imaging Log View');

        // Set up tab switching
        const tabButtons = document.querySelectorAll('.imaging-log-tab-btn');
        tabButtons.forEach(btn => {
            btn.addEventListener('click', (e) => {
                this.switchTab(e.target.dataset.tab);
            });
        });

        // Set up project controls
        this.setupProjectControls();

        // Load initial data
        await this.renderProjectList();
    },

    /**
     * Setup project tab controls
     */
    setupProjectControls() {
        // New project button
        const newProjectBtn = document.getElementById('imaging-log-new-project-btn');
        if (newProjectBtn) {
            newProjectBtn.addEventListener('click', () => this.showProjectModal());
        }

        // Search input
        const searchInput = document.getElementById('imaging-log-project-search');
        if (searchInput) {
            // Issue #334: render once typing pauses
            searchInput.addEventListener('input', () => {
                clearTimeout(this._projectSearchTimeout);
                this._projectSearchTimeout = setTimeout(() => this.renderProjectList(), APP_CONFIG.SEARCH_DEBOUNCE_MS);
            });
            // Issue #99: ✕ empties the search and shows the list again
            document.getElementById('imaging-log-project-search-clear')?.addEventListener('click', () => {
                clearTimeout(this._projectSearchTimeout);
                searchInput.value = '';
                searchInput.focus();
                this.renderProjectList();
            });
        }

        // Status filter dropdown
        const statusTrigger = document.getElementById('imaging-log-status-trigger');
        const statusDropdown = document.getElementById('imaging-log-status-dropdown');
        const statusMenu = document.getElementById('imaging-log-status-menu');
        if (statusTrigger && statusDropdown && statusMenu && !statusTrigger._listenerAttached) {
            statusTrigger._listenerAttached = true;
            statusTrigger.addEventListener('click', (e) => {
                e.stopPropagation();
                statusDropdown.classList.toggle('open');
            });
            statusMenu.addEventListener('click', (e) => {
                e.stopPropagation();
                const item = e.target.closest('.astryx-dropdown-item');
                if (!item) return;
                statusMenu.querySelectorAll('.astryx-dropdown-item').forEach(i => i.classList.remove('selected'));
                item.classList.add('selected');
                document.getElementById('imaging-log-status-label').textContent = item.textContent;
                statusDropdown.classList.remove('open');
                this.renderProjectList();
            });
        }

        // Sort dropdown
        const sortTrigger = document.getElementById('imaging-log-sort-trigger');
        const sortDropdown = document.getElementById('imaging-log-sort-dropdown');
        const sortMenu = document.getElementById('imaging-log-sort-menu');
        if (sortTrigger && sortDropdown && sortMenu && !sortTrigger._listenerAttached) {
            sortTrigger._listenerAttached = true;
            sortTrigger.addEventListener('click', (e) => {
                e.stopPropagation();
                sortDropdown.classList.toggle('open');
            });
            sortMenu.addEventListener('click', (e) => {
                e.stopPropagation();
                const item = e.target.closest('.astryx-dropdown-item');
                if (!item) return;
                sortMenu.querySelectorAll('.astryx-dropdown-item').forEach(i => i.classList.remove('selected'));
                item.classList.add('selected');
                document.getElementById('imaging-log-sort-label').textContent = item.textContent;
                sortDropdown.classList.remove('open');
                this.renderProjectList();
            });
        }
    },

    /**
     * Switch tabs
     */
    async switchTab(tabName) {
        this.currentTab = tabName;

        // Update tab buttons
        document.querySelectorAll('.imaging-log-tab-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.tab === tabName);
        });

        // Update tab content
        document.querySelectorAll('.imaging-log-tab-content').forEach(content => {
            const isActive = content.id === `imaging-log-${tabName}-tab`;
            content.classList.toggle('active', isActive);
        });

        // Load content for tab (always re-render to ensure fresh data)
        if (tabName === 'projects') {
            await this.renderProjectList();
        } else if (tabName === 'programs') {
            this.setupProgramControls();
            await this.renderProgramsList();
        } else if (tabName === 'reports') {
            await this.renderReports();
        } else if (tabName === 'activity') {
            await ImagingLogActivityView.render();
        }
    },

    /**
     * Render project list
     */
    async renderProjectList() {
        const container = document.getElementById('imaging-log-projects-list');
        if (!container) return;

        if (!container._listenerAttached) {
            container._listenerAttached = true;
            container.addEventListener('click', (e) => {
                const actionEl = e.target.closest('[data-action]');
                if (!actionEl) return;
                const action = actionEl.dataset.action;
                if (action === 'noop') return;

                const projectId = actionEl.dataset.projectId ? parseInt(actionEl.dataset.projectId) : null;
                const sessionId = actionEl.dataset.sessionId ? parseInt(actionEl.dataset.sessionId) : null;

                switch (action) {
                case 'toggle-project-sessions':
                    this.toggleProjectSessions(projectId);
                    break;
                case 'delete-project':
                    this.handleDeleteProject(projectId);
                    break;
                case 'edit-project':
                    this.handleEditProject(projectId);
                    break;
                case 'add-session':
                    this.showSessionModal(null, projectId);
                    break;
                case 'show-session':
                    this.showSessionModal(sessionId, projectId);
                    break;
                case 'delete-session':
                    this.deleteSession(sessionId);
                    break;
                }
            });
        }

        const expandedProjects = this.expandedProjectIds;
        // Issue #334: every project and session read once, not per card
        const renderId = ++this._projectListRenderId;
        const [projects, sessions] = await Promise.all([
            ImagingLogManager.getAllProjects(),
            ImagingLogManager.getAllSessions(),
        ]);
        if (renderId !== this._projectListRenderId) return;
        const sessionsByProject = ImagingLogManager.groupSessionsByProject(sessions);

        // Apply filters
        const searchQuery = document.getElementById('imaging-log-project-search')?.value.toLowerCase() ?? '';
        const statusFilter = document.getElementById('imaging-log-status-menu')?.querySelector('.astryx-dropdown-item.selected')?.dataset.value ?? '';

        let filteredProjects;

        if (searchQuery) {
            // Search always scans all projects, ignoring status filter
            filteredProjects = projects.filter(project => {
                const nameMatch = project.name.toLowerCase().includes(searchQuery);
                const targetMatch = project.targetDesignations.some(designation =>
                    designation.toLowerCase().includes(searchQuery)
                );
                return nameMatch || targetMatch;
            });
        } else {
            // No search   apply status filter to displayed list
            filteredProjects = projects.filter(project => {
                if (statusFilter) {
                    if (statusFilter === 'all-but-completed') {
                        if (project.status === 'Completed') return false;
                    } else if (project.status !== statusFilter) {
                        return false;
                    }
                }
                return true;
            });
        }

        // Apply sort
        const sortValue = document.getElementById('imaging-log-sort-menu')?.querySelector('.astryx-dropdown-item.selected')?.dataset.value ?? 'modified-desc';
        filteredProjects = this.sortProjects(filteredProjects, sortValue);

        if (filteredProjects.length === 0) {
            container.innerHTML = '<p class="empty-message">No projects found. Create your first project!</p>';
            return;
        }

        container.innerHTML = filteredProjects
            .map(project => this.renderProjectCard(project, sessionsByProject.get(project.id) ?? []))
            .join('');

        // Restore expanded state
        expandedProjects.forEach(projectId => {
            const sessionsContainer = document.getElementById(`project-sessions-${projectId}`);
            const chevron = document.getElementById(`chevron-${projectId}`);
            const addButton = document.getElementById(`add-session-btn-${projectId}`);
            if (sessionsContainer) {
                sessionsContainer.classList.add('expanded');
                sessionsContainer.style.maxHeight = sessionsContainer.scrollHeight + 'px';
                if (chevron) chevron.classList.add('expanded');
                if (addButton) addButton.hidden = false;
            }
        });
    },

    /**
     * Render a single project card from its sessions
     */
    renderProjectCard(project, sessions) {
        const integrationTime = ImagingLogManager.integrationTimeByFilter(sessions);
        const integrationHTML = Object.entries(integrationTime)
              .filter(([filter, seconds]) => seconds > 0)
              .map(([filter, seconds]) => `${HtmlUtils.escapeHtml(filter)}: ${this.formatIntegrationTime(seconds)}`)
              .join(' &nbsp; ');

        sessions.sort((a, b) => new Date(a.date) - new Date(b.date));

        const statusClass = HtmlUtils.escapeHtml(this.getStatusClass(project.status));
        // Escaped: on the web, a restored record keeps the id it has in the file (Issue #362)
        const projectId = HtmlUtils.escapeHtml(project.id);
        const lastModified = TimeUtils.formatDisplayDate(TimeUtils.formatDateForInput(new Date(project.modified)));

        const sessionsId = `project-sessions-${projectId}`;

        return `
            <div class="project-card" data-project-id="${projectId}">
                <div class="project-card-header" data-action="toggle-project-sessions" data-project-id="${projectId}">
                    <div class="project-card-heading">
                        <div class="project-card-title">
                    ${HtmlUtils.escapeHtml(project.name)}
                    ${project.publishedLink
                        ? `<a href="${HtmlUtils.escapeHtml(project.publishedLink)}" target="_blank" rel="noopener noreferrer"
                              title="View published image" class="project-published-link" data-action="noop">🔗</a>`
                        : `<span title="Edit project to add published image link" class="project-published-link-inactive">🔗</span>`
                    }
                </div>
                    </div>
                    <div class="project-card-actions">
                        <button class="project-action-btn btn-danger btn-small"
                                data-action="delete-project" data-project-id="${projectId}">
                            Delete Project
                        </button>
                        <button class="project-action-btn btn-secondary btn-small"
                                data-action="edit-project" data-project-id="${projectId}">
                            Edit Project
                        </button>
                    </div>
                </div>

                <div class="project-card-meta" data-action="toggle-project-sessions" data-project-id="${projectId}">
                    <span>Targets: ${project.targetDesignations.length}</span>
                    <span>Sessions: ${sessions.length}</span>
                    ${integrationHTML ? `<span class="imaging-session-integration">${integrationHTML}</span>` : '<span>Integration: -</span>'}
                    <span class="project-status-badge ${statusClass}">${HtmlUtils.escapeHtml(project.status)}</span>
                    <span>Modified: ${lastModified}</span>
                </div>

                <!-- Sessions Toggle Row -->
                <div class="project-sessions-toggle" data-action="toggle-project-sessions" data-project-id="${projectId}">
                    <span class="sessions-chevron" id="chevron-${projectId}">▶</span>
                    <span class="sessions-label">Imaging Sessions</span>
                    <button class="btn-secondary btn-sm add-session-btn"
                            id="add-session-btn-${projectId}"
                            hidden
                            data-action="add-session" data-project-id="${projectId}">
                        + Add Session
                    </button>
                </div>

                <!-- Sessions Section (Collapsible) -->
                <div id="${sessionsId}" class="project-sessions-container">
                    ${sessions.length > 0 ? `
            <table class="session-table">
            <thead>
            <tr>
            <th>Date</th>
            <th>Filter</th>
            <th><span class="tooltip-host has-tip" data-tooltip-key="ilog_sessionExposures">Exposures</span></th>
            <th>Integration</th>
            <th>Location</th>
            <th>Actions</th>
            </tr>
            </thead>
            <tbody>
            ${sessions.map(session => {
                const exposureCount = session.usedExposures !== undefined && session.usedExposures !== ''
                      ? session.usedExposures
                      : 0;
                const integrationSeconds = session.subLength * exposureCount;
                return `
                                        <tr data-action="show-session" data-session-id="${HtmlUtils.escapeHtml(session.id)}" data-project-id="${projectId}">
                                            <td>${TimeUtils.formatDisplayDate(session.date)}</td>
                                            <td>${HtmlUtils.escapeHtml(session.filter)}</td>
                                            <td>${exposureCount} × ${session.subLength}s</td>
                                            <td>${this.formatIntegrationTime(integrationSeconds)}</td>
                                            <td>${HtmlUtils.escapeHtml(session.location)}</td>
                                            <td>
                                                <button class="btn-danger btn-sm"
                                                        data-action="delete-session" data-session-id="${HtmlUtils.escapeHtml(session.id)}">
                                                    Delete
                                                </button>
                                            </td>
                                        </tr>
                                    `;
            }).join('')}
        </tbody>
            </table>
            ` : '<p class="imaging-log-empty">No sessions yet.</p>'}
                </div>
            </div>
        `;
    },

    /**
     * Sort projects
     */
    sortProjects(projects, sortValue) {
        const sorted = [...projects];

        switch (sortValue) {
        case 'modified-desc':
            sorted.sort((a, b) => new Date(b.modified) - new Date(a.modified));
            break;
        case 'modified-asc':
            sorted.sort((a, b) => new Date(a.modified) - new Date(b.modified));
            break;
        case 'name-asc':
            sorted.sort((a, b) => a.name.localeCompare(b.name));
            break;
        case 'name-desc':
            sorted.sort((a, b) => b.name.localeCompare(a.name));
            break;
        case 'status':
            const statusOrder = ['Planning', 'Acquiring Data', 'Acquisition Complete', 'Processing', 'Completed'];
            sorted.sort((a, b) => statusOrder.indexOf(a.status) - statusOrder.indexOf(b.status));
            break;
        }

        return sorted;
    },

    /**
     * Show project modal (create or edit)
     */
    async showProjectModal(projectId = null) {
        this.currentProjectId = projectId;
        this.selectedTargets = [];

        const title = projectId ? 'Edit Project' : 'New Project';

        this.openModal('manage-project-template', title, (action, modalBody) => {
            if (action === 'save') {
                ImagingLogView.handleSaveProject(modalBody);
            }
        });

        setTimeout(async () => {
            await this.initializeProjectModal(projectId);
        }, 0);
    },

    /**
     * Initialize project modal
     */
    async initializeProjectModal(projectId) {
        this._wireSessionDropdown('project-status-trigger', 'project-status-dropdown', 'project-status-menu', 'project-status-label');
        const expandBtn = document.getElementById('project-notes-expand-btn');
        const notesTextarea = document.getElementById('project-notes');
        if (expandBtn && notesTextarea) {
            let expanded = false;
            expandBtn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                expanded = !expanded;
                if (expanded) {
                    notesTextarea.classList.add('project-notes-expanded');
                    expandBtn.textContent = 'Collapse';
                    requestAnimationFrame(() => {
                        requestAnimationFrame(() => {
                            notesTextarea.scrollTop = notesTextarea.scrollHeight;
                            const modalBody = document.getElementById('modal-body');
                            if (modalBody) modalBody.scrollTop = modalBody.scrollHeight;
                        });
                    });
                } else {
                    notesTextarea.classList.remove('project-notes-expanded');
                    expandBtn.textContent = 'Expand';
                }
            });
        } else {
            Log.debug('Elements not found!');
        }
        // Set up target search
        const searchInput = document.getElementById('project-target-search');
        if (searchInput) {
            // Issue #314: search once typing pauses
            searchInput.addEventListener('input', (e) => {
                clearTimeout(this._projectTargetSearchTimeout);
                const query = e.target.value;
                this._projectTargetSearchTimeout = setTimeout(() => this.searchTargetsForProject(query), APP_CONFIG.SEARCH_DEBOUNCE_MS);
            });
        }
        if (projectId) {
            const project = await ImagingLogManager.getProject(projectId);
            document.getElementById('project-name').value = project.name;
            this._setSessionDropdownValue('project-status-menu', 'project-status-label', project.status);
            document.getElementById('project-published-link').value = project.publishedLink ?? '';
            document.getElementById('project-notes').value = project.notes ?? '';
            this.selectedTargets = [...project.targetDesignations];
            this.renderSelectedTargets();
        } else {
            this.selectedTargets = [];
            this.renderSelectedTargets();
        }
    },

    /**
     * Search targets for project
     */
    searchTargetsForProject(query) {
        const resultsContainer = document.getElementById('project-target-search-results');
        if (!resultsContainer) return;

        if (!query || query.length < 2) {
            resultsContainer.innerHTML = '';
            resultsContainer.hidden = true;
            return;
        }

        const results = DataManager.searchTargets(query, APP_CONFIG.PROJECT_TARGET_SEARCH_LIMIT);

        if (results.length === 0) {
            resultsContainer.innerHTML = '<p class="target-search-empty">No results</p>';
            resultsContainer.hidden = false;
            return;
        }

        resultsContainer.innerHTML = results.map(target => {
            const displayName = target.common
                  ? `${target.object} (${target.common})`
                  : target.object;

            return `
                <div class="target-search-result"
                     data-action="add-target-to-project" data-target-id="${HtmlUtils.escapeHtml(target.object)}">
                    ${HtmlUtils.escapeHtml(displayName)}
                </div>
            `;
        }).join('');
        resultsContainer.hidden = false;

        if (!resultsContainer._listenerAttached) {
            resultsContainer._listenerAttached = true;
            resultsContainer.addEventListener('click', (e) => {
                const item = e.target.closest('[data-action="add-target-to-project"]');
                if (!item) return;
                this.addTargetToProject(item.dataset.targetId);
            });
        }
    },

    /**
     * Add target to project
     */
    addTargetToProject(targetDesignation) {
        if (this.selectedTargets.includes(targetDesignation)) {
            UIManager.showToast('This target is already in the project', 'error');
            return;
        }

        this.selectedTargets.push(targetDesignation);
        this.renderSelectedTargets();

        clearTimeout(this._projectTargetSearchTimeout);
        const searchInput = document.getElementById('project-target-search');
        if (searchInput) searchInput.value = '';

        const resultsContainer = document.getElementById('project-target-search-results');
        if (resultsContainer) {
            resultsContainer.innerHTML = '';
            resultsContainer.hidden = true;
        }
    },

    /**
     * Remove target from project
     */
    removeTargetFromProject(targetDesignation) {
        this.selectedTargets = this.selectedTargets.filter(d => d !== targetDesignation);
        this.renderSelectedTargets();
    },

    /**
     * Render selected targets
     */
    renderSelectedTargets() {
        const container = document.getElementById('project-selected-targets-list');
        if (!container) return;

        if (this.selectedTargets.length === 0) {
            container.innerHTML = '<p class="imaging-log-empty">No targets selected</p>';
            return;
        }

        let html = '';
        this.selectedTargets.forEach(designation => {
            const target = DataManager.getTarget(designation);
            const displayName = target && target.common
                  ? `${designation} (${target.common})`
                  : designation;

            const otherDesignations = ImagingLogManager.otherDesignations(designation);
            const alsoText = otherDesignations.length > 0
                ? ` <span class="target-also">(also: ${HtmlUtils.escapeHtml(otherDesignations.join(', '))})</span>`
                : '';

            html += `
                <div class="selected-target-item">
                    <span>${HtmlUtils.escapeHtml(displayName)}${alsoText}</span>
                    <button class="btn-danger btn-sm"
                            data-action="remove-target-from-project" data-target-id="${HtmlUtils.escapeHtml(designation)}">
                        Remove
                    </button>
                </div>
            `;
        });

        container.innerHTML = html;

        if (!container._listenerAttached) {
            container._listenerAttached = true;
            container.addEventListener('click', (e) => {
                const btn = e.target.closest('[data-action="remove-target-from-project"]');
                if (!btn) return;
                this.removeTargetFromProject(btn.dataset.targetId);
            });
        }
    },

    /**
     * Handle save project
     */
    async handleSaveProject(modalBody) {
        const name = document.getElementById('project-name')?.value.trim();
        const status = this._getSessionDropdownValue('project-status-menu');
        const notes = document.getElementById('project-notes')?.value?.trim() ?? '';
        const publishedLink = document.getElementById('project-published-link')?.value?.trim() ?? '';

        if (publishedLink && !/^https?:\/\/.+/.test(publishedLink)) {
            UIManager.showToast('Published link must be a valid http:// or https:// URL', 'error');
            return;
        }

        const projectData = {
            name: name,
            targetDesignations: this.selectedTargets,
            status: status,
            notes: notes,
            publishedLink: publishedLink === '' ? null : publishedLink
        };

        const validation = ImagingLogManager.validateProject(projectData);
        if (!validation.valid) {
            UIManager.showToast(validation.error, 'error');
            return;
        }

        try {
            // Only targets this save adds are checked, so editing the notes
            // doesn't repeat the warning (Issue #355)
            const previousTargets = this.currentProjectId
                ? (await ImagingLogManager.getProject(this.currentProjectId)).targetDesignations
                : [];
            const addedTargets = projectData.targetDesignations.filter(d => !previousTargets.includes(d));

            if (this.currentProjectId) {
                await ImagingLogManager.updateProject(this.currentProjectId, projectData);
                UIManager.showToast(`Project "${name}" updated`, 'success');
                UIManager.markDataChanged();
            } else {
                await ImagingLogManager.createProject(projectData);
                UIManager.showToast(`Project "${name}" created`, 'success');
                UIManager.markDataChanged();
            }

            await this.checkTargetsAgainstProgramLimits(addedTargets);
            UIManager.closeModal();
            await this.renderProjectList();
        } catch (error) {
            console.error('Error saving project:', error);
            UIManager.showToast('Error saving project: ' + error.message, 'error');
        }
    },

    async checkTargetsAgainstProgramLimits(targetDesignations) {
        const allPrograms = await ImagingLogManager.getAllPrograms();
        const patternPrograms = allPrograms.filter(p => ImagingLogManager.isProgramPatternBased(p));
        const warnings = [];

        targetDesignations.forEach(designation => {
            [designation, ...ImagingLogManager.otherDesignations(designation)].forEach(des => {
                patternPrograms.forEach(program => {
                    if (ImagingLogManager.catalogNumber(des, program.catalogPrefix) > program.maxNumber) {
                        warnings.push(`${des} exceeds max number (${program.maxNumber}) for program "${program.name}"`);
                    }
                });
            });
        });

        warnings.forEach(warning => UIManager.showToast(warning, 'warning'));
    },

    /**
     * Open modal using UIManager's modal system
     */
    openModal(templateId, title, callback) {
        UIManager.openModal(templateId, title, callback);
    },

    // ============================================================================
    // Session Management
    // ============================================================================

    /**
     * Helper: a number box's value, or null when it's blank
     */
    _numberOrNull(inputId, parse) {
        const value = document.getElementById(inputId).value;
        return value === '' ? null : parse(value);
    },

    /**
     * Helper: get selected value from a session modal custom dropdown
     */
    _getSessionDropdownValue(menuId) {
        return document.getElementById(menuId)
            ?.querySelector('.astryx-dropdown-item.selected')
            ?.dataset.value ?? '';
    },

    /**
     * Helper: set selected item in a session modal custom dropdown by value
     */
    _setSessionDropdownValue(menuId, labelId, value) {
        const menu = document.getElementById(menuId);
        if (!menu) return;
        const strVal = String(value ?? '');
        menu.querySelectorAll('.astryx-dropdown-item').forEach(item => {
            item.classList.toggle('selected', item.dataset.value === strVal);
        });
        const selected = menu.querySelector('.astryx-dropdown-item.selected');
        const label = document.getElementById(labelId);
        if (label && selected) label.textContent = selected.textContent;
    },

    /**
     * Helper: populate a dynamic session dropdown from an array of names
     */
    _populateSessionDropdown(menuId, labelId, names, placeholder) {
        const menu = document.getElementById(menuId);
        const label = document.getElementById(labelId);
        if (!menu) return;

        menu.innerHTML = '';

        const ph = document.createElement('div');
        ph.className = 'astryx-dropdown-item';
        ph.dataset.value = '';
        ph.textContent = placeholder;
        menu.appendChild(ph);

        names.forEach(name => {
            const item = document.createElement('div');
            item.className = 'astryx-dropdown-item';
            item.dataset.value = name;
            item.textContent = name;
            menu.appendChild(item);
        });

        if (label) label.textContent = placeholder;
    },

    /**
     * Helper: wire a session modal dropdown trigger
     */
    _wireSessionDropdown(triggerId, dropdownId, menuId, labelId) {
        const trigger = document.getElementById(triggerId);
        const dropdown = document.getElementById(dropdownId);
        const menu = document.getElementById(menuId);
        if (!trigger || !dropdown || !menu) return;

        trigger.addEventListener('click', (e) => {
            e.stopPropagation();
            dropdown.classList.toggle('open');
        });

        menu.addEventListener('click', (e) => {
            e.stopPropagation();
            const item = e.target.closest('.astryx-dropdown-item');
            if (!item) return;
            menu.querySelectorAll('.astryx-dropdown-item').forEach(i => i.classList.remove('selected'));
            item.classList.add('selected');
            const label = document.getElementById(labelId);
            if (label) label.textContent = item.textContent;
            dropdown.classList.remove('open');
        });
    },

    /**
     * Show session modal
     */
    async showSessionModal(sessionId = null, projectId = null) {
        this.currentSessionId = sessionId;
        this.currentProjectId = projectId;

        const title = sessionId ? 'Edit Session' : 'New Imaging Session';

        this.openModal('manage-session-template', title, async (action, modalBody) => {
            if (action === 'save') {
                await this.handleSaveSession(modalBody);
            }
        });

        setTimeout(async () => {
            await this.initializeSessionModal(sessionId, projectId);

            if (!sessionId && projectId) {
                await this.autoPopulateSessionFields(projectId);
            }
        }, 0);
    },

    /**
     * Initialize session modal
     */
    async initializeSessionModal(sessionId, projectId) {
        // Populate and wire dynamic equipment dropdowns
        await this.populateSessionEquipmentDropdowns();

        // Wire static dropdowns
        this._wireSessionDropdown('session-bin-trigger', 'session-bin-dropdown', 'session-bin-menu', 'session-bin-label');
        this._wireSessionDropdown('session-clouds-trigger', 'session-clouds-dropdown', 'session-clouds-menu', 'session-clouds-label');
        this._wireSessionDropdown('session-smoke-trigger', 'session-smoke-dropdown', 'session-smoke-menu', 'session-smoke-label');
        this._wireSessionDropdown('session-seeing-trigger', 'session-seeing-dropdown', 'session-seeing-menu', 'session-seeing-label');
        this._wireSessionDropdown('session-transparency-trigger', 'session-transparency-dropdown', 'session-transparency-menu', 'session-transparency-label');

        // Set up integration time calculation
        const subLength = document.getElementById('session-sub-length');
        const numExposures = document.getElementById('session-num-exposures');
        const usedExposures = document.getElementById('session-used-exposures');
        if (subLength) subLength.addEventListener('input', () => this.updateSessionIntegrationTime());
        if (numExposures) numExposures.addEventListener('input', () => this.updateSessionIntegrationTime());
        if (usedExposures) usedExposures.addEventListener('input', () => this.updateSessionIntegrationTime());

        // 24-hour HH:MM entry for the moon times (issue #273)
        TimeInput.attach(document.getElementById('session-moon-set'));
        TimeInput.attach(document.getElementById('session-moon-rise'));
        DateInput.attach(document.getElementById('session-date'));

        // Set up moon calculation button
        const calcMoonBtn = document.getElementById('session-calc-moon-btn');
        if (calcMoonBtn) {
            calcMoonBtn.addEventListener('click', () => this.calculateMoonData());
        }

        if (sessionId) {
            const session = await ImagingLogManager.getSession(sessionId);
            document.getElementById('session-project-id').value = session.projectId;
            DateInput.set(document.getElementById('session-date'), session.date);
            document.getElementById('session-rotation').value = session.rotation ?? '';
            document.getElementById('session-temp-setpoint').value = session.tempSetpoint ?? '';
            document.getElementById('session-gain').value = session.gain ?? '';
            document.getElementById('session-offset').value = session.offset ?? '';
            document.getElementById('session-moon-illumination').value = session.moonIllumination ?? '';

            if (session.moonSet) {
                document.getElementById('session-moon-set').value = session.moonSet;
            }
            if (session.moonRise) {
                document.getElementById('session-moon-rise').value = session.moonRise;
            }

            document.getElementById('session-angle-from-moon').value = session.angleFromMoon ?? '';
            document.getElementById('session-sub-length').value = session.subLength;
            document.getElementById('session-num-exposures').value = session.numExposures;
            document.getElementById('session-used-exposures').value = session.usedExposures;
            document.getElementById('session-notes').value = session.notes ?? '';

            // Set dropdown values
            this._setSessionDropdownValue('session-location-menu', 'session-location-label', session.location);
            this._setSessionDropdownValue('session-telescope-menu', 'session-telescope-label', session.telescope);
            this._setSessionDropdownValue('session-sensor-menu', 'session-sensor-label', session.sensor);
            this._setSessionDropdownValue('session-filter-menu', 'session-filter-label', session.filter);
            this._setSessionDropdownValue('session-bin-menu', 'session-bin-label', session.bin ?? '1x1');
            this._setSessionDropdownValue('session-clouds-menu', 'session-clouds-label', session.clouds ?? '');
            this._setSessionDropdownValue('session-smoke-menu', 'session-smoke-label', session.smoke ?? '');
            this._setSessionDropdownValue('session-seeing-menu', 'session-seeing-label', session.seeing ?? '');
            this._setSessionDropdownValue('session-transparency-menu', 'session-transparency-label', session.transparency ?? '');

            this.updateSessionIntegrationTime();
        } else {
            document.getElementById('session-project-id').value = projectId;
            DateInput.set(document.getElementById('session-date'), TimeUtils.getTodayString());
        }
    },

    /**
     * Populate dynamic equipment dropdowns
     */
    async populateSessionEquipmentDropdowns() {
        const locations = DataManager.getLocations();
        this._populateSessionDropdown('session-location-menu', 'session-location-label', Object.keys(locations).sort(), 'Select location...');
        this._wireSessionDropdown('session-location-trigger', 'session-location-dropdown', 'session-location-menu', 'session-location-label');

        const telescopes = DataManager.getTelescopes();
        this._populateSessionDropdown('session-telescope-menu', 'session-telescope-label', Object.keys(telescopes).sort(), 'Select telescope...');
        this._wireSessionDropdown('session-telescope-trigger', 'session-telescope-dropdown', 'session-telescope-menu', 'session-telescope-label');

        const sensors = DataManager.getSensors();
        this._populateSessionDropdown('session-sensor-menu', 'session-sensor-label', Object.keys(sensors).sort(), 'Select sensor...');
        this._wireSessionDropdown('session-sensor-trigger', 'session-sensor-dropdown', 'session-sensor-menu', 'session-sensor-label');

        const filters = DataManager.getFilters();
        this._populateSessionDropdown('session-filter-menu', 'session-filter-label', Object.keys(filters).sort(), 'Select filter...');
        this._wireSessionDropdown('session-filter-trigger', 'session-filter-dropdown', 'session-filter-menu', 'session-filter-label');
    },

    /**
     * Update integration time display
     */
    updateSessionIntegrationTime() {
        const subLength = Number(document.getElementById('session-sub-length').value);
        const usedInput = document.getElementById('session-used-exposures').value;
        const usedExposures = usedInput === '' ? null : parseFloat(usedInput);

        if (subLength > 0 && usedExposures !== null && usedExposures > 0) {
            const totalSeconds = subLength * usedExposures;
            const hours = (totalSeconds / 3600).toFixed(1);
            document.getElementById('session-integration-time').textContent =
                `${usedExposures} × ${subLength}s = ${hours}h`;
        } else if (usedExposures === null) {
            document.getElementById('session-integration-time').textContent = '0.0h';
        } else {
            document.getElementById('session-integration-time').textContent = '-';
        }
    },

    /**
     * Calculate moon data
     */
    async calculateMoonData() {
        const dateStr = DateInput.value(document.getElementById('session-date'));
        const locationName = this._getSessionDropdownValue('session-location-menu');
        const projectId = parseInt(document.getElementById('session-project-id').value);

        if (!dateStr || !locationName) {
            UIManager.showToast('Please select date and location first', 'error');
            return;
        }

        if (!projectId) {
            UIManager.showToast('Project not found', 'error');
            return;
        }

        const project = await ImagingLogManager.getProject(projectId);
        if (!project || project.targetDesignations.length === 0) {
            UIManager.showToast('Project has no targets', 'error');
            return;
        }

        const targetDesignation = project.targetDesignations[0];
        const location = DataManager.getLocation(locationName);
        const target = DataManager.getTarget(targetDesignation);

        if (!location || !target) {
            UIManager.showToast('Could not find location or target data', 'error');
            return;
        }

        try {
            // Session date is the evening date; the night is dusk→dawn at the
            // location, sampled the same way as Daily Visibility.
            const [year, month, day] = dateStr.split('-').map(Number);
            const localNoon = new Date(year, month - 1, day, 12, 0, 0);
            const isDST = SettingsManager.isDSTOnDate(localNoon, location);
            const noonWindow = getNoonToNoonWindow(dateStr, location.timezone, isDST);
            // No astronomical darkness (high-latitude summer): use the whole noon-to-noon window
            const duskJD = findAstronomicalDusk(localNoon, location.latitude, location.longitude, location.timezone, isDST) ?? noonWindow.startJD;
            const dawnJD = findNextAstronomicalDawn(localNoon, location.latitude, location.longitude, location.timezone, isDST) ?? noonWindow.endJD;

            const moonPhase = getNightMoonPhase(duskJD, dawnJD);
            document.getElementById('session-moon-illumination').value = Math.round(moonPhase.illumination);

            const moonRiseSet = calculateMoonRiseSetForNight(noonWindow.startJD, noonWindow.endJD, location.latitude, location.longitude, location.elevation);

            if (moonRiseSet.moonrise) {
                document.getElementById('session-moon-rise').value = TimeUtils.formatLocalTime(jdToDate(moonRiseSet.moonrise), location);
            }

            if (moonRiseSet.moonset) {
                document.getElementById('session-moon-set').value = TimeUtils.formatLocalTime(jdToDate(moonRiseSet.moonset), location);
            }

            // Closest approach while the target is above the global minimum
            // altitude; if it never gets that high, closest approach all night.
            const separation =
                getMinMoonSeparation(duskJD, dawnJD, target.ra, target.dec, location.latitude, location.longitude, SettingsManager.getGlobalMinAltitude()) ??
                getMinMoonSeparation(duskJD, dawnJD, target.ra, target.dec, location.latitude, location.longitude, -90);
            document.getElementById('session-angle-from-moon').value = Math.round(separation);

            UIManager.showToast('Moon data calculated', 'success');

        } catch (error) {
            console.error('Error calculating moon data:', error);
            UIManager.showToast('Error calculating moon data: ' + error.message, 'error');
        }
    },

    /**
     * Handle save session
     */
    async handleSaveSession(modalBody) {
        const projectId = parseInt(document.getElementById('session-project-id').value);
        const date = DateInput.value(document.getElementById('session-date'));
        const location = this._getSessionDropdownValue('session-location-menu');
        const telescope = this._getSessionDropdownValue('session-telescope-menu');
        const sensor = this._getSessionDropdownValue('session-sensor-menu');
        const filter = this._getSessionDropdownValue('session-filter-menu');
        // An empty number is null, as SQLite stores it, so web and desktop
        // hold the same session (Issue #353). A blank Rotation or Moon field
        // stays blank, not 0 (Issue #355)
        const rotation = this._numberOrNull('session-rotation', parseFloat);
        const tempSetpoint = this._numberOrNull('session-temp-setpoint', parseFloat);
        const bin = this._getSessionDropdownValue('session-bin-menu');
        const gain = this._numberOrNull('session-gain', parseInt);
        const offset = this._numberOrNull('session-offset', parseInt);
        const moonIllumination = this._numberOrNull('session-moon-illumination', parseInt);

        const moonSetInput = document.getElementById('session-moon-set');
        const moonRiseInput = document.getElementById('session-moon-rise');
        if (TimeInput.isInvalid(moonSetInput) || TimeInput.isInvalid(moonRiseInput)) {
            UIManager.showToast('Enter Moon Set and Moon Rise as 24-hour HH:MM, or leave them empty', 'error');
            return;
        }
        const moonSet = TimeInput.parse(moonSetInput.value);
        const moonRise = TimeInput.parse(moonRiseInput.value);

        const angleFromMoon = this._numberOrNull('session-angle-from-moon', parseInt);
        const clouds = this._getSessionDropdownValue('session-clouds-menu');
        const smoke = this._getSessionDropdownValue('session-smoke-menu');
        const seeing = this._getSessionDropdownValue('session-seeing-menu');
        const transparency = this._getSessionDropdownValue('session-transparency-menu');
        // Issue #309: fractional exposures (2.5 s) are stored as entered
        const subLength = parseFloat(document.getElementById('session-sub-length').value);
        const numExposures = parseInt(document.getElementById('session-num-exposures').value);
        const usedInput = document.getElementById('session-used-exposures').value;
        const usedExposures = usedInput === '' ? 0 : parseInt(usedInput);
        const notes = document.getElementById('session-notes').value.trim();

        const sessionData = {
            projectId,
            date,
            location,
            telescope,
            sensor,
            filter,
            rotation,
            tempSetpoint,
            bin,
            gain,
            offset,
            moonIllumination,
            moonSet,
            moonRise,
            angleFromMoon,
            clouds,
            smoke,
            seeing,
            transparency,
            subLength,
            numExposures,
            usedExposures,
            notes
        };

        const validation = ImagingLogManager.validateSession(sessionData);
        if (!validation.valid) {
            UIManager.showToast(validation.error, 'error');
            return;
        }

        try {
            if (this.currentSessionId) {
                await ImagingLogManager.updateSession(this.currentSessionId, sessionData);
                UIManager.showToast('Session updated', 'success');
                UIManager.markDataChanged();
            } else {
                await ImagingLogManager.createSession(sessionData);
                UIManager.showToast('Session created', 'success');
                UIManager.markDataChanged();
            }

            UIManager.closeModal();
            await this.renderProjectList();

        } catch (error) {
            console.error('Error saving session:', error);
            UIManager.showToast('Error saving session: ' + error.message, 'error');
        }
    },

    /**
     * Delete session
     */
    async deleteSession(sessionId) {
        if (!await UIManager.confirm('Delete this imaging session?')) {
            return;
        }

        try {
            await ImagingLogManager.deleteSession(sessionId);
            UIManager.showToast('Session deleted', 'success');
            UIManager.markDataChanged();
            await this.renderProjectList();
        } catch (error) {
            console.error('Error deleting session:', error);
            UIManager.showToast('Error deleting session: ' + error.message, 'error');
        }
    },

    /**
     * Delete project
     */
    async deleteProject(projectId) {
        const project = await ImagingLogManager.getProject(projectId);
        try {
            await ImagingLogManager.deleteProject(projectId);
            UIManager.showToast(`Project "${project.name}" deleted`, 'success');
            UIManager.markDataChanged();
            await this.renderProjectList();
        } catch (error) {
            console.error('Error deleting project:', error);
            UIManager.showToast('Error deleting project: ' + error.message, 'error');
        }
    },

    /**
     * Handle edit project button click
     */
    async handleEditProject(projectId) {
        await this.showProjectModal(projectId);
    },

    /**
     * Handle delete project button click with confirmation
     */
    async handleDeleteProject(projectId) {
        const project = await ImagingLogManager.getProject(projectId);

        if (!await UIManager.confirm(`This action will permanently delete the project "${project.name}" and all its sessions. Are you sure?`)) {
            return;
        }

        await this.deleteProject(projectId);
    },

    /**
     * Toggle project sessions visibility
     */
    toggleProjectSessions(projectId) {
        const sessionsContainer = document.getElementById(`project-sessions-${projectId}`);
        const chevron = document.getElementById(`chevron-${projectId}`);
        const addButton = document.getElementById(`add-session-btn-${projectId}`);

        if (sessionsContainer) {
            const isExpanded = sessionsContainer.classList.contains('expanded');

            if (isExpanded) {
                this.expandedProjectIds.delete(projectId);
            } else {
                this.expandedProjectIds.add(projectId);
            }

            if (isExpanded) {
                sessionsContainer.style.maxHeight = sessionsContainer.scrollHeight + 'px';
                sessionsContainer.offsetHeight;
                sessionsContainer.style.maxHeight = '0';
                sessionsContainer.classList.remove('expanded');
            } else {
                sessionsContainer.classList.add('expanded');
                sessionsContainer.style.maxHeight = sessionsContainer.scrollHeight + 'px';
            }

            if (chevron) {
                if (isExpanded) {
                    chevron.classList.remove('expanded');
                } else {
                    chevron.classList.add('expanded');
                }
            }

            if (addButton) {
                addButton.hidden = isExpanded;
            }
        }
    },

    /**
     * Format integration time: hours from an hour up, then minutes, then
     * seconds, so short sessions don't show as 0.0h (Issue #355)
     */
    formatIntegrationTime(seconds) {
        if (seconds >= 3600) return (seconds / 3600).toFixed(1) + 'h';
        if (seconds >= 60) return Math.round(seconds / 60) + 'm';
        return Math.round(seconds) + 's';
    },

    /**
     * Get status CSS class
     */
    getStatusClass(status) {
        return 'status-' + status.toLowerCase().replace(/ /g, '-');
    },

    // ============================================================================
    // Program Management
    // ============================================================================

    /**
     * Setup program controls
     */
    setupProgramControls() {
        const importProgramBtn = document.getElementById('imaging-log-new-program-btn');
        if (importProgramBtn) {
            const newBtn = importProgramBtn.cloneNode(true);
            importProgramBtn.parentNode.replaceChild(newBtn, importProgramBtn);
            newBtn.addEventListener('click', () => this.showImportProgramModal());
        }
    },

    /**
     * Render programs list
     */
    async renderProgramsList() {
        const container = document.getElementById('imaging-log-programs-list');
        if (!container) return;

        const programs = await ImagingLogManager.getAllPrograms();

        if (programs.length === 0) {
            container.innerHTML = '<p class="empty-message">No programs found. Create or import a program!</p>';
            return;
        }

        // Projects read once for every card (Issue #355)
        const projects = (await ImagingLogManager.getAllProjects()).filter(p => p.status === 'Completed');
        container.innerHTML = programs.map(program => this.renderProgramCard(program, projects)).join('');

        const actionButtons = document.querySelectorAll('.project-action-btn[data-program-id]');
        actionButtons.forEach(btn => {
            btn.addEventListener('click', async (e) => {
                e.stopPropagation();
                const programId = parseInt(btn.getAttribute('data-program-id'));
                const action = btn.getAttribute('data-action');

                if (action === 'delete') {
                    await this.handleDeleteProgram(programId);
                } else if (action === 'edit') {
                    await this.handleEditProgram(programId);
                }
            });
        });
    },

    /**
     * Render a single program card
     */
    renderProgramCard(program, completedProjects) {
        const progress = ImagingLogManager.programProgress(program, completedProjects);
        const progressPercent = parseFloat(progress.percentage);
        const isPattern = ImagingLogManager.isProgramPatternBased(program);

        let status = 'Not Started';
        if (progress.imaged >= progress.total && progress.total > 0) {
            status = 'Complete';
        } else if (progress.imaged > 0) {
            status = 'Started';
        }

        const statusClass = status === 'Complete' ? 'status-completed' : 'status-acquiring-data';

        return `
            <div class="project-card">
                <div class="project-card-header">
                    <div class="project-card-heading">
                        <div class="project-card-title">
                            ${HtmlUtils.escapeHtml(program.name)}
                            ${this.programRangeHtml(program, isPattern)}
                        </div>
                    </div>
                    <div class="project-card-actions">
                        <button class="project-action-btn btn-danger btn-small"
                                data-program-id="${HtmlUtils.escapeHtml(program.id)}" data-action="delete">
                            Delete Program
                        </button>
                        <button class="project-action-btn btn-secondary btn-small"
                                data-program-id="${HtmlUtils.escapeHtml(program.id)}" data-action="edit">
                            Edit Program
                        </button>
                    </div>
                </div>

                <div class="project-card-meta">
                    <span>Targets: ${progress.total}</span>
                    <span class="tooltip-host has-tip" data-tooltip-key="ilog_programImaged">Imaged: ${progress.imaged} (${progressPercent}%)</span>
                    <span>Remaining: ${progress.total - progress.imaged}</span>
                    <span class="project-status-badge ${statusClass}">${status}</span>
                </div>

                <div class="program-progress-bar program-card-progress">
                    <div class="program-progress-fill" style="width: ${progressPercent}%;"></div>
                </div>
            </div>
        `;
    },

    /**
     * A pattern program's range after its name, e.g. "(NGC 1-110)"
     */
    programRangeHtml(program, isPattern) {
        return isPattern
            ? `<span class="program-range">(${HtmlUtils.escapeHtml(program.catalogPrefix)} 1-${program.maxNumber})</span>`
            : '';
    },

    async handleEditProgram(programId) {
        await this.showImportProgramModal(programId);
    },

    async handleDeleteProgram(programId) {
        await this.deleteProgramConfirm(programId);
    },

    showImportProgramModal(programId = null) {
        this.currentProgramId = programId;
        const title = programId ? 'Edit Program' : 'New Program';

        this.openModal('import-program-template', title, async (action, modalBody) => {
            if (action === 'import') {
                await this.handleSaveProgram(modalBody, programId);
            }
        });

        setTimeout(async () => {
            await this.initializeImportProgramModal(programId);
        }, 0);
    },

    async initializeImportProgramModal(programId) {
        Log.debug('initializeImportProgramModal called');
        const patternRadio = document.getElementById('program-type-pattern');
        const manualRadio = document.getElementById('program-type-manual');
        const patternFields = document.getElementById('pattern-fields');
        const manualFields = document.getElementById('manual-fields');

        const catalogPrefixMenu = document.getElementById('program-catalog-prefix-menu');
        const catalogPrefixTrigger = document.getElementById('program-catalog-prefix-trigger');
        const catalogPrefixDropdown = document.getElementById('program-catalog-prefix-dropdown');
        const catalogPrefixLabel = document.getElementById('program-catalog-prefix-label');
        if (catalogPrefixMenu) {
            catalogPrefixMenu.innerHTML = '';
            const placeholder = document.createElement('div');
            placeholder.className = 'astryx-dropdown-item';
            placeholder.dataset.value = '';
            placeholder.textContent = 'Select catalog...';
            catalogPrefixMenu.appendChild(placeholder);

            const prefixSet = new Set();
            DataManager.targetDatabase.forEach(target => {
                if (target.object) {
                    const m = target.object.match(/^([A-Za-z]+)/);
                    if (m) prefixSet.add(m[1].toUpperCase());
                }
            });
            Array.from(prefixSet).sort().forEach(prefix => {
                const item = document.createElement('div');
                item.className = 'astryx-dropdown-item';
                item.dataset.value = prefix;
                item.textContent = prefix;
                catalogPrefixMenu.appendChild(item);
            });

            if (catalogPrefixTrigger && !catalogPrefixTrigger._listenerAttached) {
                catalogPrefixTrigger._listenerAttached = true;
                catalogPrefixTrigger.addEventListener('click', (e) => {
                    e.stopPropagation();
                    catalogPrefixDropdown.classList.toggle('open');
                });
                catalogPrefixMenu.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const item = e.target.closest('.astryx-dropdown-item');
                    if (!item) return;
                    catalogPrefixMenu.querySelectorAll('.astryx-dropdown-item').forEach(i => i.classList.remove('selected'));
                    item.classList.add('selected');
                    if (catalogPrefixLabel) catalogPrefixLabel.textContent = item.textContent;
                    catalogPrefixDropdown.classList.remove('open');
                });
            }
        }

        const toggleFields = () => {
            if (patternRadio && manualRadio) {
                patternFields.hidden = !patternRadio.checked;
                manualFields.hidden = patternRadio.checked;
            }
        };

        if (patternRadio) patternRadio.addEventListener('change', toggleFields);
        if (manualRadio) manualRadio.addEventListener('change', toggleFields);

        if (programId) {
            const program = await ImagingLogManager.getProgram(programId);
            if (program) {
                document.getElementById('program-name').value = program.name;

                if (ImagingLogManager.isProgramPatternBased(program)) {
                    const maxField = document.getElementById('program-max-number');
                    patternRadio.checked = true;
                    if (maxField) maxField.value = program.maxNumber;
                    document.getElementById('program-max-number').value = program.maxNumber;
                    if (catalogPrefixMenu) {
                        catalogPrefixMenu.querySelectorAll('.astryx-dropdown-item').forEach(i => {
                            i.classList.toggle('selected', i.dataset.value.toUpperCase() === program.catalogPrefix?.toUpperCase());
                        });
                        const selected = catalogPrefixMenu.querySelector('.astryx-dropdown-item.selected');
                        if (catalogPrefixLabel && selected) catalogPrefixLabel.textContent = selected.textContent;
                    }
                } else {
                    manualRadio.checked = true;
                    document.getElementById('program-targets').value = program.targetDesignations.join('\n');
                }

                toggleFields();
            }
        }
    },

    async handleSaveProgram(modalBody, programId = null) {
        const name = document.getElementById('program-name')?.value.trim();
        const patternRadio = document.getElementById('program-type-pattern');
        if (!name) {
            UIManager.showToast('Program name is required', 'error');
            return;
        }
        const programData = { name: name };
        if (patternRadio && patternRadio.checked) {
            const prefix = document.getElementById('program-catalog-prefix-menu')?.querySelector('.astryx-dropdown-item.selected')?.dataset.value?.trim() ?? '';
            const maxNum = parseInt(document.getElementById('program-max-number')?.value);
            if (!prefix) {
                UIManager.showToast('Catalog prefix is required', 'error');
                return;
            }
            if (!maxNum || maxNum < 1) {
                UIManager.showToast('Maximum number must be at least 1', 'error');
                return;
            }
            programData.catalogPrefix = prefix;
            programData.maxNumber = maxNum;
            try {
                if (programId) {
                    const updateData = { name: name, catalogPrefix: prefix, maxNumber: maxNum };
                    await ImagingLogManager.updateProgram(programId, updateData);
                    UIManager.showToast(`Program "${name}" updated`, 'success');
                    UIManager.markDataChanged();
                    UIManager.closeModal();
                    await this.renderProgramsList();
                } else {
                    await ImagingLogManager.createProgram(programData);
                    UIManager.showToast(`Program "${name}" created`, 'success');
                    UIManager.markDataChanged();
                    UIManager.closeModal();
                    await this.renderProgramsList();
                }
            } catch (error) {
                console.error('Error saving program:', error);
                UIManager.showToast('Error saving program: ' + error.message, 'error');
            }
        } else {
            const targetList = document.getElementById('program-targets')?.value.trim();
            if (!targetList) {
                UIManager.showToast('Target list is required', 'error');
                return;
            }
            try {
                const results = await ImagingLogManager.matchProgramTargets(targetList);
                this.displayImportResults(results);
                if (results.matched.length > 0) {
                    const targetDesignations = results.matched.map(m => m.target.object);
                    programData.targetDesignations = targetDesignations;
                    if (programId) {
                        await ImagingLogManager.updateProgram(programId, programData);
                        UIManager.showToast(`Program "${name}" updated with ${results.matched.length} targets`, 'success');
                        UIManager.markDataChanged();
                    } else {
                        await ImagingLogManager.createProgram(programData);
                        UIManager.showToast(`Program "${name}" created with ${results.matched.length} targets`, 'success');
                        UIManager.markDataChanged();
                    }
                    await this.renderProgramsList();
                } else {
                    UIManager.showToast('No targets matched', 'error');
                }
            } catch (error) {
                console.error('Error saving program:', error);
                UIManager.showToast('Error saving program: ' + error.message, 'error');
            }
        }
    },

    displayImportResults(results) {
        const resultsDiv = document.getElementById('import-results');
        const summaryDiv = document.getElementById('import-results-summary');
        const matchedDiv = document.getElementById('import-results-matched');
        const failedDiv = document.getElementById('import-results-failed');

        if (!resultsDiv) return;

        summaryDiv.innerHTML = '';
        matchedDiv.innerHTML = '';
        failedDiv.innerHTML = '';

        resultsDiv.hidden = false;

        summaryDiv.innerHTML = `
            <p><strong>Matched:</strong> ${results.matched.length} targets</p>
            <p><strong>Failed:</strong> ${results.failed.length} targets</p>
        `;

        if (results.matched.length > 0) {
            matchedDiv.innerHTML = `
                <details>
                    <summary class="import-results-heading">
                        Matched Targets (${results.matched.length})
                    </summary>
                    <div class="imaging-log-scroll-list">
                        ${results.matched.map(m =>
                            `<div>${HtmlUtils.escapeHtml(m.input)} → ${HtmlUtils.escapeHtml(m.target.object)}</div>`
                        ).join('')}
                    </div>
                </details>
            `;
        }

        if (results.failed.length > 0) {
            failedDiv.innerHTML = `
                <details open>
                    <summary class="import-results-heading import-results-failed-heading">
                        Failed Targets (${results.failed.length})
                    </summary>
                    <div class="imaging-log-scroll-list import-results-failed-list">
                        ${results.failed.map(f =>
                            `<div>${HtmlUtils.escapeHtml(f.input)}</div>`
                        ).join('')}
                    </div>
                    <button class="btn-secondary btn-sm" data-action="export-missing-targets-csv">
                        Copy Missing Targets as CSV
                    </button>
                </details>
            `;

            this.failedImportTargets = results.failed;

            if (!failedDiv._listenerAttached) {
                failedDiv._listenerAttached = true;
                failedDiv.addEventListener('click', (e) => {
                    const btn = e.target.closest('[data-action="export-missing-targets-csv"]');
                    if (!btn) return;
                    this.exportMissingTargetsCSV();
                });
            }
        }
    },

    exportMissingTargetsCSV() {
        if (!this.failedImportTargets || this.failedImportTargets.length === 0) {
            UIManager.showToast('No failed targets to export', 'error');
            return;
        }

        const csv = ImagingLogManager.generateMissingTargetsCSV(this.failedImportTargets);

        navigator.clipboard.writeText(csv).then(() => {
            UIManager.showToast('CSV copied to clipboard', 'success');
        }).catch(err => {
            console.error('Failed to copy CSV:', err);
            UIManager.showToast('Failed to copy CSV', 'error');
        });
    },

    async deleteProgramConfirm(programId) {
        const program = await ImagingLogManager.getProgram(programId);

        if (!await UIManager.confirm(`Delete program "${program.name}"?`)) {
            return;
        }

        try {
            await ImagingLogManager.deleteProgram(programId);
            UIManager.showToast(`Program "${program.name}" deleted`, 'success');
            UIManager.markDataChanged();
            await this.renderProgramsList();
        } catch (error) {
            console.error('Error deleting program:', error);
            UIManager.showToast('Error deleting program: ' + error.message, 'error');
        }
    },

    // ============================================================================
    // Reports
    // ============================================================================

    async renderReports() {
        // Programs, projects and sessions read once for all three reports (Issue #355)
        const [programs, projects, sessions] = await Promise.all([
            ImagingLogManager.getAllPrograms(),
            ImagingLogManager.getAllProjects(),
            ImagingLogManager.getAllSessions(),
        ]);
        const completed = projects.filter(p => p.status === 'Completed');
        this.renderCatalogCoverageReport(completed);
        this.renderProgramProgressReport(programs, completed);
        this.renderProjectStatusReport(projects, sessions);
    },

    renderCatalogCoverageReport(projects) {
        const container = document.getElementById('report-catalog-coverage');
        if (!container) return;

        const coverage = ImagingLogManager.catalogCoverage(projects);
        if (coverage.length === 0) {
            container.innerHTML = '<p class="imaging-log-empty">No targets imaged yet.</p>';
            return;
        }

        let html = '<table class="session-table">';
        html += '<thead><tr><th>Catalog</th><th>Targets Imaged</th></tr></thead>';
        html += '<tbody>';
        coverage.forEach(([catalog, count]) => {
            html += `<tr><td>${HtmlUtils.escapeHtml(catalog)}</td><td>${count}</td></tr>`;
        });
        html += '</tbody></table>';
        container.innerHTML = html;
    },

    renderProgramProgressReport(programs, projects) {
        const container = document.getElementById('report-program-progress');
        if (!container) return;

        if (programs.length === 0) {
            container.innerHTML = '<p class="imaging-log-empty">No programs created yet.</p>';
            return;
        }

        let html = '';
        const imagedTargets = ImagingLogManager.imagedDesignations(projects);

        for (const program of programs) {
            const progress = ImagingLogManager.programProgress(program, projects);
            const isPattern = ImagingLogManager.isProgramPatternBased(program);

            let completedSection = '';
            if (progress.imaged > 0) {
                let completedTargets;

                // Each entry: a label and the designations that count for it
                const byName = (a, b) => a.label.localeCompare(b.label, undefined, { numeric: true, sensitivity: 'base' });
                if (isPattern) {
                    // One entry per catalogue number, suffixed variants together (Issue #306)
                    completedTargets = [...ImagingLogManager.patternMatches(program, projects).values()]
                        .map(set => ({ label: [...set].join(', '), designations: [...set] }))
                        .sort(byName);
                } else {
                    completedTargets = program.targetDesignations
                        .filter(t => imagedTargets.has(t))
                        .map(t => ({ label: t, designations: [t] }))
                        .sort(byName);
                }

                let completedHTML = '';
                completedTargets.forEach(({ label, designations }) => {
                    let targetProjects = projects.filter(p => p.targetDesignations.some(d => designations.includes(d)));

                    if (targetProjects.length === 0) {
                        targetProjects = projects.filter(p => p.targetDesignations.some(designation =>
                            ImagingLogManager.otherDesignations(designation).some(d => designations.includes(d))
                        ));
                    }

                    const projectLinks = targetProjects.map(proj =>
                        `<span class="program-project-link" data-action="navigate-to-project" data-project-id="${HtmlUtils.escapeHtml(proj.id)}">
                            ${HtmlUtils.escapeHtml(proj.name)}
                        </span>`
                    ).join(', ');

                    completedHTML += `
                        <div class="program-target-row">
                            <strong>${HtmlUtils.escapeHtml(label)}:</strong> ${targetProjects.length > 0 ? projectLinks : '<span class="program-no-project">No project found</span>'}
                        </div>
                    `;
                });

                completedSection = `
                    <details class="program-completed">
                        <summary class="program-report-summary program-completed-summary">
                            Targets Completed (${progress.imaged})
                        </summary>
                        <div class="imaging-log-scroll-list program-report-list">
                            ${completedHTML}
                        </div>
                    </details>
                `;
            }

            let missingSection = '';
            if (!isPattern) {
                const missingTargets = program.targetDesignations.filter(
                    designation => !imagedTargets.has(designation)
                );

                if (missingTargets.length > 0) {
                    const sortedMissing = missingTargets.sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }));
                    missingSection = `
                        <details>
                            <summary class="program-report-summary">
                                Targets yet to be imaged (${missingTargets.length})
                            </summary>
                            <div class="imaging-log-scroll-list program-report-list program-missing-list">
                                ${sortedMissing.map(t => HtmlUtils.escapeHtml(t)).join(', ')}
                            </div>
                        </details>
                    `;
                } else {
                    missingSection = '<div class="program-complete">✓ Program Complete!</div>';
                }
            }

            html += `
                <div class="info-card program-report-card">
                    <div class="program-report-header">
                        <strong class="program-report-name">
                            ${HtmlUtils.escapeHtml(program.name)}
                            ${this.programRangeHtml(program, isPattern)}
                        </strong>
                        <span class="project-status-badge ${progress.imaged === progress.total && progress.total > 0 ? 'status-completed' : 'status-acquiring-data'}">
                            ${progress.imaged === 0 ? 'Not Started' : progress.imaged === progress.total && progress.total > 0 ? 'Complete' : 'Started'}
                        </span>
                    </div>
                    <div class="program-report-progress">
                        Progress: ${progress.imaged}/${progress.total} (${progress.percentage}%)
                    </div>
                    <div class="program-progress-bar program-report-bar">
                        <div class="program-progress-fill" style="width: ${progress.percentage}%;"></div>
                    </div>
                    ${completedSection}
                    ${missingSection}
                </div>
            `;
        }

        container.innerHTML = html;

        if (!container._listenerAttached) {
            container._listenerAttached = true;
            container.addEventListener('click', (e) => {
                const el = e.target.closest('[data-action="navigate-to-project"]');
                if (!el) return;
                this.navigateToProject(parseInt(el.dataset.projectId));
            });
        }
    },

    renderProjectStatusReport(projects, sessions) {
        const container = document.getElementById('report-project-status');
        if (!container) return;
        if (projects.length === 0) {
            container.innerHTML = '<p class="imaging-log-empty">No projects created yet.</p>';
            return;
        }
        const sessionsByProject = ImagingLogManager.groupSessionsByProject(sessions);
        const statuses = ['Planning', 'Acquiring Data', 'Acquisition Complete', 'Processing', 'Completed'];
        const grouped = {};

        statuses.forEach(status => {
            grouped[status] = projects.filter(p => p.status === status);
        });
        let html = '<table class="session-table">';
        html += '<thead><tr><th>Status</th><th>Projects</th><th>Total Targets</th><th>Total Sessions</th></tr></thead>';
        html += '<tbody>';
        for (const status of statuses) {
            const projectList = grouped[status];
            if (projectList.length === 0) continue;
            const totalTargets = projectList.reduce((sum, p) => sum + p.targetDesignations.length, 0);

            const totalSessions = projectList.reduce((sum, p) => sum + (sessionsByProject.get(p.id)?.length ?? 0), 0);
            const statusClass = this.getStatusClass(status);
            html += `
            <tr>
                <td><span class="project-status-badge ${statusClass}">${status}</span></td>
                <td>${projectList.length}</td>
                <td>${totalTargets}</td>
                <td>${totalSessions}</td>
            </tr>
        `;
        }
        html += '</tbody></table>';
        container.innerHTML = html;
    },

    /**
     * Auto-populate session fields from most recent session for this project
     */
    async autoPopulateSessionFields(projectId) {
        const sessions = await ImagingLogManager.getSessionsForProject(projectId);

        if (sessions.length === 0) return;

        sessions.sort((a, b) => new Date(b.date) - new Date(a.date));
        const mostRecent = sessions[0];

        if (mostRecent.location) {
            this._setSessionDropdownValue('session-location-menu', 'session-location-label', mostRecent.location);
        }
        if (mostRecent.telescope) {
            this._setSessionDropdownValue('session-telescope-menu', 'session-telescope-label', mostRecent.telescope);
        }
        if (mostRecent.sensor) {
            this._setSessionDropdownValue('session-sensor-menu', 'session-sensor-label', mostRecent.sensor);
        }
        if (mostRecent.filter) {
            this._setSessionDropdownValue('session-filter-menu', 'session-filter-label', mostRecent.filter);
        }
        if (mostRecent.subLength) {
            document.getElementById('session-sub-length').value = mostRecent.subLength;
        }
    },

    /**
     * Navigate to a specific project
     */
    async navigateToProject(projectId) {
        // Issue #334: show every project, render once, then open this one's sessions
        clearTimeout(this._projectSearchTimeout);
        const searchInput = document.getElementById('imaging-log-project-search');
        if (searchInput) searchInput.value = '';

        const statusMenu = document.getElementById('imaging-log-status-menu');
        const statusLabel = document.getElementById('imaging-log-status-label');
        if (statusMenu) {
            statusMenu.querySelectorAll('.astryx-dropdown-item').forEach(i => i.classList.remove('selected'));
            const allItem = statusMenu.querySelector('.astryx-dropdown-item[data-value=""]');
            if (allItem) {
                allItem.classList.add('selected');
                if (statusLabel) statusLabel.textContent = allItem.textContent;
            }
        }

        await this.switchTab('projects');

        const projectCard = document.querySelector(`.project-card[data-project-id="${projectId}"]`);
        if (projectCard) {
            projectCard.scrollIntoView({ behavior: 'smooth', block: 'center' });

            projectCard.classList.add('project-card-highlight');
            setTimeout(() => projectCard.classList.remove('project-card-highlight'), APP_CONFIG.PROJECT_HIGHLIGHT_MS);

            const sessionsContainer = document.getElementById(`project-sessions-${projectId}`);
            if (sessionsContainer && !sessionsContainer.classList.contains('expanded')) {
                this.toggleProjectSessions(projectId);
            }
        }
    }

};

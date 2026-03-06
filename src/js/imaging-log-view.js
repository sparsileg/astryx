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

    /**
     * Initialize view
     */
    async init() {
        console.log('Initializing Imaging Log View');

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
            searchInput.addEventListener('input', () => this.renderProjectList());
        }

        // Status filter
        const statusFilter = document.getElementById('imaging-log-project-status-filter');
        if (statusFilter) {
            statusFilter.addEventListener('change', () => this.renderProjectList());
        }

        // Sort selector
        const sortSelect = document.getElementById('imaging-log-project-sort');
        if (sortSelect) {
            sortSelect.addEventListener('change', () => this.renderProjectList());
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
        }
    },

    /**
     * Render project list
     */
    async renderProjectList() {
        const container = document.getElementById('imaging-log-projects-list');
        if (!container) return;

        const expandedProjects = this.expandedProjectIds;
        const projects = await ImagingLogManager.getAllProjects();

        // Apply filters
        const searchQuery = document.getElementById('imaging-log-project-search')?.value.toLowerCase() || '';
        const statusFilter = document.getElementById('imaging-log-project-status-filter')?.value || '';

        let filteredProjects = projects.filter(project => {
            // Search filter
            if (searchQuery) {
                const nameMatch = project.name.toLowerCase().includes(searchQuery);
                const targetMatch = project.targetDesignations.some(designation =>
                    designation.toLowerCase().includes(searchQuery)
                );
                if (!nameMatch && !targetMatch) return false;
            }

            // Status filter
            if (statusFilter) {
                if (statusFilter === 'all-but-completed') {
                    if (project.status === 'Completed') {
                        return false;
                    }
                } else if (project.status !== statusFilter) {
                    return false;
                }
            }

            return true;
        });

        // Apply sort
        const sortValue = document.getElementById('imaging-log-project-sort')?.value || 'modified-desc';
        filteredProjects = this.sortProjects(filteredProjects, sortValue);

        if (filteredProjects.length === 0) {
            container.innerHTML = '<p class="empty-message">No projects found. Create your first project!</p>';
            return;
        }

        let html = '';
        for (const project of filteredProjects) {
            html += await this.renderProjectCard(project);
        }

        container.innerHTML = html;

        // Restore expanded state
        expandedProjects.forEach(projectId => {
            const sessionsContainer = document.getElementById(`project-sessions-${projectId}`);
            const chevron = document.getElementById(`chevron-${projectId}`);
            const addButton = document.getElementById(`add-session-btn-${projectId}`);
            if (sessionsContainer) {
                sessionsContainer.classList.add('expanded');
                sessionsContainer.style.maxHeight = sessionsContainer.scrollHeight + 'px';
                if (chevron) chevron.classList.add('expanded');
                if (addButton) addButton.style.display = 'inline-block';
            }
        });
    },


    /**
     * Render a single project card
     */
    async renderProjectCard(project) {
        // Get integration time
        const integrationTime = await ImagingLogManager.getIntegrationTimeByFilter(project.id);
        const integrationHTML = Object.entries(integrationTime)
              .filter(([filter, seconds]) => seconds > 0)  // Only show filters with time
              .map(([filter, seconds]) => `${filter}: ${this.formatIntegrationTime(seconds)}`)
              .join(' &nbsp; ');

        // Get sessions
        const sessions = await ImagingLogManager.getSessionsForProject(project.id);
        sessions.sort((a, b) => new Date(a.date) - new Date(b.date));

        const statusClass = this.getStatusClass(project.status);
        const lastModified = new Date(project.modified).toLocaleDateString();

        // Generate unique ID for this project's sessions container
        const sessionsId = `project-sessions-${project.id}`;

        return `
            <div class="project-card" data-project-id="${project.id}">
                <div class="project-card-header" onclick="ImagingLogView.toggleProjectSessions(${project.id})">
                    <div style="flex: 1;">
                        <div class="project-card-title">${this.escapeHtml(project.name)}</div>
                    </div>
                    <div class="project-card-actions">
                        <button class="project-action-btn project-action-btn-delete"
                                onclick="event.stopPropagation(); ImagingLogView.handleDeleteProject(${project.id})">
                            Delete Project
                        </button>
                        <button class="project-action-btn project-action-btn-edit"
                                onclick="event.stopPropagation(); ImagingLogView.handleEditProject(${project.id})">
                            Edit Project
                        </button>
                    </div>
                </div>

                <div class="project-card-meta" onclick="ImagingLogView.toggleProjectSessions(${project.id})">
                    <span>Targets: ${project.targetDesignations.length}</span>
                    <span>Sessions: ${sessions.length}</span>
                    ${integrationHTML ? `<span>${integrationHTML}</span>` : '<span>Integration: -</span>'}
                    <span class="project-status-badge ${statusClass}">${project.status}</span>
                    <span>Modified: ${lastModified}</span>
                </div>

                <!-- Sessions Toggle Row -->
                <div class="project-sessions-toggle" onclick="ImagingLogView.toggleProjectSessions(${project.id})">
                    <span class="sessions-chevron" id="chevron-${project.id}">▶</span>
                    <span class="sessions-label">Imaging Sessions</span>
                    <button class="btn-primary btn-sm"
                            id="add-session-btn-${project.id}"
                            style="display: none; margin-left: auto;"
                            onclick="event.stopPropagation(); ImagingLogView.showSessionModal(null, ${project.id})">
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
            <th>Exposures</th>
            <th>Integration</th>
            <th>Location</th>
            <th>Actions</th>
            </tr>
            </thead>
            <tbody>
            ${sessions.map(session => {
                const exposureCount = session.usedExposures !== undefined && session.usedExposures !== '' && session.usedExposures !== 0
                      ? session.usedExposures
                      : (session.numExposures || 0);
                const integrationSeconds = session.subLength * exposureCount;
                return `
                                        <tr onclick="ImagingLogView.showSessionModal(${session.id}, ${project.id})">
                                            <td>${this.formatSessionDate(session.date)}</td>
                                            <td>${this.escapeHtml(session.filter)}</td>
                                            <td>${exposureCount} × ${session.subLength}s</td>
                                            <td>${this.formatIntegrationTime(integrationSeconds)}</td>
                                            <td>${this.escapeHtml(session.location)}</td>
                                            <td onclick="event.stopPropagation()">
                                                <button class="btn-danger btn-sm"
                                                        onclick="ImagingLogView.deleteSession(${session.id})">
                                                    Delete
                                                </button>
                                            </td>
                                        </tr>
                                    `;
            }).join('')}
        </tbody>
            </table>
            ` : '<p style="color: var(--text-secondary); font-style: italic; padding: 1rem;">No sessions yet.</p>'}
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

        this.openModal('manage-project-template', title, async (action, modalBody) => {
            if (action === 'save') {
                await this.handleSaveProject(modalBody);
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
        // Set up notes expand button
        // Set up notes expand button
        const expandBtn = document.getElementById('project-notes-expand-btn');
        const notesTextarea = document.getElementById('project-notes');
        if (expandBtn && notesTextarea) {
            let expanded = false;
            expandBtn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                expanded = !expanded;
                if (expanded) {
                    notesTextarea.style.cssText = 'height: 30rem !important; min-height: 30rem !important; resize: none !important;';
                    expandBtn.textContent = 'Collapse';
                    // Scroll both textarea and modal to bottom
                    requestAnimationFrame(() => {
                        requestAnimationFrame(() => {
                            // Double RAF ensures reflow is complete
                            notesTextarea.scrollTop = notesTextarea.scrollHeight;

                            const modalBody = document.getElementById('modal-body');
                            const modalContent = document.querySelector('.modal-content');

                            if (modalBody) {
                                modalBody.scrollTop = modalBody.scrollHeight;
                            }
                            if (modalContent) {
                                modalContent.scrollTop = modalContent.scrollHeight;
                            }
                        });
                    });
                } else {
                    notesTextarea.style.cssText = '';
                    notesTextarea.setAttribute('rows', '6');
                    expandBtn.textContent = 'Expand';
                }
            });
        } else {
            console.log('Elements not found!');
        }

        // Set up target search
        const searchInput = document.getElementById('project-target-search');
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                this.searchTargetsForProject(e.target.value);
            });
        }

        if (projectId) {
            // Edit mode - load project data
            const project = await ImagingLogManager.getProject(projectId);
            document.getElementById('project-name').value = project.name;
            document.getElementById('project-status').value = project.status;
            document.getElementById('project-notes').value = project.notes || '';

            // Load selected targets
            this.selectedTargets = [...project.targetDesignations];
            this.renderSelectedTargets();
        } else {
            // Create mode - clear form
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
            resultsContainer.style.display = 'none';
            return;
        }

        const results = DataManager.searchTargets(query, 10);

        if (results.length === 0) {
            resultsContainer.innerHTML = '<p style="padding: 0.5rem; color: var(--text-secondary);">No results</p>';
            resultsContainer.style.display = 'block';
            return;
        }

        let html = '';
        results.forEach(target => {
            const displayName = target.common
                  ? `${target.object} (${target.common})`
                  : target.object;

            html += `
                <div class="target-search-result"
                     onclick="ImagingLogView.addTargetToProject('${this.escapeHtml(target.object)}')">
                    ${this.escapeHtml(displayName)}
                </div>
            `;
        });

        resultsContainer.innerHTML = html;
        resultsContainer.style.display = 'block';
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

        // Clear search
        const searchInput = document.getElementById('project-target-search');
        if (searchInput) searchInput.value = '';

        const resultsContainer = document.getElementById('project-target-search-results');
        if (resultsContainer) {
            resultsContainer.innerHTML = '';
            resultsContainer.style.display = 'none';
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
            container.innerHTML = '<p style="color: var(--text-secondary); font-style: italic;">No targets selected</p>';
            return;
        }

        let html = '';
        this.selectedTargets.forEach(designation => {
            const target = DataManager.getTarget(designation);
            const displayName = target && target.common
                  ? `${designation} (${target.common})`
                  : designation;

            // Get alternate designations from Other field
            let alsoText = '';
            if (target && target.other) {
                const otherDesignations = target.other.split(',').map(d => d.trim()).filter(d => d.length > 0);
                if (otherDesignations.length > 0) {
                    alsoText = ` <span style="color: var(--text-secondary); font-size: 0.9em;">(also: ${this.escapeHtml(otherDesignations.join(', '))})</span>`;
                }
            }

            html += `
                <div class="selected-target-item">
                    <span>${this.escapeHtml(displayName)}${alsoText}</span>
                    <button class="btn-danger btn-sm"
                            onclick="ImagingLogView.removeTargetFromProject('${this.escapeHtml(designation)}')">
                        Remove
                    </button>
                </div>
            `;
        });

        container.innerHTML = html;
    },

    /**
     * Handle save project
     */
    async handleSaveProject(modalBody) {
        const name = document.getElementById('project-name')?.value.trim();
        const status = document.getElementById('project-status')?.value;
        const notes = document.getElementById('project-notes')?.value.trim();

        const projectData = {
            name: name,
            targetDesignations: this.selectedTargets,
            status: status,
            notes: notes
        };

        // Validate
        const validation = ImagingLogManager.validateProject(projectData);
        if (!validation.valid) {
            UIManager.showToast(validation.error, 'error');
            return;
        }

        try {
            if (this.currentProjectId) {
                // Update existing
                await ImagingLogManager.updateProject(this.currentProjectId, projectData);
                UIManager.showToast(`Project "${name}" updated`, 'success');
                UIManager.markDataChanged();
            } else {
                // Create new
                await ImagingLogManager.createProject(projectData);
                UIManager.showToast(`Project "${name}" created`, 'success');
                UIManager.markDataChanged();
            }

            // Check for targets exceeding program max numbers
            await this.checkTargetsAgainstProgramLimits(projectData.targetDesignations);

            // Close modal
            UIManager.closeModal();

            // Refresh project list
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
            // Build full list of designations to check (primary + alternates)
            const toCheck = [designation];
            const target = DataManager.getTarget(designation);
            if (target && target.other) {
                const others = target.other.split(',').map(d => d.trim()).filter(d => d.length > 0);
                others.forEach(o => toCheck.push(o));
            }

            toCheck.forEach(des => {
                patternPrograms.forEach(program => {
                    const normalizedDes = des.replace(/\s+/g, '').toUpperCase();
                    const normalizedPrefix = program.catalogPrefix.replace(/\s+/g, '').toUpperCase();
                    if (normalizedDes.startsWith(normalizedPrefix)) {
                        const afterPrefix = normalizedDes.substring(normalizedPrefix.length);
                        const match = afterPrefix.match(/^(\d+)([A-Z]*)$/);
                        if (match) {
                            const number = parseInt(match[1], 10);
                            if (number > program.maxNumber) {
                                warnings.push(`${des} exceeds max number (${program.maxNumber}) for program "${program.name}"`);
                            }
                        }
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

            // Auto-populate from most recent session if creating new session
            if (!sessionId && projectId) {
                await this.autoPopulateSessionFields(projectId);
            }
        }, 0);
    },

    /**
     * Initialize session modal
     */
    async initializeSessionModal(sessionId, projectId) {
        // Populate equipment dropdowns
        await this.populateSessionEquipmentDropdowns();

        // Set up integration time calculation
        const subLength = document.getElementById('session-sub-length');
        const numExposures = document.getElementById('session-num-exposures');
        const usedExposures = document.getElementById('session-used-exposures');
        if (subLength) {
            subLength.addEventListener('input', () => this.updateSessionIntegrationTime());
        }
        if (numExposures) {
            numExposures.addEventListener('input', () => this.updateSessionIntegrationTime());
        }
        if (usedExposures) {
            usedExposures.addEventListener('input', () => this.updateSessionIntegrationTime());
        }

        // Set up moon calculation button
        const calcMoonBtn = document.getElementById('session-calc-moon-btn');
        if (calcMoonBtn) {
            calcMoonBtn.addEventListener('click', () => this.calculateMoonData());
        }

        if (sessionId) {
            // Edit mode
            const session = await ImagingLogManager.getSession(sessionId);
            document.getElementById('session-project-id').value = session.projectId;
            document.getElementById('session-date').value = session.date;
            document.getElementById('session-location').value = session.location;
            document.getElementById('session-telescope').value = session.telescope;
            document.getElementById('session-sensor').value = session.sensor;
            document.getElementById('session-filter').value = session.filter;
            document.getElementById('session-rotation').value = session.rotation || '';
            document.getElementById('session-temp-setpoint').value = session.tempSetpoint !== undefined ? session.tempSetpoint : -20;
            document.getElementById('session-bin').value = session.bin || '1x1';
            document.getElementById('session-gain').value = session.gain !== undefined ? session.gain : 101;
            document.getElementById('session-offset').value = session.offset !== undefined ? session.offset : 70;
            document.getElementById('session-moon-illumination').value = session.moonIllumination || '';

            // Parse time from ISO datetime
            if (session.moonSet) {
                const moonSetTime = new Date(session.moonSet).toTimeString().slice(0, 5);
                document.getElementById('session-moon-set').value = moonSetTime;
            }
            if (session.moonRise) {
                const moonRiseTime = new Date(session.moonRise).toTimeString().slice(0, 5);
                document.getElementById('session-moon-rise').value = moonRiseTime;
            }

            document.getElementById('session-angle-from-moon').value = session.angleFromMoon || '';
            document.getElementById('session-clouds').value = session.clouds || '';
            document.getElementById('session-smoke').value = session.smoke || '';
            document.getElementById('session-seeing').value = session.seeing || '';
            document.getElementById('session-transparency').value = session.transparency || '';
            document.getElementById('session-sub-length').value = session.subLength;
            document.getElementById('session-num-exposures').value = session.numExposures;
            document.getElementById('session-used-exposures').value = session.usedExposures;
            document.getElementById('session-notes').value = session.notes || '';

            this.updateSessionIntegrationTime();
        } else {
            // Create mode - set defaults
            document.getElementById('session-project-id').value = projectId;
            document.getElementById('session-date').value = new Date().toISOString().split('T')[0];
        }
    },

    /**
     * Populate equipment dropdowns
     */
    async populateSessionEquipmentDropdowns() {
        // Locations
        const locations = DataManager.getLocations();
        const locationSelect = document.getElementById('session-location');
        locationSelect.innerHTML = '<option value="">Select location...</option>';
        Object.keys(locations).sort().forEach(name => {
            locationSelect.innerHTML += `<option value="${name}">${name}</option>`;
        });

        // Telescopes
        const telescopes = DataManager.getTelescopes();
        const telescopeSelect = document.getElementById('session-telescope');
        telescopeSelect.innerHTML = '<option value="">Select telescope...</option>';
        Object.keys(telescopes).sort().forEach(name => {
            telescopeSelect.innerHTML += `<option value="${name}">${name}</option>`;
        });

        // Sensors
        const sensors = DataManager.getSensors();
        const sensorSelect = document.getElementById('session-sensor');
        sensorSelect.innerHTML = '<option value="">Select sensor...</option>';
        Object.keys(sensors).sort().forEach(name => {
            sensorSelect.innerHTML += `<option value="${name}">${name}</option>`;
        });

        // Filters
        const filters = DataManager.getFilters();
        const filterSelect = document.getElementById('session-filter');
        filterSelect.innerHTML = '<option value="">Select filter...</option>';
        Object.keys(filters).sort().forEach(name => {
            filterSelect.innerHTML += `<option value="${name}">${name}</option>`;
        });
        filterSelect.innerHTML += '<option value="__ADD_NEW__">+ Add New Filter...</option>';

        // Set up filter change handler for inline creation
        filterSelect.addEventListener('change', (e) => {
            if (e.target.value === '__ADD_NEW__') {
                this.showInlineFilterInput();
            }
        });
    },


    /**
     * Update integration time display
     */
    updateSessionIntegrationTime() {
        const subLength = parseFloat(document.getElementById('session-sub-length').value) || 0;
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
        const dateStr = document.getElementById('session-date').value;
        const locationName = document.getElementById('session-location').value;
        const projectId = parseInt(document.getElementById('session-project-id').value);

        if (!dateStr || !locationName) {
            UIManager.showToast('Please select date and location first', 'error');
            return;
        }

        if (!projectId) {
            UIManager.showToast('Project not found', 'error');
            return;
        }

        // Get project and use first target
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
            // Convert date to JD (at midnight local time)
            // Parse date components to avoid timezone ambiguity
            const [year, month, day] = dateStr.split('-').map(Number);
            const date = new Date(year, month - 1, day, 0, 0, 0);
            const jd = TimeUtils.dateToJD(date);

            // Get moon phase (illumination %)
            const moonPhase = getMoonPhase(jd);
            document.getElementById('session-moon-illumination').value = Math.round(moonPhase.illumination);

            // Get moon rise/set
            const moonRiseSet = findMoonRiseSet(jd, jd + 1, location.latitude, location.longitude, location.elevation, dateStr, location.timezone);

            if (moonRiseSet.moonrise) {
                const riseDate = jdToDate(moonRiseSet.moonrise);
                document.getElementById('session-moon-rise').value = riseDate.toTimeString().slice(0, 5);
            }

            if (moonRiseSet.moonset) {
                const setDate = jdToDate(moonRiseSet.moonset);
                document.getElementById('session-moon-set').value = setDate.toTimeString().slice(0, 5);
            }

            // Calculate target-moon separation at transit (when target is highest)
            // Transit occurs when target crosses meridian (azimuth 180°)
            const transitJD = this.findTargetTransit(jd, target.ra, target.dec, location.latitude, location.longitude);
            const moonPos = getMoonPosition(transitJD);
            const separation = getAngularSeparation(target.ra, target.dec, moonPos.ra, moonPos.dec);
            document.getElementById('session-angle-from-moon').value = Math.round(separation);

            UIManager.showToast('Moon data calculated', 'success');

        } catch (error) {
            console.error('Error calculating moon data:', error);
            UIManager.showToast('Error calculating moon data: ' + error.message, 'error');
        }
    },

    /**
     * Find target transit time (when it crosses meridian)
     * @param {number} startJD - Julian Date to start search from (midnight)
     * @param {number} targetRA - Target right ascension (hours)
     * @param {number} latitude - Observer latitude (degrees)
     * @param {number} longitude - Observer longitude (degrees)
     * @returns {number} JD of transit
     */
    findTargetTransit(startJD, targetRA, targetDec, latitude, longitude) {
        // Search from midnight to midnight next day
        const oneMinute = 1 / 1440;
        let currentJD = startJD;
        let maxAltitude = -90;
        let transitJD = startJD;

        // Search every minute for 24 hours
        for (let i = 0; i < 1440; i++) {
            const altitude = getAltitude(currentJD, targetRA, targetDec, latitude, longitude);
            if (altitude > maxAltitude) {
                maxAltitude = altitude;
                transitJD = currentJD;
            }
            currentJD += oneMinute;
        }

        return transitJD;
    },

    /**
     * Handle save session
     */
    async handleSaveSession(modalBody) {
        const projectId = parseInt(document.getElementById('session-project-id').value);
        const date = document.getElementById('session-date').value;
        const location = document.getElementById('session-location').value;
        const telescope = document.getElementById('session-telescope').value;
        const sensor = document.getElementById('session-sensor').value;
        const filter = document.getElementById('session-filter').value;
        const rotation = parseFloat(document.getElementById('session-rotation').value) || 0;

        const tempSetpointValue = document.getElementById('session-temp-setpoint').value;
        const tempSetpoint = tempSetpointValue === '' ? '' : parseFloat(tempSetpointValue);
        const bin = document.getElementById('session-bin').value;
        const gainValue = document.getElementById('session-gain').value;
        const gain = gainValue === '' ? '' : parseInt(gainValue);
        const offsetValue = document.getElementById('session-offset').value;
        const offset = offsetValue === '' ? '' : parseInt(offsetValue);
        const moonIllumination = parseInt(document.getElementById('session-moon-illumination').value) || 0;

        // Convert time to ISO datetime
        const moonSetTime = document.getElementById('session-moon-set').value;
        const moonRiseTime = document.getElementById('session-moon-rise').value;
        const moonSet = moonSetTime ? `${date}T${moonSetTime}:00Z` : null;
        const moonRise = moonRiseTime ? `${date}T${moonRiseTime}:00Z` : null;

        const angleFromMoon = parseInt(document.getElementById('session-angle-from-moon').value) || 0;
        const clouds = document.getElementById('session-clouds').value.trim();
        const smoke = document.getElementById('session-smoke').value.trim();
        const seeing = document.getElementById('session-seeing').value.trim();
        const transparency = document.getElementById('session-transparency').value.trim();
        const subLength = parseInt(document.getElementById('session-sub-length').value);
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

        // Validate
        const validation = ImagingLogManager.validateSession(sessionData);
        if (!validation.valid) {
            UIManager.showToast(validation.error, 'error');
            return;
        }

        try {
            if (this.currentSessionId) {
                // Update existing
                await ImagingLogManager.updateSession(this.currentSessionId, sessionData);
                UIManager.showToast('Session updated', 'success');
                UIManager.markDataChanged();
            } else {
                // Create new
                await ImagingLogManager.createSession(sessionData);
                UIManager.showToast('Session created', 'success');
                UIManager.markDataChanged();
            }

            // Close modal
            UIManager.closeModal();

            // Refresh project list (which includes sessions)
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
        if (!confirm('Delete this imaging session?')) {
            return;
        }

        try {
            // Get the session to find its project
            const session = await ImagingLogManager.getSession(sessionId);
            const projectId = session.projectId;

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

        if (!confirm(`This action will permanently delete the project "${project.name}" and all its sessions. Are you sure?`)) {
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
                // Collapse - set max-height to current height first, then to 0
                sessionsContainer.style.maxHeight = sessionsContainer.scrollHeight + 'px';
                // Force reflow
                sessionsContainer.offsetHeight;
                sessionsContainer.style.maxHeight = '0';
                sessionsContainer.classList.remove('expanded');
            } else {
                // Expand - set to actual content height
                sessionsContainer.classList.add('expanded');
                sessionsContainer.style.maxHeight = sessionsContainer.scrollHeight + 'px';
            }

            // Rotate chevron
            if (chevron) {
                if (isExpanded) {
                    chevron.classList.remove('expanded');
                } else {
                    chevron.classList.add('expanded');
                }
            }

            // Show/hide add button
            if (addButton) {
                addButton.style.display = isExpanded ? 'none' : 'inline-block';
            }
        }
    },

    /**
     * Format integration time (seconds to hours)
     */
    formatIntegrationTime(seconds) {
        const hours = seconds / 3600;
        return hours.toFixed(1) + 'h';
    },

    /**
     * Get status CSS class
     */
    getStatusClass(status) {
        return 'status-' + status.toLowerCase().replace(/ /g, '-');
    },

    /**
     * Escape HTML to prevent XSS
     */
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    },

    /**
     * Show inline filter input
     */
    showInlineFilterInput() {
        const filterSelect = document.getElementById('session-filter');
        const filterInput = document.getElementById('session-filter-new-input');

        if (!filterInput) return;

        // Store previous value
        const previousValue = filterSelect.value;

        // Hide dropdown, show input
        filterSelect.style.display = 'none';
        filterInput.style.display = 'block';
        filterInput.value = '';
        filterInput.focus();

        // Handle Enter key
        const handleEnter = async (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                const newFilterName = filterInput.value.trim();

                if (newFilterName) {
                    await this.saveInlineFilter(newFilterName);
                } else {
                    this.hideInlineFilterInput();
                }

                filterInput.removeEventListener('keydown', handleEnter);
                filterInput.removeEventListener('keydown', handleEsc);
            }
        };

        // Handle Esc key
        const handleEsc = (e) => {
            if (e.key === 'Escape') {
                e.preventDefault();
                this.hideInlineFilterInput();
                filterInput.removeEventListener('keydown', handleEnter);
                filterInput.removeEventListener('keydown', handleEsc);
            }
        };

        filterInput.addEventListener('keydown', handleEnter);
        filterInput.addEventListener('keydown', handleEsc);

        // Handle blur (click outside)
        const handleBlur = () => {
            setTimeout(() => {
                this.hideInlineFilterInput();
                filterInput.removeEventListener('blur', handleBlur);
                filterInput.removeEventListener('keydown', handleEnter);
                filterInput.removeEventListener('keydown', handleEsc);
            }, 200);
        };

        filterInput.addEventListener('blur', handleBlur);
    },

    /**
     * Hide inline filter input
     */
    hideInlineFilterInput() {
        const filterSelect = document.getElementById('session-filter');
        const filterInput = document.getElementById('session-filter-new-input');

        if (!filterInput) return;

        filterInput.style.display = 'none';
        filterSelect.style.display = 'block';
        filterSelect.value = ''; // Reset to "Select filter..."
    },

    /**
     * Save inline filter
     */
    async saveInlineFilter(name) {
        // Check if already exists
        if (DataManager.getFilter(name)) {
            UIManager.showToast(`Filter "${name}" already exists`, 'error');
            this.hideInlineFilterInput();
            return;
        }

        try {
            // Save filter
            await DataManager.saveFilter(name);
            UIManager.showToast(`Filter "${name}" added`, 'success');

            // Refresh dropdown
            await this.populateSessionEquipmentDropdowns();

            // Select the new filter
            const filterSelect = document.getElementById('session-filter');
            filterSelect.value = name;

            // Hide input, show dropdown
            const filterInput = document.getElementById('session-filter-new-input');
            filterInput.style.display = 'none';
            filterSelect.style.display = 'block';

        } catch (error) {
            console.error('Error saving filter:', error);
            UIManager.showToast('Error saving filter: ' + error.message, 'error');
            this.hideInlineFilterInput();
        }
    },

    /**
     * Format session date without timezone issues
     */
    formatSessionDate(dateStr) {
        // Parse as local date (YYYY-MM-DD)
        const [year, month, day] = dateStr.split('-').map(Number);
        const date = new Date(year, month - 1, day);
        return date.toLocaleDateString();
    },

    // ============================================================================
    // Program Management
    // ============================================================================

    /**
     * Setup program controls
     */
    setupProgramControls() {
        const importProgramBtn = document.getElementById('imaging-log-import-program-btn');
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

        let html = '';
        for (const program of programs) {
            html += await this.renderProgramCard(program);
        }

        container.innerHTML = html;

        // Add action button listeners
        const actionButtons = document.querySelectorAll('.project-action-btn[data-program-id]');
        actionButtons.forEach(btn => {
            btn.addEventListener('click', async (e) => {
                e.stopPropagation();
                const programId = parseInt(btn.getAttribute('data-program-id'));
                const action = btn.getAttribute('data-action');
                console.log('Program ID:', programId, 'Action:', action);

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
    async renderProgramCard(program) {
        // Get progress
        const progress = await ImagingLogManager.getProgramProgress(program.id);
        const progressPercent = parseFloat(progress.percentage);

        // Determine if pattern-based or manual
        const isPattern = ImagingLogManager.isProgramPatternBased(program);

        // Calculate status based on progress
        let status = 'Not Started';
        if (progress.imaged > 0 && progress.imaged < progress.total) {
            status = 'Started';
        } else if (progress.imaged === progress.total && progress.total > 0) {
            status = 'Complete';
        }

        // Status badge
        const statusClass = status === 'Complete' ? 'status-completed' : 'status-acquiring-data';

        return `
            <div class="project-card">
                <div class="project-card-header">
                    <div style="flex: 1;">
                        <div class="project-card-title">
                            ${this.escapeHtml(program.name)}
                            ${isPattern ? `<span style="color: var(--text-secondary); font-size: 0.85em; margin-left: 0.5rem;">(${program.catalogPrefix} 1-${program.maxNumber})</span>` : ''}
                        </div>
                    </div>
                    <div class="project-card-actions">
                        <button class="project-action-btn project-action-btn-delete"
                                data-program-id="${program.id}" data-action="delete">
                            Delete Program
                        </button>
                        <button class="project-action-btn project-action-btn-edit"
                                data-program-id="${program.id}" data-action="edit">
                            Edit Program
                        </button>
                    </div>
                </div>

                <div class="project-card-meta">
                    <span>Targets: ${progress.total}</span>
                    <span>Imaged: ${progress.imaged} (${progressPercent}%)</span>
                    <span>Remaining: ${progress.total - progress.imaged}</span>
                    <span class="project-status-badge ${statusClass}">${status}</span>
                </div>

                <!-- Progress bar -->
                <div style="margin-top: 0.75rem;">
                    <div style="background: var(--border-color); height: 8px; border-radius: 4px; overflow: hidden;">
                        <div style="background: var(--primary-color); height: 100%; width: ${progressPercent}%; transition: width 0.3s;"></div>
                    </div>
                </div>
            </div>
        `;
    },


    /**
     * Handle edit program button click
     */
    async handleEditProgram(programId) {
        await this.showImportProgramModal(programId);
    },

    /**
     * Handle delete program button click with confirmation
     */
    async handleDeleteProgram(programId) {
        await this.deleteProgramConfirm(programId);
    },

    /**
     * Show program modal (create or edit)
     */
    async showProgramModal(programId = null) {
        const modal = document.getElementById('program-modal');

        modal.innerHTML = `
            <div class="modal-content">
                <div class="modal-header">
                    <h2>${programId ? 'Edit Program' : 'New Program'}</h2>
                    <button class="modal-close" onclick="ImagingLogView.closeProgramModal()">&times;</button>
                </div>
                <div class="modal-body">
                    <div class="form-group">
                        <label for="program-name">Program Name</label>
                        <input type="text" id="program-name" placeholder="e.g., Messier Marathon">
                    </div>

                    <div class="form-group">
                        <label>Program Type</label>
                        <div style="display: flex; gap: 1.5rem; margin-top: 0.5rem;">
                            <label style="display: flex; align-items: center; gap: 0.5rem; cursor: pointer;">
                                <input type="radio" name="program-type" value="pattern" id="program-type-pattern">
                                <span>Catalog Pattern</span>
                            </label>
                            <label style="display: flex; align-items: center; gap: 0.5rem; cursor: pointer;">
                                <input type="radio" name="program-type" value="manual" id="program-type-manual" checked>
                                <span>Manual List</span>
                            </label>
                        </div>
                    </div>

                    <!-- Pattern Mode Fields -->
                    <div id="pattern-fields" style="display: none;">
                        <div class="form-group">
                            <label for="program-catalog-prefix">Catalog Prefix</label>
                            <input type="text" id="program-catalog-prefix" placeholder="e.g., NGC, M, IC, Sh">
                        </div>
                        <div class="form-group">
                            <label for="program-max-number">Maximum Number</label>
                            <input type="number" id="program-max-number" min="1" placeholder="e.g., 7840">
                        </div>
                    </div>

                    <!-- Manual List Fields -->
                    <div id="manual-fields">
                        <div class="form-group">
                            <label for="program-targets">
                                Target List
                                <button type="button" class="btn-sm" id="import-targets-btn">Import from Database</button>
                            </label>
                            <textarea id="program-targets" rows="10"
                                placeholder="Enter (or paste) target designations (one per line)&#10;M 31&#10;M 42&#10;NGC 7000"></textarea>

                            <!-- Import Results Display -->
                            <div id="import-results" style="display: none; margin-top: 1rem; padding: 1rem; background: var(--card-bg); border: 1px solid var(--border-color); border-radius: 4px;">
                                <div id="import-results-summary" style="margin-bottom: 1rem;"></div>
                                <div id="import-results-matched" style="margin-bottom: 1rem;"></div>
                                <div id="import-results-failed"></div>
                            </div>
                        </div>
                        </div>
                    </div>

                    <div class="form-group">
                        <label for="program-status">Status</label>
                        <select id="program-status">
                            <option value="Not Started">Not Started</option>
                            <option value="Started">Started</option>
                            <option value="Complete">Complete</option>
                        </select>
                    </div>
                </div>
                <div class="modal-footer">
                    <button class="btn-secondary" onclick="ImagingLogView.closeProgramModal()">Cancel</button>
                    <button class="btn-primary" id="save-program-btn">Save Program</button>
                </div>
            </div>
        `;

        modal.style.display = 'flex';

        setTimeout(async () => {
            await this.initializeProgramModal(programId);
        }, 0);
    },

    async initializeProgramModal(programId) {
        const nameField = document.getElementById('program-name');
        const patternRadio = document.getElementById('program-type-pattern');
        const manualRadio = document.getElementById('program-type-manual');
        const patternFields = document.getElementById('pattern-fields');
        const manualFields = document.getElementById('manual-fields');
        const catalogPrefixField = document.getElementById('program-catalog-prefix');
        const maxNumberField = document.getElementById('program-max-number');
        const targetsField = document.getElementById('program-targets');
        const statusField = document.getElementById('program-status');
        const importBtn = document.getElementById('import-targets-btn');
        const saveBtn = document.getElementById('save-program-btn');

        // Toggle fields based on program type
        const toggleFields = () => {
            if (patternRadio.checked) {
                patternFields.style.display = 'block';
                manualFields.style.display = 'none';
            } else {
                patternFields.style.display = 'none';
                manualFields.style.display = 'block';
            }
        };

        patternRadio.addEventListener('change', toggleFields);
        manualRadio.addEventListener('change', toggleFields);

        // If editing existing program
        if (programId) {
            const program = await ImagingLogManager.getProgram(programId);
            if (program) {
                nameField.value = program.name;
                statusField.value = program.status;

                // Detect program mode
                if (ImagingLogManager.isProgramPatternBased(program)) {
                    patternRadio.checked = true;
                    catalogPrefixField.value = program.catalogPrefix;
                    maxNumberField.value = program.maxNumber;
                } else {
                    manualRadio.checked = true;
                    targetsField.value = program.targetDesignations.join('\n');
                }

                toggleFields();
            }
        }

        // Import button handler
        importBtn.addEventListener('click', () => {
            this.showTargetImportModal(programId);
        });

        // Save button handler
        saveBtn.addEventListener('click', async () => {
            const name = nameField.value.trim();
            if (!name) {
                UIManager.showToast('Program name is required', 'error');
                return;
            }

            const programData = {
                name: name,
                status: statusField.value
            };

            // Pattern-based mode
            if (patternRadio.checked) {
                const prefix = catalogPrefixField.value.trim();
                const maxNum = parseInt(maxNumberField.value);

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
            }
            // Manual list mode
            else {
                const targetList = targetsField.value
                    .split('\n')
                    .map(line => line.trim())
                    .filter(line => line.length > 0);

                if (targetList.length === 0) {
                    UIManager.showToast('At least one target is required', 'error');
                    return;
                }

                programData.targetDesignations = targetList;
            }

            try {
                if (programId) {
                    await ImagingLogManager.updateProgram(programId, programData);
                    UIManager.showToast('Program updated', 'success');
                    UIManager.markDataChanged();
                } else {
                    await ImagingLogManager.createProgram(programData);
                    UIManager.showToast('Program created', 'success');
                    UIManager.markDataChanged();
                }

                this.closeProgramModal();
                await this.renderProgramsList();
                await this.renderReports();
            } catch (error) {
                console.error('Error saving program:', error);
                UIManager.showToast('Error saving program: ' + error.message, 'error');
            }
        });
    },


    /**
     * Show import program modal
     */
    showImportProgramModal(programId = null) {
        this.currentProgramId = programId;  // Store for later use
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
        const patternRadio = document.getElementById('program-type-pattern');
        const manualRadio = document.getElementById('program-type-manual');
        const patternFields = document.getElementById('pattern-fields');
        const manualFields = document.getElementById('manual-fields');

        // Toggle fields based on program type
        const toggleFields = () => {
            if (patternRadio && manualRadio) {
                if (patternRadio.checked) {
                    patternFields.style.display = 'block';
                    manualFields.style.display = 'none';
                } else {
                    patternFields.style.display = 'none';
                    manualFields.style.display = 'block';
                }
            }
        };

        if (patternRadio) patternRadio.addEventListener('change', toggleFields);
        if (manualRadio) manualRadio.addEventListener('change', toggleFields);

        // If editing existing program
        if (programId) {
            console.log('Loading program:', programId);
            const program = await ImagingLogManager.getProgram(programId);
            console.log('Program loaded:', program);

            if (program) {
                document.getElementById('program-name').value = program.name;

                // Detect program mode
                if (ImagingLogManager.isProgramPatternBased(program)) {
                    console.log('Pattern-based program detected');
                    const prefixField = document.getElementById('program-catalog-prefix');
                    const maxField = document.getElementById('program-max-number');

                    patternRadio.checked = true;

                    if (prefixField) prefixField.value = program.catalogPrefix;
                    if (maxField) maxField.value = program.maxNumber;

                    patternRadio.checked = true;
                    document.getElementById('program-catalog-prefix').value = program.catalogPrefix;
                    document.getElementById('program-max-number').value = program.maxNumber;
                } else {
                    console.log('Manual list program detected');
                    manualRadio.checked = true;
                    document.getElementById('program-targets').value = program.targetDesignations.join('\n');
                }

                toggleFields();
            }
        }
    },

    /**
     * Handle save program
     */
    async handleSaveProgram(modalBody, programId = null) {
        const name = document.getElementById('program-name')?.value.trim();
        const patternRadio = document.getElementById('program-type-pattern');

        if (!name) {
            UIManager.showToast('Program name is required', 'error');
            return;
        }

        const programData = {
            name: name
        };

        // Pattern-based mode
        if (patternRadio && patternRadio.checked) {
            const prefix = document.getElementById('program-catalog-prefix')?.value.trim();
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
                    const updateData = {
                        name: name,
                        catalogPrefix: prefix,
                        maxNumber: maxNum
                    };
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
        }
        // Manual list mode
        else {
            const targetList = document.getElementById('program-targets')?.value.trim();

            if (!targetList) {
                UIManager.showToast('Target list is required', 'error');
                return;
            }

            try {
                // Match targets against database
                const results = await ImagingLogManager.matchProgramTargets(targetList);

                // Display results
                this.displayImportResults(results);

                // If we have matches, create the program
                if (results.matched.length > 0) {
                    const targetDesignations = results.matched.map(m => m.target.object);

                    programData.targetDesignations = targetDesignations;

                    if (programId) {
                        // Editing existing manual list program
                        await ImagingLogManager.updateProgram(programId, programData);
                        UIManager.showToast(`Program "${name}" updated with ${results.matched.length} targets`, 'success');
                        UIManager.markDataChanged();
                    } else {
                        // Creating new manual list program
                        await ImagingLogManager.createProgram(programData);
                        UIManager.showToast(`Program "${name}" created with ${results.matched.length} targets`, 'success');
                        UIManager.markDataChanged();
                    }

//                    UIManager.closeModal();
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

    /**
     * Display import results
     */
    displayImportResults(results) {
        const resultsDiv = document.getElementById('import-results');
        const summaryDiv = document.getElementById('import-results-summary');
        const matchedDiv = document.getElementById('import-results-matched');
        const failedDiv = document.getElementById('import-results-failed');

        if (!resultsDiv) return;

        // Clear previous results
        summaryDiv.innerHTML = '';
        matchedDiv.innerHTML = '';
        failedDiv.innerHTML = '';

        resultsDiv.style.display = 'block';

        // Summary
        summaryDiv.innerHTML = `
            <p><strong>Matched:</strong> ${results.matched.length} targets</p>
            <p><strong>Failed:</strong> ${results.failed.length} targets</p>
        `;

        // Matched targets (collapsed by default)
        if (results.matched.length > 0) {
            matchedDiv.innerHTML = `
                <details>
                    <summary style="cursor: pointer; font-weight: 600; margin-bottom: 0.5rem;">
                        Matched Targets (${results.matched.length})
                    </summary>
                    <div style="max-height: 200px; overflow-y: auto; padding: 0.5rem; background: var(--hover-bg); border-radius: 4px;">
                        ${results.matched.map(m =>
                            `<div>${this.escapeHtml(m.input)} → ${this.escapeHtml(m.target.object)}</div>`
                        ).join('')}
                    </div>
                </details>
            `;
        }

        // Failed targets with CSV export
        if (results.failed.length > 0) {
            failedDiv.innerHTML = `
                <details open>
                    <summary style="cursor: pointer; font-weight: 600; margin-bottom: 0.5rem; color: var(--error-color);">
                        Failed Targets (${results.failed.length})
                    </summary>
                    <div style="max-height: 200px; overflow-y: auto; padding: 0.5rem; background: var(--hover-bg); border-radius: 4px; margin-bottom: 0.5rem;">
                        ${results.failed.map(f =>
                            `<div>${this.escapeHtml(f.input)}</div>`
                        ).join('')}
                    </div>
                    <button class="btn-secondary btn-sm" onclick="ImagingLogView.exportMissingTargetsCSV()">
                        Copy Missing Targets as CSV
                    </button>
                </details>
            `;

            // Store failed targets for CSV export
            this.failedImportTargets = results.failed;
        }
    },

    /**
     * Export missing targets as CSV
     */
    exportMissingTargetsCSV() {
        if (!this.failedImportTargets || this.failedImportTargets.length === 0) {
            UIManager.showToast('No failed targets to export', 'error');
            return;
        }

        const csv = ImagingLogManager.generateMissingTargetsCSV(this.failedImportTargets);

        // Copy to clipboard
        navigator.clipboard.writeText(csv).then(() => {
            UIManager.showToast('CSV copied to clipboard', 'success');
        }).catch(err => {
            console.error('Failed to copy CSV:', err);
            UIManager.showToast('Failed to copy CSV', 'error');
        });
    },

    /**
     * Delete program with confirmation
     */
    async deleteProgramConfirm(programId) {
        const program = await ImagingLogManager.getProgram(programId);

        if (!confirm(`Delete program "${program.name}"?`)) {
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

    /**
     * Render all reports
     */
    async renderReports() {
        await this.renderCatalogCoverageReport();
        await this.renderProgramProgressReport();
        await this.renderProjectStatusReport();
    },

    /**
     * Catalog Coverage Report
     */
    async renderCatalogCoverageReport() {
        const container = document.getElementById('report-catalog-coverage');
        if (!container) return;

        // Get all projects and their targets
        const projects = await ImagingLogManager.getAllProjects();
        const allTargets = new Set();

        projects.forEach(project => {
            project.targetDesignations.forEach(designation => {
                // Add primary designation
                allTargets.add(designation);

                // Add alternate designations from Other field
                const target = DataManager.getTarget(designation);
                if (target && target.other) {
                    const otherDesignations = target.other.split(',').map(d => d.trim()).filter(d => d.length > 0);
                    otherDesignations.forEach(other => allTargets.add(other));
                }
            });
        });

        // Count by catalog
        const catalogCounts = {};
        allTargets.forEach(designation => {
            const catalog = this.getCatalogFromDesignation(designation);
            catalogCounts[catalog] = (catalogCounts[catalog] || 0) + 1;
        });

        // Sort by count descending
        const sortedCatalogs = Object.entries(catalogCounts)
              .sort((a, b) => b[1] - a[1]);

        if (sortedCatalogs.length === 0) {
            container.innerHTML = '<p style="color: var(--text-secondary);">No targets imaged yet.</p>';
            return;
        }

        let html = '<table class="session-table">';
        html += '<thead><tr><th>Catalog</th><th>Targets Imaged</th></tr></thead>';
        html += '<tbody>';

        sortedCatalogs.forEach(([catalog, count]) => {
            html += `<tr><td>${catalog}</td><td>${count}</td></tr>`;
        });

        html += '</tbody></table>';
        container.innerHTML = html;
    },

    /**
     * Program Progress Report
     */
    async renderProgramProgressReport() {
        const container = document.getElementById('report-program-progress');
        if (!container) return;

        const programs = await ImagingLogManager.getAllPrograms();

        if (programs.length === 0) {
            container.innerHTML = '<p style="color: var(--text-secondary);">No programs created yet.</p>';
            return;
        }

        let html = '';

        for (const program of programs) {
            const progress = await ImagingLogManager.getProgramProgress(program.id);
            const projects = await ImagingLogManager.getAllProjects();
            const isPattern = ImagingLogManager.isProgramPatternBased(program);

            // Get all imaged targets from projects
            const imagedTargets = new Set();
            projects.forEach(project => {
                project.targetDesignations.forEach(designation => {
                    imagedTargets.add(designation);
                });
            });

            // Build completed targets section
            let completedSection = '';
            if (progress.imaged > 0) {
                let completedTargets;

                if (isPattern) {
                    // Pattern-based: calculate dynamically from projects
                    const matchedDesignations = new Set();
                    projects.forEach(project => {
                        project.targetDesignations.forEach(designation => {
                            if (ImagingLogManager.matchesPattern(designation, program.catalogPrefix, program.maxNumber)) {
                                matchedDesignations.add(designation);
                            }
                            const target = DataManager.getTarget(designation);
                            if (target && target.other) {
                                const otherDesignations = target.other.split(',').map(d => d.trim()).filter(d => d.length > 0);
                                otherDesignations.forEach(other => {
                                    if (ImagingLogManager.matchesPattern(other, program.catalogPrefix, program.maxNumber)) {
                                        matchedDesignations.add(other);
                                    }
                                });
                            }
                        });
                    });
                    completedTargets = Array.from(matchedDesignations)
                        .sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }));
                } else {
                    // Manual list: filter targetDesignations
                    completedTargets = program.targetDesignations
                        .filter(t => imagedTargets.has(t))
                        .sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }));
                }

                let completedHTML = '';
                completedTargets.forEach(target => {
                    // First try direct match
                    let targetProjects = projects.filter(p => p.targetDesignations.includes(target));

                    // If no direct match, find projects where this target appears in Other field
                    if (targetProjects.length === 0) {
                        targetProjects = projects.filter(p => {
                            return p.targetDesignations.some(designation => {
                                const dbTarget = DataManager.getTarget(designation);
                                if (dbTarget && dbTarget.other) {
                                    const otherDesignations = dbTarget.other.split(',').map(d => d.trim());
                                    return otherDesignations.includes(target);
                                }
                                return false;
                            });
                        });
                    }

                    const projectLinks = targetProjects.map(proj =>
                        `<span onclick="ImagingLogView.navigateToProject('${proj.id}')"
                               style="cursor: pointer; color: var(--primary-color); text-decoration: underline;">
                            ${this.escapeHtml(proj.name)}
                        </span>`
                    ).join(', ');

                    completedHTML += `
                        <div style="padding: 0.25rem;">
                            <strong>${target}:</strong> ${projectLinks || '<span style="color: var(--text-secondary);">No project found</span>'}
                        </div>
                    `;
                });

                completedSection = `
                    <details style="margin-bottom: 0.5rem;">
                        <summary style="cursor: pointer; color: var(--success-color); font-size: 0.9rem;">
                            Targets Completed (${progress.imaged})
                        </summary>
                        <div style="margin-top: 0.5rem; max-height: 200px; overflow-y: auto; padding: 0.5rem; background: var(--hover-bg); border-radius: 4px; font-size: 0.9rem;">
                            ${completedHTML}
                        </div>
                    </details>
                `;
            }

            // Build missing targets section (only for manual list programs)
            let missingSection = '';
            if (!isPattern) {
                const missingTargets = program.targetDesignations.filter(
                    designation => !imagedTargets.has(designation)
                );

                if (missingTargets.length > 0) {
                    const sortedMissing = missingTargets.sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }));
                    missingSection = `
                        <details>
                            <summary style="cursor: pointer; color: var(--text-secondary); font-size: 0.9rem;">
                                Targets yet to be imaged (${missingTargets.length})
                            </summary>
                            <div style="margin-top: 0.5rem; max-height: 150px; overflow-y: auto; padding: 0.5rem; background: var(--hover-bg); border-radius: 4px; font-size: 0.9rem;">
                                ${sortedMissing.join(', ')}
                            </div>
                        </details>
                    `;
                } else {
                    missingSection = '<div style="color: var(--success-color); font-weight: 600;">✓ Program Complete!</div>';
                }
            }

            html += `
                <div class="info-card" style="margin-bottom: 1rem; padding: 1rem;">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem;">
                        <strong style="font-size: 1.05rem;">
                            ${this.escapeHtml(program.name)}
                            ${isPattern ? `<span style="color: var(--text-secondary); font-size: 0.85em; margin-left: 0.5rem;">(${program.catalogPrefix} 1-${program.maxNumber})</span>` : ''}
                        </strong>
                        <span class="project-status-badge ${progress.imaged === progress.total && progress.total > 0 ? 'status-completed' : 'status-acquiring-data'}">
                            ${progress.imaged === 0 ? 'Not Started' : progress.imaged === progress.total && progress.total > 0 ? 'Complete' : 'Started'}
                        </span>
                    </div>
                    <div style="margin-bottom: 0.5rem;">
                        Progress: ${progress.imaged}/${progress.total} (${progress.percentage}%)
                    </div>
                    <div style="background: var(--border-color); height: 8px; border-radius: 4px; overflow: hidden; margin-bottom: 0.75rem;">
                        <div style="background: var(--primary-color); height: 100%; width: ${progress.percentage}%;"></div>
                    </div>
                    ${completedSection}
                    ${missingSection}
                </div>
            `;
        }

        container.innerHTML = html;
    },

    /**
     * Project Status Report
     */
    async renderProjectStatusReport() {
        const container = document.getElementById('report-project-status');
        if (!container) return;
        const projects = await ImagingLogManager.getAllProjects();
        if (projects.length === 0) {
            container.innerHTML = '<p style="color: var(--text-secondary);">No projects created yet.</p>';
            return;
        }
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

            let totalSessions = 0;
            for (const project of projectList) {
                const sessions = await ImagingLogManager.getSessionsForProject(project.id);
                totalSessions += sessions.length;
            }
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
     * Get catalog name from designation
     */
    getCatalogFromDesignation(designation) {
        const prefix = designation.split(' ')[0].replace(/[0-9-]/g, '');

        return CATALOG_MAP[prefix] || 'Other';
    },

    /**
     * Auto-populate session fields from most recent session for this project
     */
    async autoPopulateSessionFields(projectId) {
        const sessions = await ImagingLogManager.getSessionsForProject(projectId);

        if (sessions.length === 0) {
            return; // No previous sessions to copy from
        }

        // Sort by date to get most recent
        sessions.sort((a, b) => new Date(b.date) - new Date(a.date));
        const mostRecent = sessions[0];

        // Auto-populate these fields
        if (mostRecent.location) {
            document.getElementById('session-location').value = mostRecent.location;
        }
        if (mostRecent.telescope) {
            document.getElementById('session-telescope').value = mostRecent.telescope;
        }
        if (mostRecent.sensor) {
            document.getElementById('session-sensor').value = mostRecent.sensor;
        }
        if (mostRecent.filter) {
            document.getElementById('session-filter').value = mostRecent.filter;
        }
        if (mostRecent.subLength) {
            document.getElementById('session-sub-length').value = mostRecent.subLength;
        }
},

    /**
     * Navigate to a specific project
     */
    async navigateToProject(projectId) {
        // Switch to Projects tab
        this.switchTab('projects');

        // Clear status filter to show all projects
        const statusFilter = document.getElementById('imaging-log-project-status-filter');
        if (statusFilter) {
            statusFilter.value = ''; // Show all statuses
        }

        // Wait for render
        await this.renderProjectList();

        // Scroll to and expand the project
        setTimeout(() => {
            const projectCard = document.querySelector(`[data-project-id="${projectId}"]`);
            if (projectCard) {
                projectCard.scrollIntoView({ behavior: 'smooth', block: 'center' });

                // Add highlight effect
                projectCard.style.transition = 'background-color 0.3s';
                projectCard.style.backgroundColor = 'var(--primary-color)';
                projectCard.style.opacity = '0.8';

                setTimeout(() => {
                    projectCard.style.backgroundColor = '';
                    projectCard.style.opacity = '';
                }, 1500);

                // Expand sessions if collapsed
                const sessionsContainer = document.getElementById(`project-sessions-${projectId}`);
                const chevron = document.getElementById(`chevron-${projectId}`);
                const addButton = document.getElementById(`add-session-btn-${projectId}`);

                if (sessionsContainer && sessionsContainer.style.display === 'none') {
                    sessionsContainer.style.display = 'block';
                    if (chevron) chevron.classList.add('expanded');
                    if (addButton) addButton.style.display = 'inline-block';
                } else {
                    console.log('Sessions already visible or container not found');
                }
            } else {
                console.log('Project card NOT found!');
            }
        }, 200);
    }

};

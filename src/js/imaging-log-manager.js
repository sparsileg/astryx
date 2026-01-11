/**
 * imaging-log-manager.js
 * Manages imaging projects, sessions, and programs
 */

const ImagingLogManager = {
    
    // ============================================================================
    // Projects
    // ============================================================================
    
    /**
     * Create a new project
     */
    async createProject(projectData) {
        const project = {
            name: projectData.name,
            targetDesignations: projectData.targetDesignations || [],
            status: projectData.status || 'Planning',
            notes: projectData.notes || '',
            created: new Date().toISOString(),
            modified: new Date().toISOString()
        };
        
        const id = await DBManager.put(APP_CONFIG.STORES.IMAGING_PROJECTS, project);
        project.id = id;
        return project;
    },
    
    /**
     * Update an existing project
     */
    async updateProject(id, projectData) {
        const project = await this.getProject(id);
        if (!project) {
            throw new Error('Project not found');
        }
        
        project.name = projectData.name;
        project.targetDesignations = projectData.targetDesignations;
        project.status = projectData.status;
        project.notes = projectData.notes;
        project.modified = new Date().toISOString();
        
        await DBManager.put(APP_CONFIG.STORES.IMAGING_PROJECTS, project);
        return project;
    },
    
    /**
     * Delete a project
     */
    async deleteProject(id) {
        // Also delete all sessions for this project
        const sessions = await this.getSessionsForProject(id);
        for (const session of sessions) {
            await DBManager.delete(APP_CONFIG.STORES.IMAGING_SESSIONS, session.id);
        }
        
        await DBManager.delete(APP_CONFIG.STORES.IMAGING_PROJECTS, id);
    },
    
    /**
     * Get a project by ID
     */
    async getProject(id) {
        return await DBManager.get(APP_CONFIG.STORES.IMAGING_PROJECTS, id);
    },
    
    /**
     * Get all projects
     */
    async getAllProjects() {
        return await DBManager.getAll(APP_CONFIG.STORES.IMAGING_PROJECTS);
    },
    
    // ============================================================================
    // Sessions
    // ============================================================================
    
    /**
     * Create a new session
     */
    async createSession(sessionData) {
        const session = {
            projectId: sessionData.projectId,
            date: sessionData.date,
            location: sessionData.location,
            telescope: sessionData.telescope,
            sensor: sessionData.sensor,
            filter: sessionData.filter,
            rotation: sessionData.rotation,
            tempSetpoint: sessionData.tempSetpoint,
            bin: sessionData.bin,
            gain: sessionData.gain,
            offset: sessionData.offset,
            moonIllumination: sessionData.moonIllumination,
            moonSet: sessionData.moonSet,
            moonRise: sessionData.moonRise,
            angleFromMoon: sessionData.angleFromMoon,
            clouds: sessionData.clouds || '',
            smoke: sessionData.smoke || '',
            seeing: sessionData.seeing || '',
            transparency: sessionData.transparency || '',
            subLength: sessionData.subLength,
            numExposures: sessionData.numExposures,
            usedExposures: sessionData.usedExposures,
            notes: sessionData.notes || '',
            created: new Date().toISOString()
        };
        
        const id = await DBManager.put(APP_CONFIG.STORES.IMAGING_SESSIONS, session);
        session.id = id;
        return session;
    },
    
    /**
     * Update an existing session
     */
    async updateSession(id, sessionData) {
        const session = await this.getSession(id);
        if (!session) {
            throw new Error('Session not found');
        }
        
        // Update all fields
        Object.assign(session, sessionData);
        
        await DBManager.put(APP_CONFIG.STORES.IMAGING_SESSIONS, session);
        return session;
    },
    
    /**
     * Delete a session
     */
    async deleteSession(id) {
        await DBManager.delete(APP_CONFIG.STORES.IMAGING_SESSIONS, id);
    },
    
    /**
     * Get a session by ID
     */
    async getSession(id) {
        return await DBManager.get(APP_CONFIG.STORES.IMAGING_SESSIONS, id);
    },
    
    /**
     * Get all sessions for a project
     */
    async getSessionsForProject(projectId) {
        const allSessions = await DBManager.getAll(APP_CONFIG.STORES.IMAGING_SESSIONS);
        return allSessions.filter(s => s.projectId === projectId);
    },
    
    
    /**
     * Get all sessions
     */
    async getAllSessions() {
        return await DBManager.getAll(APP_CONFIG.STORES.IMAGING_SESSIONS);
    },
    
    // ============================================================================
    // Programs
    // ============================================================================
    
    /**
     * Create a new program
     */
    async createProgram(programData) {
        const program = {
            name: programData.name,
            status: programData.status || 'Started',
            created: new Date().toISOString()
        };
        
        // Pattern-based mode
        if (programData.catalogPrefix && programData.maxNumber) {
            program.catalogPrefix = programData.catalogPrefix;
            program.maxNumber = programData.maxNumber;
            program.observedTargets = [];
        } 
        // Manual list mode
        else {
            program.targetDesignations = programData.targetDesignations || [];
        }
        
        const id = await DBManager.put(APP_CONFIG.STORES.IMAGING_PROGRAMS, program);
        program.id = id;
        return program;
    },
    
    /**
     * Update an existing program
     */
    async updateProgram(id, programData) {
        const program = await this.getProgram(id);
        if (!program) {
            throw new Error('Program not found');
        }
        
        program.name = programData.name;
        program.status = programData.status;
        
        // Pattern-based mode
        if (programData.catalogPrefix && programData.maxNumber) {
            program.catalogPrefix = programData.catalogPrefix;
            program.maxNumber = programData.maxNumber;
            // Update observedTargets if provided, otherwise keep existing or initialize
            if (programData.observedTargets !== undefined) {
                program.observedTargets = programData.observedTargets;
            } else if (!program.observedTargets) {
                program.observedTargets = [];
            }
            // Remove manual list fields if switching modes
            delete program.targetDesignations;
        }
        // Manual list mode
        else {
            program.targetDesignations = programData.targetDesignations || [];
            // Remove pattern fields if switching modes
            delete program.catalogPrefix;
            delete program.maxNumber;
            delete program.observedTargets;
        }
        
        await DBManager.put(APP_CONFIG.STORES.IMAGING_PROGRAMS, program);
        return program;
    },
    
    /**
     * Delete a program
     */
    async deleteProgram(id) {
        await DBManager.delete(APP_CONFIG.STORES.IMAGING_PROGRAMS, id);
    },
    
    /**
     * Get a program by ID
     */
    async getProgram(id) {
        return await DBManager.get(APP_CONFIG.STORES.IMAGING_PROGRAMS, id);
    },
    
    /**
     * Get all programs
     */
    async getAllPrograms() {
        return await DBManager.getAll(APP_CONFIG.STORES.IMAGING_PROGRAMS);
    },
    
    /**
     * Check if a program is pattern-based or manual list
     */
    isProgramPatternBased(program) {
        return !!(program.catalogPrefix && program.maxNumber);
    },

    /**
     * Check if a target designation matches a pattern-based program
     * Handles case-insensitive matching, flexible spacing, and suffixes
     */
    matchesPattern(targetDesignation, catalogPrefix, maxNumber) {
        if (!targetDesignation || !catalogPrefix) return false;
        
        // Normalize: remove spaces, convert to uppercase for comparison
        const normalizedTarget = targetDesignation.replace(/\s+/g, '').toUpperCase();
        const normalizedPrefix = catalogPrefix.replace(/\s+/g, '').toUpperCase();
        
        // Check if target starts with the catalog prefix
        if (!normalizedTarget.startsWith(normalizedPrefix)) {
            return false;
        }
        
        // Extract the numeric part (and optional suffix)
        const afterPrefix = normalizedTarget.substring(normalizedPrefix.length);
        
        // Match pattern: digits followed by optional suffix (letters)
        const match = afterPrefix.match(/^(\d+)([A-Z]*)$/);
        if (!match) return false;
        
        const number = parseInt(match[1], 10);
        
        // Validate number is within range
        if (number < 1 || number > maxNumber) {
            return false;
        }
        
        return true;
    },

    // ============================================================================
    // Calculations
    // ============================================================================
    
    /**
     * Get integration time by filter for a project
     */
    async getIntegrationTimeByFilter(projectId) {
        const sessions = await this.getSessionsForProject(projectId);
        const timeByFilter = {};
        
        sessions.forEach(session => {
            const filter = session.filter;
            // Use usedExposures if available, otherwise fall back to numExposures (original)
            const exposureCount = session.usedExposures !== undefined && session.usedExposures !== '' && session.usedExposures !== 0
                  ? session.usedExposures 
                  : (session.numExposures || 0);
            const seconds = session.subLength * exposureCount;
            
            if (!timeByFilter[filter]) {
                timeByFilter[filter] = 0;
            }
            timeByFilter[filter] += seconds;
        });
        
        return timeByFilter;
    },
    
    /**
     * Get program progress (how many targets imaged)
     */
    async getProgramProgress(programId) {
        const program = await this.getProgram(programId);
        const allProjects = await this.getAllProjects();
        
        // Get all target designations from all projects
        const imagedTargetSet = new Set();
        allProjects.forEach(project => {
            project.targetDesignations.forEach(designation => {
                imagedTargetSet.add(designation);
            });
        });
        
        // Pattern-based program
        if (this.isProgramPatternBased(program)) {
            const imagedCount = program.observedTargets ? program.observedTargets.length : 0;
            return {
                total: program.maxNumber,
                imaged: imagedCount,
                percentage: program.maxNumber > 0 
                    ? (imagedCount / program.maxNumber * 100).toFixed(1)
                    : 0
            };
        }
        
        // Manual list program
        const imagedCount = program.targetDesignations.filter(designation => 
            imagedTargetSet.has(designation)
        ).length;
        
        return {
            total: program.targetDesignations.length,
            imaged: imagedCount,
            percentage: program.targetDesignations.length > 0 
                ? (imagedCount / program.targetDesignations.length * 100).toFixed(1)
                : 0
        };
    },
    
    // ============================================================================
    // Validation
    // ============================================================================
    
    /**
     * Validate project data
     */
    validateProject(projectData) {
        if (!projectData.name || projectData.name.trim() === '') {
            return { valid: false, error: 'Project name is required' };
        }
        
        if (projectData.name.length > 100) {
            return { valid: false, error: 'Project name too long (max 100 characters)' };
        }
        
        return { valid: true };
    },
    
    /**
     * Validate session data
     */
    validateSession(sessionData) {
        if (!sessionData.projectId) {
            return { valid: false, error: 'Project is required' };
        }
        
        if (!sessionData.date) {
            return { valid: false, error: 'Date is required' };
        }
        
        // Check date not in future
        const sessionDate = new Date(sessionData.date);
        const today = new Date();
        today.setHours(23, 59, 59, 999); // End of today
        if (sessionDate > today) {
            return { valid: false, error: 'Session date cannot be in the future' };
        }
        
        if (!sessionData.subLength || sessionData.subLength <= 0) {
            return { valid: false, error: 'Sub length must be positive' };
        }
        
        if (!sessionData.numExposures || sessionData.numExposures <= 0) {
            return { valid: false, error: 'Original exposures must be positive' };
        }
        
        // Used exposures is optional, but if provided must be valid
        if (sessionData.usedExposures !== undefined && sessionData.usedExposures !== null && sessionData.usedExposures !== '') {
            const used = parseInt(sessionData.usedExposures);
            if (used < 0) {
                return { valid: false, error: 'Used exposures must be zero or greater' };
            }
            if (used > sessionData.numExposures) {
                return { valid: false, error: 'Used exposures cannot exceed original exposures' };
            }
        }
        
        return { valid: true };
    },
    
    // ============================================================================
    // Target Matching (for program import)
    // ============================================================================
    
    /**
     * Match program targets against database
     */
    async matchProgramTargets(targetList) {
        const lines = targetList.split('\n')
            .map(line => line.trim())
            .filter(line => line.length > 0);
        
        const results = {
            matched: [],
            failed: []
        };
        
        for (const designation of lines) {
            // Try exact match on 'object' field
            let target = DataManager.getTarget(designation);
            
            // If not found, try searching 'other' field
            if (!target) {
                target = this.findTargetInOtherDesignations(designation);
            }
            
            if (target) {
                results.matched.push({
                    input: designation,
                    target: target,
                    matchedOn: target.object === designation ? 'object' : 'other'
                });
            } else {
                results.failed.push({
                    input: designation,
                    reason: 'Not found in database'
                });
            }
        }
        
        return results;
    },
    
    /**
     * Find target by searching 'other' designations field
     */
    findTargetInOtherDesignations(designation) {
        const targets = DataManager.getTargets();
        
        for (const target of targets) {
            if (!target.other) continue;
            
            // Split 'other' field by comma and check each designation
            const otherDesignations = target.other.split(',').map(d => d.trim());
            if (otherDesignations.includes(designation)) {
                return target;
            }
        }
        
        return null;
    },
    
    /**
     * Get catalogue name from designation prefix
     */
    getCatalogueFromDesignation(designation) {
        const prefix = designation.split(' ')[0].replace(/[0-9-]/g, '');
        
        return CATALOG_MAP[prefix] || '';
    },
    
    /**
     * Generate CSV for missing targets
     */
    generateMissingTargetsCSV(failedTargets) {
        const header = '"Object","Catalogue","Type","RA","Dec","Const","Mag","Subr","Size_max","Size_min","Common","Other"';
        
        const rows = failedTargets.map(failed => {
            const designation = failed.input;
            const catalogue = this.getCatalogueFromDesignation(designation);
            return `"${designation}","${catalogue}","","","","","","","","","",""`;
        });
        
        return [header, ...rows].join('\n');
    }

};

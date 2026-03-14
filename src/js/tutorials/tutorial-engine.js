/**
 * tutorial-engine.js
 * Drives tutorial playback for Astryx.
 * Handles step rendering, progress persistence, and user interactions.
 */

const TutorialEngine = {

    _currentTutorial: null,
    _currentStepIndex: 0,
    _overlayEl: null,
    _highlightEl: null,
    _panelEl: null,
    _clickHandler: null,

    // -------------------------------------------------------------------------
    // Public API
    // -------------------------------------------------------------------------

    async start(tutorialId) {
        const tutorial = TUTORIAL_REGISTRY.tutorials[tutorialId];
        if (!tutorial) {
            console.error(`TutorialEngine: unknown tutorial "${tutorialId}"`);
            return;
        }

        // Always clean up any existing state before starting
        this._teardown();
        this._currentTutorial = null;
        this._currentStepIndex = 0;

        this._currentTutorial = tutorial;

        const progress = await this._loadProgress(tutorialId);
        this._currentStepIndex = (progress && !progress.completed) ? progress.currentStep : 0;

        this._showStep(this._currentStepIndex);
    },

    advance(delayed = false) {
        console.log('advance: _panelEl before teardown:', this._panelEl);
        this._teardown();
        this._currentStepIndex++;
        const tutorial = this._currentTutorial;
        if (this._currentStepIndex >= tutorial.steps.length) {
            this._complete();
        } else {
            this._saveProgress(tutorial.id, this._currentStepIndex, false);
            if (delayed) {
                setTimeout(() => this._showStep(this._currentStepIndex), 600);
            } else {
                this._showStep(this._currentStepIndex);
            }
        }
    },

    skipStep() {
        this.advance();
    },

    exit() {
        this._saveProgress(this._currentTutorial.id, 0, false);
        this._teardown();
        this._currentTutorial = null;
        this._currentStepIndex = 0;
    },

    // -------------------------------------------------------------------------
    // Step rendering
    // -------------------------------------------------------------------------

    _showStep(index) {
        const step = this._currentTutorial.steps[index];
        const total = this._currentTutorial.steps.length;
        console.log(`TutorialEngine: step ${index + 1}/${total} — type=${step.type} id=${step.id}`);
        if (step.type === 'modal') {
            this._showModal(step, index, total);
        } else if (step.type === 'callout') {
            this._showCallout(step, index, total);
        }
    },

    _showModal(step, index, total) {
        // Overlay — light so user can interact with app behind it
        const overlay = document.createElement('div');
        overlay.className = 'tutorial-overlay tutorial-overlay-light';
        document.body.appendChild(overlay);
        this._overlayEl = overlay;

        // Panel
        const panel = document.createElement('div');
        panel.className = 'tutorial-modal';
        panel.innerHTML = `
            <div class="tutorial-modal-header">
                <span class="tutorial-modal-title">${step.title}</span>
                <span class="tutorial-modal-progress">Step ${index + 1} of ${total}</span>
            </div>
            <div class="tutorial-modal-body">${step.body}</div>
            <div class="tutorial-modal-footer">
                <button class="tutorial-btn-exit">Exit Tutorial</button>
                <button class="tutorial-btn-next">Next</button>
            </div>
        `;

        panel.querySelector('.tutorial-btn-next').addEventListener('click', () => { console.log('Next clicked, step:', this._currentStepIndex); this.advance(); });
        panel.querySelector('.tutorial-btn-exit').addEventListener('click', () => this.exit());

        document.body.appendChild(panel);
        this._panelEl = panel;
        this._positionModal(panel, step.position);
    },

    _positionModal(panel, position) {
        if (!position) {
            // Default — centered
            panel.style.top = '50%';
            panel.style.left = '50%';
            panel.style.transform = 'translate(-50%, -50%)';
            return;
        }

        const margin = 16;
        const pw = panel.offsetWidth;
        const ph = Math.min(panel.offsetHeight, window.innerHeight - margin * 2);

        switch (position) {
        case 'top':
            panel.style.top = `${margin}px`;
            panel.style.left = '50%';
            panel.style.transform = 'translateX(-50%)';
            break;
        case 'bottom':
            panel.style.top = `${Math.max(margin, window.innerHeight - ph - margin)}px`;
            panel.style.left = '50%';
            panel.style.transform = 'translateX(-50%)';
            break;
        case 'left':
            panel.style.top = '50%';
            panel.style.left = `${margin}px`;
            panel.style.transform = 'translateY(-50%)';
            break;
        case 'right':
            panel.style.top = '50%';
            panel.style.left = `${window.innerWidth - pw - margin}px`;
            panel.style.transform = 'translateY(-50%)';
            break;
        case 'center':
        default:
            panel.style.top = '50%';
            panel.style.left = '50%';
            panel.style.transform = 'translate(-50%, -50%)';
            break;
        }
    },

    _showCallout(step, index, total) {
        const targetEl = step.target ? document.querySelector(step.target) : null;

        // Highlight border around target element — no overlay for callout steps
        if (step.highlight && targetEl) {
            const rect = targetEl.getBoundingClientRect();
            const highlight = document.createElement('div');
            if (step.highlight === 'flash') {
                highlight.className = 'tutorial-highlight-flash';
                highlight.addEventListener('animationend', () => highlight.remove(), { once: true });
            } else {
                highlight.className = 'tutorial-highlight';
                this._highlightEl = highlight;
            }
            highlight.style.top    = `${rect.top - 4}px`;
            highlight.style.left   = `${rect.left - 4}px`;
            highlight.style.width  = `${rect.width + 8}px`;
            highlight.style.height = `${rect.height + 8}px`;
            document.body.appendChild(highlight);
        }

        // Panel
        const panel = document.createElement('div');
        panel.className = 'tutorial-callout';

        const showNext = step.waitFor === 'next';
        panel.innerHTML = `
            <div class="tutorial-callout-header">
                <span class="tutorial-callout-title">${step.title}</span>
            </div>
            <div class="tutorial-callout-body">${step.body}</div>
            <div class="tutorial-callout-footer">
                <button class="tutorial-btn-exit">Exit Tutorial</button>
                ${showNext ? '<button class="tutorial-btn-next">Next</button>' : '<button class="tutorial-btn-skip">Skip</button>'}
            </div>
        `;

        panel.querySelector('.tutorial-btn-exit').addEventListener('click', () => this.exit());
        if (showNext) {
            panel.querySelector('.tutorial-btn-next').addEventListener('click', () => this.advance());
        } else {
            panel.querySelector('.tutorial-btn-skip').addEventListener('click', () => this.skipStep());
        }

        document.body.appendChild(panel);
        this._panelEl = panel;

        if (step.width) panel.style.width = step.width;

        // Position callout relative to target
        this._positionCallout(panel, targetEl, step.position);

        // waitFor: click — advance when user clicks the target element
        // If target doesn't exist, fall back to Next button
        if (step.waitFor === 'click' && step.target) {
            if (targetEl) {
                const selector = step.target;
                const handler = (e) => {
                    if (e.target.matches(selector) || e.target.closest(selector)) {
                        this._teardown();
                        this.advance(true);
                    }
                };
                document.addEventListener('click', handler, true);
                this._clickHandler = handler;
            } else {
                // Target not found — add Next button dynamically
                const footer = panel.querySelector('.tutorial-callout-footer');
                const nextBtn = document.createElement('button');
                nextBtn.className = 'tutorial-btn-next';
                nextBtn.textContent = 'Next';
                footer.appendChild(nextBtn);
                nextBtn.addEventListener('click', () => this.advance());
            }
        }
    },

    _positionCallout(panel, targetEl, position) {
        if (!targetEl) {
            // No target — center on screen using pixel values
            const pw = panel.offsetWidth;
            const ph = panel.offsetHeight;
            panel.style.top  = `${(window.innerHeight - ph) / 2}px`;
            panel.style.left = `${(window.innerWidth - pw) / 2}px`;
            panel.style.transform = 'none';
            return;
        }

        const rect = targetEl.getBoundingClientRect();
        const gap  = 12;

        // Temporarily place off-screen to measure panel size
        panel.style.visibility = 'hidden';
        panel.style.top  = '0px';
        panel.style.left = '0px';
        const pw = panel.offsetWidth;
        const ph = panel.offsetHeight;
        panel.style.visibility = '';

        let top, left;

        switch (position) {
            case 'right':
                top  = rect.top + rect.height / 2 - ph / 2;
                left = rect.right + gap;
                break;
            case 'left':
                top  = rect.top + rect.height / 2 - ph / 2;
                left = rect.left - pw - gap;
                break;
            case 'bottom':
                top  = rect.bottom + gap;
                left = rect.left + rect.width / 2 - pw / 2;
                break;
            case 'top':
            default:
                top  = rect.top - ph - gap;
                left = rect.left + rect.width / 2 - pw / 2;
                break;
        }

        // Clamp to viewport
        const margin = 16;
        top  = Math.max(margin, Math.min(top,  window.innerHeight - ph - margin));
        left = Math.max(margin, Math.min(left, window.innerWidth  - pw - margin));

        panel.style.top  = `${top}px`;
        panel.style.left = `${left}px`;
    },

    _teardown() {
        if (this._overlayEl) {
            this._overlayEl.remove();
            this._overlayEl = null;
        }
        if (this._highlightEl) {
            this._highlightEl.remove();
            this._highlightEl = null;
        }
        if (this._panelEl) {
            this._panelEl.remove();
            this._panelEl = null;
        }
        if (this._clickHandler) {
            document.removeEventListener('click', this._clickHandler, true);
            this._clickHandler = null;
        }
    },

    _complete() {
        this._saveProgress(this._currentTutorial.id, 0, true);
        const nextId = this._currentTutorial.nextTutorial;
        const nextTutorial = nextId ? TUTORIAL_REGISTRY.tutorials[nextId] : null;
        this._teardown();
        this._showCompletionModal(this._currentTutorial.title, nextTutorial);
        this._currentTutorial = null;
        this._currentStepIndex = 0;
    },

    _showCompletionModal(tutorialTitle, nextTutorial) {
        const overlay = document.createElement('div');
        overlay.className = 'tutorial-overlay tutorial-overlay-light';
        document.body.appendChild(overlay);
        this._overlayEl = overlay;

        const panel = document.createElement('div');
        panel.className = 'tutorial-modal';
        panel.innerHTML = `
            <div class="tutorial-modal-header">
                <span class="tutorial-modal-title">Tutorial Complete</span>
            </div>
            <div class="tutorial-modal-body">
                <strong>${tutorialTitle}</strong> is complete. Well done!
                ${nextTutorial ? `<p style="margin-top: 0.5rem;">Ready to continue? The next tutorial is <strong>${nextTutorial.title}</strong>.</p>` : ''}
            </div>
            <div class="tutorial-modal-footer">
                <button class="tutorial-btn-exit">Close</button>
                ${nextTutorial ? '<button class="tutorial-btn-next">Start Next Tutorial</button>' : ''}
            </div>
        `;

        panel.querySelector('.tutorial-btn-exit').addEventListener('click', () => {
            this._teardown();
        });

        if (nextTutorial) {
            panel.querySelector('.tutorial-btn-next').addEventListener('click', () => {
                this._teardown();
                this.start(nextTutorial.id);
            });
        }

        document.body.appendChild(panel);
        this._panelEl = panel;

        // Position centered
        panel.style.top = '50%';
        panel.style.left = '50%';
        panel.style.transform = 'translate(-50%, -50%)';
    },

    // -------------------------------------------------------------------------
    // Progress persistence
    // -------------------------------------------------------------------------

    async _saveProgress(tutorialId, currentStep, completed) {
        try {
            await DBManager.put(APP_CONFIG.STORES.TUTORIAL_PROGRESS, {
                id: tutorialId,
                currentStep,
                completed,
                updatedAt: Date.now()
            });
        } catch (e) {
            console.error('TutorialEngine: failed to save progress', e);
        }
    },

    async _loadProgress(tutorialId) {
        try {
            return await DBManager.get(APP_CONFIG.STORES.TUTORIAL_PROGRESS, tutorialId);
        } catch (e) {
            return null;
        }
    },


    // -------------------------------------------------------------------------
    // Validation — call from console during tutorial authoring
    // -------------------------------------------------------------------------

    validate(tutorialId) {
        const tutorials = tutorialId
            ? { [tutorialId]: TUTORIAL_REGISTRY.tutorials[tutorialId] }
            : TUTORIAL_REGISTRY.tutorials;

        let issueCount = 0;

        Object.entries(tutorials).forEach(([id, tutorial]) => {
            if (!tutorial) {
                console.error(`[Tutorial] Unknown tutorial: "${id}"`);
                issueCount++;
                return;
            }

            console.group(`[Tutorial] Validating: "${id}"`);

            // Check required top-level fields
            ['id', 'title', 'version', 'steps'].forEach(field => {
                if (!tutorial[field]) {
                    console.error(`  Missing field: "${field}"`);
                    issueCount++;
                }
            });

            // Check nextTutorial reference
            if (tutorial.nextTutorial && !TUTORIAL_REGISTRY.tutorials[tutorial.nextTutorial]) {
                console.error(`  nextTutorial "${tutorial.nextTutorial}" not found in registry`);
                issueCount++;
            }

            // Check each step
            tutorial.steps.forEach((step, index) => {
                const prefix = `  Step ${index + 1} (${step.id || 'no-id'})`;

                // Required fields
                ['id', 'type', 'title', 'body', 'waitFor'].forEach(field => {
                    if (step[field] === undefined || step[field] === null || step[field] === '') {
                        console.error(`${prefix}: missing field "${field}"`);
                        issueCount++;
                    }
                });

                // Valid type
                if (!['modal', 'callout'].includes(step.type)) {
                    console.error(`${prefix}: unknown type "${step.type}"`);
                    issueCount++;
                }

                // Valid waitFor
                if (!['next', 'click', 'event'].includes(step.waitFor)) {
                    console.error(`${prefix}: unknown waitFor "${step.waitFor}"`);
                    issueCount++;
                }

                // Callout-specific checks
                if (step.type === 'callout') {
                    if (!step.target) {
                        console.warn(`${prefix}: callout has no target — will center on screen`);
                    } else {
                        const el = document.querySelector(step.target);
                        if (!el) {
                            console.warn(`${prefix}: target "${step.target}" not found in current DOM — may be in a modal`);
                        }
                    }
                    if (!step.position) {
                        console.warn(`${prefix}: no position specified — will default to top`);
                    }
                }

                // click waitFor requires a target
                if (step.waitFor === 'click' && !step.target) {
                    console.error(`${prefix}: waitFor="click" requires a target`);
                    issueCount++;
                }
            });

            console.groupEnd();
        });

        if (issueCount === 0) {
            console.log(`[Tutorial] Validation passed — no issues found`);
        } else {
            console.warn(`[Tutorial] Validation complete — ${issueCount} issue(s) found`);
        }
    }

};

/**
 * tutorial-manager.js
 * Manages tutorial progress persistence.
 * Abstracts storage access so TutorialEngine has no direct DBManager dependency.
 */

const TutorialManager = {
    /**
     * Save progress for a tutorial
     * @param {string} tutorialId
     * @param {number} currentStep
     * @param {boolean} completed
     */
    async saveProgress(tutorialId, currentStep, completed) {
        await DBManager.put(APP_CONFIG.STORES.TUTORIAL_PROGRESS, {
            id: tutorialId,
            currentStep,
            completed,
            updatedAt: Date.now()
        });
    },

    /**
     * Load progress for a tutorial
     * @param {string} tutorialId
     * @returns {Object|null}
     */
    async loadProgress(tutorialId) {
        return await DBManager.get(APP_CONFIG.STORES.TUTORIAL_PROGRESS, tutorialId);
    },

    /**
     * Find the most recently updated in-progress tutorial across all registered tutorials.
     * Returns the tutorial object or null if none are in progress.
     */
    async findInProgressTutorial() {
        const ids = Object.keys(TUTORIAL_REGISTRY.tutorials);
        let best = null;

        for (const id of ids) {
            const progress = await this.loadProgress(id);
            if (progress && !progress.completed && progress.currentStep > 0) {
                if (!best || progress.updatedAt > best.progress.updatedAt) {
                    best = { tutorial: TUTORIAL_REGISTRY.tutorials[id], progress };
                }
            }
        }

        return best ? best.tutorial : null;
    }

};

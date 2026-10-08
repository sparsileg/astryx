/**
 * target-selection-view.js
 * Main view controller for Target Selection
 */

const TargetSelectionView = {
    showsTargetData: true,          // re-renders on targets-updated / best-months-updated
    container: null,

    /**
     * Render the visibility view
     */
    render(container, params) {
        this.container = container;

        // Load template
        const template = document.getElementById('ts-visibility-template');
        const content = template.content.cloneNode(true);

        container.innerHTML = '';
        container.appendChild(content);

        // Reset page title (after template is in DOM)
        const pageTitle = document.getElementById('page-title');
        if (pageTitle) {
            pageTitle.textContent = '🔭 Visibility';
        }

        // Initialize components
        VisibilityTargets.init();
        TargetFilter.initUI();

        // Load last selections
        VisibilityTargets.loadLastTarget();

        // Dispatch event to signal view is loaded
        document.dispatchEvent(new CustomEvent('visibility-view-loaded'));
    },

    /**
     * Cleanup when view is destroyed
     */
    destroy() {
        // No listeners registered by this view — present for consistency
        // with app.js's `if (this.currentView.destroy)` check.
    }
};

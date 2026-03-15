/**
 * visibility-main.js
 * Main view controller for Target Selection
 */

const TargetSelectionView = {
    container: null,

    /**
     * Render the visibility view
     */
    render(container, params) {
        this.container = container;

        // Always hide/remove yearly observability container
        const yearlyObservabilityContainer = document.getElementById('yearly-observability-container');
        if (yearlyObservabilityContainer) {
            yearlyObservabilityContainer.remove();
        }

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

        // Set the heading inside the view
        const viewHeading = container.querySelector('.visibility-view h2');
        if (viewHeading) {
            viewHeading.textContent = '🌟 Target Selection';
        }

        // Make sure the main visibility form is visible
        const twoColGrid = document.querySelector('.ts-two-col-grid');
        if (twoColGrid) {
            twoColGrid.style.display = 'grid';
        }
        // ... rest of method
        // Initialize components
        VisibilityTargets.init();
        VisibilityUI.init();
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
        document.removeEventListener('targets-updated', VisibilityTargets.initializeSearch);
        TargetFilter.destroyUI();
    }
};

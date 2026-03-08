/**
 * yearly-observability-view.js
 * Yearly Observability View - displays annual altitude graphs
 */

const YearlyObservabilityView = {
    /**
     * Render the yearly observability view
     */
    render(container, params = {}) {
        container.innerHTML = `
            <div class="view-container" style="max-width: 1200px; margin: 0 auto; padding: 1.5rem;">
                <div class="view-header">
                    <h1>📅 Yearly Observability</h1>
                </div>
                <!-- Header with target info will be inserted by displayYearlyObservabilityGraph -->
                <div id="yearly-observability-header"></div>

                <!-- Help text -->
                <div id="yearly-observability-help" style="background: var(--card-bg); border: 1px solid var(--border-color); border-radius: 8px; padding: 1rem; margin-bottom: 1rem;">
                    <p style="margin: 0; color: var(--text-primary); font-size: 0.95rem; line-height: 1.5;">
                        <strong>Graph visualization:</strong> Shows peak target altitude during astronomical darkness throughout the year.
                        Background gradient shows observability score for each day based on
                        <strong>transit timing</strong> (how close to midnight) and <strong>dark hours available</strong> (total time above type-specific threshold).
                        Darker shading indicates better observing conditions.
                    </p>
                </div>

                <!-- Graph container -->
                <div id="yearly-observability-graph" style="background: var(--card-bg); border: 1px solid var(--border-color); border-radius: 8px; padding: 1rem; margin-bottom: 1.5rem;">
                    <!-- Graph will be rendered here -->
                </div>

                <!-- Legend container -->
                <div id="yearly-observability-legend" style="display: flex; gap: 2rem; justify-content: center; padding: 1rem; background: var(--card-bg); border: 1px solid var(--border-color); border-radius: 8px; flex-wrap: wrap;">
                    <!-- Legend will be rendered here -->
                </div>
            </div>
        `;

        // Always trigger calculation on render
        if (typeof VisibilityCalculations !== 'undefined') {
            setTimeout(() => {
                // Ensure a target is set
                if (typeof VisibilityTargets !== 'undefined' && !VisibilityTargets.currentTarget) {
                    VisibilityTargets.loadLastTarget();
                }
                if (typeof VisibilityTargets !== 'undefined' && !VisibilityTargets.currentTarget) {
                    const defaultTarget = DataManager.getTargets().find(t => t.object === APP_CONFIG.DEFAULT_TARGET);
                    if (defaultTarget) VisibilityTargets.currentTarget = defaultTarget;
                }
                VisibilityCalculations.calculateYearly();
            }, 100);
        }
    }
};

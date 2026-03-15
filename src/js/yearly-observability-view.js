/**
 * yearly-observability-view.js
 * Yearly Observability View - displays annual altitude graphs
 */

const YearlyObservabilityView = {
    _resizeObserver: null,

    /**
     * Render the yearly observability view
     */
    render(container, params = {}) {
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = `
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
                    <div style="display: flex; align-items: center; justify-content: center; height: 150px; color: var(--text-secondary); font-size: 0.95rem;">
                        Calculating...
                    </div>
                </div>

                <!-- Legend container -->
                <div id="yearly-observability-legend" style="display: flex; gap: 2rem; justify-content: center; padding: 1rem; background: var(--card-bg); border: 1px solid var(--border-color); border-radius: 8px; flex-wrap: wrap;">
                    <!-- Legend will be rendered here -->
                </div>
            </div>
        `;

        // Swap content in
        container.replaceChildren(...tempDiv.childNodes);

        // Render from cache if available (pre-calculated before navigation) — no blink
        if (typeof VisibilityCalculations !== 'undefined') {
            const cached = window.lastYearlyObservabilityGraphData;
            if (cached) {
                VisibilityCalculations.displayYearlyObservabilityGraph(
                    cached.altitudeData, cached.inputs
                );
            } else {
                // Fallback — direct navigation or page refresh
                if (typeof VisibilityTargets !== 'undefined' && !VisibilityTargets.currentTarget) {
                    VisibilityTargets.loadLastTarget();
                }
                if (typeof VisibilityTargets !== 'undefined' && !VisibilityTargets.currentTarget) {
                    const defaultTarget = DataManager.getTargets().find(t => t.object === APP_CONFIG.DEFAULT_TARGET);
                    if (defaultTarget) VisibilityTargets.currentTarget = defaultTarget;
                }
                setTimeout(() => VisibilityCalculations.calculateYearly(), 0);
            }
        }

        // Re-render graph on resize without recalculating — Issue #87
        const graphContainer = container.querySelector('#yearly-observability-graph');
        if (graphContainer && typeof ResizeObserver !== 'undefined') {
            if (this._resizeObserver) {
                this._resizeObserver.disconnect();
                this._resizeObserver = null;
            }
            let resizeTimer = null;
            this._resizeObserver = new ResizeObserver(() => {
                clearTimeout(resizeTimer);
                resizeTimer = setTimeout(() => {
                    const cached = window.lastYearlyObservabilityGraphData;
                    if (cached) {
                        VisibilityCalculations.renderYearlyObservabilityGraph(
                            cached.altitudeData, cached.inputs
                        );
                    }
                }, 200);
            });
            this._resizeObserver.observe(graphContainer);
        }
    },

    /**
     * Cleanup when view is destroyed
     */
    destroy() {
        if (this._resizeObserver) {
            this._resizeObserver.disconnect();
            this._resizeObserver = null;
        }
    }
};

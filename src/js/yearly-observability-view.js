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
            <div class="view-container yo-view-container">
                <div class="view-header">
                    <h1>📅 Yearly Observability</h1>
                </div>
                <!-- Header with target info will be inserted by displayYearlyObservabilityGraph -->
                <div id="yearly-observability-header"></div>

                <!-- Help text -->
                <div id="yearly-observability-help" class="yo-help">
                    <p>
                        <strong>Graph visualization:</strong> Shows peak target altitude during astronomical darkness throughout the year.
                        Background gradient shows observability score for each day based on
                        <strong>transit timing</strong> (how close to midnight) and <strong>dark hours available</strong> (total time above type-specific threshold).
                        Darker shading indicates better observing conditions.
                    </p>
                </div>

                <!-- Graph container -->
                <div id="yearly-observability-graph" class="yo-graph">
                    <div class="yo-graph-placeholder">
                        Calculating...
                    </div>
                </div>

                <!-- Legend container -->
                <div id="yearly-observability-legend" class="yo-legend">
                    <!-- Legend will be rendered here -->
                </div>
            </div>
        `;

        // Swap content in
        container.replaceChildren(...tempDiv.childNodes);

        // Render from cache if available (pre-calculated before navigation) — no blink
        if (typeof YearlyObservabilityCalculations !== 'undefined') {
            const cached = window.lastYearlyObservabilityGraphData;
            if (cached) {
                YearlyObservabilityCalculations.displayYearlyObservabilityGraph(
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
                setTimeout(() => YearlyObservabilityCalculations.calculateYearly(), 0);
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
                        YearlyObservabilityCalculations.renderYearlyObservabilityGraph(
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

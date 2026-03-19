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
        const template = document.getElementById('yo-view-template');
        const content = template.content.cloneNode(true);
        container.innerHTML = '';
        container.appendChild(content);

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

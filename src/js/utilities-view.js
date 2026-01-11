/**
 * utilities-view.js
 * Utilities view for weather forecasts and other tools
 */

const UtilitiesView = {
    /**
     * Initialize the view
     */
    init() {
        this.renderWeatherForecasts();
        
        // Listen for location updates
        document.addEventListener('locations-updated', () => {
            this.renderWeatherForecasts();
        });
    },

    /**
     * Render weather forecast links for all locations
     */
    renderWeatherForecasts() {
        const container = document.getElementById('utilities-weather-list');
        if (!container) return;

        const locations = DataManager.getLocations();
        
        if (Object.keys(locations).length === 0) {
            container.innerHTML = '<p class="empty-message">No locations configured. Add locations in Admin Tools → Manage Locations.</p>';
            return;
        }

        let html = '<div class="weather-forecast-grid">';

        Object.entries(locations).forEach(([name, location]) => {
            const astrosphericUrl = `https://astrospheric.com/?Latitude=${location.latitude}&Longitude=${location.longitude}&Loc=Forecast`;
            const clearOutsideUrl = `https://clearoutside.com/forecast/${location.latitude}/${location.longitude}?view=current`;

            html += `
                <div class="weather-location-card">
                    <strong>${name}</strong>
                    <span class="location-separator">•</span>
                    <a href="${astrosphericUrl}" target="_blank" class="weather-link">Astrospheric</a>
                    <a href="${clearOutsideUrl}" target="_blank" class="weather-link">Clear Outside</a>
                </div>
            `;
        });

        html += '</div>';
        container.innerHTML = html;
    },

    /**
     * Escape HTML to prevent XSS
     */
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
    
};

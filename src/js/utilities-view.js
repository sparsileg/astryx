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
        this.renderLightPollutionInfo();

        // Listen for location updates
        document.addEventListener('locations-updated', () => {
            this.renderWeatherForecasts();
            this.renderLightPollutionInfo();
        });
    },

    /**
     * Render weather forecast links for all locations
     */
    renderWeatherForecasts() {
        const container = document.getElementById('utilities-weather-list');
        if (!container) return;
        console.log('In renderWeatherForecasts()');

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
                    <a class="block-link" href="${astrosphericUrl}" target="_blank" class="weather-link">Astrospheric</a>
                    <span class="location-separator">•</span>
                    <a class="block-link" href="${clearOutsideUrl}" target="_blank" class="weather-link">Clear Outside</a>
                </div>
            `;
        });

        html += '</div>';
        container.innerHTML = html;
    },

    /**
     * Render light pollution info maps
     */
    renderLightPollutionInfo() {
        const container = document.getElementById('utilities-light-pollution-info');
        if (!container) return;
        console.log('In renderLightPollutionInfo()');

        const locations = DataManager.getLocations();

        if (Object.keys(locations).length === 0) {
            container.innerHTML = '<p class="empty-message">No locations configured. Add locations in Admin Tools → Manage Locations.</p>';
            return;
        }

        let html = '<div class="weather-forecast-grid">';

        Object.entries(locations).forEach(([name, location]) => {
            const lightPollutionUrl = `https://www.lightpollutionmap.info/#zoom=16.0&lat=${location.latitude}&lon=${location.longitude}`;

            html += `
                <div class="weather-location-card">
                    <a class="block-link" href="${lightPollutionUrl}" target="_blank" class="weather-link"><strong>${name}</strong></a>
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

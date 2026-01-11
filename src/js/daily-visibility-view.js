/**
 * target-selection-results.js
 * Results view - displays target-selection results
 */

const ResultsView = {
    container: null,
    currentResults: null,

    /**
     * Calculate maximum altitude target can reach from observer location
     */
    calculateMaxAltitude(latitude, declination) {
        return 90 - Math.abs(latitude - declination);
    },

    /**
     * Render the results view
     */
    render(container, params) {
        this.container = container;

        // Load template
        const template = document.getElementById('results-template');
        const content = template.content.cloneNode(true);

        container.innerHTML = '';
        container.appendChild(content);

        // Check if we have results data
        if (window.visibilityResults) {
            this.currentResults = window.visibilityResults;
            this.displayResults(this.currentResults);
        } else {
            this.showNoResultsMessage();
        }

        this.attachEventHandlers();
    },

    /**
     * Cleanup when view is destroyed
     */
    destroy() {
        this.currentResults = null;
    },

    /**
     * Attach event handlers
     */
    attachEventHandlers() {
        const backBtn = document.getElementById('results-back-btn');
        if (backBtn) {
            backBtn.addEventListener('click', () => {
                window.location.hash = '#visibility';
            });
        }
    },

    /**
     * Show no results message
     */
    showNoResultsMessage() {
        const resultsContainer = document.getElementById('results-cards-container');
        if (resultsContainer) {
            resultsContainer.innerHTML = `
                <p style="color: var(--text-secondary); text-align: center; padding: 2rem;">
                    No results to display. Please go back and run a visibility calculation.
                </p>
            `;
        }
    },

    displayResults(results) {
        const resultsContainer = document.getElementById('results-cards-container');
        if (!resultsContainer) return;

        resultsContainer.innerHTML = '';

        // Update the main title with target name
        const titleElement = document.getElementById('results-title');
        if (titleElement) {
            titleElement.textContent = `Visibility Results for ${results.targetName}`;
        }

        // Calculate max altitude
        const maxAltitude = this.calculateMaxAltitude(results.latitude, results.dec);

        // Add subtitle with max altitude
        const subtitleDiv = document.createElement('div');
        subtitleDiv.style.cssText = 'margin-bottom: 1.5rem; color: var(--text-secondary);';
        subtitleDiv.innerHTML = `
        Target's maximum possible altitude from your location: ${maxAltitude.toFixed(1)}&deg;
    `;
        resultsContainer.appendChild(subtitleDiv);

        // Display each result card
        results.results.forEach((result, index) => {
            const card = this.createResultCard(result, index, results);
            resultsContainer.appendChild(card);
        });
    },



    /**
     * Create a result card
     */
    createResultCard(result, index, allResults) {
        const card = document.createElement('div');
        card.className = 'result-card';

        // Format date
        const dateParts = result.date.split('-');
        const date = new Date(parseInt(dateParts[0]), parseInt(dateParts[1]) - 1, parseInt(dateParts[2]));
        const dateStr = date.toLocaleDateString('en-US', {
            weekday: 'short',
            month: 'short',
            day: 'numeric',
            year: 'numeric'
        });

        // Convert JD times to formatted strings
        const duskDate = TimeUtils.jdToDate(result.duskJD);
        const dawnDate = TimeUtils.jdToDate(result.dawnJD);
        const duskStr = TimeUtils.formatLocalTimeWithDate(duskDate, result.timezone);
        const dawnStr = TimeUtils.formatLocalTimeWithDate(dawnDate, result.timezone);

        let riseStr, setStr;
        if (result.riseJD) {
            const riseDate = TimeUtils.jdToDate(result.riseJD);
            riseStr = TimeUtils.formatLocalTimeWithDate(riseDate, result.timezone);
        } else {
            riseStr = 'Before dusk';
        }

        if (result.setJD) {
            const setDate = TimeUtils.jdToDate(result.setJD);
            setStr = TimeUtils.formatLocalTimeWithDate(setDate, result.timezone);
        } else {
            setStr = 'After dawn';
        }

        // Calculate moon phase and illumination
        const moonPhase = getMoonPhase(result.duskJD);
        console.log('Moon phase calculation for', result.date);
        console.log('Dusk JD:', result.duskJD, 'Time:', TimeUtils.jdToDate(result.duskJD).toISOString());
        console.log('Calculated illumination at dusk:', moonPhase.illumination.toFixed(1) + '%');

        // Check 2 hours later
        const twoHoursLaterJD = result.duskJD + (2/24);
        const moonPhase2hrs = getMoonPhase(twoHoursLaterJD);
        console.log('Two hours later JD:', twoHoursLaterJD, 'Time:',
                    TimeUtils.jdToDate(twoHoursLaterJD).toISOString());
        console.log('Calculated illumination 2hrs later:', moonPhase2hrs.illumination.toFixed(1) + '%');

        // Calculate duration (target visibility within observation window)
        let duration = 0;
        const duskJD = result.duskJD;
        const dawnJD = result.dawnJD;

        // sgb
        // Only calculate duration if target is actually above minimum altitude during darkness
        console.log('Checking visibility with:', {
            duskJD: duskJD,
            dawnJD: dawnJD,
            ra: result.ra,
            dec: result.dec,
            latitude: result.latitude,
            longitude: result.longitude,
            minAltitude: result.minAltitude
        });
        console.log('Full result object:', result);

        // Only calculate duration if target is actually above minimum altitude during darkness
        // sgb
        console.log('M1 visibility check:', {
            minAlt: allResults.minAltitude,
            ra: allResults.ra,
            dec: allResults.dec
        });
        if (isTargetVisibleDuringWindow(duskJD, dawnJD, allResults.ra, allResults.dec,
                                        allResults.latitude, allResults.longitude, allResults.minAltitude)) {
            const riseJD = result.riseJD || duskJD; // If no rise, target is already up at dusk
            const setJD = result.setJD || dawnJD;   // If no set, target stays up until dawn

            // Find the overlap: starts when both dark AND target is up,
            // ends when either gets light OR target sets
            const visibilityStart = Math.max(duskJD, riseJD);
            const visibilityEnd = Math.min(dawnJD, setJD);

            // Duration in hours (only if there's actual overlap)
            if (visibilityEnd > visibilityStart) {
                duration = (visibilityEnd - visibilityStart) * 24;
            }
        }

        // Format as hours and minutes
        const hours = Math.floor(duration);
        const minutes = Math.round((duration - hours) * 60);
        const durationStr = `${hours}h ${minutes}m`;

        card.innerHTML = `
          <div class="result-header">
            <h4>${dateStr}</h4>
            <span class="result-duration">${durationStr} imaging window</span>
            <button class="btn-primary analyze-skyglow-btn" data-index="${index}">
              Analyze Skyglow
            </button>
          </div>
          <div class="result-body">
            <div class="result-row">
              <span class="result-label">Moon:</span>
              <span class="result-value">${moonPhase.phaseName} (${moonPhase.illumination.toFixed(0)}%)</span>
          </div>
          <div class="result-row">
              <span class="result-label">Astronomical dusk to dawn:</span>
              <span class="result-value">${duskStr} - ${dawnStr}</span>
          </div>
          <div class="result-row">
              <span class="result-label">Target Visibility:</span>
              <span class="result-value">${riseStr} - ${setStr}</span>
          </div>
        </div>
        `;

        // Add click handler for analyze button
        const analyzeBtn = card.querySelector('.analyze-skyglow-btn');
        analyzeBtn.addEventListener('click', () => {
            this.analyzeSkyglow(result, allResults);
        });

        return card;
    },

    /**
     * Navigate to skyglow analysis for a result
     */
    analyzeSkyglow(result, allResults) {
        // Prepare skyglow data
        window.skyglowData = {
            date: result.date,
            targetName: allResults.targetName,
            commonName: allResults.commonName || '',
            locationName: allResults.locationName,
            ra: allResults.ra,
            dec: allResults.dec,
            latitude: allResults.latitude,
            longitude: allResults.longitude,
            elevation: allResults.elevation,
            timezone: allResults.timezone,
            isDSTActive: allResults.isDSTActive,
            minAltitude: allResults.minAltitude,
            duskJD: result.duskJD,
            dawnJD: result.dawnJD,
            riseJD: result.riseJD,
            setJD: result.setJD,
            moonRiseSet: result.moonRiseSet,
            useHorizon: allResults.useHorizon !== undefined ? allResults.useHorizon : true,
            blockedMinutes: result.blockedMinutes
        };

        // Navigate to skyglow view
        window.location.hash = '#skyglow';
    }
};

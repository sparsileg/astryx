/**
 * daily-visibility-view.js
 * Daily Visibility view - timeline visualization of one day's target visibility
 */

const DailyVisibilityView = {
    container: null,
    currentData: null,
    TIMELINE_HEIGHT: 300,
    _resizeObserver: null,
    _lastWindValues: null,

    /**
     * Render the skyglow view
     */
    render(container, params) {
        this.container = container;

        // Load template
        const template = document.getElementById('daily-visibility-template');
        const content = template.content.cloneNode(true);

        container.innerHTML = '';
        container.appendChild(content);

        // Initialize controls with current values
        this.initControls();
        this.attachEventHandlers();

        // Re-render wind SVG on resize — Issue #129
        const timelineContainer = container.querySelector('#timeline-container');
        if (timelineContainer && typeof ResizeObserver !== 'undefined') {
            if (this._resizeObserver) {
                this._resizeObserver.disconnect();
                this._resizeObserver = null;
            }
            let resizeTimer = null;
            this._resizeObserver = new ResizeObserver(() => {
                clearTimeout(resizeTimer);
                resizeTimer = setTimeout(() => {
                    if (!this._lastWindValues) return;
                    const windBand = document.querySelector('[data-wind-band]');
                    if (!windBand) return;
                    const w = windBand.offsetWidth || 800;
                    const lbl = windBand.querySelector('.cloud-band-label');
                    windBand.innerHTML = this.buildWindSVG(this._lastWindValues, w);
                    if (lbl) windBand.appendChild(lbl);
                }, 200);
            });
            this._resizeObserver.observe(timelineContainer);
        }

        // Check if we have data passed from visibility view
        if (window.skyglowData) {
            this.currentData = window.skyglowData;
            this.performAnalysis(this.currentData);
        } else {
            // Reassemble data (e.g. after page refresh)
            setTimeout(() => this.recalculate(), 0);
        }
    },

    /**
     * Cleanup when view is destroyed
     */
    destroy() {
        this.currentData = null;
        this._lastWindValues = null;
        if (this._resizeObserver) {
            this._resizeObserver.disconnect();
            this._resizeObserver = null;
        }
    },

    /**
     * Fetch weather data from Open-Meteo.
     * Caches 7 days of data per location for up to 1 hour.
     * Returns sliced 25-value arrays for the requested noon-to-noon window,
     * or null if date is outside today through today+4, or fetch fails.
     * Issue #81 / #93
     */
    async fetchCloudData(latitude, longitude, dateStr) {
        // Display for yesterday (if before cutoff hour) through today+4
        const today = new Date();
        const minDate = new Date(today);
        if (today.getHours() < APP_CONFIG.DV_LOOKBACK_CUTOFF_HOUR) {
            minDate.setDate(today.getDate() - 1);
        }
        const minDateStr = TimeUtils.formatDateForInput(minDate);
        const maxDate = new Date(today);
        maxDate.setDate(today.getDate() + 4);
        const maxDateStr = TimeUtils.formatDateForInput(maxDate);

        if (dateStr < minDateStr || dateStr > maxDateStr) {
            return null;
        }

        // Check cache — keyed by lat/lon, valid for 1 hour
        const cacheKey = `${latitude}_${longitude}`;
        const cache = window._openMeteoCache;
        const now = Date.now();
        const ONE_HOUR = 60 * 60 * 1000;

        let json;
        if (cache && cache.key === cacheKey && (now - cache.fetchedAt) < ONE_HOUR) {
            json = cache.data;
        } else {
            try {
                const url = APP_CONFIG.APIS.OPEN_METEO
                    .replace('{LAT}', latitude)
                    .replace('{LON}', longitude);
                const response = await fetch(url);
                if (!response.ok) return null;
                json = await response.json();
                window._openMeteoCache = { key: cacheKey, data: json, fetchedAt: now };
            } catch (e) {
                console.warn('Weather fetch failed:', e);
                return null;
            }
        }

        // Slice noon-to-noon window for requested date
        const times = json.hourly.time;
        const noonStr = `${dateStr}T12:00`;
        const noonIndex = times.indexOf(noonStr);
        if (noonIndex === -1) return null;

        const slice = (arr) => {
            const s = arr.slice(noonIndex, noonIndex + 24);
            if (s.length < 24) return null;
            s.push(s[s.length - 1]);
            return s;
        };

        const cloudSlice = slice(json.hourly.cloudcover);
        const lowSlice   = slice(json.hourly.cloudcover_low);
        const midSlice   = slice(json.hourly.cloudcover_mid);
        const highSlice  = slice(json.hourly.cloudcover_high);
        const windSlice  = slice(json.hourly.windspeed_10m);
        const tempSlice  = slice(json.hourly.temperature_2m);
        const dewSlice   = slice(json.hourly.dewpoint_2m);

        if (!cloudSlice || !lowSlice || !midSlice || !highSlice || !windSlice || !tempSlice || !dewSlice) return null;

        const spreadSlice = tempSlice.map((t, i) => Math.max(0, t - dewSlice[i]));

        return {
            cloud: cloudSlice,
            low: lowSlice, mid: midSlice, high: highSlice,
            wind: windSlice,
            spread: spreadSlice
        };
    },

    /**
     * Convert 25 hourly values into a smooth CSS linear-gradient.
     * Issue #81 / #93
     */
    assembleGradient(values, colorFn) {
        const stops = values.map((v, i) => {
            const pct = (i / 24) * 100;
            return `${colorFn(v)} ${pct.toFixed(3)}%`;
        });
        return `linear-gradient(to right, ${stops.join(', ')})`;
    },

    /**
     * Amber gradient for cloud cover: black (0%) → rgb(200,112,0) (100%)
     * Issue #93
     */
    cloudColor(v) {
        const r = Math.round((v / 100) * 200);
        const g = Math.round((v / 100) * 112);
        return `rgb(${r},${g},0)`;
    },

    /**
     * Blue gradient for dew point spread risk.
     * Spread >= 10°C = black (safe), spread <= 3°C = light blue (risky).
     * Inverted: low spread = high risk = more color.
     * Issue #93
     */
    dewColor(spread) {
        // Clamp spread 0-10, invert so 0=max risk, 10=no risk
        const risk = Math.max(0, Math.min(10, 10 - spread)) / 10; // 0=safe, 1=risky
        const r = Math.round(risk * 150);
        const g = Math.round(risk * 150);
        const b = Math.round(risk * 230);
        return `rgb(${r},${g},${b})`;
    },

    /**
     * Build wind speed SVG area chart for a strip.
     * Dynamic scale: rounds max wind up to next 5mph.
     * Strip height = 45px.
     * Issue #93
     */
    buildWindSVG(values, width) {
        const HEIGHT = 45;
        const maxVal = Math.max(...values);
        const MAX_WIND = Math.max(5, Math.ceil(maxVal / 5) * 5);
        const PAD = 3; // pixels from top

        const points = values.map((v, i) => {
            const x = (i / 24) * width;
            const y = HEIGHT - PAD - Math.min(1, v / MAX_WIND) * (HEIGHT - PAD * 2);
            return `${x},${y}`;
        }).join(' ');

        const lastX = ((values.length - 1) / 24) * width;
        const polygon = `${points} ${lastX},${HEIGHT} 0,${HEIGHT}`;

        const midY = HEIGHT / 2;

        return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${HEIGHT}" style="display:block;position:absolute;top:0;left:0;">
            <polygon points="${polygon}" fill="rgba(255,255,0,0.8)"/>
            <!-- Mid-scale reference line: black outline then yellow dashed on top -->
            <line x1="0" y1="${midY}" x2="${width}" y2="${midY}" stroke="#000000" stroke-width="3"/>
            <line x1="0" y1="${midY}" x2="${width}" y2="${midY}" stroke="rgba(255,255,0,0.5)" stroke-width="2" stroke-dasharray="5,5"/>
            <!-- Max wind label background -->
            <rect x="2" y="2" width="44" height="14" fill="rgba(0,0,0,0.8)" rx="2"/>
            <!-- Max wind value -->
            <text x="4" y="12" font-family="monospace" font-size="12" fill="#ffff00">${MAX_WIND}mph</text>
        </svg>`;
    },

    /**
     * Render the weather strips at the top of the timeline container.
     * Three strips: Clouds (amber gradient), Wind (yellow line), Dew (blue gradient).
     * If cloudData is null, renders an unavailable message instead.
     * Issue #81 / #93
     */
    renderCloudStrip(container, cloudData) {
        // Remove any existing strip
        const existing = container.querySelector('.cloud-cover-strip, .cloud-unavailable');
        if (existing) existing.remove();

        if (!cloudData) {
            const unavailable = document.createElement('div');
            unavailable.className = 'cloud-unavailable';
            unavailable.textContent = 'Cloud forecast unavailable for this date';
            container.insertBefore(unavailable, container.firstChild);
            return;
        }

        const strip = document.createElement('div');
        strip.className = 'cloud-cover-strip';
        strip.id = 'cloud-cover-strip';

        const bands = [
            {
                label: 'Clouds',
                type: 'gradient',
                background: this.assembleGradient(cloudData.cloud, v => this.cloudColor(v)),
                tooltipKey: 'dv_clouds'
            },
            {
                label: 'Wind',
                type: 'wind',
                wind: cloudData.wind,
                tooltipKey: 'dv_wind'
            },
            {
                label: 'Dew',
                type: 'gradient',
                background: this.assembleGradient(cloudData.spread, v => this.dewColor(v)),
                tooltipKey: 'dv_dew'
            }
        ];

        bands.forEach((band, i) => {
            if (i > 0) {
                const gap = document.createElement('div');
                gap.className = 'cloud-band-gap';
                strip.appendChild(gap);
            }

            const bandDiv = document.createElement('div');
            bandDiv.className = 'cloud-band';
            if (band.tooltipKey) bandDiv.dataset.tooltipKey = band.tooltipKey;

            if (band.type === 'gradient') {
                bandDiv.style.background = band.background;
            } else if (band.type === 'wind') {
                bandDiv.style.background = '#000000';
                bandDiv.style.position = 'relative';
                // SVG drawn after append when width is known
                bandDiv.dataset.windBand = 'true';
            }

            const label = document.createElement('div');
            label.className = 'cloud-band-label cloud-band-label-title';
            label.textContent = band.label;
            bandDiv.appendChild(label);

            strip.appendChild(bandDiv);
        });

        container.insertBefore(strip, container.firstChild);

        // Draw wind SVG now that the band is in the DOM and has a width
        const windBand = strip.querySelector('[data-wind-band]');
        if (windBand && cloudData.wind) {
            this._lastWindValues = cloudData.wind;
            const w = windBand.offsetWidth || 800;
            windBand.innerHTML += this.buildWindSVG(cloudData.wind, w);
            // Re-append label on top of SVG
            const lbl = windBand.querySelector('.cloud-band-label');
            if (lbl) windBand.appendChild(lbl);
        }
    },

    /**
     * Attach event handlers
     */
    attachEventHandlers() {
        this._addRepeatButton('dv-prev-week', -7);
        this._addRepeatButton('dv-prev-day',  -1);
        this._addRepeatButton('dv-next-day',   1);
        this._addRepeatButton('dv-next-week',  7);
        document.getElementById('dv-date')?.addEventListener('change', () => this.recalculate());
        document.getElementById('dv-min-altitude')?.addEventListener('change', () => this.recalculate());
        document.getElementById('dv-use-horizon')?.addEventListener('change', () => this.recalculate());
    },

    _addRepeatButton(id, days) {
        const btn = document.getElementById(id);
        if (!btn) return;
        let holdTimer = null;
        let repeatTimer = null;
        btn.addEventListener('click', () => this.shiftDate(days));
        btn.addEventListener('mousedown', () => {
            holdTimer = setTimeout(() => {
                repeatTimer = setInterval(() => this.shiftDate(days), 333);
            }, 500);
        });
        const cancel = () => {
            clearTimeout(holdTimer);
            clearInterval(repeatTimer);
        };
        btn.addEventListener('mouseup', cancel);
        btn.addEventListener('mouseleave', cancel);
    },

    initControls() {
        const dateInput = document.getElementById('dv-date');
        if (dateInput) {
            let defaultDate = new Date();
            if (!window.skyglowData?.date && defaultDate.getHours() < APP_CONFIG.DV_LOOKBACK_CUTOFF_HOUR) {
                defaultDate.setDate(defaultDate.getDate() - 1);
            }
            const dateStr = window.skyglowData?.date || TimeUtils.formatDateForInput(defaultDate);
            dateInput.value = dateStr;
        }
        const minAlt = document.getElementById('dv-min-altitude');
        if (minAlt) {
            const altValue = window.skyglowData?.minAltitude ?? SettingsManager.getGlobalMinAltitude();
            minAlt.value = String(altValue);
        }
        const useHorizon = document.getElementById('dv-use-horizon');
        if (useHorizon) {
            useHorizon.checked = window.skyglowData?.useHorizon ?? true;
        }
    },

    shiftDate(days) {
        const dateInput = document.getElementById('dv-date');
        if (!dateInput) return;
        const parts = dateInput.value.split('-');
        const d = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
        d.setDate(d.getDate() + days);
        dateInput.value = TimeUtils.formatDateForInput(d);
        this.recalculate();
    },

    recalculate() {
        const dateStr = document.getElementById('dv-date')?.value;
        const minAltitude = parseFloat(document.getElementById('dv-min-altitude')?.value) || SettingsManager.getGlobalMinAltitude();
        const useHorizon = document.getElementById('dv-use-horizon')?.checked ?? true;
        const locationName = SettingsManager.getSelectedLocation();

        // Ensure a target is set
        if (typeof VisibilityTargets !== 'undefined' && !VisibilityTargets.currentTarget) {
            VisibilityTargets.loadLastTarget();
        }
        if (typeof VisibilityTargets !== 'undefined' && !VisibilityTargets.currentTarget) {
            const defaultTarget = DataManager.getTargets().find(t => t.object === APP_CONFIG.DEFAULT_TARGET);
            if (defaultTarget) VisibilityTargets.currentTarget = defaultTarget;
        }

        const target = VisibilityTargets?.currentTarget;
        if (!target || !locationName || !dateStr) return;

        const skyglowData = DailyVisibilityCalculations.assembleSkyglowData(
            target, dateStr, locationName, minAltitude, useHorizon
        );
        if (!skyglowData) {
            UIManager.showToast('Could not calculate visibility for this date/location', 'error');
            return;
        }

        window.skyglowData = skyglowData;
        this.currentData = skyglowData;
        this.performAnalysis(skyglowData);
    },

    /**
     * Show data entry form if no data available
     */
    showDataEntryForm() {
        const messageDiv = document.getElementById('daily-visibility-message');
        if (messageDiv) {
            messageDiv.innerHTML = `
                <p style="color: var(--text-secondary); text-align: center; padding: 2rem;">
                    Please use the Visibility Calculator to generate observation data,
                    then click "Analyze Skyglow" to view the timeline.
                </p>
            `;
        }
    },

    /**
     * Perform daily visibility analysis - main entry point
     */
    performAnalysis(data) {
        // Hide message, show content
        const messageDiv = document.getElementById('daily-visibility-message');
        if (messageDiv) messageDiv.style.display = 'none';

        // Show analysis sections
        document.getElementById('info-cards-container').style.display = 'grid';
        document.getElementById('timeline-section').style.display = 'block';

        // Set title with target name and common name
        const dateParts = data.date.split('-');
        const date = new Date(
            parseInt(dateParts[0]),
            parseInt(dateParts[1]) - 1,
            parseInt(dateParts[2])
        );
        const dateStr = date.toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric'
        });

        // Build title — target name and common name only, no date
        let titleText = data.targetName;
        if (data.commonName && data.commonName.trim()) {
            titleText += ` (${data.commonName})`;
        }

        document.getElementById('analysis-title').textContent = titleText;

        // Populate information cards
        this.populateMoonDetails(data);
        this.populateTargetDetails(data);
        this.populateSeparationDetails(data);

        // Generate gradient timeline
        this.generateGradientTimeline(data);
    },

    /**
     * Populate Moon Details card
     */
    populateMoonDetails(data) {
        const moonPhase = getMoonPhase(data.duskJD);

        document.getElementById('moon-phase-name').textContent = moonPhase.phaseName;
        document.getElementById('moon-illumination').textContent =
            `${moonPhase.illumination.toFixed(1)}% illuminated`;
        const moonCard = document.getElementById('dv-moon-details');
        if (moonCard) moonCard.dataset.emoji = moonPhase.phaseEmoji;

        // Moon rise/set times
        let riseSetHTML = '';
        if (data.moonRiseSet.moonrise) {
            const riseDate = TimeUtils.jdToDate(data.moonRiseSet.moonrise);
            const riseStr = TimeUtils.formatLocalTimeWithDate(riseDate, data.timezone);
            riseSetHTML += `Rise: ${riseStr}<br>`;
        }
        if (data.moonRiseSet.moonset) {
            const setDate = TimeUtils.jdToDate(data.moonRiseSet.moonset);
            const setStr = TimeUtils.formatLocalTimeWithDate(setDate, data.timezone);
            riseSetHTML += `Set: ${setStr}`;
        }
        document.getElementById('moon-rise-set').innerHTML = riseSetHTML || 'No rise/set during observation';
    },

    /**
     * Populate Target Details card
     */
    populateTargetDetails(data) {
        // Calculate peak altitude at meridian crossing
        const targetRA = data.ra;
        const targetDEC = data.dec;
        const latitude = data.latitude;
        const longitude = data.longitude;

        let peakAltitudeHTML = '';
        if (!isNaN(targetRA) && !isNaN(targetDEC)) {
            let maxAltitude = -999;
            let maxAltitudeJD = null;

            // Sample at 1-minute intervals within the observation window
            const oneMinute = 1 / 1440;
            let currentJD = data.duskJD;

            while (currentJD <= data.dawnJD) {
                const altitude = getAltitude(currentJD, targetRA, targetDEC, latitude, longitude);

                if (altitude > maxAltitude) {
                    maxAltitude = altitude;
                    maxAltitudeJD = currentJD;
                }

                currentJD += oneMinute;
            }

            if (maxAltitudeJD) {
                const peakTime = TimeUtils.jdToDate(maxAltitudeJD);
                const isDST = SettingsManager.isDSTActive(peakTime, data.timezone);
                const offsetHours = isDST ? data.timezone + 1 : data.timezone;
                const adjustedTime = new Date(peakTime.getTime() + offsetHours * 3600000);
                const peakTimeStr = adjustedTime.toLocaleTimeString('en-US', {
                    hour12: false,
                    hour: '2-digit',
                    minute: '2-digit',
                    timeZone: 'UTC'
                });

                // Calculate azimuth at peak altitude
                let peakAzimuth = getAzimuth(maxAltitudeJD, targetRA, targetDEC, latitude, longitude);
                // Normalize 360° to 0° (both represent north)
                if (peakAzimuth >= 359.5) peakAzimuth = 0; // Round 360 to 0
                peakAltitudeHTML = `Peak Altitude: ${maxAltitude.toFixed(1)}° at ${peakTimeStr}<br>Peak Azimuth: ${peakAzimuth.toFixed(1)}°`;
            }
        }

        document.getElementById('target-peak-altitude').innerHTML = peakAltitudeHTML || 'N/A';

        document.getElementById('target-altitude').textContent =
            `Minimum altitude: ${data.minAltitude}°`;

        // Target rise/set times
        let riseSetHTML = '';

        // Rise time
        if (data.riseJD) {
            const riseDate = TimeUtils.jdToDate(data.riseJD);
            const riseStr = TimeUtils.formatLocalTimeWithDate(riseDate, data.timezone);

            // Check if rise is before dusk
            if (data.riseJD < data.duskJD) {
                riseSetHTML += `Rise: ${riseStr}*<br>`;
            } else {
                riseSetHTML += `Rise: ${riseStr}<br>`;
            }
        } else {
            riseSetHTML += `Rise: Before dusk<br>`;
        }

        // Set time
        if (data.setJD) {
            const setDate = TimeUtils.jdToDate(data.setJD);
            const setStr = TimeUtils.formatLocalTimeWithDate(setDate, data.timezone);

            // Check if set is after dawn
            if (data.setJD > data.dawnJD) {
                riseSetHTML += `Set: ${setStr}*`;
            } else {
                riseSetHTML += `Set: ${setStr}`;
            }
        } else if (data.actualSetJD) {
            // Extended search found set time after dawn
            const actualSetDate = TimeUtils.jdToDate(data.actualSetJD);
            const actualSetStr = TimeUtils.formatLocalTimeWithDate(actualSetDate, data.timezone);
            riseSetHTML += `Set: ${actualSetStr}*`;
        } else {
            riseSetHTML += `Set: After dawn`;
        }

        document.getElementById('target-rise-set').innerHTML = riseSetHTML;

        // Display blocked time
        console.log('populateTargetDetails - data.blockedMinutes:', data.blockedMinutes);
        console.log('populateTargetDetails - full data:', data);

        // Display blocked time
        const blockedElement = document.getElementById('target-blocked');
        if (blockedElement) {
            if (data.blockedMinutes !== undefined && data.blockedMinutes > 0) {
                blockedElement.textContent = `Blocked: ${data.blockedMinutes} min`;
            } else {
                blockedElement.textContent = 'Blocked: -';
            }
        }
    },

    /**
     * Populate Target-Moon Separation card
     */
    populateSeparationDetails(data) {
        // For rise: use target rise if it's after dusk, otherwise use dusk
        let riseTime, riseLabel;
        if (data.riseJD && data.riseJD >= data.duskJD) {
            riseTime = data.riseJD;
            riseLabel = 'At rise:';
        } else {
            riseTime = data.duskJD;
            riseLabel = 'At dusk:';
        }
        const moonPosRise = getMoonPosition(riseTime);
        const separationRise = getAngularSeparation(moonPosRise.ra, moonPosRise.dec, data.ra, data.dec);

        // For set: use target set if it's before dawn, otherwise use dawn
        let setTime, setLabel;
        if (data.setJD && data.setJD <= data.dawnJD) {
            setTime = data.setJD;
            setLabel = 'At set:';
        } else if (data.actualSetJD && data.actualSetJD <= data.dawnJD) {
            setTime = data.actualSetJD;
            setLabel = 'At set:';
        } else {
            setTime = data.dawnJD;
            setLabel = 'At dawn:';
        }
        const moonPosSet = getMoonPosition(setTime);
        const separationSet = getAngularSeparation(moonPosSet.ra, moonPosSet.dec, data.ra, data.dec);

        // Display rise separation
        document.getElementById('separation-dusk').innerHTML =
            `<span class="info-label" style="display: inline;">${riseLabel}</span> ${separationRise.toFixed(1)}°`;
        document.getElementById('separation-dusk-desc').textContent =
            this.getSeparationDescription(separationRise);

        // Display set separation
        document.getElementById('separation-dawn').innerHTML =
            `<span class="info-label" style="display: inline;">${setLabel}</span> ${separationSet.toFixed(1)}°`;
        document.getElementById('separation-dawn-desc').textContent =
            this.getSeparationDescription(separationSet);
    },

    /**
     * Get description of separation impact
     */
    getSeparationDescription(separation) {
        if (separation < 20) {
            return 'Very close - severe interference';
        } else if (separation < 40) {
            return 'Close - significant interference';
        } else if (separation < 60) {
            return 'Moderate distance - some interference';
        } else if (separation < 90) {
            return 'Good distance - minimal interference';
        } else {
            return 'Excellent distance - negligible interference';
        }
    },

    /**
     * Generate gradient timeline (using original algorithm from skyglow.html)
     * Timeline always spans from noon on observation date to noon the next day
     */
    generateGradientTimeline(data) {
        const container = document.getElementById('timeline-container');
        const labelsContainer = document.getElementById('timeline-labels');

        // Clear containers
        container.innerHTML = '';
        labelsContainer.innerHTML = '';

        // Calculate timeline bounds - ALWAYS noon to noon in LOCAL time
        // We need to create a JD that represents "local noon" for calculations
        const dateParts = data.date.split('-');
        const localNoonDate = new Date(
            parseInt(dateParts[0]),
            parseInt(dateParts[1]) - 1,
            parseInt(dateParts[2]),
            12, 0, 0
        );

        // Convert to JD treating it as UTC (no timezone adjustment)
        // This gives us the "local noon" as a JD value
        const noonStartJD = TimeUtils.dateToJD(localNoonDate);

        const timelineStartJD = noonStartJD;
        const timelineEndJD = noonStartJD + 1; // Next day's noon
        const timelineDuration = timelineEndJD - timelineStartJD;

        // Create timeline data structure
        const timelineData = {
            timelineStartJD,
            timelineEndJD,
            duskJD: data.duskJD,
            dawnJD: data.dawnJD,
            targetRiseJD: data.riseJD,
            targetSetJD: data.setJD,
            moonriseJD: data.moonRiseSet.moonrise,
            moonsetJD: data.moonRiseSet.moonset,
            jdToTimelinePercent: (jd) => {
                if (!jd) return null;
                return ((jd - timelineStartJD) / timelineDuration) * 100;
            }
        };

        // Create the timeline div with original styling
        const timelineDiv = document.createElement('div');
        timelineDiv.className = 'timeline';
        timelineDiv.id = 'timeline-gradient';
        timelineDiv.style.position = 'relative';
        timelineDiv.style.height = this.TIMELINE_HEIGHT + 'px';
        timelineDiv.style.borderRadius = '8px';
        timelineDiv.style.margin = '0';
        timelineDiv.style.marginTop = APP_CONFIG.FEATURES.CLOUD_COVER ? '137px' : '0';
        timelineDiv.style.border = '1px solid rgba(255, 255, 255, 0.2)';
        timelineDiv.style.background = '#666666'; // Default background

        // Store JD bounds as data attributes for other functions to use
        timelineDiv.dataset.startJd = timelineStartJD;
        timelineDiv.dataset.endJd = timelineEndJD;

        container.appendChild(timelineDiv);

        // Generate gradient using original algorithm
        this.createMoonlightImpactGradient(timelineData, timelineDiv, data);

        // Add markers using original algorithm
        this.createMarkersForTimeline('timeline-gradient', timelineData, data);

        // Create time labels
        this.createLabelsForTimeline(labelsContainer, timelineData, data);

        // After creating the gradient and markers, add the altitude curve
        this.drawTargetAltitudeCurve(timelineDiv, timelineData, data);
        this.drawMinimumAltitudeLine(timelineDiv, data.minAltitude, data);

        // Cloud cover strip — Issue #81
        if (APP_CONFIG.FEATURES.CLOUD_COVER) {
            const location = DataManager.getLocation(data.locationName);
            if (location) {
                const duskPct = timelineData.jdToTimelinePercent(timelineData.duskJD) ?? 50;
                const dawnPct = timelineData.jdToTimelinePercent(timelineData.dawnJD) ?? 50;
                this.fetchCloudData(location.latitude, location.longitude, data.date)
                    .then(cloudData => {
                        if (cloudData) {
                            cloudData.duskPct = duskPct;
                            cloudData.dawnPct = dawnPct;
                        }
                        this.renderCloudStrip(container, cloudData);
                    });
            }
        }
    },

    /**
     * Create moonlight impact gradient (original algorithm from skyglow.html)
     */
    createMoonlightImpactGradient(timelineData, timeline, data) {
        const targetRA = data.ra;
        const targetDEC = data.dec;
        const latitude = data.latitude;
        const longitude = data.longitude;
        const baseSkyBrightness = 21.0;

        if (isNaN(targetRA) || isNaN(targetDEC)) {
            timeline.style.background = 'linear-gradient(to right, #000000, #666666, #ffffff)';
            return;
        }

        // Generate strategic gradient stops (original uses 200 points)
        const strategicPoints = [];
        for (let i = 0; i <= 200; i++) {
            const fraction = i / 200;
            const currentJD = timelineData.timelineStartJD + fraction * (timelineData.timelineEndJD - timelineData.timelineStartJD);

            const sunPos = getSunPosition(currentJD);
            const sunAltitude = getAltitude(currentJD, sunPos.ra, sunPos.dec, latitude, longitude);

            const moonPos = getMoonPosition(currentJD);
            const moonAltitude = getAltitude(currentJD, moonPos.ra, moonPos.dec, latitude, longitude);
            const targetAltitude = getAltitude(currentJD, targetRA, targetDEC, latitude, longitude);
            const separation = getAngularSeparation(targetRA, targetDEC, moonPos.ra, moonPos.dec);

            const moonPhase = getMoonPhase(currentJD);

            let quality = calculateSkyLight(moonAltitude, targetAltitude, separation,
                                            moonPhase.illumination, baseSkyBrightness, sunAltitude);

            strategicPoints.push({
                position: fraction * 100,
                quality: quality
            });
        }

        // Create gradient with strategic color stops (original algorithm)
        const gradientStops = strategicPoints.map(point => {
            const grayValue = (1 - point.quality) * 255;
            return `rgb(${grayValue}, ${grayValue}, ${grayValue}) ${point.position}%`;
        });

        const gradient = `linear-gradient(to right, ${gradientStops.join(', ')})`;
        timeline.style.background = gradient;
    },

    /**
     * Create 'bar graph' markers for timeline
     */
    createMarkersForTimeline(timelineId, timelineData, data) {
        const timeline = document.getElementById(timelineId);

        // Clear existing markers first
        const existingMarkers = timeline.querySelectorAll('.time-marker');
        existingMarkers.forEach(marker => marker.remove());

        const addMarker = (jd, icon, label) => {
            if (!jd) return;

            const position = timelineData.jdToTimelinePercent(jd);
            if (position === null || position < 0 || position > 100) return;

            const localTime = TimeUtils.jdToDate(jd);
            const isDST = SettingsManager.isDSTActive(localTime, data.timezone);
            const offsetHours = isDST ? data.timezone + 1 : data.timezone;
            const adjustedTime = new Date(localTime.getTime() + offsetHours * 3600000);

            const timeString = adjustedTime.toLocaleTimeString('en-US', {
                hour12: false,
                hour: '2-digit',
                minute: '2-digit',
                timeZone: 'UTC'
            });

            const marker = document.createElement('div');
            marker.className = 'time-marker';
            marker.style.position = 'absolute';
            marker.style.top = '0px';
            marker.style.width = '5px';
            marker.style.height = this.TIMELINE_HEIGHT + 'px';
            marker.style.background = 'linear-gradient(to bottom, transparent 90%, rgba(255, 193, 7, 1) 90%)';
            marker.style.left = position + '%';
            marker.style.transform = 'translateX(-50%)';
            marker.style.zIndex = '10';
            marker.setAttribute('data-icon', icon);
            marker.setAttribute('data-time', timeString);
            marker.title = label;
            timeline.appendChild(marker);
        };

        // Add markers for all events
        addMarker(timelineData.duskJD, '☀️↓', 'Astronomical Dusk');
        addMarker(timelineData.dawnJD, '☀️↑', 'Astronomical Dawn');
        addMarker(timelineData.targetRiseJD, '✨↑', 'Target Rise');
        addMarker(timelineData.targetSetJD, '✨↓', 'Target Set');
        addMarker(timelineData.moonriseJD, '🌙↑', 'Moonrise');
        addMarker(timelineData.moonsetJD, '🌙↓', 'Moonset');
    },

    /**
     * Create time labels (original algorithm)
     */
    createLabelsForTimeline(labelsContainer, timelineData, data) {
        labelsContainer.innerHTML = '';
        labelsContainer.style.display = 'flex';
        labelsContainer.style.justifyContent = 'space-between';
        labelsContainer.style.margin = '17px 0 10px 0';
        labelsContainer.style.fontSize = '12px';
        labelsContainer.style.color = '#b0b0b0';
        labelsContainer.style.position = 'relative';

        // Since timeline is noon to noon in LOCAL time, we need to work in local time
        // timelineStartJD represents local noon, so we just add hours in JD units

        // Start at noon (12:00)
        let currentHour = 12;

        // Generate labels for each hour from noon to noon (24 hours)
        for (let i = 0; i <= 24; i++) {
            const position = (i / 24) * 100; // Simple linear interpolation

            const label = document.createElement('div');
            label.className = 'timeline-label';
            label.style.position = 'absolute';
            label.style.top = '-18px';
            label.style.left = position + '%';
            label.style.transform = 'translateX(-50%)';
            label.style.whiteSpace = 'nowrap';
            label.textContent = currentHour.toString();
            labelsContainer.appendChild(label);

            // Move to next hour
            currentHour = (currentHour + 1) % 24;
            if (currentHour === 0) currentHour = 24; // Show 24 instead of 0 for midnight
        }
    },

    /**
     * Draw target altitude curve on the timeline
     */
    drawTargetAltitudeCurve(timeline, timelineData, data) {
        const targetRA = data.ra;
        const targetDEC = data.dec;
        const latitude = data.latitude;
        const longitude = data.longitude;
        const minAltitude = data.minAltitude;
        const altitudeOutline = '5';       // width in pixels
        const altitudeLine = '2';          // width in pixels

        if (isNaN(targetRA) || isNaN(targetDEC)) return;

        // Check if horizon usage is enabled
        const useHorizon = data?.useHorizon ?? true;

        // Get location horizon data (only if enabled)
        const location = DataManager.getLocation(data.locationName);
        const horizonArray = (useHorizon && location) ? location.horizon : null;

        // Sample altitude at many points across the timeline
        const numPoints = 200;
        const points = [];

        for (let i = 0; i <= numPoints; i++) {
            const fraction = i / numPoints;
            const currentJD = timelineData.timelineStartJD + fraction * (timelineData.timelineEndJD - timelineData.timelineStartJD);
            const altitude = getAltitude(currentJD, targetRA, targetDEC, latitude, longitude);
            const azimuth = getAzimuth(currentJD, targetRA, targetDEC, latitude, longitude);

            // Check if target is visible (above both min altitude and horizon)
            const isVisible = isAboveHorizon(altitude, azimuth, minAltitude, horizonArray);

            // Convert altitude (0-90°) to Y position (bottom to top of timeline)
            const yPosition = this.TIMELINE_HEIGHT - (altitude / 90) * this.TIMELINE_HEIGHT;
            const xPosition = fraction * 100; // Percentage

            points.push({
                x: xPosition,
                y: Math.max(0, Math.min(this.TIMELINE_HEIGHT, yPosition)),
                isVisible: isVisible
            });
        }

        // Create SVG overlay
        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svg.style.position = 'absolute';
        svg.style.top = '0';
        svg.style.left = '0';
        svg.style.width = '100%';
        svg.style.height = this.TIMELINE_HEIGHT + 'px';
        svg.style.pointerEvents = 'none';
        svg.setAttribute('viewBox', '0 0 100 ' + this.TIMELINE_HEIGHT);
        svg.setAttribute('preserveAspectRatio', 'none');

        // Create path segments (break path when not visible)
        let currentSegment = [];
        const segments = [];

        for (let i = 0; i < points.length; i++) {
            const point = points[i];

            if (point.isVisible) {
                currentSegment.push(point);
            } else {
                // End current segment and start new one
                if (currentSegment.length > 0) {
                    segments.push(currentSegment);
                    currentSegment = [];
                }
            }
        }

        // Add final segment if any
        if (currentSegment.length > 0) {
            segments.push(currentSegment);
        }

        // Draw each segment
        segments.forEach(segment => {
            if (segment.length < 2) return; // Need at least 2 points for a line

            const pathData = segment.map((p, i) => {
                return `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`;
            }).join(' ');

            // Draw black outline (thicker)
            const outlinePath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
            outlinePath.setAttribute('d', pathData);
            outlinePath.setAttribute('fill', 'none');
            outlinePath.setAttribute('stroke', '#000000');
            outlinePath.setAttribute('stroke-width', altitudeOutline);
            outlinePath.setAttribute('vector-effect', 'non-scaling-stroke');
            svg.appendChild(outlinePath);

            // Draw white line (on top)
            const linePath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
            linePath.setAttribute('d', pathData);
            linePath.setAttribute('fill', 'none');
            linePath.setAttribute('stroke', '#FFFFFF');
            linePath.setAttribute('stroke-width', altitudeLine);
            linePath.setAttribute('vector-effect', 'non-scaling-stroke');
            svg.appendChild(linePath);
        });

        timeline.appendChild(svg);
    },

    /**
     * Draw merged minimum altitude and horizon line
     * Shows the effective minimum: max(minAltitude, horizonElevation) at each azimuth
     */
    drawMinimumAltitudeLine(timeline, minAltitude, data) {
        // Check if horizon usage is enabled
        const useHorizon = data?.useHorizon ?? true; // Default to true
        const location = DataManager.getLocation(data.locationName);
        const horizonArray = (useHorizon && location) ? location.horizon : null;

        const targetRA = data.ra;
        const targetDEC = data.dec;
        const latitude = data.latitude;
        const longitude = data.longitude;

        if (isNaN(targetRA) || isNaN(targetDEC)) return;

        // Get timeline bounds from the timeline div
        const timelineStartJD = parseFloat(timeline.dataset.startJd);
        const timelineEndJD = parseFloat(timeline.dataset.endJd);

        if (isNaN(timelineStartJD) || isNaN(timelineEndJD)) return;

        // Sample points across timeline
        const numPoints = 200;
        const points = [];

        for (let i = 0; i <= numPoints; i++) {
            const fraction = i / numPoints;
            const currentJD = timelineStartJD + fraction * (timelineEndJD - timelineStartJD);

            // Calculate azimuth at this time
            const azimuth = getAzimuth(currentJD, targetRA, targetDEC, latitude, longitude);

            // Get horizon elevation at this azimuth
            const horizonElevation = getHorizonElevationAtAzimuth(azimuth, horizonArray);

            // Effective minimum is the higher of minAltitude or horizon
            const effectiveMin = Math.max(minAltitude, horizonElevation);

            // Convert to Y position
            const yPosition = this.TIMELINE_HEIGHT - (effectiveMin / 90) * this.TIMELINE_HEIGHT;
            const xPosition = fraction * 100;

            points.push({ x: xPosition, y: Math.max(0, Math.min(this.TIMELINE_HEIGHT, yPosition)) });
        }

        // Create SVG for min altitude line
        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svg.style.position = 'absolute';
        svg.style.top = '0';
        svg.style.left = '0';
        svg.style.width = '100%';
        svg.style.height = this.TIMELINE_HEIGHT + 'px';
        svg.style.pointerEvents = 'none';
        svg.setAttribute('viewBox', '0 0 100 ' + this.TIMELINE_HEIGHT);
        svg.setAttribute('preserveAspectRatio', 'none');

        // Create path
        const pathData = points.map((p, i) => {
            return `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`;
        }).join(' ');

        // Draw black outline (thicker)
        const outlinePath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        outlinePath.setAttribute('d', pathData);
        outlinePath.setAttribute('fill', 'none');
        outlinePath.setAttribute('stroke', '#000000');
        outlinePath.setAttribute('stroke-width', 3);
        outlinePath.setAttribute('vector-effect', 'non-scaling-stroke');
        svg.appendChild(outlinePath);

        const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        path.setAttribute('d', pathData);
        path.setAttribute('fill', 'none');
        path.setAttribute('stroke', 'rgba(255, 255, 0, 0.5)'); // Yellow, semi-transparent
        path.setAttribute('stroke-width', '2');
        path.setAttribute('stroke-dasharray', '5,5'); // Dashed line
        path.setAttribute('vector-effect', 'non-scaling-stroke');

        svg.appendChild(path);
        timeline.appendChild(svg);
    },

    /**
     * Find when target crosses meridian (maximum altitude)
     */
    findMeridianCrossing(timelineData, data) {
        const targetRA = data.ra;
        const targetDEC = data.dec;
        const latitude = data.latitude;
        const longitude = data.longitude;

        if (isNaN(targetRA) || isNaN(targetDEC)) return null;

        let maxAltitude = -999;
        let maxAltitudeJD = null;

        // Sample at 1-minute intervals to find maximum altitude
        const oneMinute = 1 / 1440;
        let currentJD = timelineData.timelineStartJD;

        while (currentJD <= timelineData.timelineEndJD) {
            const altitude = getAltitude(currentJD, targetRA, targetDEC, latitude, longitude);

            if (altitude > maxAltitude) {
                maxAltitude = altitude;
                maxAltitudeJD = currentJD;
            }

            currentJD += oneMinute;
        }

        return maxAltitudeJD;
    }

};

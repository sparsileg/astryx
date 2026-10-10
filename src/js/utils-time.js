/**
 * utils-time.js
 * Time and date utilities
 */

const TimeUtils = {
    _offsetFormats: new Map(),  // IANA zone -> Intl.DateTimeFormat (perf: building one is slow)

    /**
     * UTC offset of an IANA time zone at an instant, daylight saving included
     * (e.g. -4 for America/New_York in July, 5.5 for Asia/Kolkata).
     * @param {string} timeZone - IANA name
     * @param {Date} instant
     * @returns {number} Hours east of UTC
     */
    zoneOffsetHours(timeZone, instant) {
        let format = this._offsetFormats.get(timeZone);
        if (!format) {
            format = new Intl.DateTimeFormat('en-US', { timeZone, timeZoneName: 'longOffset' });
            this._offsetFormats.set(timeZone, format);
        }
        // "GMT-04:00", "GMT+05:30", or plain "GMT" at UTC
        const name = format.formatToParts(instant).find(part => part.type === 'timeZoneName').value;
        const match = name.match(/^GMT([+-])(\d{2}):(\d{2})$/);
        if (!match) return 0;
        const hours = Number(match[2]) + Number(match[3]) / 60;
        return match[1] === '-' ? -hours : hours;
    },

    /**
     * Standard-time offset of an IANA time zone: the smaller of its January
     * and July offsets, since daylight saving adds time in either hemisphere.
     * @param {string} timeZone - IANA name
     * @param {number} year
     * @returns {number} Hours east of UTC
     */
    standardOffsetHours(timeZone, year) {
        return Math.min(
            this.zoneOffsetHours(timeZone, new Date(Date.UTC(year, 0, 1))),
            this.zoneOffsetHours(timeZone, new Date(Date.UTC(year, 6, 1)))
        );
    },

    /**
     * Whether the runtime knows an IANA time zone name.
     */
    isValidTimeZone(timeZone) {
        try {
            new Intl.DateTimeFormat('en-US', { timeZone });
            return true;
        } catch {
            return false;
        }
    },

    /**
     * Convert Date object to Julian Date
     */
    dateToJD(date) {
        const year = date.getUTCFullYear();
        const month = date.getUTCMonth() + 1;
        const day = date.getUTCDate();
        const hour = date.getUTCHours();
        const minute = date.getUTCMinutes();
        const second = date.getUTCSeconds();
        const millisecond = date.getUTCMilliseconds();

        let a = Math.floor((14 - month) / 12);
        let y = year + 4800 - a;
        let m = month + 12 * a - 3;

        let jdn = day + Math.floor((153 * m + 2) / 5) + 365 * y +
            Math.floor(y / 4) - Math.floor(y / 100) + Math.floor(y / 400) - 32045;

        let dayFraction = (hour + minute/60.0 + second/3600.0 + millisecond/3600000.0) / 24.0;
        return jdn + dayFraction - 0.5;
    },

    /**
     * Convert Julian Date to Date object
     */
    jdToDate(jd) {
        let a = Math.floor(jd + 0.5);
        let b, c;

        if (a < 2299161) {
            c = a + 1524;
        } else {
            b = Math.floor((a - 1867216.25) / 36524.25);
            c = a + b - Math.floor(b / 4) + 1525;
        }

        let d = Math.floor((c - 122.1) / 365.25);
        let e = Math.floor(365.25 * d);
        let f = Math.floor((c - e) / 30.6001);

        let day = c - e - Math.floor(30.6001 * f);
        let month = f - 1;
        let year = d - 4716;

        if (f > 13) {
            month = f - 13;
            year = d - 4715;
        }

        let dayFraction = (jd + 0.5) - a;
        let hours = dayFraction * 24;
        let minutes = (hours % 1) * 60;
        let seconds = (minutes % 1) * 60;
        let milliseconds = (seconds % 1) * 1000;

        return new Date(Date.UTC(year, month - 1, day, Math.floor(hours),
                                 Math.floor(minutes), Math.floor(seconds), Math.floor(milliseconds)));
    },

    /**
     * Convert input local time to JD for calculations
     */
    inputTimeToJD(obsDate, timeString, timezone, isDSTActive) {
        const dateTime = new Date(`${obsDate}T${timeString}:00`);
        const offsetHours = isDSTActive ? timezone + 1 : timezone;
        const utcDate = new Date(dateTime.getTime() - offsetHours * 3600000);
        return this.dateToJD(utcDate);
    },

    /**
     * JD of a local wall-clock instant at a given location, independent of
     * the browser/OS timezone. Every astro calculation that needs "noon on
     * date X" or "midnight on date X" at a specific observing location
     * should go through this rather than constructing a Date from calendar
     * components and reading it back — that pattern silently picks up
     * whatever timezone the machine happens to be set to.
     * @param {number} year
     * @param {number} month - 0-based, matching Date (0 = January)
     * @param {number} day
     * @param {number} hour - local wall-clock hour
     * @param {number} timezone - location standard offset in hours (e.g. -5 for EST)
     * @param {boolean} isDST - whether DST is in effect on that date
     * @returns {number} Julian Date
     */
    localWallClockToJD(year, month, day, hour, timezone, isDST) {
        const offsetHours = isDST ? timezone + 1 : timezone;
        return this.dateToJD(new Date(Date.UTC(year, month, day, hour, 0, 0) - offsetHours * 3600000));
    },

    /**
     * A location's offset from UTC in hours at an instant: its standard offset, plus DST
     * @param {Date} utcTime
     * @param {Object} location - { timezone, timeZone } (see SettingsManager.isDSTActive)
     */
    locationOffsetHours(utcTime, location) {
        return SettingsManager.isDSTActive(utcTime, location) ? location.timezone + 1 : location.timezone;
    },

    /**
     * Format an instant as local time (HH:MM) at a location, whatever the
     * computer's time zone (issue #263)
     * @param {Date} utcTime
     * @param {Object} location - { timezone, timeZone } (see SettingsManager.isDSTActive)
     */
    formatLocalTime(utcTime, location) {
        const localTime = new Date(utcTime.getTime() + this.locationOffsetHours(utcTime, location) * 3600000);
        return `${String(localTime.getUTCHours()).padStart(2, '0')}:${String(localTime.getUTCMinutes()).padStart(2, '0')}`;
    },

    /**
     * Format an instant as local time and date at a location
     * @param {Date} utcTime
     * @param {Object} location - { timezone, timeZone } (see SettingsManager.isDSTActive)
     */
    formatLocalTimeWithDate(utcTime, location) {
        const localTime = new Date(utcTime.getTime() + this.locationOffsetHours(utcTime, location) * 3600000);

        const timeStr = localTime.toLocaleTimeString('en-US', {
            hour12: false,
            hour: '2-digit',
            minute: '2-digit',
            timeZone: 'UTC'
        });

        const dateStr = localTime.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            timeZone: 'UTC'
        });

        return `${timeStr} ${dateStr}`;
    },

    /**
     * Format date for input field (YYYY-MM-DD)
     */
    formatDateForInput(date) {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    },

    /**
     * A stored YYYY-MM-DD date in the chosen Date Format (issue #274)
     * @param {string} dateStr - YYYY-MM-DD
     * @returns {string}
     */
    formatDisplayDate(dateStr) {
        const [year, month, day] = dateStr.split('-');
        switch (SettingsManager.getDateFormat()) {
            case 'mdy': return `${month}/${day}/${year}`;
            case 'dmy': return `${day}/${month}/${year}`;
            default:    return dateStr;
        }
    },

    /**
     * Get today's date as YYYY-MM-DD string
     */
    getTodayString() {
        return this.formatDateForInput(new Date());
    },

    /**
     * Get current date/time as DTG string (YYYYMMDD-HHMMSS)
     * @returns {string} Formatted DTG string
     */
    nowDTG() {
        const now = new Date();
        const dtg = now.getFullYear() +
              String(now.getMonth() + 1).padStart(2, '0') +
              String(now.getDate()).padStart(2, '0') + '-' +
              String(now.getHours()).padStart(2, '0') +
              String(now.getMinutes()).padStart(2, '0') +
              String(now.getSeconds()).padStart(2, '0');
        return dtg;
    },

    /**
     * Convert a DTG string (YYYYMMDD-HHMMSS, local time) to epoch ms.
     * Older settings hold epoch ms, which pass through unchanged.
     * @returns {number} Epoch ms, NaN if unparseable
     */
    dtgToMs(dtg) {
        if (typeof dtg !== 'string' || !dtg.includes('-')) return Number(dtg);
        const [datePart, timePart] = dtg.split('-');
        return new Date(
            parseInt(datePart.substring(0, 4)),
            parseInt(datePart.substring(4, 6)) - 1,
            parseInt(datePart.substring(6, 8)),
            parseInt(timePart.substring(0, 2)),
            parseInt(timePart.substring(2, 4)),
            parseInt(timePart.substring(4, 6))
        ).getTime();
    },

    /**
     * Current Julian epoch as decimal year (e.g. 2025.2)
     */
    currentEpoch() {
        const now = new Date();
        const start = new Date(Date.UTC(now.getUTCFullYear(), 0, 1));
        const end = new Date(Date.UTC(now.getUTCFullYear() + 1, 0, 1));
        return now.getUTCFullYear() + (now - start) / (end - start);
    },

    /**
     * Precess J2000 RA/Dec to a target epoch using IAU rigorous precession.
     * @param {number} ra  - J2000 RA in decimal hours
     * @param {number} dec - J2000 Dec in decimal degrees
     * @param {number} toEpoch - target epoch as decimal year (default: current)
     * @returns {{ra: number, dec: number, epochLabel: string}}
     */
    precessFromJ2000(ra, dec, toEpoch = null) {
        const epoch = toEpoch ?? this.currentEpoch();
        const T = (epoch - 2000.0) / 100.0; // Julian centuries from J2000

        // IAU 1976 precession constants (arcseconds)
        const zeta  = (2306.2181 + 1.39656 * T) * T + 0.30188 * T * T + 0.017998 * T * T * T;
        const z     = (2306.2181 + 1.39656 * T) * T + 1.09468 * T * T + 0.018203 * T * T * T;
        const theta = (2004.3109 - 0.85330 * T) * T - 0.42665 * T * T - 0.041775 * T * T * T;

        // Convert to radians
        const toRad = Math.PI / 648000; // arcsec to radians
        const zetaR  = zeta  * toRad;
        const zR     = z     * toRad;
        const thetaR = theta * toRad;

        // Input in radians
        const ra0  = ra * 15 * Math.PI / 180; // hours -> degrees -> radians
        const dec0 = dec * Math.PI / 180;

        // Rotation
        const A = Math.cos(dec0) * Math.sin(ra0 + zetaR);
        const B = Math.cos(thetaR) * Math.cos(dec0) * Math.cos(ra0 + zetaR) - Math.sin(thetaR) * Math.sin(dec0);
        const C = Math.sin(thetaR) * Math.cos(dec0) * Math.cos(ra0 + zetaR) + Math.cos(thetaR) * Math.sin(dec0);

        let raOut  = (Math.atan2(A, B) + zR) * 180 / Math.PI / 15; // radians -> hours
        const decOut = Math.asin(C) * 180 / Math.PI;

        // Normalize RA to [0, 24)
        raOut = ((raOut % 24) + 24) % 24;

        return {
            ra: raOut,
            dec: decOut,
            epochLabel: `J${epoch.toFixed(1)}`
        };
    }

};

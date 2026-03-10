/**
 * utils-time.js
 * Time and date utilities
 */

const TimeUtils = {
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
     * Format local time with date
     */
    formatLocalTimeWithDate(utcTime, timezone) {
        const isDST = SettingsManager.isDSTActive(utcTime, timezone);
        const offsetHours = isDST ? timezone + 1 : timezone;
        const localTime = new Date(utcTime.getTime() + offsetHours * 3600000);

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

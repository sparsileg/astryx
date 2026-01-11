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
    }

};


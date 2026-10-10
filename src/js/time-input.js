/**
 * time-input.js
 * The one way Astryx takes a time of day: a 24-hour HH:MM text box (issue #273).
 * The browser's time picker showed the computer's 12/24-hour format and could
 * look filled in while its value was still empty (#271).
 */

const TimeInput = {
    /**
     * A typed time as HH:MM, or null if it isn't a complete 24-hour time.
     * Accepts 21:30, 2130, 9:30 and 930.
     */
    parse(text) {
        const match = text.trim().match(/^(\d{1,2}):?(\d{2})$/);
        if (!match) return null;
        const hours = Number(match[1]);
        const minutes = Number(match[2]);
        if (hours > 23 || minutes > 59) return null;
        return `${String(hours).padStart(2, '0')}:${match[2]}`;
    },

    /**
     * The box's time as HH:MM, or '' when it's empty or not a valid time
     */
    value(input) {
        return this.parse(input.value) ?? '';
    },

    /**
     * Whether the box holds something that isn't a valid time
     */
    isInvalid(input) {
        return input.value.trim() !== '' && !this.parse(input.value);
    },

    /**
     * Outline an invalid entry while typing, tidy it to HH:MM on leaving the
     * box, and call onValid(HH:MM) each time the entry becomes a valid time
     */
    attach(input, onValid) {
        input.addEventListener('input', () => {
            input.classList.toggle('input-invalid', this.isInvalid(input));
            const time = this.parse(input.value);
            if (time && onValid) onValid(time);
        });
        input.addEventListener('blur', () => {
            const time = this.parse(input.value);
            if (time) input.value = time;
        });
    },

    /**
     * Fill an empty box with the night's astronomical dusk in the location's time,
     * rounded up to the minute so the start is never seconds before dusk
     */
    prefillDusk(input, date, location) {
        if (input.value || !date || !location) return;
        const timing = SeqPlanCalculations.calculateSessionTiming(date, location);
        if (!timing) return;
        const minuteMs = 60000;
        const duskMs = jdToDate(timing.duskJD).getTime();
        input.value = TimeUtils.formatLocalTime(new Date(Math.ceil(duskMs / minuteMs) * minuteMs), location);
    }
};

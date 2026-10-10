/**
 * date-input.js
 * The one way Astryx takes a date: a text box with a calendar that Astryx
 * draws itself (issue #261). On the Linux desktop app the native date input
 * opened WebKitGTK's own picker, which couldn't be typed into and froze the
 * app for about 10 seconds after each pick. The box shows and accepts the
 * chosen Date Format; views always get YYYY-MM-DD (issue #274).
 */

const DateInput = {
    WEEKDAYS: ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'],

    _popup: null,
    _input: null,      // the box the open calendar belongs to
    _onValid: null,
    _shownMonth: null, // first of the month the calendar shows

    // What each Date Format accepts typed (issue #274). YYYY-MM-DD always
    // works; without separators the digits follow the chosen order.
    PATTERNS: {
        ymd: [/^(?<y>\d{4})-?(?<m>\d{2})-?(?<d>\d{2})$/],
        mdy: [/^(?<y>\d{4})-(?<m>\d{2})-(?<d>\d{2})$/,
              /^(?<m>\d{1,2})\/(?<d>\d{1,2})\/(?<y>\d{4})$/,
              /^(?<m>\d{2})(?<d>\d{2})(?<y>\d{4})$/],
        dmy: [/^(?<y>\d{4})-(?<m>\d{2})-(?<d>\d{2})$/,
              /^(?<d>\d{1,2})\/(?<m>\d{1,2})\/(?<y>\d{4})$/,
              /^(?<d>\d{2})(?<m>\d{2})(?<y>\d{4})$/]
    },

    PLACEHOLDERS: { ymd: 'YYYY-MM-DD', mdy: 'MM/DD/YYYY', dmy: 'DD/MM/YYYY' },

    /**
     * A typed date as YYYY-MM-DD, or null if it isn't a real calendar date.
     * With mm/dd/yyyy chosen, 12/25/2026, 12252026 and 2026-12-25 all work.
     */
    parse(text) {
        const trimmed = text.trim();
        const match = this.PATTERNS[SettingsManager.getDateFormat()]
            .map(pattern => trimmed.match(pattern))
            .find(Boolean);
        if (!match) return null;
        const [year, month, day] = [match.groups.y, match.groups.m, match.groups.d].map(Number);
        const date = new Date(year, month - 1, day);
        if (date.getMonth() !== month - 1 || date.getDate() !== day) return null;
        return TimeUtils.formatDateForInput(date);
    },

    /**
     * Show a YYYY-MM-DD date in the box, in the chosen format
     */
    set(input, dateStr) {
        input.value = TimeUtils.formatDisplayDate(dateStr);
        input.classList.remove('input-invalid');
    },

    /**
     * The box's date as YYYY-MM-DD, or '' when it's empty or not a valid date
     */
    value(input) {
        return this.parse(input.value) ?? '';
    },

    /**
     * Whether the box holds something that isn't a valid date
     */
    isInvalid(input) {
        return input.value.trim() !== '' && !this.parse(input.value);
    },

    /**
     * Add the calendar button after the box, outline an invalid entry while
     * typing, tidy it to the chosen format on leaving the box, and call
     * onValid(YYYY-MM-DD) whenever a typed or picked date is valid
     */
    attach(input, onValid) {
        input.placeholder = this.PLACEHOLDERS[SettingsManager.getDateFormat()];
        const wrap = document.createElement('span');
        wrap.className = 'date-entry-wrap';
        input.before(wrap);
        wrap.appendChild(input);

        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'date-entry-button';
        button.setAttribute('aria-label', 'Choose a date');
        button.textContent = '📅';
        wrap.appendChild(button);

        input.addEventListener('input', () => {
            input.classList.toggle('input-invalid', this.isInvalid(input));
            const date = this.parse(input.value);
            if (date && onValid) onValid(date);
        });
        // Select the whole date on entering the box, so typing replaces it.
        // The click that focused the box would clear the selection on mouseup.
        let justFocused = false;
        input.addEventListener('focus', () => {
            input.select();
            justFocused = true;
        });
        input.addEventListener('mouseup', (e) => {
            if (justFocused) e.preventDefault();
            justFocused = false;
        });
        input.addEventListener('blur', () => {
            const date = this.parse(input.value);
            if (date) this.set(input, date);
            justFocused = false;
        });
        button.addEventListener('click', (e) => {
            e.stopPropagation();
            if (this._input === input) {
                this.close();
            } else {
                this.open(input, onValid);
            }
        });
    },

    /**
     * Open the calendar under the box, at the box's month (or today's)
     */
    open(input, onValid) {
        this.close();
        this._ensurePopup();
        this._input = input;
        this._onValid = onValid;
        const [year, month] = (this.value(input) || TimeUtils.getTodayString()).split('-').map(Number);
        this._shownMonth = new Date(year, month - 1, 1);
        this._render();
        this._popup.classList.add('open');
        this._position();
    },

    close() {
        if (!this._popup) return;
        this._popup.classList.remove('open');
        this._input = null;
        this._onValid = null;
    },

    /**
     * One calendar for every date box, made on first use. It closes on a
     * click outside, Escape, or a scroll or resize that would leave it behind.
     */
    _ensurePopup() {
        if (this._popup) return;
        const popup = document.createElement('div');
        popup.className = 'date-entry-calendar';
        popup.addEventListener('click', (e) => {
            e.stopPropagation();
            const target = e.target.closest('[data-action]');
            if (!target) return;
            const action = target.dataset.action;
            if (action === 'prev-month' || action === 'next-month') {
                this._shownMonth.setMonth(this._shownMonth.getMonth() + (action === 'prev-month' ? -1 : 1));
                this._render();
            } else if (action === 'pick') {
                this._pick(target.dataset.date);
            } else if (action === 'today') {
                this._pick(TimeUtils.getTodayString());
            }
        });
        document.addEventListener('click', (e) => {
            if (this._input && !this._input.parentElement.contains(e.target)) this.close();
        });
        // Captured first, so Escape closes only the calendar, not a modal it's over
        window.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this._input) {
                e.stopPropagation();
                this.close();
            }
        }, true);
        window.addEventListener('scroll', (e) => {
            if (this._input && !popup.contains(e.target)) this.close();
        }, true);
        window.addEventListener('resize', () => this.close());
        document.body.appendChild(popup);
        this._popup = popup;
    },

    _pick(date) {
        const input = this._input;
        const onValid = this._onValid;
        this.set(input, date);
        this.close();
        if (onValid) onValid(date);
    },

    /**
     * Draw the shown month. The chosen day has a ring and today is
     * underlined, so neither depends on color.
     */
    _render() {
        const year = this._shownMonth.getFullYear();
        const month = this._shownMonth.getMonth();
        const title = this._shownMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
        const chosen = this.value(this._input);
        const today = TimeUtils.getTodayString();
        const daysInMonth = new Date(year, month + 1, 0).getDate();

        let cells = '';
        for (let blank = 0; blank < this._shownMonth.getDay(); blank++) {
            cells += '<span></span>';
        }
        for (let day = 1; day <= daysInMonth; day++) {
            const date = TimeUtils.formatDateForInput(new Date(year, month, day));
            const classes = ['date-entry-day'];
            if (date === chosen) classes.push('chosen');
            if (date === today) classes.push('today');
            cells += `<button type="button" class="${classes.join(' ')}" data-action="pick" data-date="${date}">${day}</button>`;
        }

        this._popup.innerHTML = `
            <div class="date-entry-header">
                <button type="button" class="date-entry-nav" data-action="prev-month" aria-label="Previous month">‹</button>
                <span class="date-entry-title">${title}</span>
                <button type="button" class="date-entry-nav" data-action="next-month" aria-label="Next month">›</button>
            </div>
            <div class="date-entry-grid">
                ${this.WEEKDAYS.map(name => `<span class="date-entry-weekday">${name}</span>`).join('')}
                ${cells}
            </div>
            <button type="button" class="date-entry-today" data-action="today">Today</button>`;
    },

    /**
     * Fixed position under the box (above it when there's no room below),
     * so a scrolling container or a modal can't clip it
     */
    _position() {
        const box = this._input.parentElement.getBoundingClientRect();
        const popupHeight = this._popup.offsetHeight;
        const gap = 4;
        const fitsBelow = box.bottom + gap + popupHeight <= window.innerHeight;
        const top = fitsBelow ? box.bottom + gap : Math.max(gap, box.top - gap - popupHeight);
        const left = Math.min(box.left, window.innerWidth - this._popup.offsetWidth - gap);
        this._popup.style.top = `${top}px`;
        this._popup.style.left = `${Math.max(gap, left)}px`;
    }
};

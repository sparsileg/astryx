/**
 * dropdown-position.js
 * Keeps an open .astryx-dropdown menu on screen. A menu that would run past
 * the bottom of the window, or of a scrolling container such as a modal,
 * opens upward instead; one that fits neither way opens on the roomier side,
 * shortened to fit. Views open their own dropdowns, so this checks after
 * every click and none of them need to call it.
 */

const DropdownPosition = {

    init() {
        // Capture phase: dropdown handlers stop propagation. The next frame
        // sees the dropdown after its own handler has opened it.
        document.addEventListener('click', () => {
            requestAnimationFrame(() => this.placeOpenMenus());
        }, true);
    },

    placeOpenMenus() {
        document.querySelectorAll('.astryx-dropdown.open').forEach(dropdown => this.place(dropdown));
    },

    /**
     * Open a dropdown's menu downward if it fits, else upward if that fits,
     * else on the side with more room, shortened to fit.
     */
    place(dropdown) {
        const menu = dropdown.querySelector('.astryx-dropdown-menu');
        if (!menu) return;

        // Measure the menu as the stylesheet lays it out
        dropdown.classList.remove('open-up');
        menu.style.maxHeight = '';

        const margin = APP_CONFIG.DROPDOWN_EDGE_MARGIN_PX;
        const bounds = this.visibleBounds(dropdown);
        const trigger = dropdown.getBoundingClientRect();
        const height = menu.getBoundingClientRect().height;
        const below = bounds.bottom - trigger.bottom - margin;
        const above = trigger.top - bounds.top - margin;

        if (height <= below) return;
        if (height <= above || above > below) {
            dropdown.classList.add('open-up');
        }
        const room = Math.max(above, below);
        if (height > room) {
            menu.style.maxHeight = `${room}px`;
        }
    },

    /**
     * The part of the window an element can show in: the window, cut down
     * by every ancestor inside the body that clips its overflow.
     */
    visibleBounds(element) {
        let top = 0;
        let bottom = window.innerHeight;
        for (let parent = element.parentElement; parent && parent !== document.body; parent = parent.parentElement) {
            if (getComputedStyle(parent).overflowY !== 'visible') {
                const rect = parent.getBoundingClientRect();
                top = Math.max(top, rect.top);
                bottom = Math.min(bottom, rect.bottom);
            }
        }
        return { top, bottom };
    }
};

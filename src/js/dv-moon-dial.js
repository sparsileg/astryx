/**
 * dv-moon-dial.js
 * Target-Moon Separation dial for the Daily Visibility view.
 *
 * The observer is at the center and the target at 12 o'clock. The moon's
 * direction from the center is its ecliptic longitude offset from the
 * target: on the left while it is approaching, on the right once it has
 * passed, so over a lunar month it goes smoothly clockwise round the dial.
 * (Placing it by separation alone would make it jump across 12 and 6
 * o'clock, since the moon passes beside a target rather than over it.)
 * When it passes beside a target well off its path, it lifts outside the
 * rim by about the amount it misses by, so it arcs over the target rather
 * than through it. The lift follows a smooth model (the moon on the
 * ecliptic, the target at its ecliptic latitude), so the arc is clean. The angle shown is the true separation.
 *
 * A haze around the moon spreads further and denser the brighter the moon
 * is (its phase dimming, in magnitudes): a full moon's reaches 90°, a
 * fainter moon's proportionally less. It covers the target as much as the
 * true separation deserves, and the Interference level says the same in
 * words. On nights the moon stays below the horizon it is drawn as an
 * outline, with no haze.
 */

const DVMoonDial = {
    SVG_NS: 'http://www.w3.org/2000/svg',
    VIEW_WIDTH: 250,         // viewBox width, centered on the observer
    VIEW_TOP: 150,           // viewBox space above the observer (room for the moon to lift)
    VIEW_BOTTOM: 110,        // viewBox space below the observer
    RIM_RADIUS: 85,
    MOON_RADIUS: 18,
    MAX_LIFT: 44,            // furthest the moon lifts outside the rim
    TICK_LENGTH: 6,
    TICK_ANGLES: [20, 40, 60, 90, 180],
    ANGLE_TEXT_INSET: 30,    // label distance inside the rim, at the 90° mark
    HAZE_FULL_SEPARATION: 90,    // a full moon's haze reaches a target this far away
    HAZE_TOUCH_FRACTION: 0.75,   // ...at this fraction of the haze radius, where it is still visible
    HAZE_DIMMING_LIMIT: 6,       // magnitudes below full at which the haze vanishes (thin crescent)
    HAZE_OPACITY_MIN: 0.3,       // haze density of the faintest moon that has haze
    HAZE_OPACITY_MAX: 0.9,       // haze density of a full moon
    // Interference levels by separation for a full moon; a fainter moon's
    // separations count as larger, in proportion to its shorter haze reach
    INTERFERENCE_LEVELS: [[20, 'Severe'], [40, 'Significant'], [60, 'Some'], [90, 'Minimal']],

    _els: null,
    _state: null,            // { theta, separation, eclipticLatitude, hazeReach, hazeOpacity } last drawn
    _animFrame: null,

    /**
     * Draw the dial for a night.
     * @param {HTMLElement} container - Element to hold the dial
     * @param {Object} night - { moonUp, separation (degrees), longitudeOffset (degrees),
     *   eclipticLatitude (target's, degrees), illumination (0-100), waxing, latitude }
     */
    update(container, night) {
        if (!this._els || !container.contains(this._els.svg)) {
            this.build(container);
        }

        const els = this._els;
        els.moon.classList.toggle('dv-dial-moon-down', !night.moonUp);

        // Lit side faces the sun: right while waxing, seen from the north
        const litOnRight = night.waxing === (night.latitude >= 0);
        els.moonLit.setAttribute('d', this.litPath(night.illumination / 100));
        els.moonLit.setAttribute('transform', litOnRight ? '' : 'scale(-1 1)');

        els.angleText.textContent = `${Math.round(night.separation)}°`;

        const brightness = this.brightness(night.illumination);
        const target = {
            theta: night.longitudeOffset,
            separation: night.separation,
            eclipticLatitude: night.eclipticLatitude,
            hazeReach: this.HAZE_FULL_SEPARATION * brightness,
            hazeOpacity: (night.moonUp && brightness > 0)
                ? this.HAZE_OPACITY_MIN + (this.HAZE_OPACITY_MAX - this.HAZE_OPACITY_MIN) * brightness
                : 0
        };
        this.animateTo(target);
    },

    /**
     * Moon brightness 0-1 on a magnitude (log) scale, as the eye sees it:
     * 1 at full, 0 at HAZE_DIMMING_LIMIT magnitudes fainter.
     */
    brightness(illumination) {
        return Math.max(0, 1 - getMoonPhaseDimming(illumination) / this.HAZE_DIMMING_LIMIT);
    },

    /**
     * Interference level from the moon's separation and brightness; matches
     * the haze, so it's Negligible exactly when the haze doesn't reach.
     * @param {Object} night - Same as update()
     * @returns {string}
     */
    interferenceLevel(night) {
        const reach = this.HAZE_FULL_SEPARATION * this.brightness(night.illumination);
        if (!night.moonUp || reach <= 0) return 'Negligible';
        const fullMoonSeparation = night.separation * this.HAZE_FULL_SEPARATION / reach;
        const level = this.INTERFERENCE_LEVELS.find(([limit]) => fullMoonSeparation < limit);
        return level ? level[1] : 'Negligible';
    },

    /**
     * Create the dial's SVG; static parts are drawn once here.
     */
    build(container) {
        this.stopAnimation();
        this._state = null;
        const R = this.RIM_RADIUS;

        const svg = this.el('svg', {
            viewBox: `${-this.VIEW_WIDTH / 2} ${-this.VIEW_TOP} ${this.VIEW_WIDTH} ${this.VIEW_TOP + this.VIEW_BOTTOM}`,
            class: 'dv-dial-svg',
            role: 'img',
            'aria-label': 'Target-Moon separation dial'
        });

        const gradient = this.el('radialGradient', { id: 'dv-moon-haze-gradient' });
        gradient.appendChild(this.el('stop', { offset: '0', class: 'dv-haze-stop dv-haze-stop-inner' }));
        gradient.appendChild(this.el('stop', { offset: '0.4', class: 'dv-haze-stop dv-haze-stop-mid' }));
        gradient.appendChild(this.el('stop', { offset: '1', class: 'dv-haze-stop dv-haze-stop-outer' }));
        const defs = this.el('defs', {});
        defs.appendChild(gradient);
        svg.appendChild(defs);

        svg.appendChild(this.el('circle', { cx: 0, cy: 0, r: R, class: 'dv-dial-rim' }));
        for (const angle of this.TICK_ANGLES) {
            for (const side of angle === 180 ? [1] : [-1, 1]) {
                const a = side * angle;
                const inner = this.point(a, R - this.TICK_LENGTH);
                const outer = this.point(a, R);
                svg.appendChild(this.el('line', {
                    x1: inner.x, y1: inner.y, x2: outer.x, y2: outer.y, class: 'dv-dial-tick'
                }));
            }
        }

        svg.appendChild(this.el('line', { x1: 0, y1: 0, x2: 0, y2: -R, class: 'dv-dial-sightline' }));
        const moonLine = this.el('line', { x1: 0, y1: 0, class: 'dv-dial-sightline' });
        svg.appendChild(moonLine);

        svg.appendChild(this.target(0, -R));

        // Haze is drawn over the target so it visibly covers it
        const haze = this.el('circle', { fill: 'url(#dv-moon-haze-gradient)', class: 'dv-dial-haze' });
        svg.appendChild(haze);

        const moon = this.el('g', { class: 'dv-dial-moon' });
        moon.appendChild(this.el('circle', { cx: 0, cy: 0, r: this.MOON_RADIUS, class: 'dv-dial-moon-dark' }));
        const moonLit = this.el('path', { class: 'dv-dial-moon-lit' });
        moon.appendChild(moonLit);
        svg.appendChild(moon);

        svg.appendChild(this.telescope());

        const angleText = this.el('text', { y: 5, class: 'dv-dial-angle' });
        svg.appendChild(angleText);

        container.replaceChildren(svg);
        this._els = { svg, moonLine, haze, moon, moonLit, angleText };
    },

    /**
     * Move the moon and haze to a new night; the moon takes the short way
     * round, so stepping forward a day sweeps it clockwise. A step that
     * arrives mid-move (holding the day button) carries on at speed rather
     * than starting again from rest.
     */
    animateTo(target) {
        const continuing = this._animFrame !== null;
        this.stopAnimation();
        const from = this._state;
        const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        if (!from || reduceMotion) {
            this.draw(target);
            return;
        }

        const dTheta = ((target.theta - from.theta + 540) % 360) - 180;
        const duration = APP_CONFIG.DV_MOON_DIAL_ANIMATION_MS;
        const start = performance.now();

        const step = (now) => {
            const t = Math.min(1, (now - start) / duration);
            const ease = continuing
                ? 1 - Math.pow(1 - t, 2)
                : (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);
            this.draw({
                theta: from.theta + dTheta * ease,
                eclipticLatitude: target.eclipticLatitude,
                separation: from.separation + (target.separation - from.separation) * ease,
                hazeReach: from.hazeReach + (target.hazeReach - from.hazeReach) * ease,
                hazeOpacity: from.hazeOpacity + (target.hazeOpacity - from.hazeOpacity) * ease
            });
            if (t < 1) {
                this._animFrame = requestAnimationFrame(step);
            } else {
                this._animFrame = null;
                this.draw(target);
            }
        };
        this._animFrame = requestAnimationFrame(step);
    },

    stopAnimation() {
        if (this._animFrame !== null) {
            cancelAnimationFrame(this._animFrame);
            this._animFrame = null;
        }
    },

    /**
     * Draw the moving parts for one moon position.
     */
    draw(state) {
        const els = this._els;
        const theta = ((state.theta + 540) % 360) - 180;
        const R = this.RIM_RADIUS;
        const moonPos = this.point(theta, R + this.lift(theta, state.eclipticLatitude));

        // The moon's distance from the target on the dial is only roughly its
        // separation, so scale the haze to cover the target as the true
        // separation deserves
        const dialDistance = Math.hypot(moonPos.x, moonPos.y + R);
        const trueDistance = this.chord(state.separation);
        const scale = trueDistance > 1 ? dialDistance / trueDistance : 1;
        const hazeRadius = Math.max(this.MOON_RADIUS, this.chord(state.hazeReach) / this.HAZE_TOUCH_FRACTION) * scale;

        els.moon.setAttribute('transform', `translate(${moonPos.x} ${moonPos.y})`);
        els.haze.setAttribute('cx', moonPos.x);
        els.haze.setAttribute('cy', moonPos.y);
        els.haze.setAttribute('r', hazeRadius);
        els.haze.setAttribute('opacity', state.hazeOpacity);
        els.moonLine.setAttribute('x2', moonPos.x);
        els.moonLine.setAttribute('y2', moonPos.y);

        // Angle label at the 90° mark, on the side away from the moon
        const textX = (this.RIM_RADIUS - this.ANGLE_TEXT_INSET) * (theta >= 0 ? -1 : 1);
        els.angleText.setAttribute('x', textX);

        this._state = { ...state, theta };
    },

    /**
     * How far outside the rim the moon sits, along direction theta, so that
     * its distance from the target matches its separation, easing off
     * toward MAX_LIFT.
     * The separation is modeled from theta and the target's ecliptic
     * latitude, with the moon on the ecliptic. Zero for a target on the
     * moon's path.
     */
    lift(theta, eclipticLatitude) {
        const R = this.RIM_RADIUS;
        const a = (theta * Math.PI) / 180;
        const b = (eclipticLatitude * Math.PI) / 180;
        const separation = (Math.acos(Math.cos(b) * Math.cos(a)) * 180) / Math.PI;
        const c = this.chord(separation);
        // |moon - target|² = r² + R² - 2rR·cos(theta) = c²; outer root
        const discriminant = c * c - R * R * Math.sin(a) * Math.sin(a);
        if (discriminant < 0) return 0;
        const excess = Math.max(0, R * Math.cos(a) + Math.sqrt(discriminant) - R);
        return this.MAX_LIFT * Math.tanh(excess / this.MAX_LIFT);
    },

    /**
     * Straight-line distance on the dial between two rim points this many
     * degrees apart.
     */
    chord(degrees) {
        return 2 * this.RIM_RADIUS * Math.sin((degrees * Math.PI) / 360);
    },

    /**
     * Lit part of the moon disc, lit side on the right.
     * @param {number} fraction - Illuminated fraction, 0-1
     */
    litPath(fraction) {
        const r = this.MOON_RADIUS;
        const terminatorRx = r * Math.abs(2 * fraction - 1);
        // Gibbous: terminator bulges into the left half; crescent: the right
        const sweep = fraction > 0.5 ? 1 : 0;
        return `M 0 ${-r} A ${r} ${r} 0 0 1 0 ${r} A ${terminatorRx} ${r} 0 0 ${sweep} 0 ${-r} Z`;
    },

    /**
     * Bullseye target symbol; its filled outer ring hides the rim behind it.
     */
    target(cx, cy) {
        const g = this.el('g', { class: 'dv-dial-target' });
        g.appendChild(this.el('circle', { cx, cy, r: 10 }));
        g.appendChild(this.el('circle', { cx, cy, r: 5.5 }));
        g.appendChild(this.el('circle', { cx, cy, r: 1.5, class: 'dv-dial-target-center' }));
        return g;
    },

    /**
     * Small telescope on a tripod at the center, pointing at the target.
     */
    telescope() {
        const g = this.el('g', { class: 'dv-dial-telescope' });
        g.appendChild(this.el('line', { x1: 0, y1: 4, x2: -9, y2: 17 }));
        g.appendChild(this.el('line', { x1: 0, y1: 4, x2: 0, y2: 18 }));
        g.appendChild(this.el('line', { x1: 0, y1: 4, x2: 9, y2: 17 }));
        g.appendChild(this.el('rect', { x: -4, y: -14, width: 8, height: 18, rx: 1 }));
        g.appendChild(this.el('rect', { x: -5.5, y: -20, width: 11, height: 7, rx: 1 }));
        return g;
    },

    /**
     * Point on a circle; theta in degrees clockwise from 12 o'clock.
     */
    point(theta, radius) {
        const a = (theta * Math.PI) / 180;
        return { x: radius * Math.sin(a), y: -radius * Math.cos(a) };
    },

    el(tag, attrs) {
        const node = document.createElementNS(this.SVG_NS, tag);
        for (const [key, value] of Object.entries(attrs)) {
            node.setAttribute(key, value);
        }
        return node;
    }
};

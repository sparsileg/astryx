/**
 * algorithm-validation-view.js
 * "Validate Algorithms" admin view — runs astronomy calculation regression
 * tests and displays pass/fail results.
 */

// Test cases are added in later steps, grouped by file-under-test.
// Shape: { name, actual: () => value, expected, tolerance, source }
//   - name: short label shown in the results table
//   - actual: zero-arg function returning the computed value (minutes-past-midnight,
//             degrees, etc. — whatever unit matches `expected`)
//   - expected: reference value
//   - tolerance: max allowed |actual - expected|, in the same unit as expected.
//             Time-based cases should use APP_CONFIG.ALGORITHM_VALIDATION_TOLERANCE_MINUTES.
//   - source: short string, e.g. 'timeanddate.com 2026-06-21' or 'snapshot'
const ASTRO_TESTS = [
    // --- utils-time.js ---
    {
        name: 'dateToJD: J2000.0 epoch',
        actual: () => TimeUtils.dateToJD(new Date(Date.UTC(2000, 0, 1, 12, 0, 0))),
        expected: 2451545.0,
        tolerance: 0.0000001,
        source: 'IAU standard J2000.0 epoch (JD 2451545.0 = 2000-01-01 12:00 UTC)'
    },
    {
        name: 'dateToJD: 2026-06-21 00:00 UTC',
        actual: () => TimeUtils.dateToJD(new Date(Date.UTC(2026, 5, 21, 0, 0, 0))),
        expected: 2461212.5,
        tolerance: 0.0000001,
        source: 'Computed via standard Julian Day algorithm (Meeus)'
    },
    {
        name: 'dateToJD / jdToDate round-trip consistency',
        actual: () => {
            const originalDate = new Date(Date.UTC(2026, 5, 21, 3, 47, 0));
            const jd = TimeUtils.dateToJD(originalDate);
            const roundTrip = TimeUtils.jdToDate(jd);
            return (roundTrip.getTime() - originalDate.getTime()) / 60000; // diff in minutes
        },
        expected: 0,
        tolerance: APP_CONFIG.ALGORITHM_VALIDATION_TOLERANCE_MINUTES,
        source: 'snapshot (round-trip self-consistency, not externally verified)'
    },

    // --- astro-core.js ---
    {
        name: 'getGMST: matches documented constant at J2000.0',
        actual: () => getGMST(2451545.0),
        expected: 18.697374558,
        tolerance: 0.0000001,
        source: 'formula identity (JD 2451545.0 = d=0 in the GMST formula)'
    },
    {
        name: 'getGMST: 1987-04-10 00:00 UT (Meeus Example 12.a)',
        actual: () => getGMST(2446895.5),
        expected: 13.179546,
        tolerance: 0.001,
        source: 'Meeus, Astronomical Algorithms, Example 12.a (13h10m46.3668s)'
    },
    {
        name: 'getAngularSeparation: 90° apart in RA at dec=0',
        actual: () => getAngularSeparation(0, 0, 6, 0),
        expected: 90,
        tolerance: 0.0001,
        source: 'geometric identity (6h RA offset at celestial equator = 90°)'
    },
    {
        name: 'getAngularSeparation: identical coordinates',
        actual: () => getAngularSeparation(5, 45, 5, 45),
        expected: 0,
        tolerance: 0.0001,
        source: 'geometric identity (same point = 0° separation)'
    },
    {
        name: 'getAngularSeparation: small separation (0.15°, same RA)',
        actual: () => getAngularSeparation(5.0, 20.0, 5.0, 20.15),
        expected: 0.15,
        tolerance: 0.05,
        source: 'geometric identity (equal RA collapses formula to |dec2-dec1|); ' +
                'regression guard for the haversine consolidation in Issue #202 ' +
                '(motivating precision concern applies at arcsecond-scale separations, ' +
                'not fully exercised at this tolerance)'
    },
    {
        name: 'getHorizonElevationAtAzimuth: flat notional horizon',
        actual: () => getHorizonElevationAtAzimuth(45, APP_CONFIG.NOTIONAL_HORIZON),
        expected: 0,
        tolerance: 0.0000001,
        source: 'geometric identity (NOTIONAL_HORIZON is flat at 0° elevation)'
    },
    {
        name: 'isAboveHorizon: above min altitude, no horizon data',
        actual: () => isAboveHorizon(10, 45, 5, []),
        expected: true,
        tolerance: 0,
        source: 'geometric identity (10° > 5° min altitude)'
    },
    {
        name: 'isAboveHorizon: below min altitude',
        actual: () => isAboveHorizon(3, 45, 5, []),
        expected: false,
        tolerance: 0,
        source: 'geometric identity (3° < 5° min altitude)'
    },
    {
        name: 'getAltitude: zenith identity (HA=0, dec=lat)',
        actual: () => {
            const jd = 2451545.0;
            const latitude = 39.296739;
            const longitude = -78.198136;
            const lst = getLST(jd, longitude);
            return getAltitude(jd, lst, latitude, latitude, longitude);
        },
        expected: 90,
        tolerance: 0.0001,
        source: 'geometric identity (hour angle=0 & dec=lat implies object at zenith)'
    },

    // --- astro-sun.js ---
    {
        name: 'getSunPosition: declination near June solstice ≈ obliquity',
        actual: () => getSunPosition(dateToJD(new Date(Date.UTC(2026, 5, 21, 16, 0, 0)))).dec,
        expected: 23.44,
        tolerance: 0.1,
        source: "Earth's axial tilt / obliquity of the ecliptic (~23.44°)"
    },
    {
        name: 'combineMagnitudes: identical source combined with itself',
        actual: () => combineMagnitudes(10, 10),
        expected: 10 - 2.5 * Math.log10(2),
        tolerance: 0.0001,
        source: 'photometric identity (equal fluxes combine to -2.5·log10(2) brighter)'
    },
    {
        name: 'solarBrightnessUltraSmooth: value at transition center',
        actual: () => solarBrightnessUltraSmooth(-6),
        expected: 16.5,
        tolerance: 0.0001,
        source: "formula identity (tanh(0)=0 → exact midpoint of dark/bright sky constants)"
    },
    {
        name: 'findAstronomicalDusk: 2026-06-21 (timeanddate.com anchor)',
        actual: () => {
            const localDate = new Date(2026, 5, 21);
            const duskJD = findAstronomicalDusk(localDate, 39.296739, -78.198136, -5, true);
            const expectedJD = dateToJD(new Date(Date.UTC(2026, 5, 22, 2, 43, 0)));
            return (duskJD - expectedJD) * 1440;
        },
        expected: 0,
        tolerance: APP_CONFIG.ALGORITHM_VALIDATION_TOLERANCE_MINUTES,
        source: 'timeanddate.com, 2026-06-21, 39.296739,-78.198136, EDT (22:43 local)'
    },
    {
        name: 'findAstronomicalDusk: 2026-12-21 (timeanddate.com anchor)',
        actual: () => {
            const localDate = new Date(2026, 11, 21);
            const duskJD = findAstronomicalDusk(localDate, 39.296739, -78.198136, -5, false);
            const expectedJD = dateToJD(new Date(Date.UTC(2026, 11, 21, 23, 29, 0)));
            return (duskJD - expectedJD) * 1440;
        },
        expected: 0,
        tolerance: APP_CONFIG.ALGORITHM_VALIDATION_TOLERANCE_MINUTES,
        source: 'timeanddate.com, 2026-12-21, 39.296739,-78.198136, EST (18:29 local)'
    },
    {
        name: 'findNextAstronomicalDawn: 2026-06-22 (timeanddate.com anchor)',
        actual: () => {
            const localDate = new Date(2026, 5, 21);
            const dawnJD = findNextAstronomicalDawn(localDate, 39.296739, -78.198136, -5, true);
            const expectedJD = dateToJD(new Date(Date.UTC(2026, 5, 22, 7, 46, 0)));
            return (dawnJD - expectedJD) * 1440;
        },
        expected: 0,
        tolerance: APP_CONFIG.ALGORITHM_VALIDATION_TOLERANCE_MINUTES,
        source: 'timeanddate.com, 2026-06-22, 39.296739,-78.198136, EDT (03:46 local)'
    },
    {
        name: 'findNextAstronomicalDawn: 2026-12-22 (timeanddate.com anchor)',
        actual: () => {
            const localDate = new Date(2026, 11, 21);
            const dawnJD = findNextAstronomicalDawn(localDate, 39.296739, -78.198136, -5, false);
            const expectedJD = dateToJD(new Date(Date.UTC(2026, 11, 22, 10, 52, 0)));
            return (dawnJD - expectedJD) * 1440;
        },
        expected: 0,
        tolerance: APP_CONFIG.ALGORITHM_VALIDATION_TOLERANCE_MINUTES,
        source: 'timeanddate.com, 2026-12-22, 39.296739,-78.198136, EST (05:52 local)'
    },
    {
        name: 'Dusk/dawn ordering consistency (June 2026)',
        actual: () => {
            const localDate = new Date(2026, 5, 21);
            const dusk = findAstronomicalDusk(localDate, 39.296739, -78.198136, -5, true);
            const dawn = findNextAstronomicalDawn(localDate, 39.296739, -78.198136, -5, true);
            return dawn > dusk;
        },
        expected: true,
        tolerance: 0,
        source: 'snapshot (internal consistency, not externally verified)'
    },
    {
        name: 'Dusk search convergence: sun altitude ≈ -18° at returned JD',
        actual: () => {
            const localDate = new Date(2026, 5, 21);
            const duskJD = findAstronomicalDusk(localDate, 39.296739, -78.198136, -5, true);
            const sunPos = getSunPosition(duskJD);
            return getAltitude(duskJD, sunPos.ra, sunPos.dec, 39.296739, -78.198136);
        },
        expected: -18,
        tolerance: 0.1,
        source: 'snapshot (verifies binary search converged to the correct threshold)'
    },

    // --- astro-moon.js ---
    // NOTE: all moon rise/set tests below are snapshot-only (compared against
    // this codebase's own previously recorded output), NOT against external
    // sources like timeanddate.com/USNO. Moon rise/set has a genuine, inherent
    // 2-5 minute residual against external sources (mean-parallax approximation
    // + truncated lunar position series) — see calculateHorizonDepression's
    // comments. That residual would fail the shared ±2 min tolerance by design,
    // not due to a bug. Do NOT "fix" this by loosening ALGORITHM_VALIDATION_TOLERANCE_MINUTES —
    // that constant is also used by externally-verified sun tests above, where
    // a looser tolerance would mask real regressions.
    {
        name: 'getMoonPosition: RA snapshot at 2026-06-21 00:00 UTC',
        actual: () => getMoonPosition(dateToJD(new Date(Date.UTC(2026, 5, 21, 0, 0, 0)))).ra,
        expected: 11.267162807947011,
        tolerance: 0.0001,
        source: 'snapshot (recorded from this codebase, not externally verified)'
    },
    {
        name: 'getMoonPosition: Dec snapshot at 2026-06-21 00:00 UTC',
        actual: () => getMoonPosition(dateToJD(new Date(Date.UTC(2026, 5, 21, 0, 0, 0)))).dec,
        expected: 3.1520066961339617,
        tolerance: 0.0001,
        source: 'snapshot (recorded from this codebase, not externally verified)'
    },
    {
        name: 'getMoonPhase: illumination snapshot at 2026-06-21 00:00 UTC',
        actual: () => getMoonPhase(dateToJD(new Date(Date.UTC(2026, 5, 21, 0, 0, 0)))).illumination,
        expected: 40.45815621870214,
        tolerance: 0.0001,
        source: 'snapshot (recorded from this codebase, not externally verified)'
    },
    {
        name: 'calculateHorizonDepression: sea level identity',
        actual: () => calculateHorizonDepression(0),
        expected: 0.125,
        tolerance: 0.0000001,
        source: 'formula identity (elevation=0 → geometric dip term is exactly 0)'
    },
    {
        name: 'calculateHorizonDepression: 233m elevation snapshot',
        actual: () => calculateHorizonDepression(233),
        expected: -0.3650177233420944,
        tolerance: 0.0000001,
        source: 'snapshot (recorded from this codebase, not externally verified)'
    },
    {
        name: 'calculateMoonRiseSet: moonrise snapshot, 2026-06-21',
        actual: () => {
            const searchStart = dateToJD(new Date(Date.UTC(2026, 5, 21, 4, 0, 0)));
            const searchEnd = dateToJD(new Date(Date.UTC(2026, 5, 22, 4, 0, 0)));
            const result = calculateMoonRiseSet(searchStart, searchEnd, 39.296739, -78.198136, 233);
            const expectedJD = dateToJD(new Date(Date.UTC(2026, 5, 21, 17, 5, 0)));
            return (result.moonrise - expectedJD) * 1440;
        },
        expected: 0,
        tolerance: APP_CONFIG.ALGORITHM_VALIDATION_TOLERANCE_MINUTES,
        source: 'snapshot (recorded from this codebase, not compared to external sources — see note above)'
    },
    {
        name: 'calculateMoonRiseSet: moonset snapshot, 2026-06-21',
        actual: () => {
            const searchStart = dateToJD(new Date(Date.UTC(2026, 5, 21, 4, 0, 0)));
            const searchEnd = dateToJD(new Date(Date.UTC(2026, 5, 22, 4, 0, 0)));
            const result = calculateMoonRiseSet(searchStart, searchEnd, 39.296739, -78.198136, 233);
            const expectedJD = dateToJD(new Date(Date.UTC(2026, 5, 21, 4, 49, 0)));
            return (result.moonset - expectedJD) * 1440;
        },
        expected: 0,
        tolerance: APP_CONFIG.ALGORITHM_VALIDATION_TOLERANCE_MINUTES,
        source: 'snapshot (recorded from this codebase, not compared to external sources — see note above)'
    },

    // --- astro-target.js ---
    {
        name: 'isTargetVisibleDuringWindow: circumpolar target stays visible',
        actual: () => isTargetVisibleDuringWindow(
            dateToJD(new Date(Date.UTC(2026, 5, 21, 4, 0, 0))),
            dateToJD(new Date(Date.UTC(2026, 5, 22, 4, 0, 0))),
            12, 80, 39.296739, -78.198136, 20
        ),
        expected: true,
        tolerance: 0,
        source: 'geometric identity (dec=80° at lat=39.3° never dips below ~29° altitude, always ≥ 20° min)'
    },
    {
        name: 'isTargetVisibleDuringWindow: target never rises above horizon',
        actual: () => isTargetVisibleDuringWindow(
            dateToJD(new Date(Date.UTC(2026, 5, 21, 4, 0, 0))),
            dateToJD(new Date(Date.UTC(2026, 5, 22, 4, 0, 0))),
            12, -80, 39.296739, -78.198136, 0
        ),
        expected: false,
        tolerance: 0,
        source: 'geometric identity (dec=-80° at lat=39.3° peaks at ~-29° altitude, never above 0°)'
    },
    {
        name: 'findTargetRise: circumpolar target has no rise event',
        actual: () => {
            const result = findTargetRise(
                dateToJD(new Date(Date.UTC(2026, 5, 21, 4, 0, 0))),
                dateToJD(new Date(Date.UTC(2026, 5, 22, 4, 0, 0))),
                12, 80, 39.296739, -78.198136, 20
            );
            return result === null;
        },
        expected: true,
        tolerance: 0,
        source: 'geometric identity (already above min altitude at window start, no rise crossing)'
    },
    {
        name: 'findTargetSet: circumpolar target has no set event',
        actual: () => {
            const result = findTargetSet(
                dateToJD(new Date(Date.UTC(2026, 5, 21, 4, 0, 0))),
                dateToJD(new Date(Date.UTC(2026, 5, 22, 4, 0, 0))),
                12, 80, 39.296739, -78.198136, 20
            );
            return result === null;
        },
        expected: true,
        tolerance: 0,
        source: 'geometric identity (still visible at window end, so any dip is discarded per function contract)'
    },
    {
        name: 'findTargetTransit: self-consistency (RA = LST at known JD)',
        actual: () => {
            const startJD = dateToJD(new Date(Date.UTC(2026, 5, 21, 4, 0, 0)));
            const endJD = startJD + 1;
            const testJD = startJD + 0.3;
            const lstAtTest = getLST(testJD, -78.198136);
            const transitJD = findTargetTransit(startJD, endJD, lstAtTest, 0, -78.198136);
            return (transitJD - testJD) * 1440;
        },
        expected: 0,
        tolerance: APP_CONFIG.ALGORITHM_VALIDATION_TOLERANCE_MINUTES,
        source: 'geometric identity (a target with RA set to LST at testJD must transit at testJD)'
    },

    // --- additional coverage: previously-untested functions/branches ---
    {
        name: 'precessFromJ2000: zero-motion identity (toEpoch=2000.0)',
        actual: () => TimeUtils.precessFromJ2000(5.5, 45.2, 2000.0).ra,
        expected: 5.5,
        tolerance: 0.0000001,
        source: 'formula identity (precessing to J2000 itself must return input RA unchanged)'
    },
    {
        name: 'precessFromJ2000: zero-motion identity (dec)',
        actual: () => TimeUtils.precessFromJ2000(5.5, 45.2, 2000.0).dec,
        expected: 45.2,
        tolerance: 0.0000001,
        source: 'formula identity (precessing to J2000 itself must return input Dec unchanged)'
    },
    {
        name: 'getAzimuth: meridian transit identity (dec<lat, HA=0 → due south)',
        actual: () => {
            const jd = 2451545.0;
            const lst = getLST(jd, -78.198136);
            return getAzimuth(jd, lst, 0, 39.296739, -78.198136);
        },
        expected: 180,
        tolerance: 0.0001,
        source: 'geometric identity (object on meridian, south of zenith in N hemisphere = due south)'
    },
    {
        name: 'solarBrightnessUltraSmooth: dark-sky asymptote (sun at -90°)',
        actual: () => solarBrightnessUltraSmooth(-90),
        expected: 21.5,
        tolerance: 0.001,
        source: 'formula identity (tanh saturates near -1 at the deep-night extreme)'
    },
    {
        name: 'solarBrightnessUltraSmooth: bright-sky asymptote (sun at +90°)',
        actual: () => solarBrightnessUltraSmooth(90),
        expected: 11.5,
        tolerance: 0.001,
        source: 'formula identity (tanh saturates near +1 at the full-daylight extreme)'
    },
    {
        name: 'getHorizonElevationAtAzimuth: linear interpolation midpoint',
        actual: () => getHorizonElevationAtAzimuth(45, [{azimuth: 0, elevation: 10}, {azimuth: 90, elevation: 20}]),
        expected: 15,
        tolerance: 0.0000001,
        source: 'formula identity (halfway between two horizon points = average elevation)'
    },
    {
        name: 'isAboveHorizon: blocked by non-flat horizon profile',
        actual: () => isAboveHorizon(10, 0, 5, [{azimuth: 0, elevation: 15}, {azimuth: 180, elevation: 0}]),
        expected: false,
        tolerance: 0,
        source: 'geometric identity (altitude 10° clears the 5° min but not the 15° horizon obstruction)'
    },
    {
        name: 'combineMagnitudes: negligible second source',
        actual: () => combineMagnitudes(10, 30),
        expected: 10,
        tolerance: 0.001,
        source: 'formula identity (mag 30 source contributes negligible flux vs mag 10)'
    },
    {
        name: 'getMoonPhase: illumination near New Moon (2026-07-14)',
        actual: () => getMoonPhase(dateToJD(new Date(Date.UTC(2026, 6, 14, 9, 43, 0)))).illumination,
        expected: 0,
        tolerance: 1,
        source: 'starwalk.space, New Moon 2026-07-14 09:43 UTC (illumination should be ≈0%)'
    },
    {
        name: 'getMoonPhase: illumination near Full Moon (2026-07-29)',
        actual: () => getMoonPhase(dateToJD(new Date(Date.UTC(2026, 6, 29, 14, 36, 0)))).illumination,
        expected: 100,
        tolerance: 1,
        source: 'timeanddate.com / starwalk.space, Full Moon 2026-07-29 14:36 UTC (illumination should be ≈100%)'
    }
];

const AlgorithmValidationView = {
    results: [],

    init() {
        this.runTests();
        this.render();
    },

    destroy() {
        // No listeners/observers yet — stub for router consistency
    },

    runTests() {
        this.results = ASTRO_TESTS.map(test => {
            let actualValue;
            let error = null;

            try {
                actualValue = test.actual();
            } catch (e) {
                error = e.message || 'Error during test execution';
            }

            const pass = error === null && (
                (typeof actualValue === 'number' && Math.abs(actualValue - test.expected) <= test.tolerance) ||
                    (typeof actualValue === 'boolean' && actualValue === test.expected)
            );

            return {
                name: test.name,
                expected: test.expected,
                actual: error !== null ? error : actualValue,
                pass,
                source: test.source
            };
        });
    },

    formatValue(value) {
        if (typeof value !== 'number') return value;
        // Round to 6 decimal places, then strip trailing zeros
        return parseFloat(value.toFixed(6)).toString();
    },

    render() {
        const tbody = document.getElementById('algorithm-validation-tbody');
        const summaryEl = document.getElementById('algorithm-validation-summary');

        if (tbody) {
            tbody.innerHTML = '';
            this.results.forEach(result => {
                const row = document.createElement('tr');
                row.className = result.pass ? 'validation-pass' : 'validation-fail';
                row.innerHTML = `
                    <td>${result.name}</td>
                    <td>${this.formatValue(result.expected)}</td>
                    <td>${this.formatValue(result.actual)}</td>
                    <td>${result.pass ? 'PASS' : 'FAIL'}</td>
                `;
                tbody.appendChild(row);
            });
        }

        if (summaryEl) {
            const passCount = this.results.filter(r => r.pass).length;
            summaryEl.textContent = `${passCount}/${this.results.length} tests`;
        }
    }
};

// ----------------------------------------------------------------------
// ----------------------------------------------------------------------
// ----------------------------------------------------------------------

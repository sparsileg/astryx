/**
 * config.js
 * Application constants and configuration
 * No state management - that's handled by managers
 */

/**
 * APP_VERSION is x.y.z, where
 *   x — only for complete redesigns or database schema breaks that require migration
 *   y — new features (like cloud cover strip, imaging log)
 *   z — bug fixes, UI tweaks, tutorial updates
 *
 * DB_VERSION must be an integer
 */
const APP_CONFIG = {
    APP_NAME: 'Astryx',
    APP_TITLE: 'Astryx - Astrophotography Planning Tool',
    APP_VERSION: '1.5.0b',
    DB_NAME: 'astryx-db',
    DB_VERSION: 8,
    TARGET_DATA_PATH: './data/',
    DEFAULT_THEME: 'Matrix',

    // Calculation constants
    TIMELINE_EXTENSION_HOURS: 1/24,
    MOON_SEARCH_STEP_SIZE: 1/1440,
    MOON_SEARCH_MAX_STEPS: 2880,
    TARGET_SEARCH_STEP_SIZE: 1/1440,

    // DSS background image cache duration in ms
    DSS_CACHE_DURATION: 15 * 24 * 60 * 60 * 1000,
    DSS_LARGE_CACHE_DURATION: 2 * 24 * 60 * 60 * 1000,
    // Chunk size (bytes) for base64 conversion of cached DSS images — avoids
    // spreading large byte arrays into String.fromCharCode all at once.
    DSS_BASE64_CHUNK_SIZE: 8192,

    // Number of the top-ranked targets used to generate combinations
    TOP_RANKED_TARGETS: 37,

    // UI constants
    DEFAULT_MIN_ALTITUDE: 30,
    DEFAULT_YEARLY_MIN_ALTITUDE: 35, // fallback minimum altitude for Yearly Observability (Issue #218)
    DEFAULT_TIMEZONE: -5,
    MAX_SEARCH_RESULTS: 101, // maximum search results you can set
    DEFAULT_MIN_SIZE: 4.0,   // target filter arc minutes
    DEFAULT_MAX_MAG: 14.5,   // target filter magnitude

    // IndexedDB store names
    STORES: {
        SETTINGS: 'settings',
        LOCATIONS: 'locations',
        TELESCOPES: 'telescopes',
        SENSORS: 'sensors',
        PINNED_TARGETS: 'pinnedTargets',
        TODO_TARGETS: 'toDoTargets',
        TARGETS: 'targets',
        FILTERS: 'filters',
        IMAGING_PROJECTS: 'imagingProjects',
        IMAGING_SESSIONS: 'imagingSessions',
        IMAGING_PROGRAMS: 'imagingPrograms',
        DSS_CACHE: 'dssCache',
        TUTORIAL_PROGRESS: 'tutorialProgress'
    },

    NOTIONAL_HORIZON: [
        { azimuth: 0, elevation: 0 },
        { azimuth: 90, elevation: 0 },
        { azimuth: 180, elevation: 0 },
        { azimuth: 270, elevation: 0 }
    ],

    // Default target (used when no current target is selected)
    DEFAULT_TARGET: 'M 42',

    // Daily visibility: hours past midnight before which we default to previous night
    DV_LOOKBACK_CUTOFF_HOUR: 12,

    // Backup reminder constants
    BACKUP_REMINDER_INTERVAL_DAYS: 7,   // default reminder interval (days)
    BACKUP_REMINDER_AMBER_DAYS: 7,      // sidebar indicator turns amber after this many days
    BACKUP_REMINDER_RED_DAYS: 14,       // sidebar indicator turns orange/red after this many days

    // Session analysis learned defaults (issue #145)
    DEFAULT_SUB_GAP_S: 5,              // seconds between end of exposure and start of next (camera download + overhead)
    DEFAULT_DITHER_DURATION_S: 25,     // seconds for dither + guide settle
    DEFAULT_FRAMES_PER_DITHER: 3,      // user-settable frames between dithers

    FEATURES: {
        OPTIMIZER_COMBINATIONS: true,  // Issue #38 - combination mode for target optimizer
        CLOUD_COVER: true,             // Issue #81 - cloud cover strip on daily visibility timeline (experimental)
        TRANSITION_OPTIMIZATION: true, // Issue #109 - sequence transition optimization
        DEBUG_LOGGING: false           // Issue #177 - gate for per-render/per-interaction console.log noise
    },

    // Sequence transition optimization settings
    TRANSITION_OPTIMIZATION_THRESHOLD: 0.00,  // Minimum fractional improvement to accept reorder (0%)

    // External data APIs
    APIS: {
        OPEN_METEO: 'https://api.open-meteo.com/v1/forecast?latitude={LAT}&longitude={LON}&hourly=cloudcover,cloudcover_low,cloudcover_mid,cloudcover_high,windspeed_10m,temperature_2m,dewpoint_2m&timezone=auto&past_days=1&forecast_days=7&wind_speed_unit=mph',
        DSS: 'https://alasky.u-strasbg.fr/hips-image-services/hips2fits?hips=CDS/P/DSS2/color'
    },

    // Preferred catalog order for deduplication (Issue #54)
    CATALOG_PREFERENCE: ['Messier','NGC','IC','Sharpless','Caldwell','Barnard','Arp','Abell'],

    // To Do List chart altitude graph (Issue #147)
    TODO_ALTITUDE_SAMPLE_POINTS: 24,     // number of samples across dusk-dawn window
    TODO_ALTITUDE_GRAPH_STYLE: 'fill',   // 'fill' or 'line'
    TODO_ALTITUDE_GRAPH_ALPHA: 0.65,     // opacity of fill or line
    TODO_ALTITUDE_GRAPH_LINE_WIDTH: 4.0, // line width (used for both 'line' mode and fill outline)

    // Validate Algorithms view (Issue #176) — global tolerance for time-based
    // regression test comparisons, in minutes. Single shared value, no per-test
    // override. Note: moon rise/set tests are snapshot-only (see astro-moon.js
    // test entries) because their inherent ~2-5 min residual vs external sources
    // would fail this tolerance by design, not due to a bug.
    ALGORITHM_VALIDATION_TOLERANCE_MINUTES: 2,

    // PHD2 guide log analysis thresholds (ELR.p1-2). RMS bands are calibrated
    // against the settled-frame RMS of the 19-log corpus (see
    // threshold-calibration.md §1): excellent < RMS_EXCELLENT, normal
    // RMS_EXCELLENT–RMS_ELEVATED, elevated RMS_ELEVATED–RMS_HIGH, high
    // RMS_HIGH–RMS_CRITICAL, critical >= RMS_CRITICAL. Settled RMS is the
    // headline metric these fire against; see Phd2LogParser._finalizeSession.
    PHD2_GUIDE_THRESHOLDS: {
        RMS_EXCELLENT:    0.95,  // arcsec — narrative calls it "excellent" below this
        RMS_ELEVATED:     1.30,  // arcsec — elevated_rms anomaly fires at/above this
        RMS_HIGH:         2.0,   // arcsec — high_rms anomaly fires at/above this
        RMS_CRITICAL:     4.0,   // arcsec — critical_rms anomaly fires at/above this
        PEAK_SPIKE:       20.0,  // arcsec — isolated peak-error spike
        SNR_LOW:          15.0,  // SNR units — guide star may be too faint
        SNR_JUMP_FACTOR:  2.0,   // ratio vs previous-session avg SNR (guide star reselected)
        SHORT_SESSION:    100,   // frames — likely an autofocus interruption
    },

    // ASIAir Autorun log analysis (ELR.p1-3). Safety-net bound for the
    // bounded settle-terminator scan (dither/AF/calibration) — real
    // terminators land within ~60-90s in the corpus; this is a ceiling
    // against a genuinely unparseable log, not a tuned value.
    ASIAIR_SETTLE_SCAN_TIMEOUT_S: 300,

    // Minimum number of clean samples (settled dithers, or un-interrupted
    // sub-to-sub gaps) required before a learned value is updated from a
    // given night's log. Below this, the stored value is left untouched
    // rather than updated from too little/noisy data.
    ASIAIR_MIN_CLEAN_SAMPLES: 5,

    // Session analysis fusion/invariant thresholds (ELR.p3-2). All values
    // sourced from threshold-calibration.md §11's summary table — rig-
    // specific to the AM5 / AT115EDT / ASI120MM Mini corpus this was
    // calibrated against (9 months, 25 ASIAir logs, 19 PHD2 logs), per
    // design principle P8. Two one-off measured values from that table are
    // deliberately NOT included here: focus temperature coefficient
    // (-20.2 steps/°C) and the critical focus zone (±20 steps = +6%) — both
    // are single-night measurements to trend against, not configurable
    // bands, and don't belong alongside actual thresholds.
    //
    // Note: DEFAULT_SUB_GAP_S (5s, above) and DEFAULT_DITHER_DURATION_S
    // (25s, above) are pre-existing sequence-planner learned-value seeds,
    // a different purpose from the analysis thresholds below — they are
    // NOT reconciled with the corpus-measured sub-cycle-overhead (23s) or
    // dither-typical (21s) values here. Left untouched; whether those
    // seeds should be updated to match is a separate question from this
    // issue's scope.
    LOG_ANALYSIS: {
        // Guiding RMS bands (settled, arcsec) — duplicates
        // PHD2_GUIDE_THRESHOLDS' RMS_EXCELLENT/ELEVATED/HIGH conceptually;
        // referenced here by name for fusion/invariant code so this file
        // is a complete, self-contained reference for §11's table, without
        // relying on the caller also knowing to check PHD2_GUIDE_THRESHOLDS.
        RMS_EXCELLENT_ARCSEC: 0.95,
        RMS_ELEVATED_ARCSEC: 1.30,
        RMS_HIGH_ARCSEC: 2.0,

        // RA/Dec RMS ratio — median 1.38 across the corpus; a Dec-worse-
        // than-RA night (ratio < 1.0) is itself an anomaly worth flagging.
        RA_DEC_RATIO_NORMAL_MIN: 1.2,
        RA_DEC_RATIO_NORMAL_MAX: 1.6,

        // Dither settle duration (seconds) — median 21s (n=815 successful
        // settles), p90 33s.
        DITHER_SETTLE_TYPICAL_S: 21,
        DITHER_SETTLE_SLOW_S: 33,

        // Settle failure rate (fraction of dithers) — corpus baseline 1.5%.
        SETTLE_FAILURE_NORMAL_FRACTION: 0.02,
        SETTLE_FAILURE_ANOMALOUS_FRACTION: 0.05,

        // Sub-to-sub cadence overhead (seconds) — one night measured in
        // detail (2026-07-23): mean 22.8s, median 24s. Used by I1's
        // per-sub overhead budget.
        SUB_CYCLE_OVERHEAD_S: 23,

        // Autofocus (seconds / fraction)
        AF_DURATION_TYPICAL_S: 109,
        AF_FAILURE_ELEVATED_FRACTION: 0.10,

        // Guide-star failures (combined starLost + selectFailed), per night.
        GUIDE_STAR_FAILURES_ANOMALOUS_PER_NIGHT: 25,

        // PHD2 dropped-frame rate (fraction of frames) — corpus baseline
        // 1.18%.
        PHD2_DROP_RATE_ELEVATED_FRACTION: 0.005,
        PHD2_DROP_RATE_ANOMALOUS_FRACTION: 0.02,

        // Guide-star swap detector (D1, Phase 4) — coefficient of
        // variation of displacement; < this indicates a fixed/repeated
        // displacement (star swap) rather than a scattered mechanical
        // excursion. 0 false positives across 511 sessions in the corpus.
        STAR_SWAP_DISPLACEMENT_CV_MAX: 0.15,

        // Frame cadence irregularity (D7, Phase 4) — count of PHD2 frame
        // intervals exceeding 1.5x the guide exposure, per session.
        CADENCE_IRREGULARITY_ANOMALOUS_COUNT: 15,

        // I2 (wall-clock reconciliation): fraction of total wall clock the
        // unaccounted remainder may occupy before the invariant fails.
        // Not itself in threshold-calibration.md's table — no corpus
        // baseline exists for "acceptable" unaccounted time since the
        // phantom-gap bug this invariant guards against is already fixed;
        // 5% is a reasonable regression-protection ceiling, not a
        // calibrated corpus value like everything else in this block.
        WALL_CLOCK_UNACCOUNTED_FRACTION: 0.05,

        // I6 (PHD2 frame count × exposure ≈ session duration): fraction
        // tolerance on the reconciliation. Same caveat as above — a
        // reasonable ceiling, not a corpus-calibrated figure.
        FRAME_DURATION_TOLERANCE_FRACTION: 0.15,

        // Tier classification (design doc §4.3), resolved at ELR.p3-1 in
        // favor of relative-to-night-median (design doc §10 Q5 leaves this
        // explicitly open). Multipliers tuned to reproduce the design
        // doc's own worked example (2026-07-23: images 35-42 all reject).
        TIER_MARGINAL_MULTIPLIER: 1.2,
        TIER_REJECT_MULTIPLIER: 2.0,
    },
};

/**
 * Constellation abbreviation to full name mapping
 */
const CONSTELLATIONS = {
    'AND': 'Andromeda',
    'ANT': 'Antlia',
    'APS': 'Apus',
    'AQR': 'Aquarius',
    'AQL': 'Aquila',
    'ARA': 'Ara',
    'ARI': 'Aries',
    'AUR': 'Auriga',
    'BOO': 'Bootes',
    'CAE': 'Caelum',
    'CAM': 'Camelopardalis',
    'CNC': 'Cancer',
    'CVN': 'Canes Venatici',
    'CMA': 'Canis Major',
    'CMI': 'Canis Minor',
    'CAP': 'Capricornus',
    'CAR': 'Carina',
    'CAS': 'Cassiopeia',
    'CEN': 'Centaurus',
    'CEP': 'Cepheus',
    'CET': 'Cetus',
    'CHA': 'Chamaeleon',
    'CIR': 'Circinus',
    'COL': 'Columba',
    'COM': 'Coma Berenices',
    'CRA': 'Corona Australis',
    'CRB': 'Corona Borealis',
    'CRV': 'Corvus',
    'CRT': 'Crater',
    'CRU': 'Crux',
    'CYG': 'Cygnus',
    'DEL': 'Delphinus',
    'DOR': 'Dorado',
    'DRA': 'Draco',
    'EQU': 'Equuleus',
    'ERI': 'Eridanus',
    'FOR': 'Fornax',
    'GEM': 'Gemini',
    'GRU': 'Grus',
    'HER': 'Hercules',
    'HOR': 'Horologium',
    'HYA': 'Hydra',
    'HYI': 'Hydrus',
    'IND': 'Indus',
    'LAC': 'Lacerta',
    'LEO': 'Leo',
    'LMI': 'Leo Minor',
    'LEP': 'Lepus',
    'LIB': 'Libra',
    'LUP': 'Lupus',
    'LYN': 'Lynx',
    'LYR': 'Lyra',
    'MEN': 'Mensa',
    'MIC': 'Microscopium',
    'MON': 'Monoceros',
    'MUS': 'Musca',
    'NOR': 'Norma',
    'OCT': 'Octans',
    'OPH': 'Ophiuchus',
    'ORI': 'Orion',
    'PAV': 'Pavo',
    'PEG': 'Pegasus',
    'PER': 'Perseus',
    'PHE': 'Phoenix',
    'PIC': 'Pictor',
    'PSC': 'Pisces',
    'PSA': 'Pisces Austrinus',
    'PUP': 'Puppis',
    'PYX': 'Pyxis',
    'RET': 'Reticulum',
    'SGE': 'Sagitta',
    'SGR': 'Sagittarius',
    'SCO': 'Scorpius',
    'SCL': 'Sculptor',
    'SCT': 'Scutum',
    'SER': 'Serpens',
    'SEX': 'Sextans',
    'TAU': 'Taurus',
    'TEL': 'Telescopium',
    'TRA': 'Triangulum Australe',
    'TRI': 'Triangulum',
    'TUC': 'Tucana',
    'UMA': 'Ursa Major',
    'UMI': 'Ursa Minor',
    'VEL': 'Vela',
    'VIR': 'Virgo',
    'VOL': 'Volans',
    'VUL': 'Vulpecula'
};

/**
 * Object type abbreviation to full name mapping
 */
const OBJECT_TYPES = {
    '1STAR': 'Single star',
    '2STAR': 'Double star',
    'ASTER': 'Asterism',
    'BRTNB': 'Emission nebula',
    'CL+NB': 'Cluster with nebulosity',
    'DRKNB': 'Dark nebula',
    'GALCL': 'Galaxy cluster',
    'GALXY': 'Galaxy',
    'GLOCL': 'Globular cluster',
    'GX+DN': 'Diffuse nebula in a galaxy',
    'GX+GC': 'Globular cluster in a galaxy',
    'G+C+N': 'Cluster with nebulosity in a galaxy',
    'LMCCN': 'Cluster with nebulosity in the LMC',
    'LMCDN': 'Diffuse nebula in the LMC',
    'LMCGC': 'Globular cluster in the LMC',
    'LMCOC': 'Open cluster in the LMC',
    'MSTAR': 'Multiple stars',
    'NONEX': 'Nonexistent',
    'OPNCL': 'Open cluster',
    'OTHER': 'Unknown',
    'PLNNB': 'Planetary nebula',
    'QUASR': 'Quasar',
    'REFNB': 'Reflection nebula',
    'SMCCN': 'Cluster with nebulosity in the SMC',
    'SMCDN': 'Diffuse nebula in the SMC',
    'SMCGC': 'Globular cluster in the SMC',
    'SMCOC': 'Open cluster in the SMC',
    'SNREM': 'Supernova remnant'
};


/**
 * Catalog abbreviation to full name
 */
const CATALOG_MAP = {
    'Abell': 'Abell',
    'Arp': 'Arp',
    'B': 'Barnard',
    'C': 'Caldwell',
    'IC': 'IC',
    'LDN': 'LDN',
    'M': 'Messier',
    'MP': 'Minor Planet',
    'NGC': 'NGC',
    'Ou': 'Extra',
    'Pal': 'Extra',
    'RCW': 'Extra',
    'Sh': 'Sharpless',
    'vdB': 'Extra'
};

/**
 * Lightweight debug logger (Issue #177).
 * Gated by APP_CONFIG.FEATURES.DEBUG_LOGGING — silent by default in production.
 * Startup milestones and warn/error calls are NOT routed through this; they
 * remain plain console.log/warn/error since they're useful in bug reports.
 */
const Log = {
    debug(...args) {
        if (APP_CONFIG.FEATURES.DEBUG_LOGGING) console.log(...args);
    }
};

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
    APP_VERSION: '1.3.12',
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
    ALGORITHM_VALIDATION_TOLERANCE_MINUTES: 2
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

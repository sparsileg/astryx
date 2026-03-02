/**
 * config.js
 * Application constants and configuration
 * No state management - that's handled by managers
 */

/**
 * APP_VERSION can be anything
 * DB_VERSION must be an integer
 */
const APP_CONFIG = {
    APP_NAME: 'Specula',
    APP_TITLE: 'Specula - Astrophotography Planning Tool',
    APP_VERSION: '0.11.0',
    DB_NAME: 'specula-db',
    DB_VERSION: 7,
    TARGET_DATA_PATH: './data/',
    DEFAULT_THEME: 'Matrix',

    // Calculation constants
    TIMELINE_EXTENSION_HOURS: 1/24,
    MOON_SEARCH_STEP_SIZE: 1/1440,
    MOON_SEARCH_MAX_STEPS: 2880,
    TARGET_SEARCH_STEP_SIZE: 1/1440,

    // UI constants
    DEFAULT_MIN_ALTITUDE: 30,
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
        DSS_CACHE: 'dssCache'
    },

    NOTIONAL_HORIZON: [
        { azimuth: 0, elevation: 0 },
        { azimuth: 90, elevation: 0 },
        { azimuth: 180, elevation: 0 },
        { azimuth: 270, elevation: 0 }
    ]
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

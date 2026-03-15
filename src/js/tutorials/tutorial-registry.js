/**
 * tutorial-registry.js
 * Registry of all available tutorials.
 * Each entry maps a tutorial ID to its data object,
 * defined in a separate file and loaded before this one.
 *
 * Script load order in index.html:
 *   1. Individual tutorial files (e.g. tutorial-getting-started.js)
 *   2. tutorial-registry.js
 *   3. tutorial-engine.js
 */

const TUTORIAL_REGISTRY = {
    version: '1.0',
    tutorials: {
        'daily-visibility':     TUTORIAL_DAILY_VISIBILITY,
        'getting-started':      TUTORIAL_GETTING_STARTED,
        'settings':             TUTORIAL_SETTINGS,
        'admin-tools':          TUTORIAL_ADMIN_TOOLS,
        'sidebar':              TUTORIAL_SIDEBAR,
        'todo':                 TUTORIAL_TODO,
        'target-search':        TUTORIAL_TARGET_SEARCH,
        'target-filtering':     TUTORIAL_TARGET_FILTERING,
        'yearly-observability': TUTORIAL_YEARLY_OBSERVABILITY,
    }
};

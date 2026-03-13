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
        'getting-started':  TUTORIAL_GETTING_STARTED,
        'settings':         TUTORIAL_SETTINGS,
        'sidebar':          TUTORIAL_SIDEBAR,
        'target-search':    TUTORIAL_TARGET_SEARCH,
        'target-filtering': TUTORIAL_TARGET_FILTERING
    }
};

/**
 * test-sample.js
 * Sample JS file for testing find-unused-js.py
 */

const SampleManager = {

    /**
     * This function is called elsewhere — should show as USED
     */
    init() {
        this.loadData();
        this.attachEventHandlers();
    },

    /**
     * Called by init() via this.loadData() — should show as USED
     */
    loadData() {
        console.log('Loading data...');
    },

    /**
     * Called by init() via this.attachEventHandlers() — should show as USED
     */
    attachEventHandlers() {
        const btn = document.getElementById('save-btn');
        if (btn) btn.addEventListener('click', () => this.save());
    },

    /**
     * Called as this.save() from attachEventHandlers — should show as USED
     */
    save() {
        console.log('Saving...');
        this.formatOutput();
    },

    /**
     * Called by save() via this.formatOutput() — should show as USED
     */
    formatOutput() {
        return 'formatted';
    },

    /**
     * Never called anywhere — should show as UNUSED
     */
    debugDump() {
        console.log('Debug dump');
    },

    /**
     * Never called anywhere — should show as UNUSED
     */
    legacyExport() {
        return null;
    },

    /**
     * Never called anywhere — should show as UNUSED
     */
    resetToDefaults() {
        console.log('Resetting...');
    }
};

/**
 * Top-level function, called below — should show as USED
 */
function initApp() {
    SampleManager.init();
}

/**
 * Top-level function, never called — should show as UNUSED
 */
function orphanedHelper() {
    return 42;
}

/**
 * Top-level arrow function, called below — should show as USED
 */
const formatDate = (date) => date.toISOString();

/**
 * Top-level arrow function, never called — should show as UNUSED
 */
const unusedFormatter = (val) => val.trim();

// Entry point
initApp();
console.log(formatDate(new Date()));

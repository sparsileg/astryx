/**
 * tutorial-utilities.js
 * "Utilities" tutorial definition.
 * Covers: Sky Conditions and Dust Mote Distance
 * Estimator. Session Log Analysis has its own view and tutorial
 * (tutorial-log-analysis.js).
 *
 * Modal  — use when there's no specific element to point at (introductions,
 *           transitions, instructions to navigate somewhere)
 * Callout — use when you can point at a specific element in the current DOM
 */

const TUTORIAL_UTILITIES = {
    id: 'utilities',
    title: 'Utilities',
    version: 1,
    nextTutorial: 'log-analysis',
    steps: [

        // --- Introduction ---
        {
            id: 'welcome',
            type: 'modal',
            title: 'Utilities',
            body: 'This tutorial walks you through the Utilities view — a collection of tools that support your planning and post-session analysis. It covers the Sky Conditions links and the Dust Mote Distance Estimator. It takes about 4 minutes.',
            target: null,
            position: 'center',
            waitFor: 'next',
            highlight: false
        },
        {
            id: 'open-utilities',
            type: 'callout',
            title: 'Open Utilities',
            body: 'Click <strong>Utilities</strong> in the left navigation panel to open the view.',
            target: '#sidebar-utilities',
            position: 'right',
            waitFor: 'click',
            highlight: true
        },

        // --- Sky Conditions ---
        {
            id: 'sky-conditions',
            type: 'callout',
            title: 'Sky Conditions',
            body: 'Choose one of your saved locations; it starts on your current location. Each link opens in a new browser tab at that location\'s coordinates:<br><br><strong>Astrospheric</strong> and <strong>Clear Outside</strong>: forecasts to supplement the one in the Daily Visibility timeline. Check them the day of a planned session.<br><strong>Clouds</strong>: near-real-time satellite cloud imagery.<br><strong>Light Pollution</strong>: the Light Pollution Map, the recommended way to find a location\'s Bortle value. Once you know it, update it in Admin Tools → Manage Observer Locations.',
            target: '#utilities-sky-conditions',
            position: 'bottom',
            width: '420px',
            waitFor: 'next',
            highlight: 'flash'
        },

        // --- Dust Mote ---
        {
            id: 'dust-mote-intro',
            type: 'callout',
            title: 'Dust Mote Distance Estimator',
            body: 'The Dust Mote Distance Estimator helps you determine how far a dust particle is from your sensor based on how it appears in your images — the larger the dust spot, the further away it is from the sensor surface.<br><br>This is useful when trying to decide whether to clean the sensor window or a filter or lens further up the train.',
            target: '#utilities-dust-mote',
            scrollTo: true,
            position: 'top',
            width: '420px',
            waitFor: 'next',
            highlight: 'flash'
        },
        {
            id: 'dust-telescope-telescope',
            type: 'callout',
            title: 'Auto-Fill from Equipment',
            body: 'Select a telescope from your saved equipment to automatically populate the Focal Ratio field. You can also enter this value manually if you prefer. Click Next when done.',
            target: '#dust-telescope-dropdown',
            position: 'top',
            waitFor: 'next',
            highlight: true
        },
        {
            id: 'dust-telescope-sensor',
            type: 'callout',
            title: 'Auto-Fill from Equipment',
            body: 'Select a sensor from your saved equipment to automatically populate the Pixel Size field. You can also enter this value manually if you prefer. Click Next when done.',
            target: '#dust-sensor-dropdown',
            position: 'top',
            waitFor: 'next',
            highlight: true
        },
        {
            id: 'dust-spot-pixels',
            type: 'callout',
            title: 'Spot Diameter',
            body: 'Measure the diameter of the dust spot in your image, in pixels, using your image processing software. Its edge is soft: measure across the spot where the edge has faded halfway. If you imaged with binning, enter the binned pixel size above, or measure on an unbinned frame. Enter the spot diameter now.',
            target: '#dust-spot-pixels',
            position: 'top',
            waitFor: 'next',
            highlight: true
        },
        {
            id: 'dust-results',
            type: 'callout',
            title: 'Distance Results',
            body: 'The result is the estimated distance from the sensor, in millimeters: the spot\'s diameter times the focal ratio. The line below it shows the spot diameter in millimeters.<br><br>A small distance (a few mm) suggests the dust is on the sensor window. A larger one points to a filter or the rear lens of a flattener or reducer. Dust further up the train is too far out of focus to show as a spot.',
            target: '#dust-mote-results',
            position: 'top',
            width: '450px',
            waitFor: 'next',
            highlight: 'flash'
        },

        // --- Complete ---
        {
            id: 'complete',
            type: 'modal',
            title: 'Utilities Complete',
            body: 'You now know how to use the tools in the Utilities view. Use the forecast links before every session, the light pollution map to verify your Bortle rating, and the Dust Mote Estimator when cleaning your optical train.<br><br>Next, the Log Analysis tutorial covers reviewing your imaging and guiding sessions.',
            target: null,
            position: 'center',
            waitFor: 'next',
            highlight: false
        }
    ]
};

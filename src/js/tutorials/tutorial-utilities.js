/**
 * tutorial-utilities.js
 * "Utilities" tutorial definition.
 * Covers: Weather Forecasts, Light Pollution, and Dust Mote Distance
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
            body: 'This tutorial walks you through the Utilities view — a collection of tools that support your planning and post-session analysis. It covers weather and light pollution links and the Dust Mote Distance Estimator. It takes about 4 minutes.',
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

        // --- Weather ---
        {
            id: 'weather-overview',
            type: 'callout',
            title: 'Weather Forecasts',
            body: 'The Weather Forecasts card shows links to three weather services — <strong>Astrospheric</strong>, <strong>Clear Outside</strong>, and <strong>Clouds</strong> — for each of your saved observer locations. Each link opens in a new browser tab and shows a forecast tailored to your exact coordinates.<br><br>Use the additional details in these sources to supplement the forecast data referenced in the Daily Visibility timeline. Use them the day of a planned session to confirm conditions. The <strong>Clouds</strong> website provides near-real-time cloud imagery.',
            target: '#utilities-weather-forecasts',
            position: 'bottom',
            width: '420px',
            waitFor: 'next',
            highlight: 'flash'
        },

        // --- Light Pollution ---
        {
            id: 'light-pollution',
            type: 'callout',
            title: 'Light Pollution',
            body: 'The Light Pollution card provides a direct link to the Light Pollution Map for each of your saved locations. This is the recommended way to find the Bortle scale value for a location — open the map, zoom in to your site, and read the Bortle rating.<br><br>Once you know your Bortle value, you can update it in Admin Tools → Manage Observer Locations.',
            target: '#utilities-light-pollution',
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
            body: 'The Dust Mote Distance Estimator helps you determine how far a dust particle is from your sensor based on how it appears in your images — the larger and fuzzier the dust spot, the further away it is from the sensor surface.<br><br>This is useful when trying to decide whether to clean the sensor itself or the optical elements further up the train.',
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
            body: 'Measure the diameter of the dust spot in your image — use your image processing software to measure in pixels — and enter it here. The more accurately you measure, the more useful the result. Enter the spot diameter now.',
            target: '#dust-spot-pixels',
            position: 'top',
            waitFor: 'next',
            highlight: true
        },
        {
            id: 'dust-results',
            type: 'callout',
            title: 'Distance Results',
            body: 'The results table shows the estimated distance from the sensor for two common dust particle sizes — 0.5 mm and 1.5 mm. The summary line below shows the computed spot diameter in millimeters and the focal ratio used.<br><br>A small distance (a few mm) suggests the dust is on or very close to the sensor. A large distance suggests it is on a filter, lens element, or the front of the optical train.',
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
            body: 'You now know how to use all three tools in the Utilities view. Use the weather links before every session, the light pollution map to verify your Bortle rating, and the Dust Mote Estimator when cleaning your optical train.<br><br>Next, the Log Analysis tutorial covers reviewing your imaging and guiding sessions.',
            target: null,
            position: 'center',
            waitFor: 'next',
            highlight: false
        }
    ]
};

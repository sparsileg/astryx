/**
 * tutorial-getting-started.js
 * "Getting Started with Astryx" tutorial definition.
 */

const TUTORIAL_GETTING_STARTED = {
    id: 'getting-started',
    title: 'Getting Started with Astryx',
    version: 2,
    nextTutorial: null,
    steps: [
        {
            id: 'welcome',
            type: 'modal',
            title: 'Welcome to Astryx',
            body: 'This tutorial will walk you through setting up Astryx for the first time with a imaging site, a telescope, and a sensor. It takes about 10 minutes.',
            target: null,
            position: 'center',
            waitFor: 'next',
            highlight: false
        },
        {
            id: 'open-locations',
            type: 'modal',
            title: 'Open Manage Locations',
            body: 'Open the hamburger menu (☰ top right), click Admin Tools, then click Manage Observer Locations. Click Next when the Manage Locations form is open.',
            target: null,
            position: 'center',
            waitFor: 'next',
            highlight: false
        },
        {
            id: 'add-location',
            type: 'callout',
            title: 'Save Your Location',
            body: 'Fill in the fields for your imaging site in the Add New Location section, then click Save Location.',
            target: '#modal-save-btn',
            position: 'bottom',
            waitFor: 'click',
            highlight: true
        },
        {
            id: 'location-saved',
            type: 'callout',
            title: 'Location Saved',
            body: 'Great — your location has been saved. The first time you select the new location the "Best Month" will be calculated for each object visible from that site. You can add more sites any time from Admin Tools → Manage Observer Locations.',
            target: '#sidebar-location-select',
            position: 'right',
            waitFor: 'next',
            highlight: true
        },
        {
            id: 'interstitial',
            type: 'modal',
            title: "Now let's add your equipment",
            body: "Next we'll add a telescope and sensor so Astryx can calculate your field of view.",
            target: null,
            position: 'center',
            waitFor: 'next',
            highlight: false
        },
        {
            id: 'open-equipment',
            type: 'modal',
            title: 'Open Manage Equipment',
            body: 'Open the hamburger menu (☰ top right), click Admin Tools, then click Manage Equipment. Click Next when the Manage Equipment form is open.',
            target: null,
            position: 'center',
            waitFor: 'next',
            highlight: false
        },
        {
            id: 'click-telescopes',
            type: 'callout',
            title: 'Open Telescope Form',
            body: 'Click Telescopes to open the telescope entry form.',
            target: '#manage-equipment-telescopes-btn',
            position: 'bottom',
            waitFor: 'click',
            highlight: true
        },
        {
            id: 'add-telescope',
            type: 'callout',
            title: 'Save Your Telescope',
            body: 'Fill in your telescope details, then click Save Telescope.',
            target: '#modal-save-btn',
            position: 'bottom',
            waitFor: 'click',
            highlight: true
        },
        {
            id: 'open-equipment-sensor',
            type: 'modal',
            title: 'Now Add Your Sensor',
            body: "Now let's add your sensor. Open the hamburger menu (☰) → Admin Tools → Manage Equipment. Click Next when the form is open.",
            target: null,
            position: 'top',
            waitFor: 'next',
            highlight: false
        },
        {
            id: 'click-sensors',
            type: 'callout',
            title: 'Open Sensor Form',
            body: 'Click Sensors to open the sensor entry form.',
            target: '#manage-equipment-sensors-btn',
            position: 'right',
            waitFor: 'click',
            highlight: true
        },
        {
            id: 'add-sensor',
            type: 'callout',
            title: 'Save Your Sensor',
            body: 'Fill in your sensor details, then click Save Sensor.',
            target: '#modal-save-btn',
            position: 'bottom',
            waitFor: 'click',
            highlight: true
        },
        {
            id: 'complete',
            type: 'modal',
            title: "You're all set!",
            body: "Astryx now knows your location, telescope, and sensor. With this information you can start searching for your next astrophotography target. You're ready to start planning your imaging sessions!",
            target: null,
            position: 'center',
            waitFor: 'next',
            highlight: false
        }
    ]
};

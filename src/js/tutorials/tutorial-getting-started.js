/**
 * tutorial-getting-started.js
 * "Getting Started with Astryx" tutorial definition.
 */

const TUTORIAL_GETTING_STARTED = {
    id: 'getting-started',
    title: 'Getting Started with Astryx',
    version: 3,
    nextTutorial: 'settings',
    steps: [
        {
            id: 'welcome',
            type: 'modal',
            title: 'Welcome to Astryx',
            body: 'This tutorial will walk you through setting up Astryx for the first time with a location from which you\'ll observe, a telescope, and a sensor. It takes about 10 minutes.',
            target: null,
            position: 'center',
            waitFor: 'next',
            highlight: false
        },
        {
            id: 'data-security',
            type: 'modal',
            title: 'Data Security & Privacy',
            body: 'This program does not store your data on any servers. As a result, your data is completely private to your local computer. Most browsers will retain stored data until you clean the browser cache. However, we have heard that the Apple browser Safari will delete your data after you don\'t use it for one week. We strongly suggest that you use a different browser. We like Vivaldi which is based on Chrome, but without all the features that track and target you.<br><br>It is very important to understand that you are fully responsible for preserving your own data. We strongly recommend that as soon as the target database is loaded, use the <strong>Backup</strong> function in the system menu to save the target database to your local computer for an easy restore, if necessary.<br><br>Likewise, we recommend that you keep regular backups anytime you add, delete, or change any other form of data in Astryx. There is an automatic backup capability - see the system menu >> <strong>Settings</strong> page to define how the automatic backup works. You can also do a <strong>Backup</strong> of some or all of your data at any time from the system menu. Once you have a single target database backup, there is no need to backup it up again. Focus on backing up the data you have created or updated.<br><br><strong>Remember</strong> that you are completely responsible for your data. Since it is not stored offsite, it cannot be recovered unless you have made backups yourself.',
            target: null,
            position: 'top',
            waitFor: 'next',
            highlight: false
        },
        {
            id: 'open-admin-tools',
            type: 'callout',
            title: 'Open the System Menu',
            body: 'Open the system menu (☰) in the top right of the sidebar header',
            target: '#system-menu-btn',
            position: 'left',
            width: '175px',
            waitFor: 'click',
            highlight: true
        },
        {
            id: 'open-submenu',
            type: 'callout',
            title: 'Open Manage Locations',
            body: 'Click <strong>Admin Tools</strong>.',
            target: '[data-action="admin-tools"]',
            position: 'left',
            width: '175px',
            waitFor: 'click',
            highlight: true
        },
        {
            id: 'open-locations',
            type: 'callout',
            title: 'Open Manage Locations',
            body: 'Click <strong>Manage Observer Locations</strong>.',
            target: '[data-action="manage-locations"]',
            position: 'left',
            width: '175px',
            waitFor: 'click',
            highlight: true
        },
        {
            id: 'add-location',
            type: 'callout',
            title: 'Save Your Location',
            body: 'Fill in the fields for your imaging site in the Add New Location section. Timezone, Latitude, Longitude, and Elevation must be as accurate as possible since many calculations depend on them. You can ignore the Horizon Profile for now. Once you are done, click <strong>Save Location</strong>.',
            target: '#modal-save-btn',
            position: 'right',
            width: '200px',
            waitFor: 'click',
            highlight: true
        },
        {
            id: 'location-saved',
            type: 'callout',
            title: 'Location Saved',
            body: 'Your location has been saved.',
            target: null,
            position: 'center',
            waitFor: 'next',
            highlight: false
        },
        {
            id: 'close-location-form',
            type: 'callout',
            title: 'Set Your Location',
            body: 'The first time you select a new location, the "Best Month" will be calculated automatically for each object visible from that site. Select the site you just created, if necessary.',
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
            id: 'open-system-equipment',
            type: 'callout',
            title: 'Open the System Menu',
            body: 'Open the system menu (☰) in the top right, click <strong>Admin Tools</strong>, then click <strong>Manage Equipment</strong>. Click Next when the dialog is open.',
            target: '#system-menu-btn',
            position: 'left',
            width: '175px',
            waitFor: 'click',
            highlight: true
        },
        {
            id: 'open-admin-equipment',
            type: 'callout',
            title: 'Open Admin Tools',
            body: 'Click <strong>Admin Tools</strong>.',
            target: '[data-action="admin-tools"]',
            position: 'left',
            width: '175px',
            waitFor: 'click',
            highlight: true
        },
        {
            id: 'open-equipment',
            type: 'callout',
            title: 'Open Manage Equipment',
            body: 'Click <strong>Manage Equipment</strong>.',
            target: '[data-action="manage-equipment"]',
            position: 'left',
            width: '175px',
            waitFor: 'click',
            highlight: true
        },
        {
            id: 'equipment-tabs-intro',
            type: 'modal',
            title: 'Equipment Tabs',
            body: 'The Manage Equipment dialog has three tabs: <strong>Telescopes</strong>, <strong>Sensors</strong>, and <strong>Filters</strong>. The Telescopes tab is shown by default. We\'ll add a telescope first.',
            target: null,
            position: 'center',
            waitFor: 'next',
            highlight: false
        },
        {
            id: 'telescope-name',
            type: 'callout',
            title: 'Telescope Name',
            body: 'Give the telescope a recognizable name — this is how it will appear throughout Astryx.',
            target: '#telescope-name',
            position: 'bottom',
            waitFor: 'next',
            highlight: true
        },
        {
            id: 'telescope-focal-length',
            type: 'callout',
            title: 'Telescope Focal Length',
            body: 'Enter the focal length in millimeters.',
            target: '#telescope-focal-length',
            position: 'bottom',
            waitFor: 'next',
            highlight: true
        },
        {
            id: 'telescope-aperture',
            type: 'callout',
            title: 'Telescope Aperture',
            body: 'Enter the aperture in millimeters.',
            target: '#telescope-aperture',
            position: 'bottom',
            waitFor: 'next',
            highlight: true
        },
        {
            id: 'telescope-mods',
            type: 'callout',
            title: 'Telescope Modifications',
            body: 'If you are going to use a reducer or Barlow multiplier, enter the power.',
            target: '#telescope-multiplier',
            position: 'bottom',
            waitFor: 'next',
            highlight: true
        },
        {
            id: 'telescope-save',
            type: 'callout',
            title: 'Save Your Telescope',
            body: 'Click <strong>Save Telescope</strong>.',
            target: '#equipment-save-telescope-btn',
            position: 'bottom',
            waitFor: 'click',
            highlight: true
        },
        {
            id: 'add-sensor-intro',
            type: 'callout',
            title: 'Now Add Your Sensor',
            body: 'Click the <strong>Sensors</strong> tab at the top of the dialog.',
            target: '[data-tab="sensors"]',
            position: 'bottom',
            waitFor: 'click',
            highlight: true
        },
        {
            id: 'sensor-name',
            type: 'callout',
            title: 'Sensor Name',
            body: 'Give the sensor a recognizable name.',
            target: '#sensor-name',
            position: 'bottom',
            waitFor: 'next',
            highlight: true
        },
        {
            id: 'sensor-save',
            type: 'callout',
            title: 'Save Your Sensor',
            body: 'Fill in the resolution and pixel size fields, then click <strong>Save Sensor</strong>. Click Next when saved.',
            target: '#equipment-save-sensor-btn',
            position: 'bottom',
            waitFor: 'click',
            highlight: true
        },
        {
            id: 'equipment-close',
            type: 'callout',
            title: 'Close Manage Equipment',
            body: 'Close the <strong>Manage Equipment</strong> dialog.',
            target: '#modal-close',
            position: 'left',
            waitFor: 'click',
            highlight: true
        },
        {
            id: 'complete',
            type: 'modal',
            title: "You're all set!",
            body: "Astryx now knows your location, telescope, and sensor. You\'re ready to start planning your imaging sessions! With this information you can start searching for your next astrophotography target and planning your imaging sessions. We encourage you to view all the tutorials to understand everything that Astryx can do for you.",
            target: null,
            position: 'center',
            waitFor: 'next',
            highlight: false
        }
    ]
};

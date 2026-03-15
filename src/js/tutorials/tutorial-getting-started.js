/**
 * tutorial-getting-started.js
 * "Getting Started with Astryx" tutorial definition.
 */

const TUTORIAL_GETTING_STARTED = {
    id: 'getting-started',
    title: 'Getting Started with Astryx',
    version: 2,
    nextTutorial: 'settings',
    steps: [
        {
            id: 'welcome',
            type: 'modal',
            title: 'Welcome to Astryx',
            body: 'This tutorial will walk you through setting up Astryx for the first time with an imaging site, a telescope, and a sensor. It takes about 10 minutes.',
            target: null,
            position: 'center',
            waitFor: 'next',
            highlight: false
        },
        {
            id: 'data-security',
            type: 'modal',
            title: 'Data Security & Privacy',
            body: 'This program does not store your data on any servers. As a result, your data is completely private to your local computer. Most browsers will retain stored data until you clean the browser cache. However, we have heard that the Apple browser Safari will delete your data after you don\'t use it for one week. We strongly suggest that you use a different browser. We like Vivaldi which is based on Chrome, but without all the features that track and target you.<br><br>It is very important to understand that you are fully responsible for preserving your own data. We strongly recommend that as soon as the target database is loaded, use the <strong>Backup</strong> function in the system menu to save the target database to your local computer for an easy restore, if necessary.<br><br>Likewise, we recommend that you keep regular backups anytime you add, delete, or change any other form of data in Astryx. There is an automatic backup capability - see the system menu >> <strong>Settings</strong> page to define how the automatic backup works. You can also do a <strong>Backup</strong> of some or all of your data at any time from the system menu. Once you have a single target database backup, there is no need to backup it up again. Focus on backing up the data you have created.<br><br><strong>Remember</strong> that you are completely responsible for your data. Since it is not stored offsite, it cannot be recovered unless you have made backups yourself.',
            target: null,
            position: 'top',
            waitFor: 'next',
            highlight: false
        },
        {
            id: 'open-locations',
            type: 'callout',
            title: 'Open Manage Locations',
            body: 'Open the system menu (☰) in the top right of the sidebar header, click <strong>Admin Tools</strong>, then click <strong>Manage Observer Locations</strong>. Click Next when the <strong>Manage Observer Locations</strong> form is open.',
            target: '#system-menu-btn',
            position: 'left',
            width: '175px',
            waitFor: 'next',
            highlight: true
        },
        {
            id: 'add-location',
            type: 'callout',
            title: 'Save Your Location',
            body: 'Fill in the fields for your imaging site in the Add New Location section. Timezone, Latitude, Longitude, and Elevation must be as accurate as possible. You can ignore the Horizon Profile for now. Once you are done, click <strong>Save Location</strong>.',
            target: '#modal-save-btn',
            position: 'left',
            waitFor: 'click',
            highlight: true
        },
        {
            id: 'location-saved',
            type: 'callout',
            title: 'Location Saved',
            body: 'Great — your location has been saved. You can add more sites any time from Admin Tools → Manage Observer Locations.<br><br>Now close the form.',
            target: '#modal-close',
            position: 'left',
            waitFor: 'click',
            highlight: true
        },
        {
            id: 'close-location-form',
            type: 'callout',
            title: 'Set Your Location',
            body: 'The first time you select a new location, the "Best Month" will be calculated automagically for each object visible from that site.',
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
            type: 'callout',
            title: 'Open Manage Equipment',
            body: 'Open the system menu (☰) in the top right, click Admin Tools, then click Manage Equipment. Click Next when the Manage Equipment form is open.',
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
            body: "Now let's add your sensor. Open the system menu (☰) → Admin Tools → Manage Equipment. Click Next when the form is open.",
            target: null,
            position: 'top',
            waitFor: 'next',
            highlight: false
        },
        {
            id: 'click-sensors',
            type: 'callout',
            title: 'Open Sensor Form',
            body: 'Click Sensors to open the sensor entry form. Click next when the form is is open.',
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

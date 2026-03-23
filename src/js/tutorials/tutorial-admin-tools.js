/**
 * tutorial-admin-tools.js
 * "Admin Tools" tutorial definition.
 * Covers: Calculate Best Months, Manage Equipment (telescopes as example),
 * Manage Observer Locations, Clear All Targets, Check for Target Updates,
 * Merge New Targets.
 *
 * Modal — use when there's no specific element to point at (introductions,
 * transitions, instructions to navigate somewhere)
 * Callout — use when you can point at a specific element in the current DOM
 */

const TUTORIAL_ADMIN_TOOLS = {
    id: 'admin-tools',
    title: 'Admin Tools',
    version: 2,
    nextTutorial: 'backup-restore',
    steps: [
        {
            id: 'welcome',
            type: 'modal',
            title: 'Admin Tools',
            body: 'This tutorial covers the Admin Tools menu — the utilities for managing your equipment, locations, target database, and best month calculations. It takes about 5 minutes.',
            target: null,
            position: 'center',
            waitFor: 'next',
            highlight: false
        },
        {
            id: 'admin-submenu',
            type: 'callout',
            title: 'Admin Tools Menu',
            body: 'Open the <strong>Admin Tools</strong> submenu from the system menu. The <strong>Admin Tools</strong> submenu contains several utilities for managing your data and equipment. We will walk through each one.',
            target: '#admin-tools-submenu',
            position: 'right',
            waitFor: 'next',
            highlight: false
        },

        // --- Calculate Best Months ---
        {
            id: 'best-months-intro',
            type: 'callout',
            title: 'Calculate Best Months',
            body: 'The <strong>Calculate Best Months</strong> operation is normally executed when you select a location for the first time. The option is kept in Admin Tools "just in case" or if you just want to calculate for all your current locations.<br><br>Open <strong>Admin Tools → Calculate Best Months</strong>.<br><br> Click Next when the dialog is open.',
            target: null,
            position: 'center',
            waitFor: 'next',
            highlight: false
        },
        {
            id: 'best-months-location',
            type: 'callout',
            title: 'Select Location',
            body: 'Choose the observing location for which you want to compute best months. Astryx will calculate, for each target, which calendar months offer the most favorable visibility from that location.<br><br>Best Months analysis scores every target across the year based on visibility windows, darkness hours, and minimum altitude. Results are stored per location so you can run this for each site you image from.',
            target: '#best-months-location-select',
            position: 'right',
            width: '500px',
            waitFor: 'next',
            highlight: true
        },
        {
            id: 'best-months-execute',
            type: 'callout',
            title: 'Calculate for One Location',
            body: 'Once a location is selected, click the <strong>Calculate</strong> button to find the best month and visible months for every target in the database from this location.',
            target: '#best-months-calculate',
            position: 'left',
            waitFor: 'click',
            highlight: true
        },
        {
            id: 'best-months-results',
            type: 'callout',
            title: 'Calculating ...',
            body: 'The calculations usually takes less than a minute. When it is completed, click <strong>Next</strong>.',
            target: '#best-months-location-select',
            position: 'top',
            waitFor: 'next',
            highlight: true
        },
        {
            id: 'best-months-close',
            type: 'callout',
            title: 'Close Best Months Dialog',
            body: 'Once the calculation is done, close the <strong>Calculate Best Observing Months</strong> dialog.',
            target: '#modal-close',
            position: 'left',
            waitFor: 'click',
            highlight: true
        },

        // --- Manage Equipment ---
        {
            id: 'manage-equipment-intro',
            type: 'callout',
            title: 'Manage Equipment',
            body: 'Open <strong>Admin Tools → Manage Equipment</strong>. Click Next when the dialog is open.',
            target: null,
            position: 'center',
            waitFor: 'next',
            highlight: false
        },
        {
            id: 'manage-equipment-tabs',
            type: 'modal',
            title: 'Equipment Tabs',
            body: 'Equipment is organized into three tabs: <strong>Telescopes</strong>, <strong>Sensors</strong>, and <strong>Filters</strong>. Click the <strong>Telescopes</strong> tab at the top of the dialog to follow along. Click Next when you are on the Telescopes tab.',
            target: null,
            position: 'center',
            waitFor: 'next',
            highlight: false
        },
        {
            id: 'telescope-name',
            type: 'callout',
            title: 'Telescope Name',
            body: 'Give the telescope a recognizable name — this is how it will appear throughout Astryx in equipment selectors and the field of view planner.',
            target: '#telescope-name',
            position: 'bottom',
            waitFor: 'next',
            highlight: true
        },
        {
            id: 'telescope-fl',
            type: 'callout',
            title: 'Focal Length',
            body: 'Enter the native focal length in millimeters. This is the optical focal length of the telescope before any reducer or barlow.',
            target: '#telescope-focal-length',
            position: 'right',
            waitFor: 'next',
            highlight: true
        },
        {
            id: 'telescope-aperture',
            type: 'callout',
            title: 'Aperture',
            body: 'Enter the aperture in millimeters. Aperture determines light gathering ability and is used in imaging calculations.',
            target: '#telescope-aperture',
            position: 'left',
            waitFor: 'next',
            highlight: true
        },
        {
            id: 'telescope-multiplier',
            type: 'callout',
            title: 'Focal Multiplier',
            body: 'The power of any flattener, reducer, or barlow in the optical train. Use <strong>1.0</strong> if none. A 0.8× reducer would be entered as <strong>0.8</strong>; a 2× barlow as <strong>2.0</strong>.',
            target: '#telescope-multiplier',
            position: 'bottom',
            waitFor: 'next',
            highlight: true
        },
        {
            id: 'telescope-save',
            type: 'callout',
            title: 'Save Telescope',
            body: 'Click <strong>Save Telescope</strong> to save your entry. The telescope will appear in the Saved Telescopes list below.',
            target: '#equipment-save-telescope-btn',
            position: 'bottom',
            waitFor: 'next',
            highlight: true
        },
        {
            id: 'telescope-list',
            type: 'callout',
            title: 'Saved Telescopes',
            body: 'Your saved telescopes appear here. You can delete any entry.',
            target: '#telescope-list',
            position: 'top',
            waitFor: 'next',
            highlight: 'flash'
        },
        {
            id: 'do-the-rest',
            type: 'callout',
            title: 'Sensors and Filters',
            body: 'Switch to the <strong>Sensors</strong> and <strong>Filters</strong> tabs to manage those equipment types — no need to close and reopen the dialog.  The same pattern applies to adding and deleting Sensors and Filters tabs. If you need to change any of the information, simply delete the equipment and add a new item with the updated information.',
            target: '#telescope-list',
            position: 'top',
            waitFor: 'next',
            highlight: 'flash'
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

        // --- Manage Observer Locations ---
        {
            id: 'manage-locations-intro',
            type: 'modal',
            title: 'Manage Observer Locations',
            body: 'Open <strong>Admin Tools → Manage Observer Locations</strong>. Click Next when the dialog is open.',
            target: null,
            position: 'center',
            waitFor: 'next',
            highlight: false
        },
        {
            id: 'location-name',
            type: 'callout',
            title: 'Location Name',
            body: 'Give each observing site a descriptive name — for example <em>Backyard</em> or <em>Dark Sky Park</em>.',
            target: '#manage-location-name',
            position: 'right',
            waitFor: 'next',
            highlight: true
        },
        {
            id: 'location-overview',
            type: 'modal',
            title: 'Important Parameters',
            body: 'The remaining values drive all rise/set and visibility calculations so it is very important that these are as accurate as possible.',
            target: null,
            position: 'center',
            waitFor: 'next',
            highlight: false
        },
        {
            id: 'location-timezone',
            type: 'callout',
            title: 'Timezone',
            body: 'Enter the timezone offset in hours from UTC. Locations west of the UTC meridian are negative. Locations east are positive',
            target: '#manage-timezone',
            position: 'bottom',
            waitFor: 'next',
            highlight: true
        },
        {
            id: 'location-bortle',
            type: 'callout',
            title: 'Bortle Scale',
            body: 'The Bortle scale rates sky darkness from 1 (darkest) to 9 (inner city). This value is used in daily visibility and target scoring.<br><br>If you do not know the Bortle value for your location. Create your location and use the <strong>Utilities >> Light Pollution</strong> link to identify your Bortle value. You can then edit your location to update it. ',
            target: '#manage-bortle',
            position: 'left',
            waitFor: 'next',
            highlight: true
        },
        {
            id: 'location-coords',
            type: 'callout',
            title: 'Coordinates & Elevation',
            body: 'Enter the latitude and longitude in decimal degrees (south and west are negative), and the elevation in meters.',
            target: '#manage-longitude',
            position: 'bottom',
            waitFor: 'next',
            highlight: false
        },
        {
            id: 'location-horizon',
            type: 'callout',
            title: 'Horizon Profile',
            body: 'Optionally enter a custom horizon profile — one point per line as <em>Azimuth Elevation</em> in integer degrees. This lets Astryx account for obstructions like trees or buildings when computing visibility windows.',
            target: '#manage-horizon',
            position: 'top',
            waitFor: 'next',
            highlight: true
        },
        {
            id: 'location-list',
            type: 'callout',
            title: 'Saved Locations',
            body: 'Your saved locations appear here. You can edit or delete any entry.',
            target: '#location-list',
            position: 'top',
            waitFor: 'next',
            highlight: 'flash'
        },
        {
            id: 'location-close',
            type: 'callout',
            title: 'Close Observer Locations',
            body: 'Close the <strong>Manage Locations</strong> dialog.',
            target: '#modal-close',
            position: 'left',
            waitFor: 'click',
            highlight: true
        },

        // --- Database Operations ---
        {
            id: 'database-ops-intro',
            type: 'modal',
            title: 'Target Database Operations',
            body: 'The remaining three Admin Tools manage the target database itself: importing new data, checking for updates, and clearing targets when needed.',
            target: null,
            position: 'center',
            waitFor: 'next',
            highlight: false
        },
        {
            id: 'admin-submenu-2',
            type: 'callout',
            title: 'Database Operations',
            body: 'Open the system menu (☰) and expand <strong>Admin Tools</strong> again. The bottom three items — <strong>Clear All Targets</strong>, <strong>Check for Target Updates</strong>, and <strong>Merge New Targets</strong> — manage the target database.',
            target: null,
            position: 'center',
            width: '450px',
            waitFor: 'next',
            highlight: false
        },
        {
            id: 'clear-all-targets',
            type: 'modal',
            title: 'Clear All Targets',
            body: '<strong>Clear All Targets</strong> permanently removes every target from the database. Use this only when performing a full database replacement. You will be prompted to confirm before any data is deleted.<br><br>Before using this operation, we strongly recommend that you do a target database backup using the <strong>Backup</strong> command located in the system menu.',
            target: null,
            position: 'center',
            waitFor: 'next',
            highlight: false
        },
        {
            id: 'check-updates',
            type: 'modal',
            title: 'Check for Target Updates',
            body: '<strong>Check for Target Updates</strong> compares your current database version against the latest available update. Use this periodically to see if a newer database is available. If it is available, it will be automagically installed.<br><br>If you are running Astryx in local mode, rather than using the <em>astryx.tools</em> website, this operation does not work.<br><br>Note that database updates will be very rare.',
            target: null,
            position: 'center',
            waitFor: 'next',
            highlight: false
        },
        {
            id: 'import-targets',
            type: 'modal',
            title: 'Import Target Database',
            body: 'This operation is intended to be used when using Astryx in local mode. When running from <strong>https://astryx.tools</strong>, target database, if they occur, are handled automatically. <strong>Import Target Database</strong> reads an Astryx CSV file and adds new targets without removing your existing data. Use this to update to a newer database while preserving your pinned targets, to-do list, and imaging logs. Because this will interfere with automatic updates, this capability is currently disabled.',
            target: null,
            position: 'center',
            waitFor: 'next',
            highlight: false
        },

        // --- Complete ---
        {
            id: 'complete',
            type: 'modal',
            title: 'Admin Tools Complete',
            body: 'You now know how to configure your equipment and locations, compute best months for your observing sites, and keep your target database up to date. That completes all of the Astryx tutorials — happy imaging!',
            target: null,
            position: 'center',
            waitFor: 'next',
            highlight: false
        }
    ]
};

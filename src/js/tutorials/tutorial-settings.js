/**
 * tutorial-settings.js
 * "Configuring Settings" tutorial definition.
 * Covers: DST Mode, Min Altitude, Filter defaults, and Auto-backup.
 *
 * Modal — use when there's no specific element to point at (introductions,
 * transitions, instructions to navigate somewhere)
 * Callout — use when you can point at a specific element in the current DOM
 */

const TUTORIAL_SETTINGS = {
    id: 'settings',
    title: 'Configuring Settings',
    version: 1,
    nextTutorial: 'admin-tools',
    steps: [
        {
            id: 'welcome',
            type: 'modal',
            title: 'Configuring Settings',
            body: 'This tutorial walks you through the key settings that control how Astryx behaves. It takes about 3 minutes.',
            target: null,
            position: 'center',
            waitFor: 'next',
            highlight: false
        },
        {
            id: 'open-settings',
            type: 'callout',
            title: 'Open Settings',
            body: 'Open the system menu (☰) in the top right of the sidebar header and click <strong>Settings</strong>. Click Next when the Settings panel is open.',
            target: '#system-menu-btn',
            position: 'left',
            width: '175px',
            waitFor: 'next',
            highlight: true
        },
        {
            id: 'dst-mode',
            type: 'callout',
            title: 'DST Mode',
            body: 'Controls how Astryx handles Daylight Saving Time. Leave this on <strong>Automatic</strong> unless your region does not observe DST or you need custom start and end dates.',
            target: '#dst-mode',
            position: 'right',
            waitFor: 'next',
            highlight: true
        },
        {
            id: 'min-altitude',
            type: 'callout',
            title: 'Min Altitude',
            body: 'The global minimum altitude used across all analysis tools. Objects below this angle above the horizon are excluded from calculations. Can be overridden in some tools.',
            target: '#global-min-altitude',
            position: 'left',
            waitFor: 'next',
            highlight: true
        },
        {
            id: 'filter-min-size',
            type: 'callout',
            title: 'Min Target Size',
            body: 'The default minimum angular size in arcminutes applied when using the Target Filter. This value can be overwritten in the Filter Targets panel. Valid range: 0.1 to 999.',
            target: '#filter-min-size',
            position: 'right',
            waitFor: 'next',
            highlight: true
        },
        {
            id: 'filter-max-mag',
            type: 'callout',
            title: 'Max Magnitude',
            body: 'The default maximum magnitude applied when using the Target Filter. This value can be overwritten in the Filter Targets panel. Valid range: -5 to 20.',
            target: '#filter-max-mag',
            position: 'left',
            waitFor: 'next',
            highlight: true
        },
        {
            id: 'auto-backup',
            type: 'callout',
            title: 'Automatic Backups',
            body: 'When enabled, Astryx automatically backs up your data to the default location after any change to settings, locations, equipment, targets, or imaging records.',
            target: '#auto-backup-enabled',
            position: 'right',
            waitFor: 'next',
            highlight: true
        },
        {
            id: 'backup-delay',
            type: 'callout',
            title: 'Backup Delay',
            body: 'The number of minutes Astryx waits after your last change before triggering an automatic backup. This prevents excessive backups during active use. The timer resets if there is another change before the backup is performed.',
            target: '#backup-delay-minutes',
            position: 'right',
            waitFor: 'next',
            highlight: true
        },
        {
            id: 'complete',
            type: 'modal',
            title: 'Settings Complete',
            body: 'You now know how to configure Astryx for your location, equipment, and workflow. These settings take effect immediately and are saved automatically.',
            target: null,
            position: 'center',
            waitFor: 'next',
            highlight: false
        }
    ]
};

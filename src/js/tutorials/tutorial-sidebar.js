/**
 * tutorial-sidebar.js
 * "The Sidebar" tutorial definition.
 * Covers: system menu, location, theme, current target, and all nav items.
 *
 * Modal — use when there's no specific element to point at (introductions,
 * transitions, instructions to navigate somewhere)
 * Callout — use when you can point at a specific element in the current DOM
 */

const TUTORIAL_SIDEBAR = {
    id: 'sidebar',
    title: 'The Sidebar',
    version: 1,
    nextTutorial: 'target-search',
    steps: [
        {
            id: 'welcome',
            type: 'modal',
            title: 'Controls and Navigation',
            body: 'This tutorial walks you through each control and navigation item accessible from the left hand side sidebar. The sidebar includes menus for setting preferences and administrative tasks, dropdowns to set your preferred color theme and imaging location, and buttons that navigate to analysis and display tools to help you define and plan your imaging sessions.<br><br>Note that by clicking the left-facing arrow at the top of the sidebar, you can collapse it so the main viewing area becomes larger. This tutorial takes about 8 minutes.',
            target: null,
            position: 'center',
            waitFor: 'next',
            highlight: false
        },
        {
            id: 'sidebar',
            type: 'callout',
            title: 'The Sidebar',
            body: 'You access almost all the settings and navigation controls from the sidebar. It is divided into two primary sections, the header panel and the navigation panel.',
            target: '.sidebar',
            position: 'right',
            waitFor: 'next',
            highlight: 'flash'
        },
        {
            id: 'header',
            type: 'callout',
            title: 'Sidebar Header',
            body: 'The sidebar header contains controls that determine the settings Astryx will use as you plan your imaging sessions. ',
            target: '.sidebar-header',
            position: 'right',
            waitFor: 'next',
            highlight: true
        },
        {
            id: 'system',
            type: 'callout',
            title: 'System Menu',
            body: 'The system menu (☰) provides access to settings, administrative operations, and information about Astryx. Click it now to see the options.',
            target: '#system-menu-btn',
            position: 'left',
            width: '170px',
            waitFor: 'next',
            highlight: true
        },
        {
            id: 'theme',
            type: 'callout',
            title: 'Theme',
            body: 'Select the style and colour theme of the interface. Astryx includes Dark, Light, Matrix, Flat, and Night themes. The Night theme is designed to preserve your dark adaptation at the telescope. Try different options and select your favorite. It can be changed at any time.',
            target: '#theme-select',
            position: 'right',
            waitFor: 'next',
            highlight: true
        },
        {
            id: 'location',
            type: 'callout',
            title: 'Observer Location',
            body: 'Select the location from which your imaging will take place. All visibility and observability calculations use this location. You can manage locations from the system menu → Admin Tools → Manage Observer Locations.<br><br>If you add a new location, the first time you select it here, the <em>Best Month</em> calculation will automagically execute.',
            target: '#sidebar-location-select',
            position: 'right',
            waitFor: 'next',
            highlight: true
        },
        {
            id: 'current-target',
            type: 'callout',
            title: 'Current Target',
            body: 'Displays the currently selected target. Once the <strong>Current Target</strong> is set, all analysis tools operate on the target. You set the <strong>Current Target</strong> by selecting a result from <strong>Target Search</strong>, <strong>Filter Targets</strong>, or the <strong>Pinned Targets</strong> list.<br><br>You can click the <strong>Current Target</strong> label directly to open the Detail panel for that target.',
            target: '#sidebar-current-target',
            position: 'right',
            waitFor: 'next',
            highlight: true
        },
        {
            id: 'target-selection',
            type: 'callout',
            title: 'Target Selection',
            body: 'Search and filter the target database of thousands of deep-sky objects. Pin targets for quick access and imaging sessions planning or add them to your To Do list from the Detail panel.<br><br>Once you create a <strong>To Do List</strong>, you can use it for searches and filters instead of the entire target database.',
            target: '#sidebar-target-selection',
            position: 'right',
            waitFor: 'next',
            highlight: true
        },
        {
            id: 'todo-list',
            type: 'callout',
            title: 'To Do List',
            body: 'Display and manage the personal queue of targets you plan to image. View and sort the list in various formats.',
            target: '#sidebar-to-do-list',
            position: 'right',
            waitFor: 'next',
            highlight: true
        },
        {
            id: 'yearly-observability',
            type: 'callout',
            title: 'Yearly Observability',
            body: 'Compute and view the observability of the current target for the next 12 months to identify the best times for imaging.',
            target: '#sidebar-yearly-observability',
            position: 'right',
            waitFor: 'next',
            highlight: true
        },
        {
            id: 'daily-visibility',
            type: 'callout',
            title: 'Daily Visibility',
            body: 'The visibility chart analyzes the entire night based on a combination of sky darkness, target altitude, and moon proximity. The graphical view gives you an immediate understanding of the best imaging windows.',
            target: '#sidebar-daily-visibility',
            position: 'right',
            waitFor: 'next',
            highlight: true
        },
        {
            id: 'viewfinder',
            type: 'callout',
            title: 'Viewfinder',
            body: 'View a DSS2/color sky survey image of the current target overlaid with your field of view based on the selected telescope and sensor. Rotation tools help you frame your target.',
            target: '#sidebar-viewfinder',
            position: 'right',
            waitFor: 'next',
            highlight: true
        },
        {
            id: 'target-optimizer',
            type: 'callout',
            title: 'Target Optimizer',
            body: 'Based on your location and equipment, <strong>Target Optimizer</strong> generates a ranked set of individual targets and target combinations best suited for imaging on a specified night. You can use your <strong>To Do List</strong> as the source or use the result of <strong>Filter Targets</strong>.<br><br>Use the <strong>Send to Optimizer</strong> button in the <strong>Filter Targets</strong> results to copy the results for use in the optimizer.',
            target: '#sidebar-target-optimizer',
            position: 'right',
            waitFor: 'next',
            highlight: true
        },
        {
            id: 'sequence-planner',
            type: 'callout',
            title: 'Sequence Planner',
            body: 'Using your <strong>Pinned Targets</strong>, the <strong>Sequence Planner</strong> generates an optimal imaging sequence for a specified night, including timing, duration, and ordering recommendations.<br><br>It takes into account overhead times associated with autofocusing, calibration, and meridian flips, as well as target set times. If enabled, it can provide additional optimization by juggling target order and time allocation between targets.',
            target: '#sidebar-sequence-planner',
            position: 'right',
            waitFor: 'next',
            highlight: true
        },
        {
            id: 'imaging-log',
            type: 'callout',
            title: 'Imaging Log',
            body: 'Track and report on your imaging projects, sessions, and target lists. Keep a record of what you have imaged and when.',
            target: '#sidebar-imaging-log',
            position: 'right',
            waitFor: 'next',
            highlight: true
        },
        {
            id: 'utilities',
            type: 'callout',
            title: 'Utilities',
            body: 'Access supplementary tools including cloud cover forecasts, light pollution maps, analysis of ASIAIR session and guide logs, and dust mote management.',
            target: '#sidebar-utilities',
            position: 'right',
            waitFor: 'next',
            highlight: true
        },
        {
            id: 'complete',
            type: 'modal',
            title: 'Sidebar Complete',
            body: 'You now know your way around the Astryx sidebar. Click <em>Next</em> to continue.',
            target: null,
            position: 'center',
            waitFor: 'next',
            highlight: false
        }
    ]
};

/**
 * tutorial-imaging-projects.js
 * "Imaging Log — Projects" tutorial definition.
 * Covers: navigating to the Imaging Log, the Projects tab, project cards
 * (status badge, targets, sessions, integration time), expanding sessions,
 * creating a project, the session modal (equipment, moon & conditions,
 * acquisition), Calculate Moon Data, integration time calculation,
 * editing and deleting projects and sessions, and the status workflow.
 *
 * Modal  — use when there's no specific element to point at
 * Callout — use when pointing at a specific element in the current DOM
 */

const TUTORIAL_IMAGING_PROJECTS = {
    id: 'imaging-projects',
    title: 'Imaging Projects',
    version: 1,
    nextTutorial: null,
    steps: [

        // --- Introduction ---
        {
            id: 'welcome',
            type: 'modal',
            title: 'Imaging Projects',
            body: 'This tutorial walks you through the Projects section of the Imaging Log — the tool that records what you have imaged, when you imaged it, and how much data you have collected for each target.<br><br>A <strong>Project</strong> is a long-running effort to image one or more related targets. Within each project you record individual <strong>Imaging Sessions</strong> — each representing one night at the telescope. It takes about 10 minutes.',
            target: null,
            position: 'center',
            waitFor: 'next',
            highlight: false
        },
        {
            id: 'open-imaging-log',
            type: 'callout',
            title: 'Open Imaging Log',
            body: 'Click <strong>Imaging Log</strong> in the left navigation panel to open the view.',
            target: '#sidebar-imaging-log',
            position: 'right',
            waitFor: 'click',
            highlight: true
        },
        {
            id: 'tabs',
            type: 'callout',
            title: 'Imaging Log Tabs',
            body: 'The Imaging Log is divided into three tabs. <strong>Projects</strong> is where you manage your imaging projects and their sessions. <strong>Programs</strong> tracks structured observing programs like imaging the full Messier catalog. <strong>Reports</strong> gives you a summary of your progress across catalogs, programs, and projects.<br><br>We are focused on Projects for this tutorial.',
            target: '.imaging-log-tabs',
            position: 'bottom',
            waitFor: 'next',
            highlight: true
        },

        // --- Projects toolbar ---
        {
            id: 'toolbar',
            type: 'callout',
            title: 'Projects Toolbar',
            body: 'The toolbar at the top of the Projects tab gives you three ways to find projects quickly. The <strong>Search</strong> field filters by project name or target designation — useful when you have many projects. The <strong>Status</strong> filter limits the list to projects in a specific stage of your workflow. <strong>Sort By</strong> controls the order of the list.',
            target: '.imaging-log-filters',
            position: 'bottom',
            width: '420px',
            waitFor: 'next',
            highlight: true
        },
        {
            id: 'status-filter-default',
            type: 'callout',
            title: 'Default Status Filter',
            body: 'The Status filter defaults to <strong>All But Completed</strong>. This keeps your active projects front and center while hiding finished ones — the most common working view. Switch to <strong>All Statuses</strong> or <strong>Completed</strong> when you want to review finished work.',
            target: '#imaging-log-project-status-filter',
            position: 'bottom',
            waitFor: 'next',
            highlight: true
        },

        // --- Project cards ---
        {
            id: 'project-card',
            type: 'callout',
            title: 'Project Cards',
            body: 'Each project appears as a card in the list. The card shows the project name, the number of targets and imaging sessions recorded, the total integration time broken down by filter, the current status, and the date the project was last modified.',
            target: '#imaging-log-projects-list',
            position: 'top',
            waitFor: 'next',
            highlight: 'flash'
        },
        {
            id: 'integration-time',
            type: 'callout',
            title: 'Integration Time',
            body: 'The integration time shown on each project card is the total accumulated imaging time across all sessions, broken down by filter. For example, a project might show <em>L: 4.2h &nbsp; R: 1.5h &nbsp; G: 1.5h &nbsp; B: 1.5h</em>.<br><br>Integration time is calculated automatically from the session data — specifically from the number of used exposures and sub length recorded in each session. Only filters with recorded time are shown.',
            target: '.imaging-session-integration',
            position: 'right',
            waitFor: 'next',
            highlight: true
        },
        {
            id: 'status-badge',
            type: 'callout',
            title: 'Project Status',
            body: 'Each project carries a status that reflects where it is in your imaging workflow:<br><br><strong>Planning</strong> — you have identified the target but not yet started imaging.<br><br><strong>Acquiring Data</strong> — you are actively collecting frames across one or more sessions.<br><br><strong>Acquisition Complete</strong> — you have collected enough data and are done imaging.<br><br><strong>Processing</strong> — the data is being stacked, calibrated, and processed.<br><br><strong>Completed</strong> — the project is finished. Completed projects are hidden by default in the project list.',
            target: '.project-status-badge',
            position: 'bottom',
            width: '550px',
            waitFor: 'next',
            highlight: true
        },
        {
            id: 'new-project',
            type: 'callout',
            title: 'Creating a Project',
            body: 'Click <strong>+ New Project</strong> to create a new imaging project. You will be asked for a name, status, one or more targets, and optional notes.',
            target: '#imaging-log-new-project-btn',
            position: 'right',
            waitFor: 'click',
            highlight: true
        },
        {
            id: 'project-name',
            type: 'callout',
            title: 'Project Name and Status',
            body: 'Give the project a descriptive name — typically the target or region you are imaging, for example <em>Horsehead Nebula Region</em> or <em>M42 LRGB</em>.<br><br>Set the initial status to <strong>Planning</strong> if you have not yet started imaging, or <strong>Acquiring Data</strong> if you are ready to log your first session.',
            target: '#project-name',
            position: 'bottom',
            waitFor: 'next',
            highlight: true
        },
        {
            id: 'project-targets',
            type: 'callout',
            title: 'Adding Targets to a Project',
            body: 'Search for targets by designation or common name and click a result to add it. A project can contain multiple targets — useful for mosaic panels or wide fields of view where multiple targets can be captured.<br><br>The targets you add are used by the Reports tab to track catalog coverage and by Programs to measure your progress toward structured observing goals.',
            target: '#project-target-search',
            position: 'top',
            waitFor: 'next',
            highlight: 'flash'
        },
        {
            id: 'project-notes',
            type: 'callout',
            title: 'Project Notes',
            body: 'The Notes field is a free-form area for anything relevant to the project — your imaging plan, equipment notes, processing ideas, or observations about past sessions. It supports Markdown formatting so you can use headings, bold text, and lists to organise longer notes.<br><br>Use the <strong>Expand</strong> button to enlarge the notes area when writing longer entries.',
            target: '#project-notes',
            position: 'top',
            waitFor: 'next',
            highlight: true
        },
        {
            id: 'save-new-project',
            type: 'callout',
            title: 'Save the New Project',
            body: 'Save the project you just created.',
            target: '#modal-save-btn',
            position: 'bottom',
            waitFor: 'click',
            highlight: true
        },
        {
            id: 'open-session-list',
            type: 'callout',
            title: 'Open Session List',
            body: 'Click anywhere on the new project card to expand the sessions list.',
            target: '#imaging-log-projects-list',
            position: 'center',
            waitFor: 'click',
            highlight: false
        },
        {
            id: 'add-session',
            type: 'callout',
            title: 'Adding a Session',
            body: 'When the sessions section is expanded, an <strong>+ Add Session</strong> button appears. Click it to record a new imaging session for that project.<br><br> The session form pre-fills several fields from the most recent session for that project, saving you from re-entering your equipment setup each time.',
            target: '.add-session-btn',
            position: 'left',
            waitFor: 'click',
            highlight: true
        },
        {
            id: 'session-modal-intro',
            type: 'modal',
            title: 'Recording an Imaging Session',
            body: 'Each imaging session captures a detailed record of one night at the telescope. The session form is divided into three sections: <strong>Equipment</strong>, <strong>Moon & Conditions</strong>, and <strong>Acquisition</strong>.<br><br>When you add a new session to a project that already has sessions, the form pre-fills the equipment fields from the most recent session — you only need to update what changed.',
            target: null,
            position: 'center',
            waitFor: 'next',
            highlight: false
        },
        {
            id: 'session-equipment-1',
            type: 'callout',
            title: 'Equipment Section',
            body: 'Records the setup used for this session: date, location, telescope, sensor, filter, camera rotation, sensor cooling temperature, binning, gain, and offset.<br><br>Telescope, sensor, and filter options are drawn from the equipment you have entered in Admin Tools. If a filter you used is not in the list, you can type a new name directly — it will be added automatically.<br><br>Rotation, gain, and offset are for reference — they help you match sessions when stacking frames across multiple nights.',
            target: '#new-session-equipment',
            position: 'bottom',
            width: '450px',
            waitFor: 'next',
            highlight: true
        },
        {
            id: 'session-moon',
            type: 'callout',
            title: 'Moon & Conditions Section',
            body: 'Records the moon situation and sky conditions for the session.<br><br>Click <strong>Calculate Moon Data</strong> to automatically fill moon rise and set times, illumination percentage, and the angular separation between the moon and your target — all calculated from the session date, location, and the first target in the project.<br><br>Clouds, smoke, seeing, and transparency are qualitative assessments you enter yourself after the session. These build a historical record of your site conditions over time.',
            target: '#new-session-conditions',
            position: 'top',
            width: '400px',
            waitFor: 'next',
            highlight: true
        },
        {
            id: 'session-acquisition',
            type: 'callout',
            title: 'Acquisition Section',
            body: 'Records the exposure data collected during the session.<br><br><strong>Sub Length</strong> — the duration of each individual exposure in seconds.<br><br><strong>Original Exposures</strong> — how many frames you captured before any quality rejection.<br><br><strong>Used</strong> — how many frames you kept after rejection. Leave blank if you have not yet reviewed the frames.<br><br><strong>Integration Time</strong> is calculated automatically from Used × Sub Length and updates as you type. This is the value that accumulates toward the project total shown on the project card.<br><br>Note that if you leave the number of used subs blank, it will use the number of original exposures towards the integration shown in the project header. This will update if you enter the used subs in the future.',
            target: '#new-session-acquisiton',
            position: 'top',
            width: '450px',
            waitFor: 'next',
            highlight: true
        },
        {
            id: 'new-session-save',
            type: 'callout',
            title: 'Save the New Session',
            body: 'Save the new imaging session.',
            target: '#modal-save-btn',
            position: 'left',
            width: '450px',
            waitFor: 'click',
            highlight: true
        },
        {
            id: 'edit-delete',
            type: 'callout',
            title: 'Editing and Deleting',
            body: 'Each project card has <strong>Edit Project</strong> and <strong>Delete Project</strong> buttons. Edit opens the project form pre-filled with current data. Delete permanently removes the project and all its sessions — a confirmation is required.<br><br>Individual sessions can be edited by clicking their row in the expanded sessions table, or deleted with the Delete button in the Actions column.',
            target: '.project-card-actions',
            position: 'left',
            width: '420px',
            waitFor: 'next',
            highlight: false
        },
        {
            id: 'workflow',
            type: 'modal',
            title: 'Typical Projects Workflow',
            body: 'A typical workflow for a new imaging project:<br><br>1. Click <strong>+ New Project</strong> and give it a name and target<br>2. Set status to <strong>Planning</strong> or <strong>Acquiring Data</strong><br>3. After each imaging session, expand the project card and click <strong>+ Add Session</strong><br>4. Fill in equipment, click <strong>Calculate Moon Data</strong>, enter sky conditions<br>5. Enter sub length, original and used exposure counts<br>6. Update project status as the project progresses<br>7. When you have enough data, set status to <strong>Acquisition Complete</strong> and later to <strong>Processing</strong> or <strong>Completed</strong><br><br>Over time your Imaging Log becomes a complete history of everything you have imaged, with total integration times and conditions for every session.',
            target: null,
            position: 'center',
            waitFor: 'next',
            highlight: false
        },
        {
            id: 'complete',
            type: 'modal',
            title: 'Imaging Log: Projects Complete',
            body: 'You can now create and manage imaging projects, record detailed session data, track integration time by filter, and follow a project from Planning through to Completed.<br><br>Continue with the <strong>Programs</strong> tutorial to learn how to track structured observing programs, or explore the <strong>Reports</strong> tab to see a summary of your imaging history across catalogs and programs.',
            target: null,
            position: 'center',
            waitFor: 'next',
            highlight: false
        }
    ]
};

/**
 * tutorial-sequence-planner.js
 * "Sequence Planner" tutorial definition.
 * Covers: navigating to the view, session settings (date, start time,
 * location, min altitude, horizon), overhead settings (autofocus, flip,
 * calibration, between subs), collapsible sections, target allocation
 * (exposure time, sliders, drag to reorder), Reset & Optimize, the
 * timeline visualization, the Imaging Plan results, and warnings.
 *
 * Modal  — use when there's no specific element to point at
 * Callout — use when pointing at a specific element in the current DOM
 */

const TUTORIAL_SEQUENCE_PLANNER = {
    id: 'sequence-planner',
    title: 'Sequence Planner',
    version: 1,
    nextTutorial: null,
    steps: [

        // --- Introduction ---
        {
            id: 'welcome',
            type: 'modal',
            title: 'Sequence Planner',
            body: 'This tutorial walks you through the Sequence Planner — the tool that turns your list of pinned targets into a concrete imaging schedule for a specific night.<br><br>It calculates when each target is visible, divides the available imaging time among them, accounts for autofocus runs and meridian flips, and produces a timeline and written plan you can take to the telescope. It takes about 10 minutes.<br><br>To more fully understand the benefits of Sequence Planner, we encourage you to Pin two or three targets that are visible at the same time before you start the tutorial.',
            target: null,
            position: 'center',
            waitFor: 'next',
            highlight: false
        },
        {
            id: 'open-seqplan',
            type: 'callout',
            title: 'Open Sequence Planner',
            body: 'Click <strong>Sequence Planner</strong> in the left navigation panel to open the view.',
            target: '#sidebar-sequence-planner',
            position: 'right',
            waitFor: 'click',
            highlight: true
        },
        {
            id: 'overview',
            type: 'modal',
            title: 'How the Sequence Planner Works',
            body: 'The Sequence Planner works in three steps:<br><br>1. You configure the <strong>Session Settings</strong> — date, location, start time, and visibility constraints.<br><br>2. You set the <strong>Overhead Settings</strong> — autofocus intervals, meridian flip parameters, calibration time, and the gap between exposures.<br><br>3. The planner calculates each target\'s available imaging window, divides time among them using the <strong>Target Allocation</strong> controls, and produces a <strong>Timeline</strong> and <strong>Imaging Plan</strong> you can follow at the telescope.',
            target: null,
            position: 'center',
            waitFor: 'next',
            highlight: false
        },

        // --- Session Settings ---
        {
            id: 'session-settings-card',
            type: 'callout',
            title: 'Session Settings',
            body: 'The Session Settings card contains everything that defines the boundaries of your imaging session — when it starts, where you are observing from, and how high a target must be before you will image it.<br><br>Click the header to collapse or expand this card once you have your settings configured.',
            target: '#seqplan-session-settings',
            position: 'bottom',
            width: '400px',
            waitFor: 'next',
            highlight: true
        },
        {
            id: 'date',
            type: 'callout',
            title: 'Observation Date',
            body: 'Set the date of your imaging session. The planner uses this to calculate dusk and dawn times, meridian transit times, and target rise and set times for your location.',
            target: '#seq-plan-date',
            position: 'bottom',
            waitFor: 'next',
            highlight: true
        },
        {
            id: 'start-time',
            type: 'callout',
            title: 'Session Start Time',
            body: '<strong>Dusk</strong> starts the session at the end of astronomical twilight — the earliest time imaging is practical. <strong>Custom</strong> lets you enter a later start time, for example if you cannot be at your site until midnight.',
            target: '#seq-plan-start-time',
            position: 'bottom',
            waitFor: 'next',
            highlight: true
        },
        {
            id: 'location',
            type: 'callout',
            title: 'Location',
            body: 'Select the observation site you will be imaging from. The planner uses your location\'s latitude, longitude, elevation, and horizon profile for all calculations. Locations are managed in Admin Tools.',
            target: '#seq-plan-location',
            position: 'bottom',
            waitFor: 'next',
            highlight: true
        },
        {
            id: 'min-altitude',
            type: 'callout',
            title: 'Minimum Altitude',
            body: 'The minimum elevation above the horizon a target must reach before the planner will schedule imaging time for it. Targets below this threshold are still tracked but excluded from the active imaging window.<br><br>Higher values restrict imaging to times when targets are through less atmosphere, improving image quality but shortening available windows.',
            target: '#seq-plan-min-altitude',
            position: 'bottom',
            waitFor: 'next',
            highlight: true
        },
        {
            id: 'use-horizon',
            type: 'callout',
            title: 'Use Horizon Profile',
            body: 'When set to Yes, the planner applies the custom horizon profile stored for your selected location — accounting for trees, buildings, or terrain. Periods when a target is blocked by the horizon are flagged as warnings in the Imaging Plan.<br><br>Set to No to treat the horizon as perfectly flat. If your location has no horizon profile defined, this setting has no effect.',
            target: '#seq-plan-use-horizon',
            position: 'bottom',
            waitFor: 'next',
            highlight: true
        },

        // --- Overhead Settings ---
        {
            id: 'overhead-intro',
            type: 'callout',
            title: 'Overhead Settings',
            body: 'Below the session settings is the overhead configuration — the time costs that reduce your net imaging time each night. These include autofocus runs, meridian flips, calibration for guiding, and the gap between individual exposures. The planner subtracts these from the available window when calculating how many exposures you can collect.',
            target: '#seqplan-overhead-settings',
            position: 'bottom',
            width: '420px',
            waitFor: 'next',
            highlight: true
        },
        {
            id: 'autofocus',
            type: 'callout',
            title: 'Autofocus',
            body: 'When enabled, the planner schedules periodic autofocus runs throughout the session. If enabled, autofocus is always assumed at the start of each new target and after a meridian flip, as well as the scheduled intervals.<br><br><strong>AF Interval</strong> — the interval between autofocus events in minutes<br><br><strong>AF Duration</strong> — how many minutes each autofocus routine takes. This time is subtracted from imaging time.',
            target: '.seq-plan-overhead-row-1',
            position: 'bottom',
            width: '420px',
            waitFor: 'next',
            highlight: true
        },
        {
            id: 'meridian-flip',
            type: 'callout',
            title: 'Meridian Flip',
            body: 'When a target crosses the meridian on an equatorial mount, the mount must flip to keep tracking. The planner models this automatically.<br><br><strong>Flip Pause</strong> — time before the meridian the mount stops imaging to prepare for the flip.<br><br><strong>Flip Duration</strong> — time the flip and re-centering takes.<br><br><strong>Flip Offset</strong> — how far past the meridian the flip actually occurs. Combined, these define the total time lost around a meridian crossing.',
            target: '.seq-plan-overhead-row-2',
            position: 'bottom',
            width: '440px',
            waitFor: 'next',
            highlight: true
        },
        {
            id: 'calibration',
            type: 'callout',
            title: 'Guide Calibration and Between Subs',
            body: '<strong>Calibration</strong> — The duration in minutes for guide calibration. Guide Calibration is assumed to run after moving to a new target (including the first) and after each meridian flip.<br><br><strong>Between Subs</strong> — the gap in seconds between consecutive exposures, accounting for download time and dithering recovery. For modern cameras and fast USB connections this is typically 6–12 seconds.',
            target: '.seq-plan-overhead-row-3',
            position: 'bottom',
            width: '420px',
            waitFor: 'next',
            highlight: true
        },
        {
            id: 'Optimization',
            type: 'callout',
            title: 'Additional Optimization',
            body: 'If multiple targets are planned, the <strong>Sequence Planner</strong> performs an initial optimization based on the set time for each target. Additional optimization is performed if enabled by automatically adjusting target ordering and time allocaton. Please see the Help topic for more detailed information.',
            target: '.seq-plan-overhead-row-4',
            position: 'bottom',
            width: '420px',
            waitFor: 'next',
            highlight: true
        },
        {
            id: 'target-allocation-intro',
            type: 'callout',
            title: 'Target Allocation',
            body: 'The Target Allocation card appears after the plan is generated. It shows one row per pinned target and lets you control how imaging time is divided among all the targets.',
            target: '#seqplan-target-allocation',
            position: 'top',
            waitFor: 'next',
            highlight: true
        },
        {
            id: 'exposure-time',
            type: 'callout',
            title: 'Exposure Time',
            body: 'Each target row has an exposure time field in seconds. This is the length of a single sub-frame for that target. Common values are suggested in a dropdown as you type.<br><br>Changing the exposure time recalculates how many exposures fit within the allocated window — a longer exposure means fewer frames but more signal per frame. The planner updates the timeline and results automatically when you change this value.',
            target: '#seqplan-target-allocation',
            position: 'top',
            width: '400px',
            waitFor: 'next',
            highlight: true
        },
        {
            id: 'sliders',
            type: 'callout',
            title: 'Time Allocation Sliders',
            body: 'Each target has a slider that controls what percentage of the total session time is allocated to it. The sliders are linked — increasing one target\'s allocation reduces the others, working from right to left. The rightmost target absorbs changes first.<br><br>The allocation display shows the percentage, the number of exposures, and the exposure length for each target. Adjust sliders to prioritise targets you most want to image, or to account for targets with shorter available windows.',
            target: '#seqplan-target-allocation',
            position: 'top',
            width: '400px',
            waitFor: 'next',
            highlight: true
        },
        {
            id: 'drag-reorder',
            type: 'callout',
            title: 'Reordering Targets',
            body: 'Drag targets by the handle on the left of each row to change their imaging order. The planner initially suggests an order based on when each target sets — targets that drop below the minimum altitude earliest are imaged first, ensuring you capture everything before it becomes unavailable.<br><br>You can override this order by dragging. The timeline and Imaging Plan update immediately to reflect the new sequence.',
            target: '.seq-plan-drag-handle',
            position: 'right',
            position: '400px',
            waitFor: 'next',
            highlight: true
        },
        {
            id: 'reset-optimize',
            type: 'callout',
            title: 'Reset & Optimize',
            body: 'Click <strong>Reset & Optimize</strong> to generate or regenerate the plan. The planner calculates each target\'s available imaging window for the night, orders targets so that those setting earliest are imaged first, and divides the available time equally among them as a starting point.<br><br>Use this button when you want to return to the default allocation.',
            target: '#seq-plan-reset-btn',
            position: 'left',
            waitFor: 'next',
            highlight: true
        },
        {
            id: 'timeline',
            type: 'callout',
            title: 'Timeline',
            body: 'The Timeline shows the full night as a horizontal bar from the specified start time to dawn. Each target is represented by a colored band showing its allocated imaging window. Gaps between bands represent overhead time — autofocus, meridian flips, and target transitions.<br><br>The timeline updates in real time as you adjust sliders, change exposure times, or reorder targets, giving you immediate visual feedback on how the night is structured.<br><br>Scroll down to see the Imaging Plan before clicking Next.',
            target: '#seq-plan-timeline',
            position: 'top',
            scrollTo: true,
            width: '450px',
            waitFor: 'next',
            highlight: 'flash'
        },
        {
            id: 'imaging-plan',
            type: 'callout',
            title: 'Imaging Plan',
            body: 'The Imaging Plan summarises the full session. For each target it shows the start and end time, total imaging duration, and the number of exposures at the selected duration.<br><br>Click a target designator to open its detail view with full sequencing information for the night.',
            target: '#seq-plan-results',
            position: 'top',
            scrollTo: true,
            width: '420px',
            waitFor: 'next',
            highlight: true
        },
        {
            id: 'warnings',
            type: 'callout',
            title: 'Warnings',
            body: 'The Imaging Plan and Timeline flag two types of constraint violations with a ⚠ warning:<br><br><strong>Altitude constraint</strong> — part of a target\'s allocated window falls outside the time it is above the minimum altitude. This can happen when a target rises late or sets early relative to its allocated slot.<br><br><strong>Horizon constraint</strong> — part of the window is blocked by the custom horizon profile at your location.<br><br>Both warnings show the affected time period so you can decide whether to adjust the allocation, reorder targets, or accept the constraint. Short violations of a few minutes are often ignorable; longer ones may warrant adjusting the plan.',
            target: '#seq-plan-timeline',
            position: 'top',
            width: '500px',
            waitFor: 'next',
            highlight: 'flash'
        },
        {
            id: 'workflow',
            type: 'modal',
            title: 'Typical Planning Workflow',
            body: 'A typical Sequence Planner session before an imaging night:<br><br>1. Pin your targets for the night using Target Search, Filter Targets, or the Target Optimizer<br>2. Open Sequence Planner and set the date, location, and start time<br>3. Confirm overhead settings match your equipment setup<br>4. Click <strong>Reset & Optimize</strong> to generate the initial plan<br>5. Review the Timeline — check that all targets have reasonable windows<br>6. Adjust exposure times and sliders to prioritise your most important targets<br>7. Check the Imaging Plan for any warnings and adjust if needed<br>8. Note the start time and sequence for each target<br><br>The plan gives you a clear, tested schedule so you arrive at your session knowing exactly what to image and when.',
            target: null,
            position: 'center',
            waitFor: 'next',
            highlight: false
        },
        {
            id: 'complete',
            type: 'modal',
            title: 'Sequence Planner Complete',
            body: 'You can now configure a session, set overhead parameters, generate and adjust a plan, read the timeline, and interpret the Imaging Plan and its warnings.<br><br>Use it together with the <strong>Target Optimizer</strong> to choose the best targets for the night, and <strong>Daily Visibility</strong> to verify conditions before committing to your plan.',
            target: null,
            position: 'center',
            waitFor: 'next',
            highlight: false
        }
    ]
};

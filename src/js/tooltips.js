/**
 * tooltips.js
 * helper function and tooltip strings to be inserted
 * into HTML elements via keyword
 *
 * Example:
 * const TOOLTIPS = {
 *     limitingMagnitude: 'Show objects brighter than this value\nin the results table'
 * };
 *
 *  <label class="tooltip-host" data-tooltip-key="limitingMagnitude">Limiting Magnitude</label>
 */

/**
 * ilog: imaging log
 * ml:   manage locations
 * sb:   sidebar
 * set:  settings
 * sp:   sequence planner
 * to:   target optimizer
 * ts:   target selection
 */

const TOOLTIPS = {

    ilog_catalogPrefix:     'The catalog designation prefix to match\n— for example NGC, M, or IC. Targets\nwhose designations start with this prefix\nand fall within the maximum number\nare included in the program.',
    ilog_maxNumber:         'The highest catalog number included\nin this program. For example, entering\n110 for prefix M defines the\n110-object Messier program.',
    ilog_programType:       'Catalog Pattern matches targets by\ndesignation prefix and number range,\nuseful for structured programs like\nimaging all NGC objects. Manual List\naccepts an explicit list of existing\ntarget designations.',
    ilog_projectNotes:      'Free-form notes for this project.\nSupports Markdown formatting —\nuse **bold**, *italic*, and - lists.',
    ilog_projectSearch:     'Filter the project list by name.\nPartial matches are supported.',
    ilog_projectSort:       'Controls the order projects\nappear in the list.',
    ilog_projectStatus:     'Tracks where this project is in\nyour workflow. Projects in Completed\nstatus are hidden by default\nin the project list.',
    ilog_projectTargets:    'Search for targets by designation\nor common name and add them to\nthis project. A project can contain\nmultiple targets — useful for mosaic\npanels or related objects\nimaged together.',
    ilog_sessionCalcMoon:   'Automatically fills moon illumination,\nrise/set times, and angle from moon\nusing the session date, location,\nand the first target in the project.',
    ilog_sessionGain:       'Sensor gain setting used during\nthis session. Refer to your camera\ndocumentation for recommended\ngain values for your imaging mode.',
    ilog_sessionOffset:     'Sensor offset (also called pedestal\nor black level) used during this\nsession. Keeps histogram data\noff the left wall.',
    ilog_sessionOriginal:   'Total number of exposures captured\nduring this session before rejection.',
    ilog_sessionRotation:   'Camera rotation angle in degrees\nas reported by your plate solving\nsoftware. Used for reference only.',
    ilog_sessionSubLength:  'Duration of each individual\nexposure in seconds.',
    ilog_sessionTemp:       'Sensor cooling target temperature\nin degrees Celsius. Consistent\ncooling reduces thermal noise and\nimproves frame calibration.',
    ilog_sessionUsed:       'Number of exposures kept after\nquality rejection. Used to calculate\nfinal integration time.',
    ilog_statusFilter:      'Show only projects in the selected\nstatus. All But Completed is the\ndefault — it hides finished projects\nwhile keeping active work visible.',
    ml_bortle:      'Level of light pollution. See Utilities for determining.',
    ml_horizProf:   'Horizon profile of the new location. One point\nper line in Azimuth Elevation order, both\nin integer degrees.',
    ml_tzOffset:    'Timezone offset of the new\nlocation in hours, where west is\nnegative and east is positive',
    sb_system:      'Menu for various settings and administrative operations',
    sb_theme:       'Select the style and theme of\nthe interface',
    sb_location:    'Select the location from which\nimaging will take place',
    sb_currentTgt:  'The currently selected target\nfor analysis operations',
    sb_tgtSelect:   'Search and filter the target database.\n Pin and add objects to To Do list.\n Remove objects from list',
    sb_todoList:    'Display the target To Do list\nin various formats',
    sb_yearlyObs:   'Compute and view the observability\nof the current target over the\nupcoming year',
    sb_dailyVis:    'Compute and view the visibility\nof the current target over\na specified time period',
    sb_fov:         'View a DSS image for the current\ntarget within the specified\nfield of view',
    sb_tgtOpt:      'Generate a set of individual\ntargets and target combinations\nbest suited for viewing\non a specified day',
    sb_seqPlanner:  'Generate an optimal\nimaging sequence for the\npinned targets for a\nspecified day',
    sb_imgLog:      'Track and report on imaging\nprojects, sessions, and\ntarget lists',
    sb_utils:       'Clouds, light pollution, and\ndust motes',
    set_DST:        'Set Daylight Savings Time mode,\nusually leave it on Automatic',
    set_autoBU:     'Automatically back up to the default\nlocation after a change in:\nsettings, locations, telescopes,\nsensors, filters, pinnedTargets,\ntoDoTargets, imagingProjects,\nimagingSessions, imagingPrograms',
    set_backupDelay: 'Minutes after last change before\nmaking an automatic backup\nto the default location',
    set_filterMaxMag: 'Default maximum magnitude\nfor the Target Filter.\nValid range: -5 to 20',
    set_filterMinSize: 'Default minimum target size (arcminutes)\nfor the Target Filter.\nValid range: 0.1 to 999',
    set_minAlt:     'Global minimum altitude for analysis\noperations - can be overriden\nin some cases',
    sp_afCheck:     'Check to enable autofocus events',
    sp_afDuration:  'Duration of an autofocus event',
    sp_afInterval:  'Interval between autofocus events',
    sp_framesPerDither: 'Number of frames between dither events.\nSet to 0 to disable dithering.\nSub gap and dither duration are learned\nautomatically from analyzed session logs.',
    sp_calibration: 'Duration of a guide calibration',
    sp_flipDuration:'Duration of the actual meridian flip',
    sp_flipOffset:  'How many minutes after the target\npasses meridian before the mount starts\nto flip',
    sp_flipPause:   'How long imaging pauses before\nthe mount begins the meridian flip',
    sp_horizon:     'Use the imported or default\nhorizon data',
    sp_location:    'Location the imaging session\nwill take place',
    sp_minAltitude: 'Minimum altitude of a target\nbefore imaging should occur',
    sp_startDate:   'Date of the imaging session',
    sp_startTime:   'Time the imaging session will start',
    to_date:        'Date of the imaging session',
    to_findTargets: 'Generate optimal targets and target\ncombinations from source data',
    to_source:      'Source of data to use',
    to_startTime:   'Start of the imaging session',
    ts_PIN:         'Add current target to the Pinned\nTargets list',
    ts_catalog:     'Include objects from the selected\ncatalog(s)',
    ts_createIP:    'Create Imaging Program from\nthe results',
    ts_limitMag:    'Show objects brighter than this\nvalue (lower number = brighter).\nLeave blank to disable filtering',
    ts_minSize:     'Exclude objects smaller than the\nentered value. Leave blank to disable\n filtering',
    ts_month:       'Include objects observable in the\nselected month',
    ts_sendOpt:     'Use the results in the\nTarget Optimizer',
    ts_tgtName:     'Type designator or keywords to\nsearch for object',
    ts_type:        'Include objects of the selected type(s)',
    util_weather:   'Opens Astrospheric and Clear Outside forecast\npages for each of your configured locations.\nRequires internet access.',
    util_lightPoll: 'Opens Light Pollution Map centered on each\nof your configured locations.\nRequires internet access.',
    util_sessLogs:  'Select ASIAir autorun and plan session files and\nguide logs. Analyzes each log and produces reports\nwith a summary, notable events and anomalies, and\nrecommendations. Select both logs at the same time\nand they can access each other\'s data for\nadditional information. PDF output available.',
    util_dustMote:  'Estimates how far a dust particle is from\nyour sensor based on the size of its shadow\nin your calibration frames.',
    util_dustFocalRatio:'The focal ratio (f-number) of your telescope.\nAuto-filled when you select a telescope above,\nor enter manually.',
    util_dustPixelSize: 'The physical size of one pixel on your sensor\nin micrometres. Auto-filled when you select\na sensor above, or enter manually.',
    util_dustSpotDiam:  'The diameter of the dust spot shadow in your\ncalibration frame, measured in pixels using\nyour imaging software.',
    dv_clouds:      'Total cloud cover forecast. Black is clear,\nbright amber is fully overcast.',
    dv_wind:        'Wind speed forecast at 10m elevation.\nGround-level or sheltered sites may\nexperience less wind than shown.',
    dv_dew:         'Dew point risk forecast. Black is safe;\nbright blue means conditions are\napproaching dew formation.',
    xxxxxxx:        ''
};


/**
 * Apply tooltip data attributes to elements with data-tooltip-key
 */
function applyTooltips(root = document) {
    root.querySelectorAll('[data-tooltip-key]').forEach(el => {
        const key = el.dataset.tooltipKey;
        if (TOOLTIPS[key]) el.setAttribute('data-tooltip', TOOLTIPS[key]);
    });
}

/**
 * Global JS-driven tooltip element — renders at fixed position so it's
 * always on top regardless of parent stacking contexts
 */
const tooltipEl = document.createElement('div');
tooltipEl.id = 'global-tooltip';
tooltipEl.style.cssText = `
    position: fixed;
    background: #1a1a1a;
    color: #ffffff;
    border: 1px solid #444444;
    padding: 0.25rem 0.5rem;
    border-radius: 4px;
    font-size: 0.75rem;
    white-space: pre;
    z-index: 99999;
    pointer-events: none;
    display: none;
    box-shadow: 0 2px 6px rgba(0,0,0,0.8);
    max-width: 300px;
`;
document.body.appendChild(tooltipEl);

let tooltipTimer = null;
let mouseX = 0;
let mouseY = 0;

document.addEventListener('mouseover', (e) => {
    const host = e.target.closest('[data-tooltip]');
    if (!host) return;
    tooltipTimer = setTimeout(() => {
        tooltipEl.textContent = host.getAttribute('data-tooltip');
        tooltipEl.style.left = (mouseX + 12) + 'px';
        tooltipEl.style.top  = (mouseY + 12) + 'px';
        tooltipEl.style.display = 'block';
    }, 500);
});

document.addEventListener('mousemove', (e) => {
    mouseX = e.clientX;
    mouseY = e.clientY;
    if (tooltipEl.style.display === 'none') return;
    tooltipEl.style.left = (mouseX + 12) + 'px';
    tooltipEl.style.top  = (mouseY + 12) + 'px';
});

document.addEventListener('mouseout', (e) => {
    const host = e.target.closest('[data-tooltip]');
    if (!host) return;
    clearTimeout(tooltipTimer);
    tooltipEl.style.display = 'none';
});

/**
 * Automatically apply tooltips whenever new elements are added to the DOM
 */
const tooltipObserver = new MutationObserver((mutations) => {
    mutations.forEach(mutation => {
        mutation.addedNodes.forEach(node => {
            if (node.nodeType === 1) { // Element nodes only
                applyTooltips(node);
                // Also check the node itself
                if (node.dataset?.tooltipKey) {
                    const key = node.dataset.tooltipKey;
                    if (TOOLTIPS[key]) node.setAttribute('data-tooltip', TOOLTIPS[key]);
                }
            }
        });
    });
});

tooltipObserver.observe(document.body, {
    childList: true,
    subtree: true
});

// Apply tooltips to all static elements already in the DOM
applyTooltips();

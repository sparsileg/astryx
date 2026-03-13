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
 * bm: best month
 * it: import targets
 * mf: manage filters
 * ml: manage locations
 * ms: manage sensors
 * mt: manage telescopes
 * sb: sidebar
 * set: settings
 * sp: sequence planner
 * to: target optimizer
 * ts: target selection
 */

const TOOLTIPS = {
    bm_location:    'The observing location for which you wish\nto compute the Best Month and month visibility',
    it_selectTgt:   'Select the desired target database file\nin Astryx CSV format',
    mf_filtName:    'Preferred name for the new filter',
    mf_savedFilt:   'List of the existing filters',
    ml_bortle:      'Bortle scale number of the new location',
    ml_elev:        'Elevation in meters of the new location',
    ml_existing:    'List of existing observation locations',
    ml_horizProf:   'Horizon profile of the new location. One point\nper line in Azimuth Elevation order, where\nAzimuth is in integer degrees and Elevation\nis in integer degrees',
    ml_lat:         'Latitude of the new location\nin decimal degrees',
    ml_locName:     'Preferred name for the new location',
    ml_lon:         'Longitude of the new location\nin decimal degrees',
    ml_tzOffset:    'Timezone offset of the new\nlocation in hours, where west is\nnegative and east is positive',
    ms_sensName:    'Preferred name for the new sensor',
    ms_pixX:        'Pixel size in micrometers for the X-axis',
    ms_pixY:        'Pixel size in micrometers for the Y-axis',
    ms_resX:        'Resolution in pixels for the X-axis',
    ms_resY:        'Resolution in pixels for the Y-axis',
    ms_savedSens:   'List of the existing sensors',
    mt_aperture:    'Aperture in millimeters of the new telescope',
    mt_fl:          'Focal length in millimeters of the new telescope',
    mt_multiplier:  'The power of the flattener, reducer, or barlow',
    mt_saved:       'List of the existing telescopes',
    mt_telName:     'Preferred name for the new telescope',
    sb_currentTgt:  'The currently selected target\nfor analysis operations',
    sb_dailyVis:    'Compute and view the visibility\nof the current target over\na specified time period',
    sb_fov:         'View a DSS image for the current\ntarget within the specified\nfield of view',
    sb_hamburger:   'Various settings and administrative operations',
    sb_imgLog:      'Track and report on imaging\nprojects, sessions, and\ntarget lists',
    sb_location:    'Select the location from which\nimaging will take place',
    sb_seqPlanner:  'Generate an optimal\nimaging sequence for the\npinned targets for a\nspecified day',
    sb_tgtOpt:      'Generate a set of individual\ntargets and target combinations\nbest suited for viewing\non a specified day',
    sb_tgtSelect:   'Search and filter the target database.\n Pin and add objects to To Do list.\n Remove objects from list',
    sb_theme:       'Select the style and theme of\nthe interface',
    sb_todoList:    'Display the target To Do list\nin various formats',
    sb_utils:       'Clouds, light pollution, and\ndust motes',
    sb_yearlyObs:   'Compute and view the observability\nof the current target over the\nupcoming year',
    set_autoBU:     'Automatically back up to the default\nlocation after a change in:\nsettings, locations, telescopes,\nsensors, filters, pinnedTargets,\ntoDoTargets, imagingProjects,\nimagingSessions, imagingPrograms',
    set_backupDelay: 'Minutes after last change before\nmaking an automatic backup\nto the default location',
    set_DST:        'Set Daylight Savings Time mode,\nusually leave it on Automatic',
    set_filterMaxMag: 'Default maximum magnitude\nfor the Target Filter.\nValid range: -5 to 20',
    set_filterMinSize: 'Default minimum target size (arcminutes)\nfor the Target Filter.\nValid range: 0.1 to 999',
    set_minAlt:     'Global minimum altitude for analysis\noperations - can be overriden\nin some cases',
    sp_afCheck:     'Check to enable autofocus events',
    sp_afDuration:  'Duration of an autofocus event',
    sp_afInterval:  'Interval between autofocus events',
    sp_betweenSubs: 'Average duration in seconds between subs',
    sp_calibration: 'Duration of a calibration',
    sp_flipDuration:'Duration of the actual meridian flip',
    sp_flipOffset:  'How many minutes after the target\npasses meridian before the mount starts\nto flip',
    sp_flipPause:   'How long imaging pauses before\nthe mount begins the meridian flip',
    sp_startDate:   'Date of the imaging session',
    sp_horizon:     'Use the imported or default\nhorizon data',
    sp_location:    'Location the imaging session\nwill take place',
    sp_minAltitude: 'Minimum altitude of a target\nbefore imaging should occur',
    sp_startTime:   'Time the imaging session will start',
    to_date:        'Date of the imaging session',
    to_findTargets: 'Generate optimal targets and target\ncombinations from source data',
    to_source:      'Source of data to use',
    to_startTime:   'Start of the imaging session',
    ts_catalog:     'Include objects from the selected\ncatalog(s)',
    ts_createIP:    'Create Imaging Program from\nthe results',
    ts_limitMag:    'Show objects brighter than this\nvalue (lower number = brighter).\nLeave blank to disable filtering',
    ts_minSize:     'Exclude objects smaller than the\nentered value. Leave blank to disable\n filtering',
    ts_month:       'Include objects observable in the\nselected month',
    ts_PIN:         'Add current target to the Pinned\nTargets list',
    ts_sendOpt:     'Use the results in the\nTarget Optimizer',
    ts_tgtName:     'Type designator or keywords to\nsearch for object',
    ts_type:        'Include objects of the selected type(s)',
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

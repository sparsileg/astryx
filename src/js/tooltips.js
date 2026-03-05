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

const TOOLTIPS = {
    sb_currentTgt:  'The currently selected target\nfor analysis operations',
    sb_dailyVis:    'Compute and view the visibility\nof the current target over\na specified time period',
    sb_fov:         'View a simulated or actual DSS\nimage for the current target\nwithin the telescope/sensor\nfield of view',
    sb_imgLog:      'Track and report on imaging\nprojects, sessions, and\ntarget lists',
    sb_location:    'Select the location to use\nduring planning',
    sb_seqPlanner:  'Generate an optimal\nimaging sequence for the\npinned targets for a\nspecified day',
    sb_tgtOpt:      'Generate a set of individual\ntargets and target combinations\nbest suited for viewing\non a specified day',
    sb_tgtSelect:   'Search and filter the target database',
    sb_theme:       'Select the style and theme of\nthe interface',
    sb_todoList:    'Display the target To Do list\nin various formats',
    sb_utils:       'Clouds, light pollution, and\ndust motes',
    sb_yearlyObs:   'Compute and view the observability\nof the current target over the\nupcoming year',
    set_autoBU:     'Automatically back up 60 seconds\nafter a change in settings, to do\nlist, etc.',
    set_DST:        'Set Daylight Savings Time mode,\nusually leave it on Automatic',
    set_minAlt:     'Global minimum altitude for analysis\noperations - can be overriden\nin some cases',
    set_searchRes:  'Number of search results to show\nduring Target Search',
    sp_afCheck:     'Check to enable autofocus events',
    sp_afDuration:  'Duration of an autofocus event',
    sp_afInterval:  'Interval between autofocus events',
    sp_betweenSubs: 'Average duration in seconds between subs',
    sp_calibration: 'Duration of a calibration',
    sp_flipDuration:'Duration of the actual meridian flip',
    sp_flipOffset:  'Not sure what this does',
    sp_flipPause:   'How long imaging pauses before\nand after a meridian flip',
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
    ts_limitMag:    'Show objects brighter than this\nvalue (lower number = brighter)',
    ts_minSize:     'Exclude objects smaller than the\nentered value',
    ts_month:       'Include objects observable in the\nselected month',
    ts_PIN:         'Add current target to the Pinned\nTargets list',
    ts_sendOpt:     'Use the results in the\nTarget Optimizer',
    ts_tgtName:     'Type designator or keywords to\nsearch for object',
    ts_type:        'Include objects of the selected type(s)',
    xyz: 'fred'
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

document.addEventListener('mouseover', (e) => {
    const host = e.target.closest('[data-tooltip]');
    if (!host) return;
    tooltipEl.textContent = host.getAttribute('data-tooltip');
    tooltipEl.style.display = 'block';
});

document.addEventListener('mousemove', (e) => {
    if (tooltipEl.style.display === 'none') return;
    tooltipEl.style.left = (e.clientX + 12) + 'px';
    tooltipEl.style.top  = (e.clientY + 12) + 'px';
});

document.addEventListener('mouseout', (e) => {
    const host = e.target.closest('[data-tooltip]');
    if (!host) return;
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

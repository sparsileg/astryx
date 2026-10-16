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
 * dv:   daily visibility
 * fov:  viewfinder
 * ilog: imaging log
 * log:  log analysis
 * ml:   manage locations
 * sb:   sidebar
 * set:  settings
 * sp:   sequence planner
 * to:   target optimizer
 * td:   target details
 * todo: to do list
 * ts:   target selection
 * util: utilities
 */

const TOOLTIPS = {

    fov_coverage:   'How much of the field\'s\narea the target fills',
    fov_dawes:      'The finest detail the aperture\ncan separate: 116 ÷ aperture\nin mm',
    fov_efl:        'Focal length times the reducer\nor Barlow factor',
    fov_mode:       'Actual: your field as the\ncamera sees it. Wider: three\ntimes the sky, with a frame\nyou drag to move the center',
    fov_resolution: 'How much sky each\npixel covers',
    fov_rotate:     'Turn the camera as you would\non the focuser; 0° is north up.\nType an angle, or hold ↺ or ↻\nto keep turning',
    fov_targetSize: 'The target\'s catalog size. The\nellipse is always tilted 45°;\nonly its size is meaningful',
    ilog_activityShade:     'Each night\'s integration time\nagainst this year\'s other\nimaging nights, in four steps\nfrom Less to More',
    ilog_maxNumber:         'The last number in the program;\n110 with M is the whole\nMessier catalog',
    ilog_programImaged:     'Targets in Completed projects,\ncounting their other designations',
    ilog_programType:       'Catalog Pattern: one catalog\nfrom 1 up to a number,\nsuch as M 1–110.\nManual List: the targets\nyou type, one per line',
    ilog_projectNotes:      'Kept as plain text. Markdown\nrenders when you paste the\nnotes into a Markdown document',
    ilog_projectSearch:     'Find projects by name or\ntarget designation, in every\nstatus; partial matches\nare supported',
    ilog_projectStatus:     'Where the project is in your\nworkflow. Only Completed projects\ncount as imaged in Programs\nand Reports',
    ilog_projectTargets:    'Search by designation or common\nname and click a result to add it.\nA project can include\nmultiple targets',
    ilog_sessionCalcMoon:   'Fill in the four Moon fields\nfrom the Date, Location and\nthe project\'s first target',
    ilog_sessionExposures:  'Used exposures × sub length',
    ilog_sessionIllum:      'The Moon\'s illumination at\nthe middle of the night',
    ilog_sessionMoonAngle:  'The closest the Moon came to\nthe project\'s first target while\nit was above your Min Altitude',
    ilog_sessionOffset:     'Also called pedestal or black\nlevel; it keeps the darkest\npixels above zero',
    ilog_sessionOriginal:   'Total number of exposures captured\nduring this session before rejection.',
    ilog_sessionRotation:   'The camera angle your plate\nsolve reported, to frame the\nnext session the same way',
    ilog_sessionSubLength:  'Duration of each individual\nexposure in seconds.',
    ilog_sessionTemp:       'The temperature the camera\ncooled the sensor to; your\ndarks need the same one',
    ilog_sessionUsed:       'Number of exposures kept after\nquality rejection. Used to calculate\nfinal integration time.',
    ilog_statusFilter:      'Show only projects at this\nstatus. All But Completed\nhides finished projects',
    ml_bortle:      'Level of light pollution. See Utilities for determining.',
    ml_horizProf:   'Horizon profile of the new location. One point\nper line in Azimuth Elevation order, both\nin integer degrees.',
    ml_timeZone:    'Time zone of the location, such as\nAmerica/New_York or Europe/Madrid.\nSets its UTC offset and daylight saving.',
    sb_system:      'Settings, equipment, locations,\nbackup and restore, tutorials,\nhelp, and About',
    sb_theme:       'Select the style and theme of\nthe interface',
    sb_fontSize:    'Text size for the whole app,\nin pixels (16 is the default)',
    sb_location:    'The site every view plans for:\nrise and set times, darkness,\nand your horizon profile',
    sb_currentTgt:  'The Current Target: the one Daily\nVisibility, Yearly Observability,\nand the Viewfinder show.\nClick for its details',
    sb_tgtSelect:   'Search and filter the target\ndatabase; pin targets and add\nthem to your To Do List',
    sb_todoList:    'Targets you\'d like to image\nsomeday, and which of them\nare up on a given night',
    sb_yearlyObs:   'How well placed the Current\nTarget is through the year,\nand its best month',
    sb_dailyVis:    'One night for the Current Target:\ndarkness, altitude, the Moon,\nand the weather forecast',
    sb_fov:         'The Current Target framed by\nyour telescope and sensor,\non a DSS sky image',
    sb_tgtOpt:      'Find the single targets, and\ngroups of two or three,\nthat best fit a night',
    sb_seqPlanner:  'Optimize your plan for imaging\nthe pinned targets on a given night',
    sb_imgLog:      'Record your projects and sessions,\ntrack programs, and report on them',
    sb_logAnalysis: 'Analyze ASIAir Autorun and\nPHD2 guide logs and produce\ndetailed session reports',
    sb_utils:       'Weather and light pollution\nlinks, and the dust mote\ncalculator',
    sb_pinned:      'Your targets for the next imaging\nsession, used by the Sequence Planner.\nClick one for its details',
    set_DST:        'Set Daylight Savings Time mode,\nusually leave it on Automatic',
    set_autoBU:     'Back up to the specified folder\nwhen your data or settings change',
    set_backupDelay: 'Wait this long after the last\nchange, so a run of edits\nmakes one backup',
    set_backupFolder: 'Where backups are saved.\nIf empty, automatic backups\ngo to your Downloads folder,\nand a manual backup asks\nwhere to save',
    set_backupReminder: 'Show a reminder when your\nlast backup is older than this',
    set_filterMaxMag: 'Default maximum magnitude\nfor the Target Filter.\nValid range: -5 to 20',
    set_filterMinSize: 'Default minimum target size (arcminutes)\nfor the Target Filter.\nValid range: 0.1 to 999',
    set_dateFormat: 'How dates are shown and typed;\ndates are always stored as yyyy-mm-dd',
    set_minAlt:     'The altitude a target must clear\nto count as visible, used across\nthe app. Views with their own\nMin Altitude start from this one',
    sp_allocation:  'Use the arrows to change the\norder; set each target\'s\nexposure and its share\nof the night',
    sp_afCheck:     'Check to enable autofocus events',
    sp_afDuration:  'Duration of an autofocus event',
    sp_afInterval:  'Interval between autofocus events',
    sp_framesPerDither: 'Number of frames between dither events.\nSet to 0 to disable dithering.\nSub gap and dither duration are learned\nautomatically from analyzed session logs.',
    sp_calibration: 'Duration of a guide calibration',
    sp_flipDuration:'Duration of the actual meridian flip',
    sp_flipOffset:  'How many minutes after the target\npasses meridian before the mount starts\nto flip',
    sp_flipPause:   'How long imaging pauses before\nthe mount begins the meridian flip',
    sp_location:    'Location the imaging session\nwill take place',
    sp_reset:       'Discard your changes and\nlet Astryx choose the order\nand split the night again',
    sp_minAltitude: 'Minimum altitude of a target\nbefore imaging should occur',
    sp_startDate:   'Date of the imaging session',
    sp_startTime:   'Time the imaging session will start',
    to_date:        'Date of the imaging session',
    to_comboScore:  'Each target\'s composite score\ntimes its usable hours,\naveraged over the targets;\nnot 0–100, for comparing\ncombinations with each other',
    to_composite:   () => 'A weighted sum of the four\nscores, 0–100, used to\nrank the cards\n' + OptimizerCalculations.describeWeights(), // Issue #99: weights read from OPTIMIZER_WEIGHTS
    to_coverage:    'From the first target\'s window\nstart to the last one\'s end,\nout of the whole night',
    todo_chart:     'Switch between the list and\nchart of targets visible\non the specified day',
    todo_notObservable: 'Fewer than two unbroken dark\nhours above your Min Altitude\non the specified date',
    todo_observable: 'At least two unbroken hours\nabove your Min Altitude\non the specified date',
    todo_sort:      'Rise Time: rise and set times,\nobservable targets first.\nType: grouped by object type.\nBest Month: grouped by the month\neach target is best placed',
    to_mode:        'Individual: each target on its own.\nCombinations: the best plans\nwith one, two or three targets',
    to_source:      'Source of targets to rank',
    to_startTime:   'Start of the imaging session',
    to_scores:      'Window: hours above your Min Altitude, 1 h = 0 up to 8 h or more = 100\nAltitude: peak altitude, your Min Altitude = 0 up to overhead (90°) = 100\nCentering: crossing the meridian at mid-session = 100, at either end = 0\nMoon: Moon brightness and distance while the target is up; Moon down = 100',
    td_bestMonth:   'When the target is best placed:\nhigh around midnight, on long\ndark nights',
    td_calculated:  'When these were last calculated.\nTo recalculate: ≡ → Admin Tools →\nCalculate Best Months',
    td_criteria:    'The Min Altitude and dark hours\nthese results were calculated with',
    td_observable:  'The months with at least two\nunbroken dark hours above\nyour Min Altitude',
    td_other:       'Other designations for\nthis target',
    td_peakAlt:     'The highest the target gets\nfrom this location, when it\ncrosses the meridian',
    td_subr:        "The target's brightness spread\nover its area; lower is brighter.\nOnly galaxies have a value",
    ts_catalog:     'Include targets from the catalogs\nyou tick. None ticked\nmatches nothing',
    ts_createIP:    'Save every target in\nthe results as an\nImaging Log program\n(up to 199 targets)',
    ts_limitMag:    'Include targets at least this bright;\nlower is brighter. Targets with\nno magnitude always pass.\nBlank includes every magnitude',
    ts_minSize:     'Include targets at least this large,\nby their larger dimension.\nBlank includes every size',
    ts_month:       'Include targets with two unbroken\ndark hours above your Min Altitude\non nights in this month,\nfrom your location',
    ts_sendOpt:     'Rank every target in\nthe results for a night\nin the Target Optimizer;\nchoose Filter Targets\nas its source',
    ts_tgtName:     'A designation, such as M 31 or\nNGC 7000, or part of a name.\nSearching resets the filters',
    ts_type:        'Include targets of the types\nyou tick. None ticked\nmatches nothing',
    util_skyConditions: 'Opens forecast, satellite cloud and\nlight pollution pages for the location\nyou choose. Starts on your current\nlocation. Requires internet access',
    log_analysis:   'Astryx tells the two logs apart\nby their contents and combines\nthem into one report, with\nPDF and CSV output',
    log_guideStability: 'Enter your ASIAir\'s Guide Stability\nand Settle Time so the report can\ntell whether dithers settled in\ntime for the night\'s guiding, and\nsuggest a looser setting if not.\nThe logs don\'t record them',
    util_dustMote:  'Estimates how far a dust particle is from\nyour sensor based on the size of its shadow\nin your calibration frames.',
    util_dustFocalRatio:'The focal ratio (f-number) of your imaging\ntrain, including any reducer or Barlow.\nAuto-filled when you select a telescope above,\nor enter manually.',
    util_dustPixelSize: 'The physical size of one pixel on your sensor\nin micrometres. Auto-filled when you select\na sensor above, or enter manually.',
    util_dustSpotDiam:  'The diameter of the dust spot shadow in your\ncalibration frame, measured in pixels using\nyour imaging software.',
    dv_clouds:      'Total cloud cover forecast. Black is clear,\nbright amber is fully overcast.',
    dv_wind:        'Wind speed forecast at 10m elevation.\nGround-level or sheltered sites may\nexperience less wind than shown.',
    dv_horizon:     'Use your location\'s horizon\nprofile: a target behind trees\nor buildings counts as not up',
    dv_dew:         'Dew point risk forecast. Black is safe;\nbright blue means conditions are\napproaching dew formation.',
    dv_moonDial:    'You are at the center and your target is at\n12 o\'clock. The Moon\'s position around the dial\nshows where it is along its monthly path\nacross the sky. On the left it\'s approaching\nyour target, near the top it\'s passing, and on\nthe right it has passed. The number is the\ntrue angular separation between the Moon and\nyour target. Most targets sit north or south\nof the Moon\'s path, so the Moon passes beside\nthem, not over them. The dial shows this by\nlifting the Moon outside the rim as it goes\nby. For the same reason, the Moon at 6 o\'clock\nis rarely a full 180° away. For a target 45°\noff the Moon\'s path, the most it can be is\nabout 135°.'
};


/**
 * Tooltip text for a key; an entry may be a function when its text is
 * built from current values (Issue #99)
 */
function tooltipText(key) {
    const entry = TOOLTIPS[key];
    return typeof entry === 'function' ? entry() : entry;
}

/**
 * Apply tooltip data attributes to elements with data-tooltip-key
 */
function applyTooltips(root = document) {
    root.querySelectorAll('[data-tooltip-key]').forEach(el => {
        const text = tooltipText(el.dataset.tooltipKey);
        if (text) el.setAttribute('data-tooltip', text);
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
`;
document.body.appendChild(tooltipEl);

let tooltipTimer = null;
let mouseX = 0;
let mouseY = 0;

let tooltipOpensLeft = false;

// Beside the pointer, on the side away from the nearer edge: a control in the
// right half of the window opens its tooltip to the left (Issue #99); above
// the pointer only when it would run off the bottom
function positionTooltip() {
    const offset = APP_CONFIG.TOOLTIP_POINTER_OFFSET_PX;
    const left = tooltipOpensLeft ? mouseX - offset - tooltipEl.offsetWidth : mouseX + offset;
    const below = mouseY + offset;
    const top = below + tooltipEl.offsetHeight > window.innerHeight
        ? mouseY - offset - tooltipEl.offsetHeight
        : below;
    tooltipEl.style.left = Math.max(0, left) + 'px';
    tooltipEl.style.top  = Math.max(0, top) + 'px';
}

document.addEventListener('mouseover', (e) => {
    const host = e.target.closest('[data-tooltip]');
    if (!host) return;
    tooltipTimer = setTimeout(() => {
        const rect = host.getBoundingClientRect();
        tooltipOpensLeft = rect.left + rect.width / 2 > window.innerWidth / 2;
        tooltipEl.textContent = host.getAttribute('data-tooltip');
        tooltipEl.style.display = 'block';
        positionTooltip();
    }, 500);
});

document.addEventListener('mousemove', (e) => {
    mouseX = e.clientX;
    mouseY = e.clientY;
    if (tooltipEl.style.display === 'none') return;
    positionTooltip();
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
                    const text = tooltipText(node.dataset.tooltipKey);
                    if (text) node.setAttribute('data-tooltip', text);
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

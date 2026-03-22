/**
 * tutorial-utilities.js
 * "Utilities" tutorial definition.
 * Covers: Weather Forecasts, Light Pollution, Session Log Analysis
 * (ASIAir and PHD2 log upload, accordion reports, PDF output),
 * and Dust Mote Distance Estimator.
 *
 * Modal  — use when there's no specific element to point at (introductions,
 *           transitions, instructions to navigate somewhere)
 * Callout — use when you can point at a specific element in the current DOM
 */

const TUTORIAL_UTILITIES = {
    id: 'utilities',
    title: 'Utilities',
    version: 1,
    nextTutorial: null,
    steps: [

        // --- Introduction ---
        {
            id: 'welcome',
            type: 'modal',
            title: 'Utilities',
            body: 'This tutorial walks you through the Utilities view — a collection of tools that support your planning and post-session analysis. It covers weather and light pollution links, the Session Log Analyzer for reviewing your imaging and guiding sessions, and the Dust Mote Distance Estimator. It takes about 8 minutes.',
            target: null,
            position: 'center',
            waitFor: 'next',
            highlight: false
        },
        {
            id: 'open-utilities',
            type: 'callout',
            title: 'Open Utilities',
            body: 'Click <strong>Utilities</strong> in the left navigation panel to open the view.',
            target: '#sidebar-utilities',
            position: 'right',
            waitFor: 'click',
            highlight: true
        },

        // --- Weather ---
        {
            id: 'weather-overview',
            type: 'callout',
            title: 'Weather Forecasts',
            body: 'The Weather Forecasts card shows links to three weather services — <strong>Astrospheric</strong>, <strong>Clear Outside</strong>, and <strong>Clouds</strong> — for each of your saved observer locations. Each link opens in a new browser tab and shows a forecast tailored to your exact coordinates.<br><br>Use the additional details in these sources to supplement the forecast data referenced in the Daily Visibility timeline. Use them the day of a planned session to confirm conditions. The <strong>Clouds</strong> website provides near-real-time cloud imagery.',
            target: '#utilities-weather-forecasts',
            position: 'bottom',
            width: '420px',
            waitFor: 'next',
            highlight: 'flash'
        },

        // --- Light Pollution ---
        {
            id: 'light-pollution',
            type: 'callout',
            title: 'Light Pollution',
            body: 'The Light Pollution card provides a direct link to the Light Pollution Map for each of your saved locations. This is the recommended way to find the Bortle scale value for a location — open the map, zoom in to your site, and read the Bortle rating.<br><br>Once you know your Bortle value, you can update it in Admin Tools → Manage Observer Locations.',
            target: '#utilities-light-pollution',
            position: 'bottom',
            width: '420px',
            waitFor: 'next',
            highlight: 'flash'
        },

        // --- Session Log Analysis ---
        {
            id: 'session-analysis-intro',
            type: 'callout',
            title: 'Session Log Analysis',
            body: 'The Session Log Analysis card is a powerful tool that provides "under-the-hood" insights. It analyzes log files from your imaging and guiding sessions and produces detailed reports — including a summary, notable events and anomalies, and actionable recommendations.<br><br>Two log files are currently supported: the <strong>ASIAir Autorun log</strong> for imaging session analysis, and the <strong>PHD2 guide log</strong> for guiding analysis. You can load either one independently, or both together (strongly encouraged) for cross-referenced reports. You can save both reports in PDF for archival purposes.',
            target: '#utilities-log-analysis',
            position: 'top',
            width: '460px',
            waitFor: 'next',
            highlight: 'flash'
        },
        {
            id: 'session-log-file',
            type: 'callout',
            title: 'Session Log File Picker',
            body: 'Click <strong>Session Log</strong> to select your ASIAir Autorun log file. These are <em>.txt</em> files saved by the ASIAir to your storage device after each session — typically named <em>Autorun_Log_YYYY-MM-DD_HHMMSS.txt</em>.<br><br>Once selected, the log is parsed immediately and a report accordion appears below.<br><br>Select a session log file now.',
            target: '#session-log-file',
            position: 'top',
            width: '460px',
            waitFor: 'click',
            highlight: true
        },
        {
            id: 'phd2-log-file',
            type: 'callout',
            title: 'PHD2 Guide Log File Picker',
            body: 'Click <strong>PHD2 Guide Log</strong> to select your PHD2 guide log file. These are <em>.txt</em> files saved by PHD2 after each guiding session — typically named <em>PHD2_GuideLog_YYYY-MM-DD_HHMMSS.txt</em>.<br><br>You can load both files at the same time. When both are loaded, the PHD2 report cross-references your guide sessions with the imaging sub numbers from the ASIAir log, so anomalies can be mapped directly to specific frames.<br><br>Select a guiding log file now.',
            target: '#phd2-log-file',
            position: 'top',
            width: '460px',
            waitFor: 'click',
            highlight: true
        },
        {
            id: 'session-accordion',
            type: 'callout',
            title: 'Report Accordions',
            body: 'When a log file is loaded, a collapsed report accordion appears below the file pickers — one for the ASIAir session report and one for the PHD2 guide report.<br><br>Click the accordion header to expand it and view the full report. Click again to collapse it. Loading a new file replaces the existing report for that log type and resets it to collapsed.<br><br>Each expanded report includes a <strong>Download PDF</strong> button to save the report to your computer. This can be used for later viewing or for archival purposes to keep with your other session files.',
            target: '#session-analysis-accordions',
            position: 'top',
            width: '500px',
            waitFor: 'next',
            highlight: 'flash'
        },
        {
            id: 'asiair-report-contents',
            type: 'modal',
            title: 'ASIAir Session Report',
            body: 'The ASIAir session report contains:<br><br><strong>Detail table</strong> — every event in the session (autofocus runs, imaging blocks, dithers, meridian flip) with start time, end time, and duration.<br><br><strong>Summary</strong> — total time broken down by event type and percentage of session, showing how efficiently imaging time was used.<br><br><strong>Recommended Session Settings</strong> — observed values for autofocus duration, guide calibration duration, and between-sub timing, with recommended settings to use in your next session.<br><br><strong>Notes</strong> — clarifications on how durations are calculated.',
            target: null,
            position: 'center',
            waitFor: 'next',
            highlight: false
        },
        {
            id: 'phd2-report-contents',
            type: 'modal',
            title: 'PHD2 Guide Report',
            body: 'The PHD2 guide report contains:<br><br><strong>Equipment</strong> — guide camera, pixel scale, focal length, guide exposure, and mount.<br><br><strong>Overall Statistics</strong> — session-wide RMS values for RA, Dec, and total, average guide star SNR, and dither count.<br><br><strong>Sessions table</strong> — per-session statistics with color-coded flags for high RMS, spikes, error codes, SNR changes, and short sessions. Each row shows the log line number for easy reference. You will note that sometimes there are multiple guiding sessions due to auto-focus, meridian flips, or other events that temporarily interrupt the normal guiding.<br><br><strong>Anomalies &amp; Events</strong> — notable events flagged with severity (critical, warning, or info), including cross-referenced sub numbers when an ASIAir log is also loaded.<br><br><strong>Recommendations</strong> — actionable items such as specific frames to inspect, settings to consider adjusting, and equipment observations.<br><br><strong>Narrative Analysis</strong> — a plain-language interpretation of the night\'s guiding performance, session by session.',
            target: null,
            position: 'center',
            waitFor: 'next',
            highlight: false
        },
        {
            id: 'cross-reference',
            type: 'modal',
            title: 'Cross-Referencing Both Logs',
            body: 'Loading both the ASIAir and PHD2 logs together unlocks the most useful analysis. The PHD2 report can then identify which specific imaging sub numbers were being captured during any guiding anomaly — for example: <em>"Session 11 had high RMS — affects subs 49–54, inspect carefully."</em><br><br>This saves significant post-processing time by telling you exactly which frames to examine or discard before you start stacking. You can load the files in either order — the report recalculates automatically when the second file is added.',
            target: null,
            position: 'center',
            waitFor: 'next',
            highlight: false
        },

        // --- Dust Mote ---
        {
            id: 'dust-mote-intro',
            type: 'callout',
            title: 'Dust Mote Distance Estimator',
            body: 'The Dust Mote Distance Estimator helps you determine how far a dust particle is from your sensor based on how it appears in your images — the larger and fuzzier the dust spot, the further away it is from the sensor surface.<br><br>This is useful when trying to decide whether to clean the sensor itself or the optical elements further up the train.',
            target: '#utilities-dust-mote',
            scrollTo: true,
            position: 'top',
            width: '420px',
            waitFor: 'next',
            highlight: 'flash'
        },
        {
            id: 'dust-telescope-telescope',
            type: 'callout',
            title: 'Auto-Fill from Equipment',
            body: 'Select a telescope from your saved equipment to automatically populate the Focal Ratio field. You can also enter these value manually if you prefer.',
            target: '#dust-telescope-select',
            position: 'top',
            waitFor: 'click',
            highlight: true
        },
        {
            id: 'dust-telescope-sensor',
            type: 'callout',
            title: 'Auto-Fill from Equipment',
            body: 'Select a sensor from your saved equipment to automatically populate the Pixel Size field. You can also enter these values manually if you prefer.',
            target: '#dust-sensor-select',
            position: 'top',
            waitFor: 'click',
            highlight: true
        },
        {
            id: 'dust-spot-pixels',
            type: 'callout',
            title: 'Spot Diameter',
            body: 'Measure the diameter of the dust spot in your image — use your image processing software to measure in pixels — and enter it here. The more accurately you measure, the more useful the result. Enter the spot diameter now.',
            target: '#dust-spot-pixels',
            position: 'top',
            waitFor: 'next',
            highlight: true
        },
        {
            id: 'dust-results',
            type: 'callout',
            title: 'Distance Results',
            body: 'The results table shows the estimated distance from the sensor for two common dust particle sizes — 0.5 mm and 1.5 mm. The summary line below shows the computed spot diameter in millimeters and the focal ratio used.<br><br>A small distance (a few mm) suggests the dust is on or very close to the sensor. A large distance suggests it is on a filter, lens element, or the front of the optical train.',
            target: '#dust-mote-results',
            position: 'top',
            width: '450px',
            waitFor: 'next',
            highlight: 'flash'
        },

        // --- Complete ---
        {
            id: 'complete',
            type: 'modal',
            title: 'Utilities Complete',
            body: 'You now know how to use all four tools in the Utilities view. Use the weather links before every session, the light pollution map to verify your Bortle rating, the Session Log Analyzer after each imaging night to review your performance and identify frames to inspect, and the Dust Mote Estimator when cleaning your optical train.',
            target: null,
            position: 'center',
            waitFor: 'next',
            highlight: false
        }
    ]
};

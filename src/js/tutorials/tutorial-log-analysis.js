/**
 * tutorial-log-analysis.js
 * "Log Analysis" tutorial definition.
 * Covers: ASIAir Autorun and PHD2 guide log upload, the Session, PHD2 and
 * Combined report accordions, PDF/CSV output.
 *
 * Modal  — use when there's no specific element to point at (introductions,
 *           transitions, instructions to navigate somewhere)
 * Callout — use when you can point at a specific element in the current DOM
 */

const TUTORIAL_LOG_ANALYSIS = {
    id: 'log-analysis',
    title: 'Log Analysis',
    version: 1,
    nextTutorial: null,
    steps: [

        // --- Introduction ---
        {
            id: 'welcome',
            type: 'modal',
            title: 'Log Analysis',
            body: 'This tutorial walks you through the Log Analysis view, which reviews your imaging and guiding sessions from their log files. Have an ASIAir Autorun log and a PHD2 guide log from the same night handy. It takes about 6 minutes.',
            target: null,
            position: 'center',
            waitFor: 'next',
            highlight: false
        },
        {
            id: 'open-log-analysis',
            type: 'callout',
            title: 'Open Log Analysis',
            body: 'Click <strong>Log Analysis</strong> in the left navigation panel to open the view.',
            target: '#sidebar-log-analysis',
            position: 'right',
            waitFor: 'click',
            highlight: true
        },

        // --- Session Log Analysis ---
        {
            id: 'session-analysis-intro',
            type: 'callout',
            title: 'Session Log Analysis',
            body: 'The Session Log Analysis card provides "under-the-hood" insights. It analyzes log files from your imaging and guiding sessions and produces detailed reports — including a summary, notable events and anomalies, and actionable recommendations.<br><br>Two log files are currently supported: the <strong>ASIAir Autorun log</strong> for imaging session analysis, and the <strong>PHD2 guide log</strong> for guiding analysis. You can load either one independently, or both together (strongly encouraged) for a combined, cross-referenced report. Every report can be saved as a PDF for archival purposes.',
            target: '#log-analysis-card',
            position: 'bottom',
            width: '460px',
            waitFor: 'next',
            highlight: 'flash'
        },
        {
            id: 'session-log-file',
            type: 'callout',
            title: 'Session Log File Picker',
            body: 'Click <strong>Session Log</strong> to select your ASIAir Autorun log file. These are <em>.txt</em> files saved by the ASIAir to your storage device after each session — typically named <em>Autorun_Log_YYYY-MM-DD_HHMMSS.txt</em>.<br><br>Once selected, the log is parsed immediately and a report accordion appears below. Loading a log also refreshes the sub gap and dither durations the Sequence Planner learns from your sessions.<br><br>Select a session log file now.',
            target: '#session-log-file',
            position: 'bottom',
            width: '460px',
            waitFor: 'click',
            highlight: true
        },
        {
            id: 'phd2-log-file',
            type: 'callout',
            title: 'PHD2 Guide Log File Picker',
            body: 'Click <strong>PHD2 Guide Log</strong> to select your PHD2 guide log file. These are <em>.txt</em> files saved by PHD2 after each guiding session — typically named <em>PHD2_GuideLog_YYYY-MM-DD_HHMMSS.txt</em>.<br><br>When both files are loaded, the PHD2 report cross-references your guide sessions with the imaging sub numbers from the ASIAir log, and a Combined Report is added.<br><br>Select a guiding log file now.',
            target: '#phd2-log-file',
            position: 'bottom',
            width: '460px',
            waitFor: 'click',
            highlight: true
        },
        {
            id: 'session-accordion',
            type: 'callout',
            title: 'Report Accordions',
            body: 'Each loaded log adds a collapsed report accordion below the file pickers — a <strong>Session Report</strong> for the ASIAir log and a <strong>PHD2 Guide Report</strong> for the guide log. Once both are loaded, a third <strong>Combined Report</strong> appears.<br><br>Click an accordion header to expand it and view the full report. Click again to collapse it. Loading a new file replaces the existing report for that log type.<br><br>Each expanded report has a <strong>Download PDF</strong> button to save it with your other session files. The Combined Report can also download a per-sub CSV.',
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
            body: 'The ASIAir session report contains:<br><br><strong>Detail table</strong> — every event in the session (autofocus runs, imaging blocks, dithers, meridian flip) with start time, end time, and duration.<br><br><strong>Summary</strong> — total time broken down by event type and percentage of session, showing how efficiently imaging time was used.<br><br><strong>Recommended Session Settings</strong> — observed values for autofocus duration, guide calibration duration, and between-sub timing, with recommended settings to use in your next session.<br><br><strong>Anomalies</strong> — notable problems found in the log, when there are any.<br><br><strong>Notes</strong> — clarifications on how durations are calculated.',
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
            id: 'combined-report-contents',
            type: 'modal',
            title: 'Combined Report',
            body: 'Loading both logs together unlocks the most useful analysis. The Combined Report fuses the two into one view of the night:<br><br><strong>Verdict</strong> — the night at a glance: subs captured, how many were clean, marginal, or rejected, usable integration, settled guide RMS, and the number of findings by severity.<br><br><strong>Recommendations</strong> — suggested settings for sequence planning, the ASIAir, and guiding, each with the observed value and a confidence level.<br><br><strong>Session Timeline</strong> and <strong>Summary</strong> — the night\'s events and where the time went. Tick <em>Show all events</em> to include routine dithers, plate solves, and mount start/stop.<br><br><strong>Per-Sub Frame Quality</strong> — guiding RMS, peak error, and temperature for each sub, so you know exactly which frames to examine or discard before stacking.<br><br><strong>Guiding Analysis</strong>, <strong>Findings</strong>, <strong>Focus and Environment</strong>, and <strong>Data Quality</strong> — the detail behind the verdict.<br><br>If an Imaging Log session exists for the same night, its telescope, sensor, and location are used in the analysis. You can load the files in either order — the reports update when the second file is added.',
            target: null,
            position: 'center',
            width: '520px',
            waitFor: 'next',
            highlight: false
        },

        // --- Complete ---
        {
            id: 'complete',
            type: 'modal',
            title: 'Log Analysis Complete',
            body: 'You now know how to use the Log Analysis view. Load your ASIAir and PHD2 logs after each imaging night to review your performance, find frames to inspect, and pick up recommended settings for your next session.',
            target: null,
            position: 'center',
            waitFor: 'next',
            highlight: false
        }
    ]
};

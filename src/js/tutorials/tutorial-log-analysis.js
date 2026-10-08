/**
 * tutorial-log-analysis.js
 * "Log Analysis" tutorial definition.
 * Covers: ASIAir Autorun and PHD2 guide log upload, the Combined Report,
 * PDF/CSV output.
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
            body: 'The Session Log Analysis card provides "under-the-hood" insights. It analyzes log files from your imaging and guiding sessions and produces detailed reports — including a summary, notable events and anomalies, and actionable recommendations.<br><br>Two log files are currently supported: the <strong>ASIAir Autorun log</strong> for imaging session analysis, and the <strong>PHD2 guide log</strong> for guiding analysis. Together they produce one cross-referenced Combined Report. The Session Log is required; the guide log adds the guiding analysis and is strongly encouraged. The report can be saved as a PDF for archival purposes.',
            target: '#log-analysis-card',
            position: 'bottom',
            width: '460px',
            waitFor: 'next',
            highlight: 'flash'
        },
        {
            id: 'log-file',
            type: 'callout',
            title: 'Loading the Logs',
            body: 'Drag your ASIAir Autorun log and PHD2 guide log onto the box, or click <strong>Browse…</strong> to select them. You can load both at once or one at a time, in either order; Astryx tells them apart by their contents. Both are <em>.txt</em> files, typically named <em>Autorun_Log_YYYY-MM-DD_HHMMSS.txt</em> (saved by the ASIAir to your storage device) and <em>PHD2_GuideLog_YYYY-MM-DD_HHMMSS.txt</em>.<br><br>The names of the loaded files appear beside the button. The Combined Report appears below as soon as the Session Log is loaded; the guide log adds the guiding analysis, cross-referenced with your imaging sub numbers. If the two logs don\'t overlap in time, Astryx warns you that they may be from different nights.<br><br>Loading a Session Log also refreshes the sub gap and dither durations the Sequence Planner learns from your sessions.<br><br>Select your log files now.',
            target: '#log-browse',
            position: 'bottom',
            width: '460px',
            waitFor: 'click',
            highlight: true
        },
        {
            id: 'guide-stability',
            type: 'callout',
            title: 'Guide Stability and Settle Time',
            body: 'Enter your ASIAir\'s <strong>Guide Stability</strong> and <strong>Settle Time</strong>: after a dither, guiding must stay under this many arcseconds for this many seconds.<br><br>Neither log records them, so the Combined Report reads them from here to judge your settle times. Astryx remembers them; change them only when you change them on the ASIAir.',
            target: '#log-guide-stability',
            position: 'bottom',
            width: '420px',
            waitFor: 'next',
            highlight: true
        },
        {
            id: 'session-accordion',
            type: 'callout',
            title: 'The Combined Report',
            body: 'Loading the Session Log adds the <strong>Combined Report</strong> below the file pickers, collapsed. Add the night\'s PHD2 Guide Log for the guiding analysis; without it, the guide figures are left out.<br><br>Click the report\'s header to expand it, and again to collapse it. Loading a new file in either picker rebuilds the report.<br><br>Above the report are a <strong>Download PDF Report</strong> button to save it with your other session files, and a <strong>Download Per-Sub CSV</strong> button. Neither needs the report open.',
            target: '#session-analysis-accordions',
            position: 'top',
            width: '500px',
            waitFor: 'next',
            highlight: 'flash'
        },
        {
            id: 'combined-report-contents',
            type: 'modal',
            title: 'Combined Report',
            body: 'The Combined Report fuses the two logs into one view of the night:<br><br><strong>Verdict</strong> — the night at a glance: subs captured, how many were clean, marginal, or rejected, usable integration, settled guide RMS, and the number of findings by severity.<br><br><strong>Recommendations</strong> — suggested settings for sequence planning, the ASIAir, and guiding, each with the observed value and a confidence level.<br><br><strong>Guiding Settings</strong> — each guide setting with what tonight\'s logs showed, what it means, and what to try.<br><br><strong>Session Timeline</strong> and <strong>Summary</strong> — the night\'s events and where the time went. Tick <em>Show all events</em> to include routine dithers, plate solves, and mount start/stop.<br><br><strong>Per-Sub Frame Quality</strong> — guiding RMS, peak error, and temperature for each sub, so you know exactly which frames to examine or discard before stacking.<br><br><strong>Guiding Analysis</strong>, <strong>Findings</strong>, <strong>Focus and Environment</strong>, and <strong>Data Quality</strong> — the detail behind the verdict.<br><br>If an Imaging Log session exists for the same night, its telescope, sensor, and location are used in the analysis. The report updates when the second log is added.',
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

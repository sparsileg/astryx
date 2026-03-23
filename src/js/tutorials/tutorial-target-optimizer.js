
/**
 * tutorial-target-optimizer.js
 * "Target Optimizer" tutorial definition.
 * Covers: navigating to the view, candidate sources (To Do List vs Filter
 * Targets), session settings (date, start time), running the optimizer,
 * reading a result card (window, scores, actions), the scoring model,
 * the Best Combinations view, and a practical planning workflow.
 *
 * Modal  — use when there's no specific element to point at (introductions,
 *           transitions, instructions to navigate somewhere)
 * Callout — use when you can point at a specific element in the current DOM
 */

const TUTORIAL_TARGET_OPTIMIZER = {
    id: 'target-optimizer',
    title: 'Target Optimizer',
    version: 1,
    nextTutorial: 'sequence-planner',
    steps: [

        // --- Introduction ---
        {
            id: 'welcome',
            type: 'modal',
            title: 'Target Optimizer',
            body: 'This tutorial walks you through the Target Optimizer — the tool that evaluates a pool of candidate targets for a specific night and ranks them by how well they suit your session.<br><br>Instead of manually checking every target against moon conditions, altitude, and available imaging time, the Optimizer scores them all at once and surfaces the best options. It takes about 8 minutes.',
            target: null,
            position: 'center',
            waitFor: 'next',
            highlight: false
        },
        {
            id: 'open-optimizer',
            type: 'callout',
            title: 'Open Target Optimizer',
            body: 'Click <strong>Target Optimizer</strong> in the left navigation panel to open the view.',
            target: '#sidebar-target-optimizer',
            position: 'right',
            waitFor: 'click',
            highlight: true
        },
        {
            id: 'overview',
            type: 'modal',
            title: 'How the Optimizer Works',
            body: 'The Optimizer works in three steps:<br><br>1. You provide a <strong>candidate pool</strong> — either your To Do List or a set of targets sent from Filter Targets.<br><br>2. You set a <strong>date and session start time</strong> — the Optimizer uses your selected location and minimum altitude setting automatically.<br><br>3. It scores every candidate against four factors and returns a ranked list of the best targets for that night, along with a Best Combinations view that suggests which targets pair well together.',
            target: null,
            position: 'center',
            waitFor: 'next',
            highlight: false
        },

        // --- Settings ---
        {
            id: 'date',
            type: 'callout',
            title: 'Observation Date',
            body: 'Set the date you are planning to image. The Optimizer calculates dusk and dawn for your selected location on this date and uses that window as the basis for all scoring.<br><br>The field defaults to today each time you open the view.',
            target: '#optimizer-date',
            position: 'bottom',
            waitFor: 'next',
            highlight: true
        },
        {
            id: 'start-time',
            type: 'callout',
            title: 'Session Start Time',
            body: 'Controls when your imaging session begins. <strong>Dusk</strong> starts the session at the calculated end of astronomical twilight — the earliest you can usefully image. <strong>Custom</strong> reveals a time field so you can enter a later start, for example if you cannot be at your site until midnight.<br><br>The session always ends at dawn. Setting a later start narrows the window and will reduce scores for targets that peak early in the night.',
            target: '#optimizer-start-time',
            position: 'bottom',
            waitFor: 'next',
            highlight: true
        },
        {
            id: 'source',
            type: 'callout',
            title: 'Candidate Source',
            body: 'Selects the pool of targets the Optimizer will evaluate.<br><br><strong>To Do List</strong> — uses every target currently on your To Do List. This is the most common workflow: build a list of targets you are interested in imaging and let the Optimizer pick the best one for tonight.<br><br><strong>Filter Targets</strong> — uses a set of targets sent from the Filter Targets view via its <em>Send to Optimizer</em> button. This option is disabled until a pool has been loaded.',
            target: '#optimizer-source',
            position: 'bottom',
            width: '420px',
            waitFor: 'next',
            highlight: true
        },
        {
            id: 'filter-pool',
            type: 'modal',
            title: 'Using Filter Targets as a Source',
            body: 'The Filter Targets view lets you search the full 14,000+ object database using criteria like object type, size, constellation, and observability. When you have a filtered result set you want to evaluate, click <strong>Send to Optimizer</strong> in Filter Targets.<br><br>The Optimizer\'s Source dropdown will update to show the count of loaded targets and enable the Filter Targets option. This is useful when your To Do List is small or when you want to explore what is available in a specific category on a given night.',
            target: null,
            position: 'center',
            waitFor: 'next',
            highlight: false
        },
        {
            id: 'execute',
            type: 'callout',
            title: 'Find Targets',
            body: 'Click <strong>Find Targets</strong> to run the Optimizer. It evaluates every candidate in your pool against the session window, eliminates those that do not meet visibility requirements, scores the remainder, and returns a ranked list.<br><br>For a To Do List with dozens of targets, this completes in well under a second.<br><br>Click <strong>Find Targets</strong> now.',
            target: '#optimizer-execute-btn',
            position: 'bottom',
            waitFor: 'click',
            highlight: true
        },

        // --- Results ---
        {
            id: 'results-summary',
            type: 'callout',
            title: 'Results Summary',
            body: 'The summary line at the top of the results shows how many targets are displayed versus how many were evaluated in total, along with a breakdown of why candidates were eliminated — for example, targets that never rise above your minimum altitude or that have too short an imaging window to be worthwhile.',
            target: '.optimizer-results-summary',
            position: 'bottom',
            waitFor: 'next',
            highlight: true
        },
        {
            id: 'result-card',
            type: 'callout',
            title: 'Result Cards',
            body: 'Each result card represents one candidate target ranked by its composite score. The rank number appears on the left. The top line shows the object designator, common name, type, and angular size. The second line shows the imaging window — when the target is above your minimum altitude — its peak altitude, and moon separation.',
            target: '#optimizer-card-0',
            position: 'top',
            width: '450px',
            waitFor: 'next',
            highlight: 'flash'
        },
        {
            id: 'score-breakdown',
            type: 'callout',
            title: 'Score Breakdown',
            body: 'The lower section of each card shows the four component scores (0-100) that make up the composite:<br><br><strong>Window</strong> — how many hours the target is above your minimum altitude during the session. Longer is better.<br><br><strong>Altitude</strong> — how high the target peaks. Higher means less atmosphere and sharper images.<br><br><strong>Centering</strong> — how close the transit time is to the session midpoint. A target that transits at the middle of the night has its best altitude centered in your session.<br><br><strong>Moon</strong> — a time-weighted score accounting for moon altitude, illumination, and angular separation throughout the imaging window.',
            target: '#optimizer-card-0',
            position: 'top',
            width: '460px',
            waitFor: 'next',
            highlight: false
        },
        {
            id: 'score-model',
            type: 'modal',
            title: 'How Scores Are Weighted',
            body: 'The four component scores are combined into a single composite score using fixed weights:<br><br><strong>Moon</strong> — 30% — the largest factor, because moon interference is the most common reason a night is unusable for a specific target.<br><br><strong>Window duration</strong> — 30% — longer available time directly increases how much data you can collect.<br><br><strong>Peak altitude</strong> — 25% — higher altitude means less atmospheric distortion and better image quality.<br><br><strong>Transit centering</strong> — 15% — a target centered in the session makes scheduling easier and maximises high-altitude time.<br><br>All scores are on a 0–100 scale. The composite is a weighted sum of the four components.',
            target: null,
            position: 'center',
            waitFor: 'next',
            highlight: false
        },
        {
            id: 'card-actions',
            type: 'callout',
            title: 'Card Actions',
            body: 'Each card has three actions:<br><br><strong>Daily Visibility</strong> — opens the Daily Visibility view for this target on the optimizer date, pre-loaded with your current location. Use this to inspect the full night timeline before committing.<br><br><strong>Pin</strong> — adds the target to your Pinned Targets list, which is used by the Sequence Planner.<br><br><strong>✕</strong> (middle left) — removes the target from the results list. Use this to prune candidates you are not interested in before switching to the Best Combinations view.',
            target: '#optimizer-card-0',
            position: 'top',
            width: '440px',
            waitFor: 'next',
            highlight: false
        },

        // --- Combinations ---
        {
            id: 'combinations-intro',
            type: 'callout',
            title: 'Best Combinations',
            body: 'The <strong>Best Combinations</strong> button switches to a view that suggests which targets work well together for a single night — solo targets, pairs, and triplets — ranked by a combined score that accounts for both quality and imaging time coverage.<br><br>Use this when you want to fill a full night with more than one target, or when you want to switch targets partway through a session as windows open and close.',
            target: '.optimizer-mode-toggle',
            position: 'bottom',
            waitFor: 'next',
            highlight: true
        },
        {
            id: 'combinations-detail',
            type: 'modal',
            title: 'Reading Combinations',
            body: 'Each combination card shows:<br><br><strong>Coverage</strong> — the span from the earliest window start to the latest window end across all targets in the combination, expressed as hours covered out of total night hours. This shows how well the combination fills the session.<br><br><strong>Avg score</strong> — each target\'s composite score weighted by its window hours, averaged across all targets in the combination. This normalizes solo, pair, and triplet scores to the same scale so you can compare across sections.<br><br>Each target within the combination shows its own window and key stats so you can see whether the windows overlap or sequence neatly across the night.<br><br>Use the <strong>Replace Pinned Targets</strong> button to instantly load a combination into your Pinned Targets list, ready for the Sequence Planner.',
            target: null,
            position: 'center',
            waitFor: 'next',
            highlight: false
        },
        {
            id: 'replace-pinned',
            type: 'modal',
            title: 'Replace Pinned Targets',
            body: 'The <strong>Replace Pinned Targets</strong> button on each combination card unpins all currently pinned targets and pins the targets in that combination in a single step.<br><br>This is the fastest path from optimization to sequence planning: run the Optimizer, choose a combination, click Replace Pinned Targets, then open the Sequence Planner to build your night.',
            target: null,
            position: 'center',
            waitFor: 'next',
            highlight: false
        },

        // --- Practical workflow ---
        {
            id: 'workflow',
            type: 'modal',
            title: 'Typical Planning Workflow',
            body: 'The Optimizer fits into a larger planning workflow:<br><br>1. Build your <strong>To Do List</strong> with targets you want to image<br>2. Open Target Optimizer and set the date for your next imaging session<br>3. Click <strong>Find Targets</strong> and review the ranked results<br>4. Check the top candidates using <strong>Daily Visibility</strong> to inspect moon conditions across the full night<br>5. Switch to <strong>Best Combinations</strong> if you want to plan a multi-target session<br>6. Click <strong>Replace Pinned Targets</strong> to load your chosen combination<br>7. Open the <strong>Sequence Planner</strong> to build your imaging schedule<br><br>The Optimizer removes the guesswork — you arrive at your session knowing exactly which targets are worth your time that night.',
            target: null,
            position: 'center',
            waitFor: 'next',
            highlight: false
        },

        // --- Complete ---
        {
            id: 'complete',
            type: 'modal',
            title: 'Target Optimizer Complete',
            body: 'You can now configure and run the Optimizer, read the scored result cards, understand what drives each component score, and use Best Combinations to plan a full night across multiple targets.<br><br>Use it together with <strong>Daily Visibility</strong> to verify specific nights and the <strong>Sequence Planner</strong> to turn the results into an imaging schedule.',
            target: null,
            position: 'center',
            waitFor: 'next',
            highlight: false
        }
    ]
};

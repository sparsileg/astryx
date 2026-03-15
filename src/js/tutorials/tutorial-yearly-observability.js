/**
 * tutorial-yearly-observability.js
 * "Yearly Observability" tutorial definition.
 * Covers: navigating to the view, reading the graph, understanding the
 * observability score, the background gradient, the altitude line,
 * flat/ascending/descending curve sections, moon phase markers,
 * best month and observable range, minimum altitude control,
 * and how to use the view for planning imaging sessions.
 *
 * Modal  — use when there's no specific element to point at (introductions,
 *           transitions, instructions to navigate somewhere)
 * Callout — use when you can point at a specific element in the current DOM
 */

const TUTORIAL_YEARLY_OBSERVABILITY = {
    id: 'yearly-observability',
    title: 'Yearly Observability',
    version: 2,
    nextTutorial: null,
    steps: [

        // --- Introduction ---
        {
            id: 'welcome',
            type: 'modal',
            title: 'Yearly Observability',
            body: 'This tutorial walks you through the Yearly Observability view — the tool that shows you how well a target can be imaged across an entire year from your location.<br><br>Use it for long-range planning to identify your best imaging windows, understand why a target disappears at certain times of year, and avoid scheduling sessions in poor conditions. It takes about 8 minutes.',
            target: null,
            position: 'center',
            waitFor: 'next',
            highlight: false
        },
        {
            id: 'open-yearly',
            type: 'callout',
            title: 'Open Yearly Observability',
            body: 'Click <strong>Yearly Observability</strong> in the left navigation panel to open the view.',
            target: '#sidebar-yearly-observability',
            position: 'right',
            waitFor: 'click',
            highlight: true
        },
        {
            id: 'overview',
            type: 'callout',
            title: 'What Yearly Observability Shows',
            body: 'The graph plots 365 days of data — starting from the first of the current month — for the current target and your selected location. Each day shows how high the target rises during astronomical darkness and how favorable conditions are for imaging.',
            target: '#yearly-observability-graph',
            position: 'top',
            width: '450px',
            waitFor: 'next',
            highlight: 'flash'
        },

        // --- Header ---
        {
            id: 'header',
            type: 'callout',
            title: 'Target Summary',
            body: 'The header shows the target name, its peak altitude across the year, the best calendar month for imaging from your location, and the full range of months during which it is observable. This gives you an immediate at-a-glance answer to "when should I image this target?"',
            target: '#yearly-observability-header',
            position: 'bottom',
            waitFor: 'next',
            highlight: true
        },
        {
            id: 'min-altitude',
            type: 'callout',
            title: 'Minimum Altitude',
            body: 'Controls the altitude threshold used in calculations. Raising it restricts results to nights when the target climbs higher — through less atmosphere — which improves image quality but shortens the observable window. Lowering it extends the window but includes nights with more atmospheric distortion.<br><br>The graph recalculates immediately when you change this value.',
            target: '#yearly-min-altitude',
            position: 'bottom',
            waitFor: 'next',
            highlight: true
        },

        // --- The graph elements ---
        {
            id: 'altitude-line',
            type: 'callout',
            title: 'Peak Altitude Line',
            body: 'The line across the graph shows the peak altitude the target reaches during astronomical darkness on each night of the year. Higher means the target climbs further above the horizon — less atmosphere to image through, sharper results.',
            target: '#yearly-observability-graph',
            position: 'top',
            width: '420px',
            waitFor: 'next',
            highlight: false
        },
        {
            id: 'today-marker',
            type: 'callout',
            title: 'Today and Moon Phase Markers',
            body: 'A vertical orange line marks today\'s date on the graph so you can immediately see where you are in the current imaging season.<br><br>Yellow circles mark full moon dates across the year. Full moon significantly degrades imaging conditions for faint targets — the darkest areas of the background gradient will fall between these markers.',
            target: '#yearly-observability-graph',
            position: 'top',
            width: '420px',
            waitFor: 'next',
            highlight: false
        },
        {
            id: 'background-gradient',
            type: 'callout',
            title: 'Observability Score',
            body: 'The background shading is the observability score — <strong>darker means better conditions, lighter means worse</strong>.<br><br><strong>Black/very dark</strong>: Excellent — target transits near midnight, maximum dark hours, new moon<br><strong>Medium gray</strong>: Good — target observable but moon present or transit offset from midnight<br><strong>Light gray</strong>: Marginal — limited dark hours or unfavorable moon<br><strong>White</strong>: Poor or impossible — target too low or sun interference',
            target: '#yearly-observability-graph',
            position: 'top',
            width: '460px',
            waitFor: 'next',
            highlight: false
        },
        {
            id: 'score-factors',
            type: 'modal',
            title: 'What Goes Into the Score',
            body: 'The observability score combines four factors for each night:<br><br><strong>Transit timing</strong> — how close to midnight the target reaches its highest point. A target that transits at midnight is at its best — it is highest during the darkest hours.<br><br><strong>Dark hours</strong> — total time the target is above the altitude threshold during astronomical darkness.<br><br><strong>Moon illumination</strong> — a brighter moon reduces the score.<br><br><strong>Moon-target separation</strong> — how far the moon is from the target. Even a full moon matters less if it is 90° or more away.<br><br>The score is also weighted by object type — faint nebulae benefit more from long dark hours, while compact objects like galaxies benefit more from a near-midnight transit.',
            target: null,
            position: 'center',
            waitFor: 'next',
            highlight: false
        },

        // --- Curve shape explanation ---
        {
            id: 'key-insight',
            type: 'modal',
            title: 'The Key Insight',
            body: 'Every target reaches its absolute maximum altitude every single night of the year when it transits (crosses the meridian). This is determined purely by geometry — its declination and your latitude. This never changes.<br><br>But the graph shows <strong>peak altitude during astronomical darkness</strong>, and that can vary dramatically across the year. This is why the altitude line has flat sections and sloped sections — and understanding those shapes tells you everything about when to image a target.',
            target: null,
            position: 'center',
            waitFor: 'next',
            highlight: false
        },
        {
            id: 'flat-section',
            type: 'callout',
            title: 'Flat Section — Prime Imaging Season',
            body: 'When the altitude line is flat, the target\'s transit is occurring during astronomical darkness. The graph is showing the target\'s full potential — its maximum possible altitude — every night in that stretch.<br><br>The flat section is your prime imaging season. The target is as high as it gets, and darkness is capturing the entire transit. Plan the bulk of your imaging sessions here.',
            target: '#yearly-observability-graph',
            position: 'top',
            width: '440px',
            waitFor: 'next',
            highlight: false
        },
        {
            id: 'descending-section',
            type: 'callout',
            title: 'Descending Curve — Past the Peak Season',
            body: 'As you move past a target\'s optimal viewing season, the target transits progressively earlier in the evening. Eventually it transits before astronomical darkness begins — so by the time it is dark enough to image, the target has already passed its peak and is descending. The altitude line slopes downward.<br><br>For example, a target that transits at midnight in December might transit at 4pm by April. Darkness does not start until 8pm, by which point the target is well past its peak and already dropping.',
            target: '#yearly-observability-graph',
            position: 'top',
            width: '440px',
            waitFor: 'next',
            highlight: false
        },
        {
            id: 'ascending-section',
            type: 'callout',
            title: 'Ascending Curve — Approaching the Peak Season',
            body: 'On the other side, as you approach a target\'s optimal season, the target transits progressively later into the night. Darkness ends before the target reaches its peak — so the graph shows the altitude at dawn rather than at transit. As the season progresses, darkness extends later, capturing more of the target\'s rising arc, and the altitude line climbs.<br><br>The bottom line: <strong>flat = transit during darkness</strong>. <strong>Sloped = darkness only catches part of the arc before or after transit</strong>.',
            target: '#yearly-observability-graph',
            position: 'top',
            width: '440px',
            waitFor: 'next',
            highlight: false
        },

        // --- Legend ---
        {
            id: 'legend',
            type: 'callout',
            title: 'Legend',
            body: 'The legend identifies each visual element in the graph — the altitude line, minimum altitude threshold, observability gradient, full moon markers, and today\'s date marker.',
            target: '#yearly-observability-legend',
            position: 'top',
            waitFor: 'next',
            highlight: true
        },

        // --- Planning guidance ---
        {
            id: 'planning',
            type: 'modal',
            title: 'Using This View for Planning',
            body: 'Yearly Observability answers the key planning questions every astrophotographer faces:<br><br><strong>Is this target worth imaging from my location?</strong> If the altitude line stays low or disappears for most of the year, the target may never clear your horizon well enough.<br><br><strong>When is the best time?</strong> Find the darkest background shading within the flat section — that combination of good transit timing, long dark hours, and favorable moon is your sweet spot.<br><br><strong>How long is my window?</strong> The observable range in the header tells you which months the target is at least minimally visible.<br><br><strong>Which specific nights?</strong> Once you have identified the right month, switch to <strong>Daily Visibility</strong> to pick a specific night where moon conditions are also favorable.',
            target: null,
            position: 'center',
            waitFor: 'next',
            highlight: false
        },

        // --- Complete ---
        {
            id: 'complete',
            type: 'modal',
            title: 'Yearly Observability Complete',
            body: 'You can now read the altitude line, interpret the observability score, understand the flat and sloped sections of the graph, and use Yearly Observability to plan your imaging sessions throughout the year.<br><br>Use it together with <strong>Daily Visibility</strong> — Yearly Observability for the month, Daily Visibility for the night.',
            target: null,
            position: 'center',
            waitFor: 'next',
            highlight: false
        }
    ]
};

/**
 * tutorial-daily-visibility.js
 * "Daily Visibility" tutorial definition.
 * Covers: navigating to the view, date controls, the gradient timeline,
 * the three info cards (Moon, Target, Separation), min altitude,
 * horizon profile toggle, and date navigation buttons.
 *
 * Modal  — use when there's no specific element to point at (introductions,
 *           transitions, instructions to navigate somewhere)
 * Callout — use when you can point at a specific element in the current DOM
 */

const TUTORIAL_DAILY_VISIBILITY = {
    id: 'daily-visibility',
    title: 'Daily Visibility',
    version: 4,
    nextTutorial: null,
    steps: [

        // --- Introduction ---
        {
            id: 'welcome',
            type: 'modal',
            title: 'Daily Visibility',
            body: 'This tutorial walks you through the Daily Visibility view — the tool that shows you exactly how a target, the moon, and sky darkness interact across a single night.<br><br>This capability of Astryx is helpful to identify nights and times when the target is positioned well in dark skies. It takes about 8 minutes.',
            target: null,
            position: 'center',
            waitFor: 'next',
            highlight: false
        },
        {
            id: 'open-daily-visibility',
            type: 'callout',
            title: 'Open Daily Visibility',
            body: 'Click <strong>Daily Visibility</strong> in the left navigation panel to open the view.',
            target: '#sidebar-daily-visibility',
            position: 'right',
            waitFor: 'click',
            highlight: true
        },
        {
            id: 'overview',
            type: 'callout',
            title: 'What Daily Visibility Shows',
            body: 'Daily Visibility analyzes a full 24-hour period — noon to noon — for the current target and your selected location. It combines sky darkness, target altitude, and moon position into a single color-coded timeline so you can immediately identify the best imaging windows for any given night.<br><br>Additional information is added such as sun, moon, and target rise & set times, as well as the minimum altitude and, if available, the horizon profile of your observation site.',
            target: '#timeline-container',
            position: 'top',
            width: '500px',
            waitFor: 'next',
            highlight: false
        },

        // --- Date controls ---
        {
            id: 'date-control',
            type: 'callout',
            title: 'Observation Date',
            body: 'This field sets the date for the analysis. Change it to any date you are planning to image. All calculations — twilight times, target rise and set, moon position — update immediately. Note that the default date spans an entire night of imaging until noon on the next day in order to display the correct weather forecast for your current imaging session.',
            target: '#dv-date',
            position: 'bottom',
            waitFor: 'next',
            highlight: true
        },
        {
            id: 'date-nav-buttons',
            type: 'callout',
            title: 'Date Navigation',
            body: 'The arrow buttons step the date forward or backward one day or one week at a time. Hold a button down to advance rapidly — useful for scanning across a season to find favorable nights.',
            target: '.dv-controls-row',
            position: 'bottom',
            waitFor: 'next',
            highlight: 'flash'
        },

        // --- Min altitude and horizon ---
        {
            id: 'min-altitude',
            type: 'callout',
            title: 'Minimum Altitude',
            body: 'Sets the minimum elevation above the horizon in degrees that the target must reach to be considered visible. The default comes from your global Settings.<br><br>Raising this value restricts results to times when the target is higher — and therefore through less atmosphere — which generally improves image quality.',
            target: '#dv-min-altitude',
            position: 'bottom',
            waitFor: 'next',
            highlight: true
        },
        {
            id: 'use-horizon',
            type: 'callout',
            title: 'Use Horizon Profile',
            body: 'When checked, Astryx applies the custom horizon profile stored for your location — accounting for trees, buildings, or terrain — when determining whether the target is visible. The horizon profile never dips below the minimum altitude.<br><br>Uncheck this to treat the horizon as perfectly flat. If your location has no horizon profile defined, this control has no effect.',
            target: '#dv-use-horizon',
            position: 'bottom',
            waitFor: 'next',
            highlight: true
        },

        // --- The timeline ---
        {
            id: 'timeline-intro',
            type: 'callout',
            title: 'The Timeline',
            body: 'The timeline is the centerpiece of the Daily Visibility view. It spans noon on the selected date to noon the following day and uses color to show the state of the sky at every moment across that period.',
            target: '#timeline-container',
            position: 'top',
            width: '300px',
            waitFor: 'next',
            highlight: 'flash'
        },
        {
            id: 'timeline-colors',
            type: 'callout',
            title: 'Reading the Colors',
            body: 'The background colour tells you the sky state at each point in time: <strong>white</strong> is daylight, <strong>gray</strong>  indicates moonlight or before astronomical dusk or after astronomical dawn, and <strong>dark grey/black</strong> is astronomical darkness.',
            target: '.gradient-legend',
            position: 'top',
            waitFor: 'next',
            highlight: true
        },
        {
            id: 'timeline-tgt-altitude',
            type: 'callout',
            title: 'Target Altitude graph',
            body: 'The bright white line traces your target\'s altitude — higher on the timeline means higher in the sky. The line only appears when the target is above the minimum altitude or horizon.',
            target: '#dv-legend-tgt-altitude',
            position: 'top',
            waitFor: 'next',
            highlight: true
        },
        {
            id: 'timeline-altitude-line',
            type: 'callout',
            title: 'Minimum Altitude Line',
            body: 'The dashed yellow line marks the effective minimum altitude threshold. When a horizon profile is active, this line combines with the minimum altitude to follow the terrain rather than staying flat — it rises where obstructions are present and dips where the horizon is clear, but never drops below the minimum altitude. Set the minimum altitude lower to better see your entire horizon profile.<br><br>Imaging time is available when the white target line is above the dashed line and the background is dark.',
            target: '#dv-legend-min-altitude',
            position: 'left',
            width: '400px',
            waitFor: 'next',
            highlight: true
        },
        {
            id: 'cloud-cover-strip',
            type: 'callout',
            title: 'Weather Forecast Strips',
            body: 'Three forecast strips appear at the top of the timeline for today through the next four days. Other dates show an unavailable message.<br><br>When you open Daily Visibility before noon, the date defaults to the previous day so the weather strips reflect the imaging night that is still in progress. The default date resets to today at noon.<br><br><strong>Clouds</strong> — amber gradient showing total cloud cover. Black means clear skies, bright amber means fully overcast.<br><br><strong>Wind</strong> — yellow area chart showing wind speed. The scale maximum is shown at the top left and adjusts to the night\'s conditions.<br><br><strong>Dew</strong> — blue gradient showing dew point risk. Black means a safe spread between temperature and dew point; bright blue means conditions are approaching dew formation.',
            target: '#cloud-cover-strip',
            position: 'bottom',
            width: '440px',
            waitFor: 'next',
            highlight: true
        },
        {
            id: 'info-cards-intro',
            type: 'callout',
            title: 'Information Cards',
            body: 'Below the timeline, three cards summarise the key factors that affect your imaging session: Moon conditions, Target visibility, and Moon–Target separation.',
            target: '#info-cards-container',
            position: 'top',
            waitFor: 'next',
            highlight: 'flash'
        },
        {
            id: 'moon-card',
            type: 'callout',
            title: 'Moon Card',
            body: 'Shows the moon phase name, illumination percentage, and rise and set times for the night. A bright poorly-placed moon is one of the most common reasons to postpone an imaging session — this card, along with the timeline, lets you assess that at a glance.',
            target: '#dv-moon-details',
            position: 'top',
            waitFor: 'next',
            highlight: true
        },
        {
            id: 'target-card',
            type: 'callout',
            title: 'Target Card',
            body: 'Shows the target\'s rise and set times, peak altitude and the time it occurs, and — when a horizon profile is active — the number of minutes blocked by terrain. An asterisk (*) next to a time means the event falls outside the astronomical darkness window.',
            target: '#dv-target-details',
            position: 'top',
            waitFor: 'next',
            highlight: true
        },
        {
            id: 'separation-card',
            type: 'callout',
            title: 'Moon–Target Separation Card',
            body: 'Shows the angular distance between the moon and your target at the start and end of the imaging window, along with a plain-language assessment of the interference level.',
            target: '#dv-moon-separation',
            position: 'top',
            waitFor: 'next',
            highlight: true
        },

        // --- Practical use ---
        {
            id: 'practical-use',
            type: 'callout',
            title: 'Putting It Together',
            body: 'A good imaging night shows a long dark section in the timeline with the white target line well above the dashed altitude threshold, a low moon illumination percentage or moon that sets early in the night, and a separation value in the <em>Good</em> or <em>Excellent</em> range.<br><br>Use the date navigation arrows to step through upcoming nights until you find one where all three conditions align. Once you have found the right night, you are ready to plan your sequence.',
            target: '#timeline-container',
            position: 'bottom',
            width: '450px',
            waitFor: 'next',
            highlight: 'flash'
        },

        // --- Complete ---
        {
            id: 'complete',
            type: 'modal',
            title: 'Daily Visibility Complete',
            body: 'You can now read the timeline, interpret the information cards, and use Daily Visibility to identify the best nights for imaging any target from your location. Happy imaging!',
            target: null,
            position: 'center',
            waitFor: 'next',
            highlight: false
        }
    ]
};

/**
 * tutorial-target-filtering.js
 * "Filtering Search Results" tutorial definition.
 * Covers: opening the filter panel, each filter group, applying
 * filters, reading filtered results, and clearing filters.
 *
 * Modal — use when there's no specific element to point at (introductions,
 * transitions, instructions to navigate somewhere)
 * Callout — use when you can point at a specific element in the current DOM
 */

const TUTORIAL_TARGET_FILTERING = {
    id: 'target-filtering',
    title: 'Filter Targets',
    version: 2,
    nextTutorial: 'tutorial-todo',
    steps: [
        {
            id: 'welcome',
            type: 'modal',
            title: 'Filtering Search Results',
            body: '<strong>Filter Targets</strong> lets you narrow search results by catalog, object type, visibility, size, and magnitude. This tutorial shows you how to build a focused target list using filters. It takes about 5 minutes.',
            target: null,
            position: 'center',
            waitFor: 'next',
            highlight: false
        },
        {
            id: 'open-target-selection',
            type: 'callout',
            title: 'Open Target Selection',
            body: 'Click <strong>Target Selection</strong> in the left navigation panel to open the search view.',
            target: '#sidebar-target-selection',
            position: 'right',
            waitFor: 'click',
            highlight: true
        },

        {
            id: 'filter-targets-overview',
            type: 'callout',
            title: 'Filter Targets Overview',
            body: 'The filter panel groups controls by Catalog, Object Type, Visibility, Size, and Magnitude. You can set any combination and the results dynamically update each time you make a change. Click <strong>Next</strong> to advance.',
            target: '#target-filter-panel',
            position: 'left',
            waitFor: 'next',
            highlight: true
        },
        {
            id: 'filter-catalog',
            type: 'callout',
            title: 'Filter by Catalog',
            body: 'Select one or more catalogs from the dropdown to include objects in that constellation in the results. Cllick on the Catalog dropdown and select <strong>Select None</strong>. Click on the <em>Messier</em> catalog. You may have to scroll to see it. Click on the dropdown to collapse it.',
            target: '#target-filter-catalog-trigger',
            position: 'left',
            waitFor: 'next',
            highlight: true
        },
        {
            id: '#filter-object-type',
            type: 'callout',
            title: 'Filter by Object Type',
            body: 'Select one or more types to include objects of that type in the results. Click on the Type dropdown and press <strong>Select None</strong>. Check <em>Emission nebula</em> and <em>Reflection nebula</em> — to include only those types in results. Click on the dropdown to collapse it.',
            target: '#target-filter-type-trigger',
            position: 'left',
            waitFor: 'next',
            highlight: true
        },
        {
            id: 'filter-visibility',
            type: 'callout',
            title: 'Filter by Visibility',
            body: 'Visibility filters includes only objects that are visible from your location during the specified month(s) and are higher than a minimum altitude based on the object type. You can select every month or a single month.<br><br>Note that when <em>Any Month</em> is selected, targets may appear in the results list that are not visible from your currently selected location because they are too low in the sky.',
            target: '#target-filter-month',
            position: 'left',
            waitFor: 'next',
            highlight: true
        },
        {
            id: 'filter-size',
            type: 'callout',
            title: 'Filter by Angular Size',
            body: 'Use the size range to match targets to your field of view. Set a minimum size to avoid objects that are too small for your equipment.',
            target: '#target-filter-size',
            position: 'left',
            waitFor: 'next',
            highlight: true
        },
        {
            id: 'filter-magnitude',
            type: 'callout',
            title: 'Filter by Magnitude',
            body: 'Set a maximum magnitude to limit results to objects bright enough for your equipment. Lower numbers are brighter — most imaging targets fall between magnitude 5 and 14.',
            target: '#target-filter-magnitude',
            position: 'left',
            waitFor: 'next',
            highlight: true
        },
        {
            id: 'filtered-results',
            type: 'callout',
            title: 'Filtered Results',
            body: 'Look in the <strong>Filter Results</strong> panel to view the filtered results. You can scroll through the entire result set if you wish. Note that the results are random so the order may change as you reapply the filter.<br><br>Click on one of the displayed objects to make it the <strong>Current Target</strong>.',
            target: '#target-filter-results',
            position: 'left',
            scrollTo: true,
            waitFor: 'next',
            highlight: true
        },
        {
            id: 'reset-filters',
            type: 'callout',
            title: 'Reset Filters',
            body: 'Click <strong>Reset</strong> to reset all filters to default values.',
            target: '#target-filter-reset-btn',
            position: 'bottom',
            waitFor: 'next',
            highlight: true
        },
        {
            id: 'filter-results-options',
            type: 'callout',
            title: 'Filter Results Options',
            body: 'The <strong>Filter Results</strong> panel also has the <em>Create Imaging Program</em> and <em>Send to Optimizer</em> buttons. Those will be explained in later tutorials. Hit <strong>Next</strong> to advance.',
            target: '#filter-results-options',
            position: 'left',
            waitFor: 'next',
            highlight: true
        },
        {
            id: 'target-source',
            type: 'callout',
            title: 'Select Target Source',
            body: 'You can filter the entire target database or restrict filtering to your To Do list.',
            target: '#target-source-radio',
            position: 'left',
            scrollTo: true,
            waitFor: 'next',
            highlight: true
        },
        {
            id: 'complete',
            type: 'modal',
            title: 'Filtering Complete',
            body: 'You now know how to use every filter in the <strong>Filter Targets</strong> panel to build a focused, relevant target list. Combine filters to home in on exactly the right targets for your equipment, location, and sky conditions.',
            target: null,
            position: 'center',
            waitFor: 'next',
            highlight: false
        }
    ]
};

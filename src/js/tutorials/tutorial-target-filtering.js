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
    version: 3,
    nextTutorial: 'todo',
    steps: [
        {
            id: 'welcome',
            type: 'modal',
            title: 'Filtering Search Results',
            body: '<strong>Filter Targets</strong> lets you narrow the target list by catalog, object type, visibility, size, and magnitude. This tutorial shows you how to build a focused target list using filters. It takes about 5 minutes.',
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
            body: 'The filters sit below the search bar in the <strong>Target Search &amp; Filter</strong> card and are grouped by Catalog, Type, Visibility, Size, and Magnitude. You can set any combination and the <strong>Results</strong> card on the right updates each time you make a change — there is no Apply button.<br><br>Changing a filter clears the search bar, since filtering and name searching are two ways of building the same results list. Click <strong>Next</strong> to advance.',
            target: '#target-search-filter-panel',
            position: 'right',
            waitFor: 'next',
            highlight: true
        },
        {
            id: 'filter-catalog',
            type: 'callout',
            title: 'Filter by Catalog',
            body: 'Select one or more catalogs from the dropdown to include objects from those catalogs in the results. Click on the Catalog dropdown and select <strong>Select None</strong>. Check the <em>Messier</em> catalog — you may have to scroll to see it. Click on the dropdown to collapse it.',
            target: '#target-filter-catalog-trigger',
            position: 'right',
            waitFor: 'next',
            highlight: true
        },
        {
            id: 'filter-object-type',
            type: 'callout',
            title: 'Filter by Object Type',
            body: 'Select one or more types to include objects of that type in the results. Click on the Type dropdown and press <strong>Select None</strong>. Check <em>Emission nebula</em> and <em>Reflection nebula</em> to include only those types in the results. Click on the dropdown to collapse it.',
            target: '#target-filter-type-trigger',
            position: 'right',
            waitFor: 'next',
            highlight: true
        },
        {
            id: 'filter-visibility',
            type: 'callout',
            title: 'Filter by Visibility',
            body: 'The Visibility filter includes only objects that are visible from your location during the specified month(s) and are higher than a minimum altitude based on the object type. You can select <em>Any month</em> or a single month.<br><br>Note that when <em>Any Month</em> is selected, targets may appear in the results list that are not visible from your currently selected location because they are too low in the sky.',
            target: '#target-filter-month-trigger',
            position: 'right',
            waitFor: 'next',
            highlight: true
        },
        {
            id: 'filter-size',
            type: 'callout',
            title: 'Filter by Angular Size',
            body: 'Set a minimum size (in arcminutes) to exclude objects that are too small for your equipment. The starting value comes from your Settings and can be changed here at any time.',
            target: '#target-filter-size',
            position: 'right',
            waitFor: 'next',
            highlight: true
        },
        {
            id: 'filter-magnitude',
            type: 'callout',
            title: 'Filter by Magnitude',
            body: 'Set a limiting magnitude to keep only objects bright enough for your equipment. Lower numbers are brighter — most imaging targets fall between magnitude 5 and 14. The starting value also comes from your Settings.',
            target: '#target-filter-magnitude',
            position: 'right',
            waitFor: 'next',
            highlight: true
        },
        {
            id: 'filtered-results',
            type: 'callout',
            title: 'Filtered Results',
            body: 'Look in the <strong>Results</strong> card to view the filtered results. The count above the list shows how many unique targets match; you can scroll through the entire set and more are loaded as you go. Filtered results are shown in random order, so the order may change as you reapply the filters. Each row also has Pinned, To Do, and imaging-status badges, as described in the Target Search tutorial.<br><br>Click on one of the displayed objects to make it the <strong>Current Target</strong> and open its Target Details.',
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
            body: 'Click <strong>Reset</strong> to return all filters to their default values: every catalog and type selected, any month, and the size and magnitude limits from your Settings.',
            target: '#target-filter-reset-btn',
            position: 'bottom',
            waitFor: 'next',
            highlight: true
        },
        {
            id: 'filter-results-options',
            type: 'callout',
            title: 'Filter Results Options',
            body: 'The header of the <strong>Results</strong> card also has the <em>Create Imaging Program</em> and <em>Send to Optimizer</em> buttons, which act on the current results. Those will be explained in later tutorials. Hit <strong>Next</strong> to advance.',
            target: '#filter-results-options',
            position: 'left',
            waitFor: 'next',
            highlight: true
        },
        {
            id: 'target-source',
            type: 'callout',
            title: 'Select Target Source',
            body: 'You can filter the entire target database or restrict filtering to your To Do list by choosing <strong>All Targets</strong> or <strong>To Do List</strong> here.',
            target: '#target-source-radio',
            position: 'right',
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

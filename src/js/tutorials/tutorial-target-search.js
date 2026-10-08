/**
 * tutorial-target-search.js
 * "Searching for Targets" tutorial definition.
 * Covers: the Target Selection layout, searching by name, reading result rows
 * and badges, the Target Details modal, adding to the To Do list, and pinning
 * (including the Pinned Targets strip in the sidebar).
 *
 * Modal — use when there's no specific element to point at (introductions,
 * transitions, instructions to navigate somewhere)
 * Callout — use when you can point at a specific element in the current DOM
 */

const TUTORIAL_TARGET_SEARCH = {
    id: 'target-search',
    title: 'Target Search',
    version: 3,
    nextTutorial: 'target-filtering',
    steps: [
        {
            id: 'welcome',
            type: 'modal',
            title: 'Searching for Targets',
            body: 'This tutorial walks you through finding deep-sky objects, reading the results, viewing target details, adding targets to your To Do list, and pinning favorites. It takes about 5 minutes.',
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
            id: 'layout-overview',
            type: 'callout',
            title: 'Target Selection Layout',
            body: 'The view has two cards. The <strong>Target Search &amp; Filter</strong> card on the left is where you say what you are looking for — by name or by filters. The <strong>Results</strong> card on the right lists the matching targets and shows the details of the one you select.<br><br>This tutorial covers searching by name. The next tutorial covers the filters.',
            target: '#target-search-filter-panel',
            position: 'right',
            waitFor: 'next',
            highlight: true
        },
        {
            id: 'target-source',
            type: 'callout',
            title: 'Select Target Source',
            body: 'Choose whether to search <strong>All Targets</strong> in the database or only the targets on your <strong>To Do List</strong>. The To Do option is useful once you have built up a list of candidates.',
            target: '#target-source-radio',
            position: 'right',
            waitFor: 'next',
            highlight: true
        },
        {
            id: 'search-bar',
            type: 'callout',
            title: 'The Search Bar',
            body: 'Type any part of an object name, catalog designation, or common name here — for example <em>Orion</em>, <em>M42</em>, or <em>nebula</em>. Searching begins once you have typed two characters, and the results update as you type. Exact and best matches are listed first.<br><br>Note that starting a name search resets the filters below, so the search covers the whole target source.',
            target: '#target-name',
            position: 'right',
            waitFor: 'next',
            highlight: true
        },
        {
            id: 'run-search',
            type: 'callout',
            title: 'Run a Search',
            body: 'Type <em>M 101</em> in the search bar now. The matching targets appear in the <strong>Results</strong> card on the right.<br><br>Click <strong>Next</strong> when you see the results.',
            target: '#target-name',
            position: 'right',
            waitFor: 'next',
            highlight: true
        },
        {
            id: 'results-list',
            type: 'callout',
            title: 'Reading the Results List',
            body: 'Each result shows the designation, object type, common name (if any), and constellation. The count above the list shows how many results are loaded; more load automatically as you scroll.<br><br>Next to each name are three small badges that show, at a glance:<br>• <strong>Pinned</strong> — a filled pin means the target is pinned<br>• <strong>To Do</strong> — a checked box means it is on your To Do list<br>• <strong>Imaging status</strong> — empty, half-filled, or filled circle for no sessions, an active project, or a completed project<br><br>Dimmed badges mean the status does not apply. The badges also account for alternate designations, so an object shows the same status under any of its catalog names.',
            target: '#target-filter-results',
            position: 'left',
            waitFor: 'next',
            highlight: true
        },
        {
            id: 'select-result',
            type: 'callout',
            title: 'Select a Target',
            body: 'Click the <strong>M 101</strong> result in the list. It becomes the <strong>Current Target</strong>, shown in the left navigation panel, so you can use the other analysis tools on it without searching again. Its details also open in a window.',
            target: '#target-filter-results',
            position: 'left',
            waitFor: 'click',
            highlight: true
        },
        {
            id: 'details-modal',
            type: 'callout',
            title: 'Reading the Target Details',
            body: 'The Target Details window shows the target\'s designations, visual information (type, size, magnitude), coordinates, and observability from your current location.<br><br>The <strong>Pin</strong> and <strong>Add to To Do List</strong> buttons at the top act on this target. The same window opens wherever you click a target: a search result, a pinned target, the Current Target, or a target on your To Do List.',
            target: '#modal-body',
            position: 'left',
            width: '450px',
            waitFor: 'next',
            highlight: false
        },
        {
            id: 'todo-intro',
            type: 'callout',
            title: 'The To Do List',
            body: 'The <strong>To Do List</strong> is a personal queue of targets you plan to image. Click <strong>Add to To Do List</strong> to place this target on your list.',
            target: '#modal-todo-btn',
            position: 'left',
            waitFor: 'click',
            highlight: true
        },
        {
            id: 'todo-confirmed',
            type: 'callout',
            title: 'Added to To Do',
            body: 'The target is now on your To Do list. The button now reads <strong>Remove from To Do List</strong> so you can take it off the list later, and the To Do badge in the results list is now checked. You can review the whole list any time from <strong>To Do List</strong> in the left navigation panel.',
            target: '#modal-todo-btn',
            position: 'left',
            waitFor: 'next',
            highlight: true
        },
        {
            id: 'pin-intro',
            type: 'callout',
            title: 'Pinning Targets',
            body: 'Pinning saves a target to your <strong>Pinned Targets</strong> list, typically the targets you want to image next. The <strong>Sequence Planner</strong> uses your pinned targets when generating an imaging session for a given night.<br><br>Click the <strong>Pin</strong> button to pin this target. It then reads <strong>Unpin</strong>.',
            target: '#modal-pin-btn',
            position: 'left',
            waitFor: 'click',
            highlight: true
        },
        {
            id: 'close-details',
            type: 'callout',
            title: 'Close the Target Details',
            body: 'Close the window with the <strong>Close</strong> button or the <strong>Esc</strong> key. The results list is still there underneath.<br><br>Click <strong>Close</strong> now.',
            target: '#modal-close',
            position: 'left',
            waitFor: 'click',
            highlight: true
        },
        {
            id: 'pin-confirmed',
            type: 'callout',
            title: 'Target Pinned',
            body: 'Pinned targets are listed in the <strong>Pinned Targets</strong> strip at the bottom of the left navigation panel, and it is visible from every view. Click a pinned target there to make it the Current Target and open its details, or click the × to unpin it. In Daily Visibility, Yearly Observability, and the Viewfinder, the click skips the details and switches the view straight to that target, so you can click between pinned targets to compare them.',
            target: '.sidebar-pinned-section',
            position: 'right',
            waitFor: 'next',
            highlight: 'flash'
        },
        {
            id: 'complete',
            type: 'modal',
            title: 'Search Complete',
            body: 'You can now search the target database by name, read the results and badges, view detailed information, add targets to your To Do list, and pin favorites. The next tutorial covers how to filter and refine the results.',
            target: null,
            position: 'center',
            waitFor: 'next',
            highlight: false
        }
    ]
};

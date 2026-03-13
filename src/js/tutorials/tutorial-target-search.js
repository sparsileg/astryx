/**
 * tutorial-target-search.js
 * "Searching for Targets" tutorial definition.
 * Covers: running a search, reading results panel, pinning a target,
 * and adding a target to the To Do list.
 *
 * Modal — use when there's no specific element to point at (introductions,
 * transitions, instructions to navigate somewhere)
 * Callout — use when you can point at a specific element in the current DOM
 */

const TUTORIAL_TARGET_SEARCH = {
    id: 'target-search',
    title: 'Target Search',
    version: 2,
    nextTutorial: 'target-filtering',
    steps: [
        {
            id: 'welcome',
            type: 'modal',
            title: 'Searching for Targets',
            body: 'This tutorial walks you through finding deep-sky objects, reading the results, pinning favourites, and adding targets to your To Do list. It takes about 5 minutes.',
            target: null,
            position: 'center',
            waitFor: 'next',
            highlight: false
        },
        {
            id: 'open-search',
            type: 'modal',
            title: 'Open Target Selection',
            body: 'Click <strong>Target Selection</strong> in the left navigation panel to open the search view. Click Next when it is open.',
            target: null,
            position: 'center',
            waitFor: 'next',
            highlight: false
        },
        {
            id: 'search-bar',
            type: 'callout',
            title: 'The Search Bar',
            body: 'Type any part of an object name, catalogue number, or common name here — for example <em>Orion</em>, <em>M42</em>, or <em>nebula</em>. Results update dynamically as you type and appear in a list that you can scroll.',
            target: '#target-name',
            position: 'right',
            waitFor: 'next',
            highlight: true
        },
        {
            id: 'run-search',
            type: 'callout',
            title: 'Run a Search',
            body: 'Type something in the search bar now — try <em>M 101</em>. Click on the result you want and it will become the Current Target, indicated in the highlighted area in the left navigation panel. This means that you can use multiple analysis tools on that target without having to search for it again.<br><br>Click Next once you have selected one of the results and it appears as the Current Target.',
            target: '#target-name',
            position: 'right',
            waitFor: 'next',
            highlight: true
        },
        {
            id: 'result-panel',
            type: 'callout',
            title: 'Reading the Result Panel',
            body: 'Once you have selected the current target, a short summary panel appears, as well as a <strong>Detail</strong> button. The summary provides a few attributes of the selected target.',
            target: '#target-info-display',
            position: 'right',
            waitFor: 'next',
            highlight: true
        },
        {
            id: 'click-the-detail-button',
            type: 'callout',
            title: 'Display Target Details',
            body: 'Click the <strong>Detail</strong> button.',
            target: '#show-detail-btn',
            position: 'right',
            waitFor: 'click',
            highlight: true
        },
        {
            id: 'details-panel',
            type: 'callout',
            title: 'Reading the Detail Panel',
            body: 'The Detail panel shows a variety of information about the object including various designations, location, size and magnitude, and visibility indicators for your current location.',
            width: '450px',
            target: '#modal-close',
            position: 'left',
            waitFor: 'next',
            highlight: false
        },
        {
            id: 'todo-intro',
            type: 'callout',
            title: 'The To Do List',
            body: 'The <strong>To Do List</strong> is a personal queue of targets you plan to image. Click the <strong>Add to To Do List</strong> button to place the current target onto your personal list.',
            target: '#modal-todo-btn',
            position: 'left',
            waitFor: 'click',
            highlight: true
        },
        {
            id: 'todo-confirmed',
            type: 'callout',
            title: 'Added to To Do',
            body: 'The target is now on your To Do list. Note that the button text has changed to remove it from the list. Access the list any time from <strong>To Do List</strong> in the left navigation panel.<br><br>Close the Detail view and click Next to continue.',
            target: null,
            position: 'right',
            waitFor: 'next',
            highlight: false
        },
        {
            id: 'pin-intro',
            type: 'callout',
            title: 'Pinning Targets',
            body: 'Selecting the <strong>Pin</strong> button saves the <strong>Current Target</strong> to your <strong>Pinned Targets</strong> list so you can find it quickly later. They appear in the <strong>Pinned Targets</strong> panel on this view and typically are the next targets you want to image. <strong>Pinned Targets</strong> are used by the <strong>Sequence Planner</strong> when generating an imaging session for a given night.',
            target: '#pin-target-btn',
            position: 'right',
            waitFor: 'next',
            highlight: true
        },
        {
            id: 'pin-target',
            type: 'callout',
            title: 'Pin a Target',
            body: 'Click the pin icon (📌) next to the search bar to pin Current Target. The current target will appear in the Pinned Targets list below.',
            target: '#pin-target-btn',
            position: 'right',
            waitFor: 'click',
            highlight: true
        },
        {
            id: 'pin-confirmed',
            type: 'callout',
            title: 'Target Pinned',
            body: 'The target is now in your <strong>Pinned Targets</strong> list.',
            target: null,
            position: 'right',
            waitFor: 'next',
            highlight: false
        },
        {
            id: 'target-source',
            type: 'callout',
            title: 'Select Target Source',
            body: 'You can choose between your To Do list and the entire target database to filter.',
            target: 'target-selection-source',
            position: 'bottom',
            waitFor: 'next',
            highlight: true
        },
        {
            id: 'complete',
            type: 'modal',
            title: 'Search Complete',
            body: 'You can now search the target database, view detailed information, pin favourites, and build your To Do list. The next tutorial covers how to filter and refine search results.',
            target: null,
            position: 'center',
            waitFor: 'next',
            highlight: false
        }
    ]
};

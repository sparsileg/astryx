/**
 * tutorial-todo.js
 * "To Do List" tutorial definition.
 * Covers: adding targets, the three sort views (Type, Best Month, Rise Time),
 * the Rise Time chart, and removing targets.
 *
 * Modal — use when there's no specific element to point at (introductions,
 * transitions, instructions to navigate somewhere)
 * Callout — use when you can point at a specific element in the current DOM
 */

const TUTORIAL_TODO = {
    id: 'todo',
    title: 'To Do List',
    version: 1,
    nextTutorial: 'yearly-observability',
    steps: [
        {
            id: 'welcome',
            type: 'modal',
            title: 'The To Do List',
            body: 'The To Do List is your personal queue of targets you intend to image. This tutorial walks you through adding targets, the three sort views, and how each one can help you plan your imaging sessions. It takes about 4 minutes.',
            target: null,
            position: 'center',
            waitFor: 'next',
            highlight: false
        },
        {
            id: 'open-todo',
            type: 'callout',
            title: 'Open the To Do List',
            body: 'Click <strong>To Do List</strong> in the left navigation panel.',
            target: '#sidebar-to-do-list',
            position: 'right',
            waitFor: 'click',
            highlight: true
        },
        {
            id: 'adding-targets',
            type: 'modal',
            title: 'Adding Targets',
            body: 'Targets are added to the To Do List from the <strong>Detail</strong> view in <strong>Search Targets</strong>. After selecting a target and opening the Detail panel, click <strong>Add to To Do List</strong>. The button toggles — click it again to remove the target from the list.',
            target: null,
            position: 'center',
            waitFor: 'next',
            highlight: false
        },

        // --- Sort control ---
        {
            id: 'sort-control',
            type: 'callout',
            title: 'Sort Options',
            body: 'The <strong>Sort by</strong> dropdown controls how your targets are grouped and ordered. There are three views: <strong>Type</strong>, <strong>Best Month</strong>, and <strong>Rise Time</strong>. Each serves a different planning purpose.',
            target: '#todo-sort-select',
            position: 'bottom',
            waitFor: 'next',
            highlight: true
        },

        // --- By Type ---
        {
            id: 'sort-by-type-intro',
            type: 'callout',
            title: 'Sort by Type',
            body: 'Select <strong>Type</strong> from the Sort by dropdown.',
            target: '#todo-sort-select',
            position: 'bottom',
            waitFor: 'click',
            highlight: true
        },
        {
            id: 'sort-by-type',
            type: 'callout',
            title: 'Grouped by Object Type',
            body: 'In this view, targets are grouped by object type — Galaxies, Nebulae, Clusters, and so on — and sorted within each group by best imaging month. This is useful when you want to focus a session on a particular category of object, or when you are building a themed imaging program.<br><br>Each target displays a small circle icon indicating its imaging status: an empty circle means no sessions exist, a half-filled circle means an active project exists in the Imaging Log, and a filled circle means the project is complete.<br><br>When you click on the target designator or common name, you will jump to the Detail view for that object and it becomes the <strong>Current Target</strong> so you can run various analysis tools on it.',
            target: '#todo-sort-select',
            position: 'bottom',
            waitFor: 'next',
            highlight: false
        },

        // --- By Best Month ---
        {
            id: 'sort-by-month-intro',
            type: 'callout',
            title: 'Sort by Best Month',
            body: 'Select <strong>Best Month</strong> from the Sort by dropdown. Click Next when the view has updated.',
            target: '#todo-sort-select',
            position: 'bottom',
            waitFor: 'click',
            highlight: false
        },
        {
            id: 'sort-by-month',
            type: 'callout',
            title: 'Grouped by Best Month',
            body: 'Here targets are grouped by their best calendar month for imaging from your current location.<br><br>Use this view for long-range planning — for example, identifying which targets you should prioritize over the next few months before they become less favorable.<br><br>Targets without Best Month data appear in a <em>No Best Month Data</em> group at the bottom.',
            target: '#todo-container',
            position: 'right',
            waitFor: 'next',
            highlight: 'flash'
        },

        // --- By Rise Time ---
        {
            id: 'sort-by-rise-intro',
            type: 'callout',
            title: 'Sort by Rise Time',
            body: 'Select <strong>Rise Time</strong> from the Sort by dropdown. Click Next when the view has updated.',
            target: '#todo-sort-select',
            position: 'bottom',
            waitFor: 'click',
            highlight: true
        },
        {
            id: 'sort-by-rise',
            type: 'callout',
            title: 'Tonight\'s Observable Targets',
            body: 'Rise Time view splits your list into <strong>Observable Tonight</strong> and <strong>Not Observable Tonight</strong>, ordered by rise time for the current date and your selected location. This is your go-to view on an imaging night — it shows exactly which targets are accessible and in what order they become available.<br><br>Note that if any of the targets on the <strong>To Do List</strong> are pinned, they will be shaded a different color.',
            target: '#todo-container',
            position: 'right',
            waitFor: 'next',
            highlight: 'flash'
        },
        {
            id: 'rise-time-toggle',
            type: 'callout',
            title: 'List and Chart Views',
            body: 'A <strong>Chart</strong> button is available in all three sort modes. The chart displays observable targets as a Gantt-style visibility timeline across the night, grouped by type, month, or rise time depending on your sort selection. Toggle back with <strong>List</strong>.',
            target: '#toggle-rise-chart',
            position: 'bottom',
            scrollTo: true,
            waitFor: 'next',
            highlight: true
        },

        // --- Removing targets ---
        {
            id: 'removing-targets',
            type: 'callout',
            title: 'Removing Targets',
            body: 'In any display other than the <strong>Chart</strong>, each target has a <strong>Remove</strong> button to remove it from the list. You can also remove a target on the <strong>To Do List</strong> from the <strong>Target Selection</strong> view by clicking <strong>Remove from To Do List</strong> in the Detail panel.',
            target: '.btn-remove-todo',
            position: 'right',
            waitFor: 'next',
            highlight: 'flash'
        },

        // --- Complete ---
        {
            id: 'complete',
            type: 'modal',
            title: 'To Do List Complete',
            body: 'You now know how to build and manage your imaging queue, and how to use each sort view for planning. Use <strong>Type</strong> to browse by category, <strong>Best Month</strong> for long-range planning, and <strong>Rise Time</strong> on the night you image.',
            target: null,
            position: 'center',
            waitFor: 'next',
            highlight: false
        }
    ]
};

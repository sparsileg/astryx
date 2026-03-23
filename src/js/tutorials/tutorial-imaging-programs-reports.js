/**
 * tutorial-imaging-programs-reports.js
 * "Imaging Programs & Reports" tutorial definition.
 * Covers: navigating to the Programs tab, what programs are and why they
 * are useful, program cards (progress bar, targets, status), creating a
 * Catalog Pattern program, creating a Manual List program, import results,
 * editing and deleting programs, and the three Reports (Catalog Coverage,
 * Program Progress, Project Status).
 *
 * Modal  — use when there's no specific element to point at
 * Callout — use when pointing at a specific element in the current DOM
 */

const TUTORIAL_IMAGING_PROGRAMS = {
    id: 'imaging-programs-reports',
    title: 'Imaging Programs & Reports',
    version: 2,
    nextTutorial: 'utilities',
    steps: [

        // --- Introduction ---
        {
            id: 'welcome',
            type: 'modal',
            title: 'Imaging Programs & Reports',
            body: 'This tutorial covers the <strong>Programs</strong> and <strong>Reports</strong> tabs of the Imaging Log.<br><br>A <strong>Program</strong> is a structured goal to image a defined set of targets — for example, all 110 Messier objects or a custom list of emission nebulae. Astryx tracks your progress automatically by comparing program targets against your existing imaging projects.<br><br><strong>Reports</strong> give you a summary view of everything you have imaged — by catalog, by program progress, and by project status. It takes about 8 minutes.',
            target: null,
            position: 'center',
            waitFor: 'next',
            highlight: false
        },
        {
            id: 'open-imaging-log',
            type: 'callout',
            title: 'Open Imaging Log',
            body: 'Click <strong>Imaging Log</strong> in the left navigation panel to open the view.',
            target: '#sidebar-imaging-log',
            position: 'right',
            waitFor: 'click',
            highlight: true
        },
        {
            id: 'open-programs-tab',
            type: 'callout',
            title: 'Open the Programs Tab',
            body: 'Click the <strong>Programs</strong> tab to switch to the programs view.',
            target: '[data-tab="programs"]',
            position: 'bottom',
            waitFor: 'click',
            highlight: true
        },

        // --- Program cards ---
        {
            id: 'program-cards',
            type: 'callout',
            title: 'Program Cards',
            body: 'Each program appears as a card showing its name, type, total target count, how many you have imaged so far, how many remain, and a progress bar. The status badge updates automatically — <strong>Not Started</strong>, <strong>Started</strong>, or <strong>Complete</strong> — based on your imaging projects.',
            target: '#imaging-log-programs-list',
            position: 'top',
            waitFor: 'next',
            highlight: 'flash'
        },
        {
            id: 'progress-bar',
            type: 'modal',
            title: 'Automatic Progress Tracking',
            body: 'You never need to manually mark a target as imaged in a program. Astryx cross-references your program\'s target list against the targets in all your imaging projects automatically.<br><br>When you add a target to a project and that target is in a program, the program\'s progress count and progress bar update immediately. Alternate designations are also checked — if your project uses NGC 224 and and the target database lists M 31 as an alternate designation, Astryx recognises them as the same object and includes them in both programs.',
            target: null,
            position: 'center',
            waitFor: 'next',
            highlight: false
        },

        // --- New program ---
        {
            id: 'new-program',
            type: 'callout',
            title: 'Creating a Program',
            body: 'Click <strong>New Program</strong> to create a new observing program.',
            target: '#imaging-log-new-program-btn',
            position: 'right',
            waitFor: 'click',
            highlight: true
        },
        {
            id: 'program-name',
            type: 'callout',
            title: 'Program Name',
            body: 'Give the program a descriptive name — for example <em>Messier Program</em>, <em>Caldwell Objects</em>, or <em>Personal NGC Favorites</em>.',
            target: '#program-name',
            position: 'bottom',
            waitFor: 'next',
            highlight: true
        },
        {
            id: 'program-type',
            type: 'callout',
            title: 'Program Type',
            body: 'Choose how the program\'s target list is defined:<br><br><strong>Catalog Pattern</strong> — automatically includes all objects matching a catalog prefix and number range. For example, prefix <em>M</em> with maximum number <em>110</em> defines the complete Messier catalog. The list updates dynamically as the database grows.<br><br><strong>Manual List</strong> — you provide an explicit list of target designations, one per line. Use this for custom programs like a personal selection of showpiece objects or a specific observing challenge list.',
            target: '#program-name',
            position: 'top',
            width: '460px',
            waitFor: 'next',
            highlight: true
        },
        {
            id: 'catalog-pattern',
            type: 'callout',
            title: 'Catalog Pattern Fields',
            body: 'Select <strong>Catalog Pattern</strong>.<br><br>When <strong>Catalog Pattern</strong> is selected, enter the catalog prefix and the highest number in the series.<br><br>For example: prefix <em>NGC</em> and maximum number <em>7840</em> covers the entire NGC catalog. Prefix <em>Sh</em> with maximum <em>313</em> covers the Sharpless catalog.<br><br>Astryx matches targets whose designations start with the prefix followed by a number within the range — spaces and capitalisation are handled automatically.',
            target: '#program-name',
            position: 'top',
            width: '440px',
            waitFor: 'next',
            highlight: false
        },
        {
            id: 'manual-list',
            type: 'callout',
            title: 'Manual List',
            body: 'Select <strong>Manual List</strong>. When <strong>Manual List</strong> is selected, enter target designations one per line in the text area. Astryx matches each entry against the target database and reports how many were found and how many failed to match.<br><br>Failed matches are shown in a collapsible list and can be copied as CSV — useful for identifying typos or designations not yet in the database.',
            target: '#program-name',
            position: 'top',
            width: '440px',
            waitFor: 'next',
            highlight: false
        },
        {
            id: 'save-program',
            type: 'callout',
            title: 'Save the Program',
            body: 'Save the program. For Manual List programs, Astryx will match your target list against the database and show the results before closing. Review any failed matches and correct them if needed.',
            target: '#modal-save-btn',
            position: 'left',
            waitFor: 'click',
            highlight: true
        },
        {
            id: 'edit-delete',
            type: 'callout',
            title: 'Editing and Deleting Programs',
            body: 'Each program card has <strong>Edit Program</strong> and <strong>Delete Program</strong> buttons. Editing reopens the program form so you can update the name, type, or target list. Deleting permanently removes the program — a confirmation is required.<br><br>Deleting a program does not affect your imaging projects or sessions — only the program definition is removed.<br><br>Delete the new program if you don\'t want to keep it. Scroll to the top of the page.',
            target: '#imaging-log-programs-list',
            position: 'top',
            width: '420px',
            waitFor: 'next',
            highlight: false
        },
        {
            id: 'create-from-filter',
            type: 'modal',
            title: 'Creating a Program from Filter Results',
            body: 'There is a faster way to create a Manual List program — directly from a set of filter results in Target Selection.<br><br>In the <strong>Target Selection</strong> view, apply filters to find the targets you want — for example, all emission nebulae in the Caldwell catalog above 10 arcminutes in size. Once you have results, click <strong>Create Imaging Program</strong> in the Filter Results panel header.<br><br>A dialog asks you to name the program and creates it instantly from the filtered targets, matching them against the database automatically. The result is identical to a Manual List program created through the Imaging Log.<br><br>Note: the filter results must contain 199 or fewer targets. If your results exceed this limit, a message will ask you to refine your filters before creating the program.',
            target: null,
            position: 'center',
            waitFor: 'next',
            highlight: false
        },
        {
            id: 'open-reports-tab',
            type: 'callout',
            title: 'Open the Reports Tab',
            body: 'Click the <strong>Reports</strong> tab to see a summary of your imaging history.',
            target: '[data-tab="reports"]',
            position: 'bottom',
            waitFor: 'click',
            highlight: true
        },
        {
            id: 'catalog-coverage',
            type: 'callout',
            title: 'Catalog Coverage Report',
            body: 'The Catalog Coverage report shows how many unique targets you have imaged from each catalog — NGC, Messier, IC, Sharpless, and so on. Counts include alternate designations, so a target recorded as NGC 224 also counts toward the Messier column if M 31 is an alternate designator.<br><br>This gives you a quick overview of which catalogs you have explored and where you have the most depth.<br><br>Scroll to see the <strong>Program Progress</strong> section.',
            target: '#report-catalog-coverage-card',
            position: 'bottom',
            width: '600px',
            waitFor: 'next',
            highlight: 'flash'
        },
        {
            id: 'program-progress',
            type: 'callout',
            title: 'Program Progress Report',
            body: 'The Program Progress report shows detailed progress for each of your programs — how many targets are complete, how many remain, and a progress bar.<br><br>Expand the <strong>Targets Completed</strong> toggle to see which objects you have imaged and which projects they belong to. If you click on the project name, you will immediately jump to that project.<br><br>For Manual List programs, a <strong>Targets yet to be imaged</strong> section shows what remains. Use this as a quick reference when planning your next session.<br><br>Scroll down to the Project Status section and then hit Next.',
            target: '#report-program-progress-card',
            position: 'top',
            width: '440px',
            waitFor: 'next',
            highlight: 'flash'
        },
        {
            id: 'project-status',
            type: 'callout',
            title: 'Project Status Report',
            body: 'The Project Status report counts your projects by status — how many are Planning, Acquiring Data, Acquisition Complete, Processing, and Completed. This is a high-level snapshot of where all your active and finished work stands.<br><br>Note that counts here reflect only the primary target of each project, not alternate designations.',
            target: '#report-project-status-card',
            position: 'top',
            width: '420px',
            scrollTo: true,
            waitFor: 'next',
            highlight: 'flash'
        },

        // --- Complete ---
        {
            id: 'complete',
            type: 'modal',
            title: 'Imaging Programs & Reports Complete',
            body: 'You can now create and manage imaging programs using both Catalog Pattern and Manual List modes, understand how progress is tracked automatically from your projects, and read the three reports to monitor your imaging history.<br><br>Use Programs together with the Projects tab — as you log sessions and add targets to projects, your program progress updates automatically with no extra work required.',
            target: null,
            position: 'center',
            waitFor: 'next',
            highlight: false
        }
    ]
};

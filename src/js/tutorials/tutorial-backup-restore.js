/**
 * tutorial-backup-restore.js
 * "Backup & Restore" tutorial definition.
 * Covers: why backups matter, the two backup types (user data vs targets),
 * performing a real user data backup, performing a real targets backup,
 * clearing the target database, and restoring from a backup file.
 *
 * Modal  — use when there's no specific element to point at
 * Callout — use when pointing at a specific element in the current DOM
 */

const TUTORIAL_BACKUP_RESTORE = {
    id: 'backup-restore',
    title: 'Backup & Restore',
    version: 1,
    nextTutorial: 'sidebar',
    steps: [

        // --- Introduction ---
        {
            id: 'welcome',
            type: 'modal',
            title: 'Backup & Restore',
            body: 'This tutorial walks you through backing up and restoring your Astryx data — and you will perform a real backup and restore as part of it.<br><br>As we step through this important tutorial, it is vital to understand that everything you enter in Astryx is stored exclusively in your browser\'s local storage. <strong>Nothing is stored on any server.</strong><br><br>That is very good for data security and privacy. However, if your browser data is cleared, your device fails, or you switch browsers, your data is gone without a backup. Please backup regularly.<br><br>The tutorial takes about 10 minutes.',
            target: null,
            position: 'center',
            waitFor: 'next',
            highlight: false
        },

        // --- Two backup types ---
        {
            id: 'two-types',
            type: 'modal',
            title: 'Two Types of Backup',
            body: 'Astryx uses two separate backup types:<br><br><strong>User Data</strong> — everything you have personally entered: settings, locations, equipment, pinned targets, To Do List, imaging projects, sessions, and programs. Back this up regularly — after every imaging session or at least weekly. Store copies in cloud storage or on a separate device.<br><br><strong>Target Database</strong> — the 14,000+ object astronomical catalog. This changes rarely and is large. Back it up once during your first use and again if the database is updated. The target version at the bottom of the left sidebar and starts with a \'t\'.',
            target: null,
            position: 'center',
            waitFor: 'next',
            highlight: false
        },

        // --- User Data Backup ---
        {
            id: 'open-backup-userdata',
            type: 'callout',
            title: 'Open Backup',
            body: 'Click the <strong>≡</strong> system menu button to open the system menu.',
            target: '#system-menu-btn',
            position: 'right',
            waitFor: 'click',
            highlight: true
        },
        {
            id: 'click-backup',
            type: 'callout',
            title: 'Open Backup Dialog',
            body: 'Click <strong>Backup</strong> to open the backup dialog.',
            target: '[data-action="new-backup"]',
            position: 'right',
            waitFor: 'click',
            highlight: true
        },
        {
            id: 'select-userdata',
            type: 'callout',
            title: 'Select User Data',
            body: 'Click <strong>Select User Data</strong> to select all your personal data for backup. This checks all user data boxes and disables the Target Database checkbox — the two types are always kept separate.',
            target: '#backup-select-userdata',
            position: 'bottom',
            waitFor: 'click',
            highlight: true
        },
        {
            id: 'userdata-checkboxes',
            type: 'callout',
            title: 'User Data Checkboxes',
            body: 'All user data stores are now checked and the Target Database is disabled. You can uncheck individual items if you only want a partial backup — for example, just your imaging projects and sessions, or perhaps to send your set of Locations to a friend.<br><br>The filename updates automatically to reflect your selection: all boxes checked shows <em>userdata</em>, a single box checked shows the storage type name, and a partial selection shows <em>partial-userdata</em>.',
            target: '#modal-body',
            position: 'top',
            width: '440px',
            waitFor: 'next',
            highlight: false
        },
        {
            id: 'filename-userdata',
            type: 'callout',
            title: 'Backup Filename',
            body: 'The filename is generated automatically and is read-only. It encodes the app name, version, database version, backup type, and a timestamp — for example <em>Astryx-v0.17.2-d8-userdata-20260316-222453</em>.<br><br>This naming convention makes it easy to identify backups by date and type when you need to restore.',
            target: '#backup-filename',
            position: 'top',
            waitFor: 'next',
            highlight: true
        },
        {
            id: 'execute-userdata-backup',
            type: 'callout',
            title: 'Save the Backup',
            body: 'Click <strong>Save Backup</strong>. A compressed ZIP file will be downloaded to your downloads folder. When complete, a success summary shows the filename, file size, and record counts for each data store.',
            target: '#modal-save-btn',
            position: 'left',
            waitFor: 'click',
            highlight: true
        },
        {
            id: 'backup-success',
            type: 'callout',
            title: 'User Data Backup Complete',
            body: 'Your user data backup has been saved to your downloads folder. Move it to cloud storage or a separate device — a backup that only exists on the same machine as the original is not a real backup.<br><br>Now we will back up the Target Database separately.<br><br>Close the success dialog.',
            target: '#modal-close',
            position: 'left',
            width: '440px',
            waitFor: 'click',
            highlight: true
        },
        {
            id: 'open-backup-targets',
            type: 'callout',
            title: 'Open Backup Again',
            body: 'Click the <strong>≡</strong> system menu button.',
            target: '#system-menu-btn',
            position: 'right',
            waitFor: 'click',
            highlight: true
        },
        {
            id: 'click-backup-targets',
            type: 'callout',
            title: 'Open Backup Dialog',
            body: 'Click <strong>Backup</strong> to open the backup dialog again.',
            target: '[data-action="new-backup"]',
            position: 'right',
            waitFor: 'click',
            highlight: true
        },
        {
            id: 'select-targets',
            type: 'callout',
            title: 'Select Targets',
            body: 'Click <strong>Select Targets</strong> to select only the Target Database for backup. All user data boxes are unchecked and disabled — the two backup types are always kept separate.',
            target: '#backup-select-targets',
            position: 'bottom',
            waitFor: 'click',
            highlight: true
        },
        {
            id: 'execute-targets-backup',
            type: 'callout',
            title: 'Save the Target Backup',
            body: 'Click <strong>Save</strong> to execute the target database backup. This file is large — typically several megabytes — but compresses well. Store it somewhere safe. You only need to repeat this if a new target list is released.',
            target: '#modal-save-btn',
            position: 'left',
            waitFor: 'click',
            highlight: true
        },
        {
            id: 'targets-backup-complete',
            type: 'callout',
            title: 'Target Database Backup Complete',
            body: 'Both backups are now saved to your downloads folder. You have a user data backup for regular recovery and a target database backup for full reinstallation. Move your backup files to cloud storage or a separate device — a backup that only exists on the same machine as the original is not a real backup<br><br>Now we will practise restoring the target database — first clearing it, then restoring from the backup file you just created.<br><br>Close the success dialog.',
            target: '#modal-close',
            position: 'left',
            width: '450px',
            waitFor: 'click',
            highlight: true
        },
        {
            id: 'open-system-menu-3',
            type: 'callout',
            title: 'Open System Menu',
            body: 'Click the <strong>≡</strong> system menu button.',
            target: '#system-menu-btn',
            position: 'right',
            waitFor: 'click',
            highlight: true
        },
        {
            id: 'open-admin-tools-2',
            type: 'callout',
            title: 'Open Admin Tools',
            body: 'Click <strong>Admin Tools</strong>.',
            target: '[data-action="admin-tools"]',
            position: 'right',
            waitFor: 'click',
            highlight: true
        },
        {
            id: 'clear-all-targets',
            type: 'callout',
            title: 'Clear All Targets',
            body: 'Click <strong>Clear All Targets</strong>. This permanently removes the entire target database from your browser storage — exactly the situation you would face if browser data was wiped or you moved to a new device.<br><br>A confirmation will be required. After clearing, Target Search will show no results until the database is restored.',
            target: '[data-action="clear-all-targets"]',
            position: 'right',
            waitFor: 'click',
            highlight: true
        },

        // --- Restore ---
        {
            id: 'open-restore',
            type: 'callout',
            title: 'Open Restore',
            body: 'Now open the <strong>≡</strong> system menu and click <strong>Restore</strong> to begin the restore process.',
            target: '#system-menu-btn',
            position: 'right',
            waitFor: 'click',
            highlight: true
        },
        {
            id: 'click-restore',
            type: 'callout',
            title: 'Open Restore Dialog',
            body: 'Click <strong>Restore</strong> to open the restore file picker.',
            target: '[data-action="new-restore"]',
            position: 'right',
            waitFor: 'click',
            highlight: true
        },
        {
            id: 'browse-file',
            type: 'callout',
            title: 'Select Your Backup File',
            body: 'Click <strong>Browse Files</strong> and navigate to the target database backup file you just created — it will be in your downloads folder with <em>targets</em> in the filename. Select the file and click Continue.',
            target: '#modal-save-btn',
            position: 'top',
            waitFor: 'click',
            highlight: true
        },
        {
            id: 'restore-file-info',
            type: 'callout',
            title: 'Backup File Information',
            body: 'The restore dialog shows details about the backup file — filename, creation date, Astryx version, and file size. If the backup is more than 30 days old a warning is shown, since restoring old data may overwrite more recent changes.<br><br>If the database version in the backup does not match your current Astryx version, the restore will be blocked — backups must match the current database schema.',
            target: '#modal-close',
            position: 'top',
            width: '440px',
            waitFor: 'next',
            highlight: false
        },
        {
            id: 'restore-stores',
            type: 'callout',
            title: 'Select What to Restore',
            body: 'The checkboxes show what is available in the backup file. For a target database backup only the Target Database will be listed. For a user data backup you can selectively restore individual stores — for example, restore only your imaging projects without overwriting your current settings.<br><br>Select or deselect as needed for your situation.',
            target: '#modal-close',
            position: 'left',
            width: '420px',
            waitFor: 'next',
            highlight: false
        },
        {
            id: 'restore-warning',
            type: 'callout',
            title: 'Confirm Before Restoring',
            body: 'Read the warning carefully — restoring will permanently delete the selected data stores and replace them with the backup contents. This cannot be undone.<br><br>Check the confirmation checkbox to confirm you understand and have backed up your current data.',
            target: '#restore-confirm-checkbox',
            position: 'top',
            width: '440px',
            waitFor: 'click',
            highlight: true
        },
        {
            id: 'restore-targets',
            type: 'callout',
            title: 'Restore Targets',
            body: 'Click <strong>Restore</strong> to proceed.<br><br><strong>Note:</strong> After clicking Restore, Astryx will reload automatically — this will interrupt the tutorial. To resume the tutorial, open the <strong>≡</strong> menu, go to <strong>Tutorials → Backup & Restore</strong> and resume — it will pick up where you left off.',
            target: '#modal-save-btn',
            position: 'left',
            waitFor: 'click',
            highlight: true
        },
        {
            id: 'restore-complete',
            type: 'modal',
            title: 'Restore Complete',
            body: 'After the restore completes, Astryx will reload automatically. The target database is now restored from your backup — Target Search should show results again.<br><br>The same process applies to restoring user data: open Restore, select your user data backup file, choose which stores to restore, confirm, and Astryx reloads with your data in place.',
            target: null,
            position: 'center',
            waitFor: 'next',
            highlight: false
        },

        // --- Strategy ---
        {
            id: 'strategy',
            type: 'modal',
            title: 'Backup Strategy',
            body: 'A practical backup routine for Astryx:<br><br>1. <strong>After installation</strong> — back up the Target Database once and store it safely. You normally don\'t need to do another targets backup unless a new targets database is released.<br><br>2. <strong>After every imaging session</strong> — back up User Data. This captures your new sessions, updated projects, and any equipment changes.<br><br>3. <strong>At minimum weekly</strong> — back up User Data even if you haven\'t been imaging, to capture any planning changes.<br><br>4. <strong>Store backups redundantly</strong> — cloud storage, a USB drive, or a second device. A backup on the same machine as the original is not a real backup.<br><br>The sidebar indicator shows days since your last backup and turns amber then orange as time passes — use it as your reminder.',
            target: null,
            position: 'center',
            waitFor: 'next',
            highlight: false
        },

        // --- Complete ---
        {
            id: 'complete',
            type: 'modal',
            title: 'Backup & Restore Complete',
            body: 'You have now performed a real user data backup, a real target database backup, cleared the target database, and restored it from your backup file.<br><br>Check the sidebar indicator regularly — it shows how many days since your last backup and reminds you when it\'s time to back up again. Click it any time to review the storage warning and jump directly to the Backup dialog.',
            target: null,
            position: 'center',
            waitFor: 'next',
            highlight: false
        }
    ]
};

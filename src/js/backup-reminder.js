/**
 * backup-reminder.js
 * Manages the backup reminder system:
 *   - Startup check: fires a toast if backup is overdue
 *   - Daily interval check: fires while app is running
 *   - Sidebar indicator: shows days since last backup, color-coded
 *   - Storage warning modal: explains browser storage risks
 */

const BackupReminder = {

    _intervalHandle: null,
    _MS_PER_DAY: 86400000,

    /**
     * Initialize — called from app.js after BackupManager.initAutoBackup()
     * Runs startup check, updates indicator, and starts daily interval
     */
    init() {
        this.updateIndicator();
        this.checkAndNotify();

        // Attach click handler to sidebar indicator
        const indicator = document.getElementById('backup-reminder-indicator');
        if (indicator) {
            indicator.addEventListener('click', () => this.showStorageWarningModal());
        }

        // Daily interval check (24 hours)
        this._intervalHandle = setInterval(() => {
            this.updateIndicator();
            this.checkAndNotify();
        }, this._MS_PER_DAY);
    },

    /**
     * Return days since last backup, or null if never backed up
     */
    daysSinceBackup() {
        const lastBackup = SettingsManager.getSetting('lastBackupTimestamp');
        if (!lastBackup) return null;

        // Handle both DTG string (YYYYMMDD-HHMMSS) and epoch ms (legacy)
        let lastBackupMs;
        if (typeof lastBackup === 'string' && lastBackup.includes('-')) {
            // Parse DTG string: YYYYMMDD-HHMMSS
            const [datePart, timePart] = lastBackup.split('-');
            const year   = parseInt(datePart.substring(0, 4));
            const month  = parseInt(datePart.substring(4, 6)) - 1;
            const day    = parseInt(datePart.substring(6, 8));
            const hour   = parseInt(timePart.substring(0, 2));
            const minute = parseInt(timePart.substring(2, 4));
            const second = parseInt(timePart.substring(4, 6));
            lastBackupMs = new Date(year, month, day, hour, minute, second).getTime();
        } else {
            // Legacy epoch ms
            lastBackupMs = Number(lastBackup);
        }

        if (isNaN(lastBackupMs)) return null;
        return (Date.now() - lastBackupMs) / this._MS_PER_DAY;
    },

    /**
     * Check if backup is overdue and show toast if so
     */
    checkAndNotify() {
        const days = this.daysSinceBackup();
        const reminderInterval = SettingsManager.getBackupReminderDays();

        if (days === null) {
            // Never backed up
            UIManager.showToast(
                'No backup found. Please back up your data regularly — nothing is stored on any server.',
                'warning'
            );
            return;
        }

        if (days >= reminderInterval) {
            const daysRounded = Math.floor(days);
            UIManager.showToast(
                `Last backup was ${daysRounded} day${daysRounded !== 1 ? 's' : ''} ago. Consider backing up your data.`,
                'warning'
            );
        }
    },

    /**
     * Update the sidebar indicator text and color
     */
    updateIndicator() {
        const indicator = document.getElementById('backup-reminder-indicator');
        if (!indicator) return;

        const days = this.daysSinceBackup();

        if (days === null) {
            indicator.textContent = 'Last backup: never';
            indicator.style.color = 'var(--warning-color, #f59e0b)';
            return;
        }

        const daysRounded = Math.floor(days);
        const label = daysRounded === 0
            ? 'Last backup: today'
            : `Last backup: ${daysRounded} day${daysRounded !== 1 ? 's' : ''} ago`;

        indicator.textContent = label;

        // Color based on thresholds — amber and orange avoid red/green confusion
        if (daysRounded >= APP_CONFIG.BACKUP_REMINDER_RED_DAYS) {
            indicator.style.color = '#f97316'; // orange
        } else if (daysRounded >= APP_CONFIG.BACKUP_REMINDER_AMBER_DAYS) {
            indicator.style.color = '#f59e0b'; // amber
        } else {
            indicator.style.color = 'var(--text-secondary)';
        }
    },

    /**
     * Called after any successful backup — updates timestamp display
     */
    onBackupComplete() {
        this.updateIndicator();
    },

    /**
     * Show the storage warning modal when the indicator is clicked
     */
    showStorageWarningModal() {
        UIManager.openModal('backup-reminder-modal-template', 'About Your Data Storage', null);
    }

};

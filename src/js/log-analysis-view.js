/**
 * log-analysis-view.js
 * Session Log Analysis view — ASIAir Autorun + PHD2 guide log parsing and
 * the Combined Report. Extracted from utilities-view.js into its own
 * sidebar view (Issue #254).
 */

const LogAnalysisView = {
    _asiairParsed: null,
    _phd2Parsed: null,
    _learned: null,
    _dropZone: null,
    _unlistenDragDrop: null,

    /**
     * Initialize the view
     */
    init() {
        this._initLogPicker();
        this.initGuideSettingInputs();
        if (window.__TAURI__) {
            this._initTauriDragDrop();
        } else {
            this._initWebDragDrop();
        }
    },

    /**
     * One picker for both logs: a drop box and a Browse button (which opens
     * the hidden file input). Each file's first line says which log it is,
     * so they can come together or one at a time, in either order.
     */
    _initLogPicker() {
        const input = document.getElementById('log-file');
        const browse = document.getElementById('log-browse');
        this._dropZone = document.getElementById('log-drop');
        if (!input || !browse || !this._dropZone) return;
        browse.addEventListener('click', () => input.click());
        input.addEventListener('change', () => {
            this._loadFiles([...input.files]);
            // Lets the same file be chosen again
            input.value = '';
        });
    },

    async _loadFiles(files) {
        const logs = [];
        for (const file of files) {
            if (this._isLogFileName(file.name)) logs.push({ fileName: file.name, text: await file.text() });
        }
        this._loadLogs(logs);
    },

    _isLogFileName(fileName) {
        if (fileName.toLowerCase().endsWith('.txt')) return true;
        UIManager.showToast(`${fileName} isn't a log file: logs are .txt files`, 'warning');
        return false;
    },

    /**
     * Sorts each {fileName, text} into the Session Log or the PHD2 Guide
     * Log by its first line, then redraws the report once for them all. A
     * log replaces the one of its kind already loaded.
     */
    async _loadLogs(logs) {
        let loaded = false;
        for (const { fileName, text } of logs) {
            const log = LogAnalysisManager.parseLog(text);
            if (log?.kind === 'session') {
                this._asiairParsed = log.parsed;
                document.getElementById('session-log-name').textContent = fileName;
                // Deliberate, explicit update — parse() itself performs no
                // writes (ELR.p1-4). Opening a log via this picker is treated
                // as a deliberate refresh of planning values, not a pure read.
                this._learned = await AsiairLogParser.updateLearnedValues(log.parsed);
                if (this._learned.alreadyLearned) {
                    UIManager.showToast('This Session Log has already updated the stored sub gap and dither values, so they were not changed again', 'warning', APP_CONFIG.TOAST_LONG_DURATION_MS);
                }
            } else if (log?.kind === 'guide') {
                this._phd2Parsed = log.parsed;
                document.getElementById('phd2-log-name').textContent = fileName;
            } else {
                UIManager.showToast(`${fileName} isn't an ASIAir Autorun log or a PHD2 guide log`, 'warning');
                continue;
            }
            loaded = true;
        }
        if (!loaded) return;
        await this._tryRenderCombinedReport();
        if (!LogAnalysisManager.logsFromSameNight(this._asiairParsed, this._phd2Parsed)) {
            UIManager.showToast('The PHD2 Guide Log doesn\'t overlap the Session Log in time, so they may be from different nights', 'warning', APP_CONFIG.TOAST_LONG_DURATION_MS);
        }
    },

    _highlightDropZone(on) {
        this._dropZone?.classList.toggle('log-drop-active', on);
    },

    // Whether a window position is over the drop box
    _isOverDropZone(x, y) {
        const el = document.elementFromPoint(x, y);
        return el != null && this._dropZone != null && this._dropZone.contains(el);
    },

    /**
     * Web: the browser's own drag and drop. A drop that misses the box is
     * ignored rather than letting the browser open the file in place of
     * the app.
     */
    _initWebDragDrop() {
        const card = document.getElementById('log-analysis-card');
        if (!card) return;
        card.addEventListener('dragover', (e) => {
            e.preventDefault();
            this._highlightDropZone(this._isOverDropZone(e.clientX, e.clientY));
        });
        card.addEventListener('dragleave', (e) => {
            if (!card.contains(e.relatedTarget)) this._highlightDropZone(false);
        });
        card.addEventListener('drop', (e) => {
            e.preventDefault();
            this._highlightDropZone(false);
            if (this._isOverDropZone(e.clientX, e.clientY)) this._loadFiles([...e.dataTransfer.files]);
        });
    },

    /**
     * Desktop: Tauri takes file drops itself and never passes them to the
     * page, so listen for its drag-drop events instead. A drop gives the
     * files' paths, which Tauri then allows the fs plugin to read. Positions
     * arrive in physical pixels.
     */
    async _initTauriDragDrop() {
        this._removeTauriDragDrop();
        const toCss = (p) => ({ x: p.x / window.devicePixelRatio, y: p.y / window.devicePixelRatio });
        const unlisten = await window.__TAURI__.webview.getCurrentWebview().onDragDropEvent(async (event) => {
            const { type, position, paths } = event.payload;
            if (type === 'leave') {
                this._highlightDropZone(false);
                return;
            }
            const { x, y } = toCss(position);
            const over = this._isOverDropZone(x, y);
            if (type !== 'drop') {
                this._highlightDropZone(over);
                return;
            }
            this._highlightDropZone(false);
            if (!over || !paths) return;
            const logs = [];
            for (const path of paths) {
                const fileName = path.split(/[\\/]/).pop();
                if (!this._isLogFileName(fileName)) continue;
                try {
                    logs.push({ fileName, text: await window.__TAURI__.fs.readTextFile(path) });
                } catch (e) {
                    UIManager.showToast(`Couldn't read ${fileName}: ${e}`, 'error');
                }
            }
            this._loadLogs(logs);
        });
        // The view may have been left while the listener was being set up
        if (this._dropZone == null) {
            unlisten();
            return;
        }
        this._unlistenDragDrop = unlisten;
    },

    _removeTauriDragDrop() {
        if (this._unlistenDragDrop) {
            this._unlistenDragDrop();
            this._unlistenDragDrop = null;
        }
    },

    /**
     * Guide Stability and settle time inputs. Neither log records them;
     * the last values are remembered, and a change redraws the combined
     * report so it judges the night against the settings actually used.
     */
    initGuideSettingInputs() {
        const inputs = [
            { id: 'log-guide-stability', get: () => SettingsManager.getGuideStabilityArcsec(), set: (v) => SettingsManager.setGuideStabilityArcsec(v) },
            { id: 'log-guide-settle-time', get: () => SettingsManager.getGuideSettleTimeS(), set: (v) => SettingsManager.setGuideSettleTimeS(v) },
        ];
        for (const { id, get, set } of inputs) {
            const input = document.getElementById(id);
            if (!input) continue;
            input.value = get();
            input.addEventListener('change', async () => {
                const value = parseFloat(input.value);
                if (!Number.isFinite(value) || value <= 0) {
                    input.value = get();
                    return;
                }
                await set(value);
                this._tryRenderCombinedReport();
            });
        }
    },

    /**
     * Renders the Combined Report (ELR.p5-1) once the Session Log is
     * loaded, with or without the PHD2 log. PHD2 alone can't fuse
     * (fuseNight requires the ASIAir side), so a PHD2 log on its own only
     * shows a note asking for the Session Log.
     */
    async _tryRenderCombinedReport() {
        const container = document.getElementById('session-analysis-accordions');
        const waiting = document.getElementById('log-analysis-waiting');
        if (waiting) waiting.remove();
        if (!this._asiairParsed) {
            if (container && this._phd2Parsed) {
                container.insertAdjacentHTML('beforeend', '<p id="log-analysis-waiting" class="session-report-note-small">PHD2 Guide Log loaded. Load the Session Log from the same night to see the Combined Report.</p>');
            }
            return;
        }
        const { fused, context } = await LogAnalysisManager.analyze(this._asiairParsed, this._phd2Parsed, this._learned);
        SessionReportView.render(fused, context);
    },

    /**
     * Cleanup when view is destroyed
     */
    destroy() {
        // The Tauri drag-drop listener is window-wide, so it outlives the view
        // unless removed here
        this._removeTauriDragDrop();
        this._dropZone = null;
    }
};

// ----------------------------------------------------------------------
// ----------------------------------------------------------------------
// ----------------------------------------------------------------------

/**
 * cli-tasks.js
 * Desktop command-line subcommands (issue #292). Rust parses the command
 * line (src-tauri/src/cli.rs) and keeps the window hidden; App hands the
 * subcommand here instead of starting the app. Each task calls code the app
 * already uses and returns an exit code. Messages for the person go to
 * stderr, so stdout carries only a task's output.
 */

const CliTasks = {
    // The same for every subcommand, and listed in `astryx --help`
    EXIT: { OK: 0, FAILED: 1, USAGE: 2 },

    // Subcommand name, as in cli.rs → async (command) => exit code
    tasks: {
        'reset-learned': async () => {
            await SettingsManager.resetLearnedValues();
            await CliTasks.stderr('Learned Sub Gap and Dither Duration reset to their defaults');
            return CliTasks.EXIT.OK;
        },

        // The Log Analysis view's steps for one pair of logs, with the
        // Download PDF Report button's PDF written to stdout (issue #293).
        // cli.rs has already refused a stdout that isn't redirected.
        'analyze-logs': async ({ log1, log2 }) => {
            const logs = {};
            for (const path of [log1, log2]) {
                const log = LogAnalysisManager.parseLog(await CliTasks.readFile(path));
                if (!log) throw new Error(`${path} isn't an ASIAir Autorun log or a PHD2 guide log`);
                if (logs[log.kind]) {
                    throw new Error(`${logs[log.kind].path} and ${path} are both ${CliTasks.LOG_NAMES[log.kind]}s; give one of each`);
                }
                logs[log.kind] = { path, parsed: log.parsed };
            }
            const { session, guide } = logs;

            // Refused before learning, so the wrong night's Session Log
            // isn't averaged in
            if (!LogAnalysisManager.logsFromSameNight(session.parsed, guide.parsed)) {
                const ranges = LogAnalysisManager.logTimeRanges(session.parsed, guide.parsed);
                const range = ({ start, end }) => `${CliTasks._dateTime(start)} to ${CliTasks._dateTime(end)}`;
                throw new Error('the logs don\'t overlap in time, so they\'re from different nights:\n'
                    + `  ${session.path}: ${range(ranges.session)}\n`
                    + `  ${guide.path}: ${range(ranges.guide)}`);
            }

            const learned = await AsiairLogParser.updateLearnedValues(session.parsed);
            for (const [name, which] of [['Sub Gap', 'subGap'], ['Dither Duration', 'dither']]) {
                await CliTasks.stderr(`Learned ${name}: ${SessionRecommendations._learnedValueText(session.parsed, which, learned)}`);
            }

            const { fused, context } = await LogAnalysisManager.analyze(session.parsed, guide.parsed, learned);
            const pdf = await SessionReportPdf.bytes(fused, context);
            if (!pdf) throw new Error(`${session.path} has no light subs, so there's no report`);
            await CliTasks.stdout(pdf);
            return CliTasks.EXIT.OK;
        },
    },

    // LogAnalysisManager.parseLog kinds, as the Log Analysis view names them
    LOG_NAMES: { session: 'Session Log', guide: 'PHD2 Guide Log' },

    // A log time in the chosen Date Format, e.g. 2026-10-12 21:04
    _dateTime(date) {
        const day = TimeUtils.formatWallClock(date).slice(0, 10).replace(/\//g, '-');
        return `${TimeUtils.formatDisplayDate(day)} ${AsiairLogParser.fmtTime(date)}`;
    },

    /**
     * The subcommand Astryx was started with, e.g. { command: 'reset-learned' },
     * or null for a normal start (always null on the web)
     */
    async getCommand() {
        if (!window.__TAURI__) return null;
        return window.__TAURI__.core.invoke('get_cli_command');
    },

    /** Run the subcommand's task, then end the process with its exit code */
    async run(command) {
        let code = this.EXIT.FAILED;
        try {
            const task = this.tasks[command.command];
            if (task) code = await task(command);
            else await this.stderr(`Astryx has no task for "${command.command}"`);
        } catch (error) {
            await this.stderr(`${command.command} failed: ${error.message ?? error}`);
        } finally {
            await this.exit(code);
        }
    },

    /** End a command-line run whose startup failed */
    async fail(error) {
        try {
            await this.stderr(`Astryx couldn't start: ${error.message ?? error}`);
        } finally {
            await this.exit(this.EXIT.FAILED);
        }
    },

    stderr(text) {
        return window.__TAURI__.core.invoke('cli_write_stderr', { text });
    },

    /** bytes: a Uint8Array, sent as a plain array (see cli_write_stdout) */
    stdout(bytes) {
        return window.__TAURI__.core.invoke('cli_write_stdout', { bytes: Array.from(bytes) });
    },

    readFile(path) {
        return window.__TAURI__.core.invoke('cli_read_file', { path });
    },

    exit(code) {
        return window.__TAURI__.core.invoke('cli_exit', { code });
    },
};

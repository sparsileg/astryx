/**
 * session-analysis.test.js
 * Log Analysis on small made-up Autorun and PHD2 logs, run through the real
 * parsers, fusion and recommendations. just test-js runs this under four
 * computer time zones, so a result that follows the computer's zone fails
 * in at least one of them.
 */

const { test } = require('node:test');
const assert = require('node:assert');
const { loadApp, get } = require('./lib/app-context');
const { SITES } = require('./lib/sites');

const context = loadApp([
    'js/asiair-log-parser.js',
    'js/phd2-log-parser.js',
    'js/config.js',
    'js/settings-manager.js',
    'js/utils-time.js',
    'js/astro-core.js',
    'js/astro-target.js',
    'js/session-invariants.js',
    'js/session-fusion.js',
    'js/session-detectors.js',
    'js/session-recommendations.js',
    'js/utils-html.js',
    'js/session-report-view.js',
    'js/session-report-pdf.js',
]);
// HtmlUtils.escapeHtml escapes through the DOM; this does what a browser's textContent/innerHTML does
context.document = {
    createElement: () => ({
        set textContent(text) { this.innerHTML = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); },
    }),
};
const { APP_CONFIG, SessionReportView, SessionReportPdf, AsiairLogParser, SettingsManager, TimeUtils, SessionFusion, SessionRecommendations, dateToJD, jdToDate, findTargetTransit } =
    get(context, '({ APP_CONFIG, SessionReportView, SessionReportPdf, AsiairLogParser, SettingsManager, TimeUtils, SessionFusion, SessionRecommendations, dateToJD, jdToDate, findTargetTransit })');

// Arrays made in the app's context are spread into this one before deepStrictEqual
const parse = lines => AsiairLogParser.parse(lines.join('\n'));
const runEvents = (parsed, type) => parsed.runs.flatMap(r => r.events).filter(e => e.type === type);

// A run's header: Autorun start, the target's position, 300 s light frames
const runStart = (time, target = 'M 31') => [
    `${time} [Autorun|Begin] ${target} Start`,
    `${time} Mount slews to target position: RA:5h18m12s DEC:+34°22'57"`,
    `${time} Shooting 48 light frames, exposure 300.0s Bin1`,
];

// Taken from a real log, 2025-10-24 at a site on US Eastern time
const flipNight = (withEnd) => [
    ...runStart('2025/10/24 03:50:00'),
    '2025/10/24 04:00:20 Exposure 300.0s image 1#',
    '2025/10/24 04:05:21 Exposure 300.0s image 2#',
    '2025/10/24 04:10:22 Exposure 300.0s image 3#',
    '2025/10/24 04:15:24 [Guide] Dither',
    '2025/10/24 04:15:24 [Guide] Dither Settle',
    '2025/10/24 04:15:48 [Guide] Settle Done',
    '2025/10/24 04:15:48 [Guide] Stop Guiding',
    '2025/10/24 04:15:49 Stop Tracking',
    '2025/10/24 04:15:49 [Meridian Flip|Begin] Wait 5min12s to Meridian Flip',
    '2025/10/24 04:21:01 Meridian Flip 1# Start',
    '2025/10/24 04:21:01 [AutoCenter|Begin] Auto-Center 1#',
    `2025/10/24 04:21:01 Mount slews to target position: RA:5h18m12s DEC:+34°22'57"`,
    '2025/10/24 04:21:32 Exposure 5.0s',
    '2025/10/24 04:21:38 Plate Solve',
    `2025/10/24 04:21:40 Solve succeeded: RA:5h18m12s DEC:+34°22'36" Angle = 19.302, Star number = 341`,
    '2025/10/24 04:21:51 [AutoCenter|End] The target is centered',
    ...(withEnd ? ['2025/10/24 04:21:51 [Meridian Flip|End] Meridian Flip succeeded'] : []),
    '2025/10/24 04:21:51 Start Tracking',
    '2025/10/24 04:21:56 [AutoFocus|Begin] Run AF after Auto Meridian filpped, exposure 2.0s Bin1, temperature 9.2℃',
    '2025/10/24 04:23:30 [AutoFocus|End] Auto focus succeeded',
    '2025/10/24 04:23:31 [Guide] Start Guiding',
    '2025/10/24 04:24:00 [Guide] Settle Done',
    '2025/10/24 04:24:00 Exposure 300.0s image 4#',
    '2025/10/24 04:29:01 Exposure 300.0s image 5#',
    '2025/10/24 04:34:02 [Guide] Dither',
    '2025/10/24 04:34:20 [Guide] Settle Done',
    '2025/10/24 04:34:21 Exposure 300.0s image 6#',
    '2025/10/24 04:39:30 [Autorun|End] Finish Autorun',
];

// Issue #303
test('a log time names the clock at the location, daylight saving included', () => {
    const instant = (text, site) => TimeUtils.wallClockToInstant(TimeUtils.parseWallClock(text), SITES[site]).toISOString();
    assert.strictEqual(instant('2026/01/15 22:00:00', 'home'), '2026-01-16T03:00:00.000Z');
    assert.strictEqual(instant('2026/07/15 22:00:00', 'home'), '2026-07-16T02:00:00.000Z');
    // Either side of the spring-forward hour
    assert.strictEqual(instant('2026/03/08 01:30:00', 'home'), '2026-03-08T06:30:00.000Z');
    assert.strictEqual(instant('2026/03/08 03:30:00', 'home'), '2026-03-08T07:30:00.000Z');
    assert.strictEqual(instant('2026/01/15 22:00:00', 'cerroTololo'), '2026-01-16T01:00:00.000Z');
    assert.strictEqual(instant('2026-07-15 22:00:00', 'capeTown'), '2026-07-15T20:00:00.000Z');
});

// Issue #303
test('report times are the log\'s own text', () => {
    const parsed = parse(flipNight(true));
    assert.strictEqual(TimeUtils.formatWallClock(parsed.wallClock.start), '2025/10/24 03:50:00');
    assert.strictEqual(AsiairLogParser.fmtTime(parsed.runs[0].blocks[0].subs[0].startedAt), '04:00');
});

// Issue #303
test('Meridian Flip Verification uses the location\'s clock, not the computer\'s', () => {
    const location = SITES.home;
    const parsed = parse(flipNight(true));
    const flip = runEvents(parsed, 'meridian_flip')[0];
    const derived = SessionRecommendations._deriveMeridianTiming(flip, parsed.runs[0], location);

    // 04:15:49 and 04:21:01 EDT, written out in UTC
    const pauseMs = Date.UTC(2025, 9, 24, 8, 15, 49);
    const flipMs = Date.UTC(2025, 9, 24, 8, 21, 1);
    const centerJD = dateToJD(new Date(pauseMs));
    const coords = parsed.runs[0].coords;
    const transitMs = jdToDate(findTargetTransit(centerJD - 0.25, centerJD + 0.25, coords.raHours, coords.decDeg, location.longitude)).getTime();

    assert.strictEqual(derived.xS, (transitMs - pauseMs) / 1000);
    assert.strictEqual(derived.yS, (flipMs - transitMs) / 1000);
});

// Issue #303
test('learned nights stored under the old key are still recognized', () => {
    const logStart = '2025/10/23 20:26:16';
    // The old key: the log's time read in the computer's zone, as ISO text
    const oldKey = new Date(2025, 9, 23, 20, 26, 16).toISOString();
    SettingsManager.settings.learnedNights = [{ start: oldKey, subGapS: 2 }, { start: '2025/10/20 19:00:00', subGapS: 3 }];

    assert.strictEqual(SettingsManager._rekeyLearnedNights(), true);
    assert.deepStrictEqual([...SettingsManager.getLearnedNights().map(n => n.start)], [logStart, '2025/10/20 19:00:00']);
    assert.strictEqual(SettingsManager.hasLearnedFromLog(logStart), true);
    assert.strictEqual(SettingsManager._rekeyLearnedNights(), false);
    delete SettingsManager.settings.learnedNights;
});

// Issue #319
test('a meridian flip with no end line keeps the subs, autofocus and dither after it', () => {
    const complete = parse(flipNight(true));
    const noEnd = parse(flipNight(false));
    const legacySubs = parsed => parsed.events.filter(e => e.type === 'imaging').reduce((n, e) => n + e.subCount, 0);

    assert.strictEqual(legacySubs(noEnd), legacySubs(complete));
    assert.strictEqual(legacySubs(noEnd), 6);
    for (const type of ['autofocus', 'dither']) {
        assert.strictEqual(runEvents(noEnd, type).length, runEvents(complete, type).length, type);
    }
    assert.strictEqual(runEvents(complete, 'meridian_flip')[0].outcome, 'succeeded');
    assert.strictEqual(runEvents(noEnd, 'meridian_flip')[0].outcome, 'interrupted');
    assert.deepStrictEqual([...noEnd.parseFailures.filter(f => f.type === 'meridian_flip').map(f => f.reason)], ['imaging_resumed']);
    assert.strictEqual(complete.parseFailures.filter(f => f.type === 'meridian_flip').length, 0);
});

// Issue #320
test('effective frames per dither is found from the dither events', () => {
    const parsed = parse(flipNight(true));
    // 3 subs before the first dither, 2 before the second
    const info = SessionRecommendations.buildFramesPerDitherInfo({ asiairParsed: parsed });
    assert.strictEqual(info.count, 2);
    assert.strictEqual(info.consistent, false);
    assert.match(info.text, /varies \(2, 3 subs\)/);
});

// Two runs whose image numbers both start at 1
const twoRuns = [
    ...runStart('2026/06/05 22:00:00', 'M 12'),
    '2026/06/05 22:01:00 Exposure 300.0s image 1#',
    '2026/06/05 22:06:02 Exposure 300.0s image 2#',
    '2026/06/05 22:11:04 Exposure 300.0s image 3#',
    '2026/06/05 22:16:06 Exposure 300.0s image 4#',
    '2026/06/05 22:21:10 [Autorun|End] Finish Autorun',
    ...runStart('2026/06/05 22:30:00', 'M 10'),
    '2026/06/05 22:31:00 Exposure 300.0s image 1#',
    '2026/06/05 22:36:03 Exposure 300.0s image 2#',
    '2026/06/05 22:41:06 Exposure 300.0s image 3#',
    '2026/06/05 22:46:10 [Autorun|End] Finish Autorun',
];

// Issue #321
test('Sub Gap matches each sub to its own tier when a second run restarts the image numbers', () => {
    const parsed = parse(twoRuns);
    const fused = SessionFusion.fuseNight(parsed);
    // Only the second run's subs are clean
    for (const sub of fused.subs) sub.tier = sub.target === 'M 10' ? 'clean' : 'reject';

    const rec = SessionRecommendations._subGapRec(fused, parsed, null);
    assert.match(rec.observed, /^3\.0s \(n=2,/);
});

// Issue #322
test('a dither that times out leaves only the next sub unsettled', () => {
    const parsed = parse([
        ...runStart('2026/10/12 21:00:00'),
        '2026/10/12 21:01:00 Exposure 300.0s image 1#',
        '2026/10/12 21:06:01 [Guide] Dither',
        '2026/10/12 21:07:01 [Guide] Settle Timeout',
        '2026/10/12 21:07:02 Exposure 300.0s image 2#',
        '2026/10/12 21:12:03 Exposure 300.0s image 3#',
        '2026/10/12 21:17:04 [Guide] Dither',
        '2026/10/12 21:17:30 [Guide] Settle Done',
        '2026/10/12 21:17:31 Exposure 300.0s image 4#',
        '2026/10/12 21:22:40 [Autorun|End] Finish Autorun',
    ]);
    const fused = SessionFusion.fuseNight(parsed);
    assert.deepStrictEqual([...fused.subs.map(s => s.settledAtStart)], [true, false, true, true]);
});

// Issue #323
test('guide RMS over several subs pools their frames', () => {
    const subs = [
        { guide: { rmsTotal: 1.0, frameCount: 100 } },
        { guide: { rmsTotal: 3.0, frameCount: 1 } },
        { guide: { rmsTotal: null, frameCount: 0 } },
    ];
    // √((100·1² + 1·3²) / 101), not the mean of 1.0 and 3.0
    assert.ok(Math.abs(SessionFusion.pooledGuideRms(subs, 'rmsTotal') - Math.sqrt(109 / 101)) < 1e-12);
    assert.strictEqual(SessionFusion.pooledGuideRms([], 'rmsTotal'), null);
});

// Issue #323
test('each guide frame uses its own session\'s pixel scale, and a frame with none is left out', () => {
    const frame = t => ({ t, raRaw: 1, decRaw: 0, settled: true, snr: 40 });
    const index = SessionFusion._buildGuideIndex({
        sessions: [
            { startTime: '2026-07-23 02:00:00', equipment: { pixelScaleArcsec: 2 }, frames: [frame(10)], drops: [] },
            { startTime: '2026-07-23 03:00:00', equipment: { pixelScaleArcsec: 4 }, frames: [frame(10)], drops: [] },
            { startTime: '2026-07-23 04:00:00', equipment: {}, frames: [frame(10)], drops: [] },
        ],
    });
    const at = (h) => TimeUtils.parseWallClock(`2026/07/23 0${h}:00:00`).getTime();
    const window = h => SessionFusion._joinGuideWindow(index, at(h), at(h) + 60000);

    assert.strictEqual(window(2).rmsRa, 2);
    assert.strictEqual(window(3).rmsRa, 4);
    assert.strictEqual(window(4).frameCount, 0);
});

// Issue #324: the screen and the PDF both print this note
test('the Behavior note describes the learned values as the average of the last nights', () => {
    const { note } = SessionReportView._recommendationGroups().find(g => g.key === 'behavior');
    const nights = APP_CONFIG.ASIAIR_LEARNED_WINDOW_NIGHTS;
    assert.ok(note.includes(`Moving Average is the average of the last ${nights} nights learned from, by date`), note);
    assert.ok(note.includes(`about 1/${nights} of its difference`), note);
    assert.doesNotMatch(note, /halfway/i);
});

// Issue #325: severity and needed changes in words, not by color alone
test('the report says each finding\'s level and which settings to change, on screen and in the PDF', () => {
    const parsed = parse(twoRuns);
    const fs = SessionFusion.fuseNight(parsed);
    const at = fs.subs[1].startedAt;
    const finding = (severity, title) => ({ code: 'TEST', severity, title, detail: '', confidence: 'measured',
        affectedSubs: [], ruledOut: [], timeRange: { from: at, to: fs.subs[2].startedAt } });
    fs.findings = [finding('critical', 'Guide star lost'), finding('warning', 'Dither timed out')];
    fs.invariants = [{ id: 'I5', passed: false, severity: 'warning', impact: 'Guide join skipped' }];
    const rec = (setting, changeNeeded) => SessionRecommendations._makeRec({ group: 'behavior', setting, observed: '1.0s',
        recommended: '2.0s', changeNeeded, evidence: 'made up', confidence: 'measured', expectedImpact: 'none' });
    const guideRow = (setting, changeNeeded) => ({ setting, yours: '1', tonight: '2', assessment: 'made up', confidence: 'measured', changeNeeded });
    const context = { asiairParsed: parsed, phd2Parsed: null };

    // Only the report's own wording is under test, so its two row sources give fixed rows
    const { build, buildGuidingSettings } = SessionRecommendations;
    SessionRecommendations.build = () => [rec('Sub Gap', true), rec('Dither Duration', false)];
    SessionRecommendations.buildGuidingSettings = () => ({ summary: [], rows: [guideRow('Min Move', true), guideRow('Max Duration', false)] });
    try {
        const html = [
            SessionReportView._buildFindingsHtml(fs, context),
            SessionReportView._buildTimelineHtml(fs, context),
            SessionReportView._buildDataQualityHtml(fs, context),
            SessionReportView._buildRecommendedSettingsHtml(fs, context),
            SessionReportView._buildGuidingSettingsHtml(context),
        ].join('');
        for (const text of ['<strong>Critical — Guide star lost</strong>', '<strong>Warning — Dither timed out</strong>',
            '<td>Critical — Guide star lost</td>', 'Warning — <strong>I5</strong>',
            'Sub Gap<br><strong>Change suggested</strong>', 'Min Move<br><strong>Change suggested</strong>']) {
            assert.ok(html.includes(text), `screen: ${text}`);
        }
        assert.ok(!/(Dither Duration|Max Duration)<br><strong>Change suggested/.test(html), 'screen: unchanged rows unmarked');
        assert.doesNotMatch(html, /🔴|🟡|🔵/);

        // Every piece of text in the PDF, in order
        const pdfText = node => typeof node === 'string' ? node
            : Array.isArray(node) ? node.map(pdfText).join('')
            : node && typeof node === 'object' ? ['text', 'stack', 'columns', 'table', 'body', 'ul', 'ol'].filter(k => k in node).map(k => pdfText(node[k])).join('|')
            : '';
        const pdf = pdfText(SessionReportPdf._docDefinition(fs, context).content);
        for (const text of ['Critical — Guide star lost', 'Warning — Dither timed out',
            'Sub Gap\nChange suggested', 'Min Move\nChange suggested']) {
            assert.ok(pdf.includes(text), `PDF: ${text}`);
        }
        assert.ok(!/(Dither Duration|Max Duration)\nChange suggested/.test(pdf), 'PDF: unchanged rows unmarked');
    } finally {
        Object.assign(SessionRecommendations, { build, buildGuidingSettings });
    }
});

// Behavior checks in headless Chromium, each in a fresh browser profile (empty
// IndexedDB), acting as a user would where a form is involved. Covers fixes
// whose result can only be seen in the running web build. Playwright lives
// outside the repo; see `just ui-checks` (optionally: just ui-checks 326).
import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
import assert from 'node:assert';

const require = createRequire(process.env.PLAYWRIGHT_DIR + '/');
const { chromium } = require('playwright');

// Not 1420: `just dev` serves there, and this run must test its own src
const PORT = 1430;
const URL = `http://localhost:${PORT}`;
const ONLY = process.argv[2];
const READY_MS = 30000;
const ACTION_MS = 10000;
const TOAST_MS = 3000;
const SETTLE_MS = 500;
const BEST_MONTHS_MS = 60000;
const MIN_ALTITUDE = 35;
const MIN_DARK_HOURS = 2;

const SITES = {
    'Test Site': { latitude: '39.2967', longitude: '-78.1981', elevation: '233', zone: 'America/New_York' },
    'Dark Site': { latitude: '-30.17', longitude: '-70.81', elevation: '2207', zone: 'America/Santiago' },
};

async function portInUse() {
    try { await fetch(URL); return true; } catch { return false; }
}

async function waitForServer() {
    for (let i = 0; i < 50; i++) {
        try { if ((await fetch(URL)).ok) return; } catch { /* not up yet */ }
        await new Promise(r => setTimeout(r, 200));
    }
    throw new Error('server did not start');
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

// Runs navigate (goto or reload) and waits until the app has finished
// starting `starts` times, Best Months it calculates at startup included
async function untilReady(page, navigate, starts = 1) {
    let started = 0;
    const ready = page.waitForEvent('console', {
        predicate: m => m.text().includes('Astryx initialized successfully') && ++started === starts, timeout: READY_MS,
    });
    await navigate();
    await ready;
    await page.evaluate(() => TutorialEngine._teardown());
}

// A page in a fresh profile. Confirm dialogs are answered from page.answers
// (true accepts, false dismisses; dismissed when empty) and recorded in
// page.dialogs; downloads are recorded in page.downloads.
async function freshApp(browser) {
    const context = await browser.newContext({ viewport: { width: 1600, height: 1000 } });
    context.setDefaultTimeout(ACTION_MS);
    const page = await context.newPage();
    page.dialogs = [];
    page.answers = [];
    page.downloads = [];
    page.on('dialog', d => {
        page.dialogs.push(d.message());
        page.answers.shift() ? d.accept() : d.dismiss();
    });
    page.on('download', d => page.downloads.push(d.suggestedFilename()));
    // A fresh profile loads the target catalogue, then reloads and starts again
    await untilReady(page, () => page.goto(URL), 2);
    return page;
}

const reload = page => untilReady(page, () => page.reload());

const toast = (page, type, text) => page.locator(`.toast-${type}`, { hasText: text }).first().waitFor({ timeout: TOAST_MS });
const modalOpen = page => page.locator('#modal').evaluate(m => m.classList.contains('active'));
const modalClosed = page => page.waitForFunction(() => !document.getElementById('modal').classList.contains('active'));

async function openAdminItem(page, action) {
    await page.click('#system-menu-btn');
    await page.click('[data-action="admin-tools"]');
    await page.click(`[data-action="${action}"]`);
}

async function pickDropdown(page, idPrefix, text) {
    await page.click(`#${idPrefix}-trigger`);
    await page.click(`#${idPrefix}-menu .astryx-dropdown-item:has-text("${text}")`);
}

// Fill Manage Locations' form and save; a save that succeeds closes the dialog
async function fillLocation(page, name, site) {
    const { latitude, longitude, elevation, zone } = SITES[site];
    await page.fill('#manage-location-name', name);
    await page.fill('#manage-time-zone', zone);
    await page.fill('#manage-latitude', latitude);
    await page.fill('#manage-longitude', longitude);
    await page.fill('#manage-elevation', elevation);
    await page.click('#modal-save-btn');
}

async function addLocations(page, ...names) {
    for (const name of names) {
        await openAdminItem(page, 'manage-locations');
        await fillLocation(page, name, name);
        await toast(page, 'success', name);
    }
}

async function selectLocation(page, name) {
    await pickDropdown(page, 'location-dropdown', name);
    await page.waitForTimeout(SETTLE_MS);
}

const calculateBestMonths = (page, name, minAltitude = MIN_ALTITUDE) =>
    page.evaluate(([n, alt, dark]) => BestMonths.calculateBestMonths(n, alt, dark), [name, minAltitude, MIN_DARK_HOURS]);

// Every target's Best Months fields for a location, from memory or from the
// database, as one string to compare
const bestMonthsSnapshot = (page, name, fromDb = false) => page.evaluate(async ([n, db]) => {
    const targets = db ? await DBManager.getAll(APP_CONFIG.STORES.TARGETS) : DataManager.getTargets();
    return JSON.stringify(targets.map(t => DataManager.PER_LOCATION_FIELDS.map(f => t[f]?.[n])));
}, [name, fromDb]);

const hasBestMonths = (page, name) => page.evaluate(n => UIManager.locationHasBestMonths(n), name);
const holdsAnyBestMonths = (page, name) => page.evaluate(async n => (await DBManager.getAll(APP_CONFIG.STORES.TARGETS))
    .some(t => DataManager.PER_LOCATION_FIELDS.some(f => t[f]?.[n] !== undefined)), name);

async function openEquipmentTab(page, tab) {
    await openAdminItem(page, 'manage-equipment');
    if (tab) await page.click(`[data-tab="${tab}"]`);
}

async function saveTelescope(page, name, focalLength) {
    await page.fill('#telescope-name', name);
    await page.fill('#telescope-focal-length', String(focalLength));
    await page.fill('#telescope-aperture', '80');
    await page.click('#equipment-save-telescope-btn');
    await page.waitForTimeout(SETTLE_MS);
}

async function saveSensor(page, name, resolutionX) {
    await page.fill('#sensor-name', name);
    await page.fill('#sensor-resolution-x', String(resolutionX));
    await page.fill('#sensor-resolution-y', '2822');
    await page.fill('#sensor-pixel-size-x', '2.4');
    await page.fill('#sensor-pixel-size-y', '2.4');
    await page.click('#equipment-save-sensor-btn');
    await page.waitForTimeout(SETTLE_MS);
}

const savedSettings = page => page.evaluate(() => ({
    dst: SettingsManager.getDSTConfig().mode,
    minAltitude: SettingsManager.getGlobalMinAltitude(),
    minSize: SettingsManager.getFilterMinSize(),
    maxMag: SettingsManager.getFilterMaxMag(),
}));

async function openSettings(page) {
    await page.click('#system-menu-btn');
    await page.click('#system-menu [data-action="settings"]');
    await page.waitForSelector('#modal.active #filter-min-size');
}

// Change the two dropdowns, type the sizes, Save
async function fillSettingsAndSave(page, { minSize = '', maxMag = '' }) {
    await page.click('#dst-mode-trigger');
    await page.click('#dst-mode-menu [data-value="never"]');
    await page.click('#global-min-altitude-trigger');
    await page.click('#global-min-altitude-menu [data-value="20"]');
    await page.fill('#filter-min-size', minSize);
    await page.fill('#filter-max-mag', maxMag);
    await page.click('#modal-save-btn');
}

async function expectSettingsRejected(page, message, field, before) {
    await toast(page, 'error', message);
    assert.ok(await modalOpen(page), 'dialog stays open');
    assert.strictEqual(await page.evaluate(() => document.activeElement?.id), field, 'field focused');
    await page.click('#modal-close');
    assert.deepStrictEqual(await savedSettings(page), before, 'nothing saved');
    await reload(page);
    assert.deepStrictEqual(await savedSettings(page), before, 'nothing saved after a reload');
}

// ---------------------------------------------------------------------------
// Checks
// ---------------------------------------------------------------------------

const CHECKS = [
    {
        issue: 329, name: 'Settings: Min Target Size 0 is refused and nothing is saved',
        run: async page => {
            const before = await savedSettings(page);
            await openSettings(page);
            await fillSettingsAndSave(page, { minSize: '0' });
            await expectSettingsRejected(page, 'Min Target Size must be between 0.1 and 999', 'filter-min-size', before);
        },
    },
    {
        issue: 329, name: 'Settings: Limiting Magnitude 30 is refused and nothing is saved',
        run: async page => {
            const before = await savedSettings(page);
            await openSettings(page);
            await fillSettingsAndSave(page, { maxMag: '30' });
            await expectSettingsRejected(page, 'Limiting Magnitude must be between -5 and 20', 'filter-max-mag', before);
        },
    },
    {
        issue: 329, name: 'Settings: a valid Save keeps every change and offers the Best Months recalculation',
        run: async page => {
            await addLocations(page, 'Test Site');
            await selectLocation(page, 'Test Site');
            await calculateBestMonths(page, 'Test Site');
            const before = await savedSettings(page);
            await openSettings(page);
            await fillSettingsAndSave(page, { minSize: '1' });
            await toast(page, 'success', 'Settings saved successfully');
            assert.ok(!await modalOpen(page), 'dialog closed');
            await page.waitForTimeout(SETTLE_MS);
            assert.ok(page.dialogs.some(m => m.includes('Recalculate Best Months for this location now?')), 'recalculation offered');
            const expected = { dst: 'never', minAltitude: 20, minSize: 1, maxMag: before.maxMag };
            assert.deepStrictEqual(await savedSettings(page), expected);
            await reload(page);
            assert.deepStrictEqual(await savedSettings(page), expected, 'still saved after a reload');
        },
    },
    {
        issue: 326, name: 'Locations: adding a name that exists (any case or spaces) is refused; editing still saves',
        run: async page => {
            await addLocations(page, 'Test Site');
            await openAdminItem(page, 'manage-locations');
            await fillLocation(page, ' test SITE ', 'Dark Site');
            await toast(page, 'error', 'Location "Test Site" already exists');
            const locations = await page.evaluate(() => DataManager.getLocations());
            assert.deepStrictEqual(Object.keys(locations), ['Test Site']);
            assert.strictEqual(locations['Test Site'].latitude, 39.2967, 'existing location unchanged');

            await page.click('[data-location="Test Site"][data-action="edit"]');
            await page.fill('#manage-elevation', '300');
            await page.click('#modal-save-btn');
            await modalClosed(page);
            await reload(page);
            assert.strictEqual(await page.evaluate(() => DataManager.getLocation('Test Site').elevation), 300, 'edit saved');
        },
    },
    {
        issue: 326, name: 'Equipment: re-saving a telescope or sensor name asks first, and No changes nothing',
        run: async page => {
            await openEquipmentTab(page);
            await saveTelescope(page, 'Test Refractor', 480);
            await saveTelescope(page, 'test refractor', 600);
            assert.match(page.dialogs.at(-1), /^Telescope "Test Refractor" already exists\. Replace it with these values\?$/);
            await page.click('[data-tab="sensors"]');
            await saveSensor(page, 'Test Sensor', 4144);
            await saveSensor(page, 'TEST SENSOR', 6248);
            assert.match(page.dialogs.at(-1), /^Sensor "Test Sensor" already exists\. Replace it with these values\?$/);
            await reload(page);
            const kept = await page.evaluate(() => ({ telescopes: DataManager.getTelescopes(), sensors: DataManager.getSensors() }));
            assert.deepStrictEqual(Object.keys(kept.telescopes), ['Test Refractor']);
            assert.strictEqual(kept.telescopes['Test Refractor'].focalLength, 480);
            assert.deepStrictEqual(Object.keys(kept.sensors), ['Test Sensor']);
            assert.strictEqual(kept.sensors['Test Sensor'].resolutionX, 4144);
        },
    },
    {
        issue: 326, name: 'Equipment: Yes replaces under the stored spelling, warning when a session used it',
        run: async page => {
            await openEquipmentTab(page);
            await saveTelescope(page, 'Test Refractor', 480);
            await page.click('[data-tab="sensors"]');
            await saveSensor(page, 'Test Sensor', 4144);
            await page.click('#modal-close');
            await page.evaluate(() => ImagingLogManager.createSession({ projectId: 1, date: '2026-10-17', telescope: 'Test Refractor' }));

            page.answers.push(true, true);
            await openEquipmentTab(page);
            await saveTelescope(page, 'test refractor', 600);
            assert.ok(page.dialogs.at(-1).includes('Imaging Log sessions that used "Test Refractor" will show the new values too'), 'in-use warning');
            await page.click('[data-tab="sensors"]');
            await saveSensor(page, 'test sensor', 6248);
            assert.ok(!page.dialogs.at(-1).includes('Imaging Log sessions'), 'no in-use warning for an unused sensor');
            await reload(page);
            const saved = await page.evaluate(() => ({ telescopes: DataManager.getTelescopes(), sensors: DataManager.getSensors() }));
            assert.deepStrictEqual(Object.keys(saved.telescopes), ['Test Refractor']);
            assert.strictEqual(saved.telescopes['Test Refractor'].focalLength, 600);
            assert.deepStrictEqual(Object.keys(saved.sensors), ['Test Sensor']);
            assert.strictEqual(saved.sensors['Test Sensor'].resolutionX, 6248);
        },
    },
    {
        issue: 326, name: 'Equipment: a filter name that exists (any case) is refused',
        run: async page => {
            await openEquipmentTab(page, 'filters');
            await page.fill('#filter-name', 'Test Luminance');
            await page.click('#equipment-save-filter-btn');
            await toast(page, 'success', 'Test Luminance');
            await page.fill('#filter-name', 'test LUMINANCE');
            await page.click('#equipment-save-filter-btn');
            await toast(page, 'error', 'Filter "Test Luminance" already exists');
            await reload(page);
            assert.deepStrictEqual(Object.keys(await page.evaluate(() => DataManager.getFilters())), ['Test Luminance']);
        },
    },
    {
        issue: 316, name: 'Deleting a location removes its Best Months in one write and keeps the other location\'s',
        run: async page => {
            await addLocations(page, 'Test Site', 'Dark Site');
            await calculateBestMonths(page, 'Test Site');
            await calculateBestMonths(page, 'Dark Site');
            const darkSite = await bestMonthsSnapshot(page, 'Dark Site', true);

            // The old code wrote each target on its own
            await page.evaluate(() => {
                window.__targetPuts = 0;
                const put = DBManager.put.bind(DBManager);
                DBManager.put = (store, item) => {
                    if (store === APP_CONFIG.STORES.TARGETS) window.__targetPuts++;
                    return put(store, item);
                };
            });
            page.answers.push(true);
            await openAdminItem(page, 'manage-locations');
            await page.click('[data-location="Test Site"][data-action="delete"]');
            await toast(page, 'success', 'Location "Test Site" deleted');
            assert.strictEqual(await page.evaluate(() => window.__targetPuts), 0, 'targets written one at a time');

            await reload(page);
            assert.deepStrictEqual(Object.keys(await page.evaluate(() => DataManager.getLocations())), ['Dark Site']);
            assert.ok(!await holdsAnyBestMonths(page, 'Test Site'), 'deleted location\'s Best Months left on targets');
            assert.strictEqual(await bestMonthsSnapshot(page, 'Dark Site', true), darkSite, 'other location\'s Best Months changed');
            assert.ok(await hasBestMonths(page, 'Dark Site'));
        },
    },
    {
        issue: 316, name: 'A failed Best Months clean-up leaves the location in place',
        run: async page => {
            await addLocations(page, 'Test Site');
            await calculateBestMonths(page, 'Test Site');
            const error = await page.evaluate(async () => {
                DBManager.putBulk = () => Promise.reject(new Error('write failed'));
                try { await DataManager.deleteLocation('Test Site'); return null; } catch (e) { return e.message; }
            });
            assert.strictEqual(error, 'write failed');
            await reload(page);
            assert.deepStrictEqual(Object.keys(await page.evaluate(() => DataManager.getLocations())), ['Test Site']);
            assert.ok(await hasBestMonths(page, 'Test Site'), 'Best Months kept');
        },
    },
    {
        issue: 339, name: 'A catalogue update recalculates Best Months for every location, the selected one first',
        run: async page => {
            await addLocations(page, 'Test Site', 'Dark Site');
            await calculateBestMonths(page, 'Test Site');
            await calculateBestMonths(page, 'Dark Site');
            await selectLocation(page, 'Dark Site');
            await page.evaluate(() => DataManager.setTargetVersion('1'));
            await page.addInitScript(() => {
                window.__recalculated = [];
                document.addEventListener('best-months-updated', e => window.__recalculated.push(e.detail.locationName));
            });

            // The app replaces the catalogue, then reloads itself and starts again
            await untilReady(page, () => page.reload(), 2);
            await page.waitForFunction(() => UIManager.locationHasBestMonths('Test Site') && UIManager.locationHasBestMonths('Dark Site'),
                null, { timeout: BEST_MONTHS_MS });
            assert.deepStrictEqual(await page.evaluate(() => [...window.__recalculated]), ['Dark Site', 'Test Site']);
            assert.notStrictEqual(await page.evaluate(() => DataManager.getTargetVersion()), '1', 'catalogue version updated');
        },
    },
    {
        issue: 339, name: 'A failed catalogue write leaves the previous catalogue and version',
        run: async page => {
            const before = await page.evaluate(async () => ({
                count: (await DBManager.getAll(APP_CONFIG.STORES.TARGETS)).length,
                version: await DataManager.getTargetVersion(),
            }));
            const error = await page.evaluate(async () => {
                // A record with no key fails partway through the write
                const targets = [...DataManager.getTargets().slice(0, 100), { name: 'no key' }];
                try { await DBManager.replaceTargets(targets, '999'); return null; } catch (e) { return String(e); }
            });
            assert.ok(error, 'write should fail');
            const after = await page.evaluate(async () => ({
                count: (await DBManager.getAll(APP_CONFIG.STORES.TARGETS)).length,
                version: await DataManager.getTargetVersion(),
            }));
            assert.deepStrictEqual(after, before);
        },
    },
    {
        issue: 307, name: 'Cancelling Best Months halfway leaves every target as it was',
        run: async page => {
            await addLocations(page, 'Test Site');
            await calculateBestMonths(page, 'Test Site');
            const before = await bestMonthsSnapshot(page, 'Test Site');
            const result = await page.evaluate(([alt, dark]) => BestMonths.calculateBestMonths('Test Site', alt, dark, (done, total) => {
                if (done === Math.floor(total / 2)) BestMonths.cancelCalculation();
            }), [60, MIN_DARK_HOURS]);
            assert.strictEqual(result.cancelled, true);
            assert.strictEqual(await page.evaluate(() => BestMonths.isCalculating), false, 'still calculating');
            assert.strictEqual(await bestMonthsSnapshot(page, 'Test Site'), before, 'targets changed in memory');
            assert.strictEqual(await bestMonthsSnapshot(page, 'Test Site', true), before, 'targets changed in the database');
            assert.strictEqual(await page.evaluate(() => SettingsManager.getBestMonthsAltitude('Test Site')), MIN_ALTITUDE);
        },
    },
    {
        issue: 307, name: 'A failed Best Months run leaves every target as it was and doesn\'t stay running',
        run: async page => {
            await addLocations(page, 'Test Site');
            await calculateBestMonths(page, 'Test Site');
            const before = await bestMonthsSnapshot(page, 'Test Site');
            const error = await page.evaluate(async ([alt, dark]) => {
                DBManager.putBulk = () => Promise.reject(new Error('write failed'));
                try { await BestMonths.calculateBestMonths('Test Site', alt, dark); return null; } catch (e) { return e.message; }
            }, [60, MIN_DARK_HOURS]);
            assert.strictEqual(error, 'write failed');
            assert.strictEqual(await page.evaluate(() => BestMonths.isCalculating), false, 'still calculating');
            assert.strictEqual(await bestMonthsSnapshot(page, 'Test Site'), before, 'targets changed');
            assert.strictEqual(await page.evaluate(() => SettingsManager.getBestMonthsAltitude('Test Site')), MIN_ALTITUDE);
        },
    },
    {
        issue: 307, name: 'Cancelling an All Locations run stops it and leaves the locations as they were',
        run: async page => {
            await addLocations(page, 'Test Site', 'Dark Site');
            await calculateBestMonths(page, 'Test Site');
            const before = await bestMonthsSnapshot(page, 'Test Site');
            const result = await page.evaluate(([alt, dark]) => BestMonths.calculateBestMonthsForAllLocations(alt, dark, p => {
                if (p.phase === 'target' && p.processedTargets === 1000) BestMonths.cancelCalculation();
            }), [60, MIN_DARK_HOURS]);
            assert.strictEqual(result.cancelled, true);
            assert.strictEqual(await page.evaluate(() => BestMonths.isCalculating), false, 'still calculating');
            assert.strictEqual(await bestMonthsSnapshot(page, 'Test Site'), before);
            assert.ok(!await hasBestMonths(page, 'Dark Site'));
        },
    },
    {
        issue: 312, name: 'Web auto-backup downloads a file, says to check Downloads, and keeps the link long enough',
        run: async page => {
            await page.evaluate(() => {
                window.__revokedAfterMs = [];
                const started = performance.now();
                const revoke = URL.revokeObjectURL.bind(URL);
                URL.revokeObjectURL = url => { window.__revokedAfterMs.push(performance.now() - started); revoke(url); };
            });
            await page.evaluate(() => BackupManager.executeAutoBackup());
            await toast(page, 'success', 'Auto-backup downloaded: check your Downloads folder');
            await page.waitForTimeout(SETTLE_MS);
            assert.ok(page.downloads.some(name => name.endsWith('.zip')), `downloads: ${page.downloads}`);
            assert.deepStrictEqual(await page.evaluate(() => [...window.__revokedAfterMs]), [], 'download link revoked at once');
        },
    },
    {
        issue: 325, name: 'To Do chart: a pinned target\'s bar shows 📌, in both chart layouts',
        run: async page => {
            await page.addInitScript(() => {
                window.__drawn = [];
                const fillText = CanvasRenderingContext2D.prototype.fillText;
                CanvasRenderingContext2D.prototype.fillText = function (text, ...rest) {
                    window.__drawn.push(String(text));
                    return fillText.call(this, text, ...rest);
                };
            });
            await reload(page);
            await addLocations(page, 'Test Site');
            await selectLocation(page, 'Test Site');
            await page.evaluate(async () => {
                for (const name of ['M 31', 'M 45']) {
                    const [t] = DataManager.searchTargets(name);
                    await ToDoManager.addToToDoList(t.object);
                }
                const [m31] = DataManager.searchTargets('M 31');
                await DataManager.pinTarget({ name: m31.object, ra: m31.ra, dec: m31.dec, common: m31.common ?? '' });
            });
            await page.click('.nav-item[data-view="todo"]');
            await page.waitForTimeout(SETTLE_MS);
            if ((await page.locator('#toggle-rise-chart').textContent()).includes('Chart')) await page.click('#toggle-rise-chart');
            // Picking the sort already chosen doesn't redraw; the view opens on Rise Time
            for (const sort of ['type', 'month', 'rise']) {
                await page.evaluate(() => { window.__drawn = []; });
                await page.click('#todo-sort-trigger');
                await page.click(`#todo-sort-menu [data-value="${sort}"]`);
                await page.waitForTimeout(SETTLE_MS);
                const drawn = await page.evaluate(() => [...window.__drawn]);
                assert.ok(drawn.some(t => t.startsWith('📌 M 31')), `${sort}: pinned label; drew ${drawn.slice(0, 20).join(' | ')}`);
                assert.ok(drawn.some(t => t.startsWith('M 45')), `${sort}: unpinned label`);
                assert.ok(!drawn.some(t => t.startsWith('📌 M 45')), `${sort}: unpinned target marked`);
            }
        },
    },
];

// ---------------------------------------------------------------------------

if (await portInUse()) {
    console.log(`Port ${PORT} is already in use; stop whatever serves it and run again`);
    process.exit(1);
}
// npx runs serve as a child process; give both their own process group and
// stop the group, or serve outlives the run and keeps the port
const server = spawn('npx', ['serve', 'src', '--listen', String(PORT)], { stdio: 'ignore', detached: true });
const results = [];
try {
    await waitForServer();
    const browser = await chromium.launch();
    for (const check of CHECKS.filter(c => !ONLY || String(c.issue) === ONLY)) {
        const label = `#${check.issue} ${check.name}`;
        const page = await freshApp(browser);
        const errors = [];
        page.on('pageerror', e => errors.push(e.message));
        try {
            await check.run(page);
            assert.deepStrictEqual(errors, [], 'page errors');
            results.push(`ok    ${label}`);
        } catch (e) {
            // The first line, plus Playwright's call log: which element it was waiting for, and what was in the way
            const lines = e.name === 'AssertionError' ? e.message.split('\n').filter(l => l.trim())
                : e.message.split('\n').filter((l, i) => i === 0 || /waiting for|intercepts|not visible|not enabled/.test(l));
            results.push(`FAIL  ${label}\n      ${[...new Set(lines.map(l => l.trim()))].slice(0, 12).join('\n      ')}`);
        }
        console.log(results.at(-1));
        await page.context().close();
    }
    await browser.close();
} finally {
    process.kill(-server.pid);
}
const failed = results.filter(r => r.startsWith('FAIL')).length;
console.log(`\n${results.length - failed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);

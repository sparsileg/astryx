// Captures the Guide's screenshots (the {.shot id="..."} placeholders in
// guide/chapters/*.md) in headless Chromium: Light theme, a fixed date, and a
// seeded location, equipment and targets. Writes guide/images/<id>.png.
//   just ui-guide-shots            all shots
//   just ui-guide-shots todo-list-chart yearly-observability-overview
import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';

const require = createRequire(process.env.PLAYWRIGHT_DIR + '/');
const { chromium } = require('playwright');

const PORT = 1420;
const APP_URL = `http://localhost:${PORT}`;
const OUT_DIR = process.env.SHOT_DIR ?? 'guide/images';
const ONLY = process.argv.slice(2);
const SETTLE_MS = 1500;
const DSS_MS = 8000;
// A winter night when Orion is well placed
const SHOT_TIME = '2026-12-14T20:00:00-05:00';
const TIME_ZONE = 'America/New_York';

async function waitForServer() {
    for (let i = 0; i < 50; i++) {
        try { if ((await fetch(APP_URL)).ok) return; } catch { /* not up yet */ }
        await new Promise(r => setTimeout(r, 200));
    }
    throw new Error('server did not start');
}

async function pickDropdown(page, idPrefix, text) {
    await page.click(`#${idPrefix}-trigger`);
    await page.click(`#${idPrefix}-menu .astryx-dropdown-item:has-text("${text}")`);
}

async function chooseTarget(page, name) {
    await page.evaluate(n => {
        const [target] = DataManager.searchTargets(n);
        VisibilityTargets.changeCurrentTarget(target);
    }, name);
}

async function chooseLocation(page) {
    await pickDropdown(page, 'location-dropdown', 'Dark Sky Site');
}

async function openView(page, sidebarId) {
    await page.click(`#${sidebarId}`);
    await page.waitForTimeout(SETTLE_MS);
}

// Seed what the Guide's examples assume: a mid-northern site, one telescope,
// one sensor, and some imaging history.
async function seed(page) {
    await page.evaluate(async () => {
        await DataManager.saveLocation('Dark Sky Site', {
            latitude: 39.2967, longitude: -78.1981, elevation: 233,
            timeZone: 'America/New_York', bortle: 4
        });
        await DataManager.saveTelescope('80mm Refractor', { focalLength: 480, aperture: 80, multiplier: 1.0 });
        await DataManager.saveSensor('Color Camera', { resolutionX: 4144, resolutionY: 2822, pixelSizeX: 2.4, pixelSizeY: 2.4 });
        document.dispatchEvent(new CustomEvent('locations-updated'));
    });
}

const TODO_NAMES = ['M 31', 'M 42', 'M 45', 'M 13', 'M 1', 'M 81', 'M 82', 'M 33', 'NGC 7000', 'NGC 2237', 'M 27', 'M 51'];

async function seedToDo(page) {
    await page.evaluate(async names => {
        for (const name of names) {
            const [target] = DataManager.searchTargets(name);
            if (target) await ToDoManager.addToToDoList(target.object);
        }
        const [pin] = DataManager.searchTargets('M 42');
        await DataManager.pinTarget({ name: pin.object, ra: pin.ra, dec: pin.dec, common: pin.common ?? '' });
    }, TODO_NAMES);
}

// Three projects, the first with a few sessions, and enough scattered nights
// across the year to fill the Activity tab.
async function seedImaging(page) {
    await page.evaluate(async () => {
        await DataManager.saveFilter('UV/IR Cut');
        const projects = [
            ['Andromeda Galaxy', ['M 31'], 'Acquiring Data'],
            ['Orion Nebula', ['M 42'], 'Planning'],
            ['Pleiades', ['M 45'], 'Processing'],
        ];
        const ids = [];
        for (const [name, targetDesignations, status] of projects) {
            const project = await ImagingLogManager.createProject({ name, targetDesignations, status });
            ids.push(project.id);
        }
        const session = (projectId, date, extra = {}) => ImagingLogManager.createSession({
            projectId, date, location: 'Dark Sky Site', telescope: '80mm Refractor', sensor: 'Color Camera',
            filter: 'UV/IR Cut', subLength: 180, numExposures: 40, usedExposures: 38,
            moonIllumination: 20, ...extra
        });
        for (let day = 8; day < 340; day += 8 + (day % 5)) {
            const date = new Date(Date.UTC(2026, 0, 1 + day)).toISOString().slice(0, 10);
            await session(ids[day % 2 ? 1 : 2], date, { numExposures: 20 + (day % 30), usedExposures: 18 + (day % 30) });
        }
        // Last, so Andromeda is the most recently modified and listed first
        for (const date of ['2026-09-12', '2026-10-03', '2026-11-07']) await session(ids[0], date);
    });
}

// Pins persist between shots, so each shot sets exactly the pins it shows
async function pinTargets(page, names) {
    await page.evaluate(async list => {
        for (const pinned of DataManager.getPinnedTargets().slice()) await DataManager.unpinTarget(pinned.name);
        for (const name of list) {
            const [t] = DataManager.searchTargets(name);
            await DataManager.pinTarget({ name: t.object, ra: t.ra, dec: t.dec, common: t.common ?? '' });
        }
    }, names);
}

// Open the Type list, clear it, and tick just the named types
async function tickTypes(page, names) {
    await page.click('#target-filter-type-trigger');
    await page.click('#type-select-none');
    for (const name of names) {
        await page.locator('#target-filter-type-menu .astryx-dropdown-item', { has: page.getByText(name, { exact: true }) }).locator('label').click();
    }
}

// Long views (reports) show their top part; a taller picture would be unreadable in print
const MAX_SHOT_HEIGHT = 1500;

// Whole-view shots leave out the sidebar and the empty space below the content
async function contentRegion(page) {
    const region = await page.evaluate(maxHeight => {
        const main = document.querySelector('main.main-content').getBoundingClientRect();
        // Containers can stretch to the window height; only content counts
        const content = [...document.querySelectorAll('main.main-content *')].filter(el =>
            ['CANVAS', 'IMG', 'SVG', 'INPUT', 'BUTTON'].includes(el.tagName) ||
            [...el.childNodes].some(n => n.nodeType === Node.TEXT_NODE && n.textContent.trim()));
        // Rows scrolled out of a clipped list don't count either
        const shown = content.filter(el => {
            const r = el.getBoundingClientRect();
            const hit = document.elementFromPoint(r.x + r.width / 2, r.y + Math.min(r.height / 2, 8));
            return r.width > 0 && r.height > 0 && hit && (el.contains(hit) || hit.contains(el));
        });
        // Cards mark where the view's panels end; their text can overflow a clipped list
        const cards = [...document.querySelectorAll('main.main-content .card')].map(el => el.getBoundingClientRect()).filter(r => r.height > 0);
        const bottom = Math.max(...(cards.length ? cards : shown.map(el => el.getBoundingClientRect())).map(r => r.bottom));
        return { x: main.x, y: 0, width: main.width, height: Math.min(bottom + 48, maxHeight) };
    }, MAX_SHOT_HEIGHT);
    return { screenshot: options => page.screenshot({ ...options, clip: region }) };
}

// Each shot: async (page) => Locator|undefined; when a locator is returned the
// picture is clipped to it, otherwise it is the whole window.
const SHOTS = {
    'target-selection-overview': async page => {
        await openView(page, 'sidebar-target-selection');
        await pickDropdown(page, 'target-filter-month', 'December');
        await tickTypes(page, ['Emission nebula']);
        await page.click('h2.view-title');
    },
    'todo-list-chart': async page => {
        await openView(page, 'sidebar-to-do-list');
        const toggle = page.locator('#toggle-rise-chart');
        if ((await toggle.textContent()).includes('Chart')) await toggle.click();
        await page.waitForTimeout(SETTLE_MS);
    },
    'todo-list-month': async page => {
        // Last month, this month, and the next two
        await page.evaluate(async names => {
            for (const name of names) await ToDoManager.removeFromToDoList(name);
        }, ['M 51', 'M 13', 'NGC 7000', 'M 27', 'M 31', 'M 33']);
        await openView(page, 'sidebar-to-do-list');
        await pickDropdown(page, 'todo-sort', 'Best Month');
        const toggle = page.locator('#toggle-rise-chart');
        if ((await toggle.textContent()).includes('List')) await toggle.click();
        await page.waitForTimeout(SETTLE_MS);
    },
    'yearly-observability-overview': async page => {
        await chooseTarget(page, 'M 42');
        await openView(page, 'sidebar-yearly-observability');
    },
    'daily-visibility-overview': async page => {
        await chooseTarget(page, 'M 42');
        await openView(page, 'sidebar-daily-visibility');
    },
    'viewfinder-overview': async page => {
        await chooseTarget(page, 'M 31');
        await openView(page, 'sidebar-viewfinder');
        await pickDropdown(page, 'fov-telescope', '80mm Refractor');
        await pickDropdown(page, 'fov-sensor', 'Color Camera');
        await page.waitForTimeout(DSS_MS);
    },
    'sequence-planner-overview': async page => {
        await pinTargets(page, ['M 31', 'M 42', 'M 45']);
        await openView(page, 'sidebar-sequence-planner');
    },
    'target-selection-filters': async page => {
        await openView(page, 'sidebar-target-selection');
        await tickTypes(page, ['Emission nebula', 'Planetary nebula', 'Supernova remnant']);
    },
    'target-selection-detail': async page => {
        await pinTargets(page, []);
        await page.evaluate(() => ToDoManager.removeFromToDoList('M 31'));
        await openView(page, 'sidebar-target-selection');
        await page.fill('#target-name', 'M 31');
        await page.waitForTimeout(SETTLE_MS);
        await page.locator('.target-result-row .target-name', { hasText: /^M 31$/ }).first().click();
        await page.waitForTimeout(SETTLE_MS);
        return page.locator('.modal-content');
    },
    'first-night-filters': async page => {
        await openView(page, 'sidebar-target-selection');
        await pickDropdown(page, 'target-filter-month', 'December');
        await tickTypes(page, ['Emission nebula', 'Galaxy', 'Open cluster']);
        await page.click('h2.view-title');
    },
    'target-optimizer-overview': async page => {
        await openView(page, 'sidebar-target-optimizer');
        await page.click('#optimizer-execute-btn');
        await page.waitForTimeout(SETTLE_MS * 3);
    },
    'target-optimizer-combinations': async page => {
        await openView(page, 'sidebar-target-optimizer');
        await page.click('#optimizer-execute-btn');
        await page.waitForTimeout(SETTLE_MS * 3);
        await page.click('.optimizer-mode-btn[data-mode="combinations"]');
        await page.waitForTimeout(SETTLE_MS * 2);
    },
    'daily-visibility-moon-dial': async page => {
        await chooseTarget(page, 'M 42');
        await openView(page, 'sidebar-daily-visibility');
        return page.locator('#dv-moon-separation');
    },
    'viewfinder-wider': async page => {
        await chooseTarget(page, 'M 42');
        await openView(page, 'sidebar-viewfinder');
        await pickDropdown(page, 'fov-telescope', '80mm Refractor');
        await pickDropdown(page, 'fov-sensor', 'Color Camera');
        await page.click('#fov-mode-toggle [data-mode="larger"]');
        await page.waitForTimeout(DSS_MS);
        const box = await page.locator('#fov-canvas, .fov-canvas, canvas').first().boundingBox();
        await page.mouse.move(box.x + box.width * 0.5, box.y + box.height * 0.5);
        await page.mouse.down();
        await page.mouse.move(box.x + box.width * 0.62, box.y + box.height * 0.42, { steps: 8 });
        await page.mouse.up();
        await page.fill('#fov-rotation-input', '25');
        await page.press('#fov-rotation-input', 'Enter');
        await page.waitForTimeout(SETTLE_MS);
    },
    'sequence-planner-timeline': async page => {
        await pinTargets(page, ['M 31', 'M 42']);
        await openView(page, 'sidebar-sequence-planner');
        return page.locator('#seq-plan-timeline').locator('xpath=ancestor::div[contains(@class,"card")][1]');
    },
    'first-night-seqplan': async page => {
        await pinTargets(page, ['M 31', 'M 42', 'M 45']);
        await openView(page, 'sidebar-sequence-planner');
        await page.locator('#seq-plan-timeline').scrollIntoViewIfNeeded();
    },
    'manage-locations': async page => {
        await page.click('#system-menu-btn');
        await page.click('[data-action="admin-tools"]');
        await page.click('[data-action="manage-locations"]');
        await page.fill('#manage-location-name', 'Backyard');
        await page.fill('#manage-latitude', '39.2967');
        await page.fill('#manage-longitude', '-78.1981');
        await page.fill('#manage-elevation', '233');
        await pickDropdown(page, 'manage-bortle', '4 -');
        await page.waitForTimeout(SETTLE_MS);
        return page.locator('.modal-content');
    },
    'manage-equipment-telescopes': async page => {
        await page.click('#system-menu-btn');
        await page.click('[data-action="admin-tools"]');
        await page.click('[data-action="manage-equipment"]');
        await page.waitForTimeout(SETTLE_MS);
        return page.locator('.modal-content');
    },
    'imaging-log-projects': async page => {
        await openView(page, 'sidebar-imaging-log');
        await page.locator('.project-card-header').first().click();
        await page.waitForTimeout(SETTLE_MS);
    },
    'imaging-log-activity': async page => {
        await openView(page, 'sidebar-imaging-log');
        await page.click('[data-tab="activity"]');
        await page.waitForTimeout(SETTLE_MS);
    },
    'log-analysis-overview': async page => {
        await openView(page, 'sidebar-log-analysis');
        const dir = new URL('../../regression-tests/TestLogs/', import.meta.url).pathname;
        await page.setInputFiles('#log-file', [
            dir + 'Autorun_Log_2026-02-03_201817.txt',
            dir + 'PHD2_GuideLog_2026-02-03_200708.txt',
        ]);
        await page.waitForTimeout(SETTLE_MS * 3);
        await page.locator('#accordion-combined .analysis-accordion-header').first().click();
    },
};

SHOTS['first-night-optimizer'] = SHOTS['target-optimizer-overview'];
SHOTS['first-night-daily-visibility'] = SHOTS['daily-visibility-overview'];

// Shots that need a different night than SHOT_TIME
const SHOT_TIMES = {
    'daily-visibility-moon-dial': '2026-12-21T20:00:00-05:00',
};

const ids = ONLY.length ? ONLY : Object.keys(SHOTS);
const unknown = ids.filter(id => !SHOTS[id]);
if (unknown.length) {
    console.error(`No shot defined for: ${unknown.join(', ')}`);
    process.exit(2);
}

mkdirSync(OUT_DIR, { recursive: true });
const server = spawn('npx', ['serve', 'src', '--listen', String(PORT)], { stdio: 'ignore', detached: true });
try {
    await waitForServer();
    const browser = await chromium.launch();
    const context = await browser.newContext({ viewport: { width: 1400, height: 2400 }, timezoneId: TIME_ZONE, deviceScaleFactor: 2 });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    page.on('dialog', d => d.dismiss());
    await page.clock.setFixedTime(new Date(SHOT_TIME));
    await page.goto(APP_URL);
    await page.waitForTimeout(5000);
    // The welcome tutorial offer and backup reminders would sit over the views
    await page.evaluate(() => TutorialEngine._teardown?.());
    await page.evaluate(async () => { await SettingsManager.updateTheme('light'); });
    await seed(page);
    await seedToDo(page);
    await seedImaging(page);
    await chooseLocation(page);
    await page.waitForTimeout(SETTLE_MS);

    for (const id of ids) {
        await page.clock.setFixedTime(new Date(SHOT_TIMES[id] ?? SHOT_TIME));
        await page.reload();
        await page.waitForTimeout(4000);
        await chooseLocation(page);
        // Back to the seeded state: one pin, the full To Do List
        await pinTargets(page, ['M 42']);
        await seedToDo(page);
        const clip = await SHOTS[id](page);
        await page.evaluate(() => document.querySelectorAll('.toast').forEach(t => t.remove()));
        await page.mouse.move(1390, 1290);
        await page.waitForTimeout(SETTLE_MS);
        await (clip ?? await contentRegion(page)).screenshot({ path: `${OUT_DIR}/${id}.png` });
        console.log(`  ${id}`);
    }
    console.log(`Page errors: ${errors.length}`);
    errors.forEach(e => console.log('  ' + e));
    await browser.close();
} finally {
    process.kill(-server.pid);
}

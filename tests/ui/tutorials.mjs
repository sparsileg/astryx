// Steps through every tutorial in headless Chromium, acting as a user would:
// Next for 'next' steps, a real click on the target for 'click' steps.
// Reports steps whose target is missing or hidden and saves a screenshot of each
// step to $SHOT_DIR (default: tests/ui/shots, git-ignored).
import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
import { mkdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { FILL, PREP } from './fill.mjs';

const require = createRequire(process.env.PLAYWRIGHT_DIR + '/');
const { chromium } = require('playwright');

const PORT = 1420;
const URL = `http://localhost:${PORT}`;
const SHOT_DIR = process.env.SHOT_DIR ?? 'tests/ui/shots';
const ONLY = process.argv[2];
const SETTLE_MS = 700;
const RELOAD_MS = 4000;

async function waitForServer() {
    for (let i = 0; i < 50; i++) {
        try { if ((await fetch(URL)).ok) return; } catch { /* not up yet */ }
        await new Promise(r => setTimeout(r, 200));
    }
    throw new Error('server did not start');
}

// npx runs serve as a child process; give both their own process group and
// stop the group, or serve outlives the run and keeps the port
const server = spawn('npx', ['serve', 'src', '--listen', String(PORT)], { stdio: 'ignore', detached: true });
const problems = [];
try {
    await waitForServer();
    const browser = await chromium.launch();
    const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    page.on('dialog', d => d.dismiss());
    // Backups download as files; FILL hooks feed them back to the restore picker
    page.downloads = [];
    page.on('download', async d => {
        const path = join(tmpdir(), `astryx-ui-${Date.now()}-${d.suggestedFilename()}`);
        await d.saveAs(path);
        page.downloads.push({ name: d.suggestedFilename(), path });
    });

    await page.goto(URL);
    await page.waitForTimeout(5000);

    // getting-started first: it creates the location and equipment the others use
    const ids = ONLY ? [...new Set(['getting-started', ONLY])] : await page.evaluate(() => Object.keys(TUTORIAL_REGISTRY.tutorials)
        .sort((a, b) => (b === 'getting-started') - (a === 'getting-started')));
    for (const id of ids) {
        // Step order changes between runs; don't leave old screenshots behind
        rmSync(`${SHOT_DIR}/${id}`, { recursive: true, force: true });
        mkdirSync(`${SHOT_DIR}/${id}`, { recursive: true });
        // _complete() finishes asynchronously; let it settle, then reload so each
        // tutorial starts from a clean UI (IndexedDB data persists across reloads)
        await page.waitForFunction(() => !TutorialEngine._currentTutorial);
        await page.reload();
        await page.waitForTimeout(RELOAD_MS);
        await page.evaluate(i => { TutorialEngine._teardown(); return TutorialEngine.start(i); }, id);
        const total = await page.evaluate(() => TutorialEngine._currentTutorial.steps.length);
        console.log(`\n${id} (${total} steps)`);
        for (let n = 0; n < total; n++) {
            await page.waitForTimeout(SETTLE_MS);
            // A restore reloads the app and ends the run; resume from saved progress
            if (!await page.evaluate(() => TutorialEngine._currentTutorial)) {
                await page.waitForTimeout(RELOAD_MS);
                await page.evaluate(i => TutorialEngine.start(i), id);
                await page.waitForTimeout(SETTLE_MS);
            }
            const stepId = await page.evaluate(() => TutorialEngine._currentTutorial.steps[TutorialEngine._currentStepIndex].id);
            await PREP[`${id}/${stepId}`]?.(page);
            await page.waitForTimeout(SETTLE_MS);
            const info = await page.evaluate(() => {
                const t = TutorialEngine._currentTutorial;
                const s = t.steps[TutorialEngine._currentStepIndex];
                // Same test the engine uses to decide whether to anchor the callout
                return { index: TutorialEngine._currentStepIndex, step: s,
                         found: !!s.target && !!document.querySelector(s.target),
                         visible: !!s.target && !!TutorialEngine._findTarget(s.target) };
            });
            const { step } = info;
            const label = `${String(info.index + 1).padStart(2)} ${step.id}`;
            const needsTarget = step.type === 'callout' && step.target;
            if (needsTarget && !info.visible) {
                const why = info.found ? 'hidden' : 'missing';
                console.log(`  ${label}: TARGET ${why} (${step.target})`);
                problems.push(`${id}/${step.id}: target ${why} ${step.target}`);
            } else {
                console.log(`  ${label}: ok`);
            }
            await page.screenshot({ path: `${SHOT_DIR}/${id}/${String(info.index + 1).padStart(2, '0')}-${step.id}.png` });

            await FILL[`${id}/${step.id}`]?.(page);
            const nextBtn = page.locator('.tutorial-btn-next');
            if (step.waitFor === 'click' && info.visible) {
                try {
                    await page.locator(`${step.target} >> visible=true`).first().click({ timeout: 3000 });
                } catch (e) {
                    problems.push(`${id}/${step.id}: click failed ${step.target}`);
                    console.log(`      click failed: ${e.message.split('\n')[0]}`);
                    await page.evaluate(() => TutorialEngine.advance());
                }
            } else if (await nextBtn.count()) {
                await nextBtn.first().click();
            } else {
                await page.evaluate(() => TutorialEngine.advance());
            }
        }
    }
    console.log(`\nPage errors: ${errors.length}`);
    errors.forEach(e => console.log('  ' + e));
    console.log(`Step problems: ${problems.length}`);
    await browser.close();
} finally {
    process.kill(-server.pid);
}
process.exit(problems.length ? 1 : 0);

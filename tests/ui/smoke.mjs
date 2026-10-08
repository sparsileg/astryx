// UI smoke test: load the app in headless Chromium, report console errors,
// and run TutorialEngine.validate() on every tutorial.
// Playwright lives outside the repo; see `just ui-test`.
import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';

const require = createRequire(process.env.PLAYWRIGHT_DIR + '/');
const { chromium } = require('playwright');

const PORT = 1420;
const URL = `http://localhost:${PORT}`;

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
let failed = false;
try {
    await waitForServer();
    const browser = await chromium.launch();
    const page = await browser.newPage();
    const errors = [];
    const validation = [];
    page.on('pageerror', e => errors.push(`pageerror: ${e.message}`));
    page.on('console', m => {
        const text = m.text();
        if (m.type() === 'error') errors.push(`console.error: ${text}`);
        if (text.startsWith('  ')) validation.push(`${m.type()}: ${text}`);
    });
    page.on('requestfailed', r => errors.push(`requestfailed: ${r.url()}`));

    await page.goto(URL);
    await page.waitForTimeout(5000);
    const title = await page.title();
    console.log(`Loaded: ${title}`);

    const before = errors.length;
    await page.evaluate(() => TutorialEngine.validate());
    const structural = errors.slice(before);
    errors.length = before;

    console.log(`\nPage errors on load: ${errors.length}`);
    errors.forEach(e => console.log('  ' + e));
    console.log(`\nTutorial structure errors: ${structural.length}`);
    structural.forEach(e => console.log('  ' + e));
    console.log(`\nValidate notes (targets absent from the current view): ${validation.filter(v => v.startsWith('warning')).length}`);
    failed = errors.length > 0 || structural.length > 0;
    await browser.close();
} finally {
    process.kill(-server.pid);
}
process.exit(failed ? 1 : 0);

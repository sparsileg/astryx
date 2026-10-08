// Data entry the tutorial stepper performs before it clicks a step's target,
// keyed "<tutorial id>/<step id>". Keep in step with the tutorials' forms.
// Views that draw for the current location and target need both chosen first.
async function chooseLocationAndTarget(page) {
    await page.click('#location-dropdown-trigger');
    await page.click('#location-dropdown-menu .astryx-dropdown-item:has-text("Test Site")');
    await page.evaluate(() => {
        const [target] = DataManager.searchTargets('M 31');
        VisibilityTargets.changeCurrentTarget(target);
    });
}

// Open System menu > Admin Tools > the given item, as the tutorials tell the user to.
async function openAdminItem(page, action) {
    if (!await page.locator('#admin-tools-submenu').isVisible()) {
        if (!await page.locator('[data-action="admin-tools"]').isVisible()) await page.click('#system-menu-btn');
        await page.click('[data-action="admin-tools"]');
    }
    if (action) await page.click(`[data-action="${action}"]`);
}

// Run before a step's target is checked, for steps whose text tells the user
// to open something first.
export const PREP = {
    'admin-tools/admin-submenu': page => openAdminItem(page),
};

async function chooseLocationAndToDoTargets(page) {
    await chooseLocationAndTarget(page);
    await page.evaluate(async () => {
        for (const name of ['M 31', 'M 42', 'M 45', 'M 13']) {
            const [target] = DataManager.searchTargets(name);
            await ToDoManager.addToToDoList(target.object);
        }
    });
}

async function chooseLocationAndPinnedTargets(page) {
    await chooseLocationAndTarget(page);
    await page.evaluate(async () => {
        for (const name of ['M 31', 'M 42', 'M 45']) {
            const [t] = DataManager.searchTargets(name);
            await DataManager.pinTarget({ name: t.object, ra: t.ra, dec: t.dec, common: t.common ?? '' });
        }
    });
}

async function pickDropdown(page, idPrefix, text) {
    await page.click(`#${idPrefix}-trigger`);
    await page.click(`#${idPrefix}-menu .astryx-dropdown-item:has-text("${text}")`);
}

export const FILL = {
    'backup-restore/browse-file': async page => {
        const backup = page.downloads.findLast(d => d.name.includes('targets'));
        await page.setInputFiles('#restore-file-input', backup.path);
    },
    'log-analysis/log-file': async page => {
        const dir = new URL('../../regression-tests/TestLogs/', import.meta.url).pathname;
        await page.setInputFiles('#log-file', [
            dir + 'Autorun_Log_2026-02-03_201817.txt',
            dir + 'PHD2_GuideLog_2026-02-03_200708.txt',
        ]);
    },
    'imaging-programs-reports/save-program': async page => {
        await page.fill('#program-name', 'Test Program');
        await page.check('#program-type-manual');
        await page.fill('#program-targets', 'M 31\nM 42\nNGC 7000');
    },
    'imaging-projects/new-session-save': async page => {
        await pickDropdown(page, 'session-location', 'Test Site');
        await pickDropdown(page, 'session-telescope', 'Test Refractor');
        await pickDropdown(page, 'session-sensor', 'Test Sensor');
        await page.fill('#session-sub-length', '180');
        await page.fill('#session-num-exposures', '40');
        await page.fill('#session-used-exposures', '38');
    },
    'imaging-projects/save-new-project': async page => {
        await page.fill('#project-name', 'Test Project');
        await page.fill('#project-target-search', 'M 31');
        await page.click('.target-search-result >> nth=0');
    },
    'todo/open-todo': chooseLocationAndToDoTargets,
    'todo/rise-time-toggle': async page => {
        const toggle = page.locator('#toggle-rise-chart');
        if ((await toggle.textContent()).includes('List')) await toggle.click();
    },
    'target-optimizer/open-optimizer': chooseLocationAndToDoTargets,
    'viewfinder/equipment': async page => {
        await chooseLocationAndTarget(page);
        await pickDropdown(page, 'fov-telescope', 'Test Refractor');
        await pickDropdown(page, 'fov-sensor', 'Test Sensor');
    },
    'sequence-planner/open-seqplan': chooseLocationAndPinnedTargets,
    'daily-visibility/open-daily-visibility': chooseLocationAndTarget,
    'admin-tools/best-months-intro': page => openAdminItem(page, 'calculate-best-months'),
    'admin-tools/best-months-location': async page => {
        await page.click('#best-months-location-trigger');
        await page.click('#best-months-location-menu .astryx-dropdown-item:has-text("Test Site")');
    },
    'admin-tools/manage-equipment-intro': page => openAdminItem(page, 'manage-equipment'),
    'admin-tools/manage-locations-intro': page => openAdminItem(page, 'manage-locations'),
    'getting-started/add-location': async page => {
        await page.fill('#manage-location-name', 'Test Site');
        await page.fill('#manage-time-zone', 'America/New_York');
        await page.fill('#manage-latitude', '39.2967');
        await page.fill('#manage-longitude', '-78.1981');
        await page.fill('#manage-elevation', '233');
    },
    'getting-started/telescope-save': async page => {
        await page.fill('#telescope-name', 'Test Refractor');
        await page.fill('#telescope-focal-length', '480');
        await page.fill('#telescope-aperture', '80');
    },
    'getting-started/sensor-save': async page => {
        await page.fill('#sensor-name', 'Test Sensor');
        await page.fill('#sensor-resolution-x', '4144');
        await page.fill('#sensor-resolution-y', '2822');
        await page.fill('#sensor-pixel-size-x', '2.4');
        await page.fill('#sensor-pixel-size-y', '2.4');
    },
};

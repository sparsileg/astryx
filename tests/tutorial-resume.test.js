/**
 * tutorial-resume.test.js
 * Where Resume Tutorial starts (Issue #327), with the real tutorial
 * definitions. The browser side is in tests/ui/checks.mjs.
 */

const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { loadApp, get } = require('./lib/app-context');

const tutorialFiles = fs.readdirSync(path.join(__dirname, '..', 'src', 'js', 'tutorials')).map(f => `js/tutorials/${f}`);
const context = loadApp(['js/config.js', ...tutorialFiles, 'js/tutorial-registry.js', 'js/tutorial-engine.js']);
const { TutorialEngine, TUTORIAL_REGISTRY } = get(context, '({ TutorialEngine, TUTORIAL_REGISTRY })');

// A page showing only the given selectors
let showing = new Set();
context.document = { querySelectorAll: sel => showing.has(sel) ? [{ getClientRects: () => [{}] }] : [] };
context.getComputedStyle = () => ({ visibility: 'visible' });

const tutorial = id => TUTORIAL_REGISTRY.tutorials[id];
const stepIndex = (id, stepId) => tutorial(id).steps.findIndex(s => s.id === stepId);
const plan = (id, saved) => ({ ...TutorialEngine._resumePlan(tutorial(id), saved) });

test('A resumed tutorial starts at the click into its view, then returns to the saved step', () => {
    showing = new Set();
    const saved = stepIndex('sequence-planner', 'date');
    assert.deepStrictEqual(plan('sequence-planner', saved), { index: stepIndex('sequence-planner', 'open-seqplan'), resumeTo: saved });

    // After the click the view is showing: back to the saved step
    TutorialEngine._currentTutorial = tutorial('sequence-planner');
    TutorialEngine._currentStepIndex = stepIndex('sequence-planner', 'open-seqplan') + 1;
    TutorialEngine._resumeTo = saved;
    showing = new Set([tutorial('sequence-planner').steps[saved].target]);
    TutorialEngine._takeResumeJump();
    assert.strictEqual(TutorialEngine._currentStepIndex, saved);
    assert.strictEqual(TutorialEngine._resumeTo, null);
});

test('A saved step inside a dialog goes on through the steps that open it', () => {
    showing = new Set();
    const steps = tutorial('backup-restore').steps;
    const saved = steps.findIndex(s => s.target === '#backup-select-userdata');
    const menu = steps.slice(0, saved).findLastIndex(s => s.target === '#system-menu-btn');
    assert.deepStrictEqual(plan('backup-restore', saved), { index: menu, resumeTo: saved });

    // The menu opened, the dialog didn't: on to the next step, not the saved one
    TutorialEngine._currentTutorial = tutorial('backup-restore');
    TutorialEngine._currentStepIndex = menu + 1;
    TutorialEngine._resumeTo = saved;
    TutorialEngine._takeResumeJump();
    assert.strictEqual(TutorialEngine._currentStepIndex, menu + 1);
    assert.strictEqual(TutorialEngine._resumeTo, null);
});

test('Saved at the start or on a way-in step, the tutorial starts there', () => {
    showing = new Set();
    assert.deepStrictEqual(plan('sequence-planner', 0), { index: 0, resumeTo: null });
    const open = stepIndex('sequence-planner', 'open-seqplan');
    assert.deepStrictEqual(plan('sequence-planner', open), { index: open, resumeTo: null });
});

test('With no way-in step, a saved step whose control is missing restarts the tutorial', () => {
    const steps = tutorial('admin-tools').steps;
    const saved = steps.findIndex(s => s.target === '#best-months-calculate');
    showing = new Set();
    assert.deepStrictEqual(plan('admin-tools', saved), { index: 0, resumeTo: null });
    showing = new Set([steps[saved].target]);
    assert.deepStrictEqual(plan('admin-tools', saved), { index: saved, resumeTo: null });
});

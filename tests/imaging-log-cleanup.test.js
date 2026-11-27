/**
 * imaging-log-cleanup.test.js
 * Catalog Coverage counts targets once per catalog it knows, a blank Moon or
 * Rotation field is saved blank, short integrations show minutes or
 * seconds, and the program limit warning checks only added targets
 * (Issue #355).
 */

const { test } = require('node:test');
const assert = require('node:assert');
const { loadApp, get } = require('./lib/app-context');

const context = loadApp(['js/config.js', 'js/imaging-log-manager.js', 'js/imaging-log-view.js']);
const { ImagingLogManager, ImagingLogView } = get(context, '({ ImagingLogManager, ImagingLogView })');

// The issue's five Completed projects, with the Other fields that gave "Other 4"
const TARGETS = {
    'NGC 1976': { object: 'NGC 1976', catalogue: 'NGC', other: 'M 42, LBN 974' },
    'C 9': { object: 'C 9', catalogue: 'Caldwell', other: 'Sh2-155, LBN 529' },
    'M 31': { object: 'M 31', catalogue: 'Messier', other: 'NGC 224' },
    'M 45': { object: 'M 45', catalogue: 'Messier', other: 'Mel 22, Cr 42' },
    'IC 1805': { object: 'IC 1805', catalogue: 'IC', other: 'Mel 15, Cr 26, Sh2-190' },
};
context.DataManager = { getTarget: name => TARGETS[name] };

const projects = designations => designations.map((d, i) => ({ id: i, status: 'Completed', targetDesignations: d }));

test('Catalog Coverage counts each target once per catalog Astryx knows, with no "Other" (Issue #355)', () => {
    const coverage = Object.fromEntries(ImagingLogManager.catalogCoverage(
        projects([['NGC 1976'], ['C 9'], ['M 31'], ['M 45'], ['IC 1805']])));
    assert.deepStrictEqual(coverage, { Messier: 3, NGC: 2, Sharpless: 2, Caldwell: 1, IC: 1 });
});

test('A target in two projects, or under two designations, counts once (Issue #355)', () => {
    const coverage = Object.fromEntries(ImagingLogManager.catalogCoverage(projects([['M 31'], ['M 31', 'M 45']])));
    assert.deepStrictEqual(coverage, { Messier: 2, NGC: 1 });
});

test('Short integrations show minutes or seconds, not 0.0h (Issue #355)', () => {
    assert.strictEqual(ImagingLogView.formatIntegrationTime(20), '20s');
    assert.strictEqual(ImagingLogView.formatIntegrationTime(0), '0s');
    assert.strictEqual(ImagingLogView.formatIntegrationTime(45 * 60), '45m');
    assert.strictEqual(ImagingLogView.formatIntegrationTime(3600), '1.0h');
    assert.strictEqual(ImagingLogView.formatIntegrationTime(5400), '1.5h');
});

test('A blank number box is null and a real 0 stays 0 (Issue #355)', () => {
    const boxes = { blank: { value: '' }, zero: { value: '0' }, angle: { value: '35' } };
    context.document = { getElementById: id => boxes[id] };
    assert.strictEqual(ImagingLogView._numberOrNull('blank', parseInt), null);
    assert.strictEqual(ImagingLogView._numberOrNull('zero', parseInt), 0);
    assert.strictEqual(ImagingLogView._numberOrNull('angle', parseInt), 35);
});

test('The program limit check warns about numbers past the maximum, any size (Issue #355)', async () => {
    const warnings = [];
    context.UIManager = { showToast: message => warnings.push(message) };
    ImagingLogManager.getAllPrograms = async () => [{ name: 'Herschel', catalogPrefix: 'NGC', maxNumber: 110 }];
    await ImagingLogView.checkTargetsAgainstProgramLimits(['M 31', 'NGC 52A']);
    assert.deepStrictEqual(warnings, ['NGC 224 exceeds max number (110) for program "Herschel"']);
    assert.strictEqual(ImagingLogManager.catalogNumber('NGC 7841', 'NGC'), 7841);
    assert.strictEqual(ImagingLogManager.catalogNumber('IC 10', 'NGC'), null);
});

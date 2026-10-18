/**
 * imaging-programs.test.js
 * Pattern-based Imaging Programs (a catalogue prefix and a maximum number):
 * which designations count, and progress (Issue #306).
 */

const { test } = require('node:test');
const assert = require('node:assert');
const { loadApp, get } = require('./lib/app-context');

const context = loadApp(['js/config.js', 'js/imaging-log-manager.js']);
const { ImagingLogManager } = get(context, '({ ImagingLogManager })');

// Targets whose Other field gives a second designation
const TARGETS = { 'M 51': { object: 'M 51', other: 'NGC 5194, Whirlpool' } };
context.DataManager = { getTarget: name => TARGETS[name] };

const NGC_110 = { id: 1, catalogPrefix: 'NGC', maxNumber: 110 };

async function progress(program, designations) {
    ImagingLogManager.getProgram = async () => program;
    ImagingLogManager.getAllProjects = async () => designations.map((d, i) => ({ id: i, status: 'Completed', targetDesignations: [d] }));
    return ImagingLogManager.getProgramProgress(program.id, true);
}

test('A number above the program maximum does not match (Issue #306)', () => {
    assert.strictEqual(ImagingLogManager.matchesPattern('NGC 7000', 'NGC', 110), false);
    assert.strictEqual(ImagingLogManager.matchesPattern('NGC 110', 'NGC', 110), true);
    assert.strictEqual(ImagingLogManager.matchesPattern('NGC 0', 'NGC', 110), false);
    assert.strictEqual(ImagingLogManager.matchesPattern('IC 10', 'NGC', 110), false);
});

test('Spacing and suffix variants are one catalogue number (Issue #306)', () => {
    for (const d of ['NGC 52', 'NGC52', 'ngc 52', 'NGC 52A']) {
        assert.strictEqual(ImagingLogManager.patternNumber(d, 'NGC', 110), 52, d);
    }
});

test('Progress counts each number once and never passes the program size (Issue #306)', async () => {
    const p = await progress(NGC_110, ['NGC 52', 'NGC52', 'NGC 52A', 'NGC 7000', 'NGC 1']);
    assert.strictEqual(p.imaged, 2);
    assert.strictEqual(p.total, 110);

    const small = { id: 2, catalogPrefix: 'NGC', maxNumber: 2 };
    const full = await progress(small, ['NGC 1', 'NGC 2', 'NGC 2A', 'NGC 3', 'NGC 5194']);
    assert.strictEqual(full.imaged, 2);
    assert.strictEqual(full.percentage, '100.0');
});

test('A designation from the Other field counts, once with its primary (Issue #306)', () => {
    const m = { id: 3, catalogPrefix: 'NGC', maxNumber: 7840 };
    const matches = ImagingLogManager.patternMatches(m, [{ targetDesignations: ['M 51'] }, { targetDesignations: ['NGC 5194A'] }]);
    assert.deepStrictEqual([...matches.keys()], [5194]);
    assert.deepStrictEqual([...matches.get(5194)], ['NGC 5194', 'NGC 5194A']);
});

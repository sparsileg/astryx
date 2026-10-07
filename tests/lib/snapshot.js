/**
 * snapshot.js
 * Golden-output checks. Each test file keeps its snapshots in
 * tests/snapshots/<file>.json. A snapshot records this codebase's own
 * output, so it catches changes, not errors that were already there.
 *
 * After a deliberate change, regenerate with `just update-snapshots` and
 * review the diff before committing. Never regenerate to make a failure go away.
 */

const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const UPDATE = process.env.UPDATE_SNAPSHOTS === '1';

function snapshotFile(testFile) {
    return path.join(__dirname, '..', 'snapshots', path.basename(testFile, '.test.js') + '.json');
}

/** Round every number so snapshots don't churn on float noise. */
function round(value, places = 6) {
    if (typeof value === 'number') return Number(value.toFixed(places));
    if (Array.isArray(value)) return value.map(v => round(v, places));
    if (value && typeof value === 'object') {
        return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, round(v, places)]));
    }
    return value;
}

/**
 * @param {string} testFile - __filename of the calling test
 * @returns {function(string, *): void} matchSnapshot(name, value)
 */
function snapshots(testFile) {
    const file = snapshotFile(testFile);
    const stored = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : {};
    const written = {};

    if (UPDATE) {
        process.on('exit', () => {
            fs.mkdirSync(path.dirname(file), { recursive: true });
            fs.writeFileSync(file, JSON.stringify(written, null, 2) + '\n');
        });
    }

    return function matchSnapshot(name, value) {
        const actual = JSON.parse(JSON.stringify(round(value)));
        if (UPDATE) {
            written[name] = actual;
            return;
        }
        assert.ok(name in stored, `No snapshot "${name}" — run \`just update-snapshots\` and review the result`);
        assert.deepStrictEqual(actual, stored[name]);
    };
}

module.exports = { snapshots, round };

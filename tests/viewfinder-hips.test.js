/**
 * viewfinder-hips.test.js
 * The Viewfinder's sky image built from HiPS survey tiles (Issue #342).
 * fixtures/healpix/nested.json holds HEALPix NESTED pixel numbers from healpy
 * (the reference HEALPix library) for 40 positions at five orders, including
 * the poles, RA 0h and the face edges near Dec ±41.8°.
 */

const { test } = require('node:test');
const assert = require('node:assert');
const { loadApp, get } = require('./lib/app-context');
const healpy = require('./fixtures/healpix/nested.json');

const context = loadApp(['js/config.js', 'js/fov-hips.js']);
const { FOVHips, APP_CONFIG } = get(context, '({ FOVHips, APP_CONFIG })');

const RAD = Math.PI / 180;
const TILE = APP_CONFIG.DSS_HIPS_TILE_WIDTH;

// Full NESTED pixel number from a face position (BigInt: order 18 needs 40 bits)
function nestedIndex(face, ix, iy, nside) {
    const spread = n => {
        let out = 0n;
        for (let bit = 0n; (BigInt(n) >> bit) > 0n; bit++) {
            if ((BigInt(n) >> bit) & 1n) out |= 1n << (2n * bit);
        }
        return out;
    };
    return BigInt(face) * BigInt(nside) ** 2n + spread(ix) + 2n * spread(iy);
}

test('HEALPix pixel of a sky position matches healpy at orders 0 to 18', () => {
    for (const { ra, dec, nest } of healpy.cases) {
        for (const [order, want] of Object.entries(nest)) {
            const nside = 2 ** Number(order);
            const p = FOVHips.skyToFace(ra * RAD, dec * RAD, nside);
            const got = nestedIndex(p.face, Math.floor(p.x), Math.floor(p.y), nside);
            assert.strictEqual(got, BigInt(want), `RA ${ra} Dec ${dec} order ${order}`);
        }
    }
});

test('the tile holding a position is the healpy pixel one tile order up', () => {
    for (const { ra, dec, nest } of healpy.cases) {
        // A tile at order k is the order k pixel; its pixels are at order k + 9
        const p = FOVHips.skyToFace(ra * RAD, dec * RAD, 2 ** 9 * TILE);
        const tile = FOVHips.tileIndex(9, p.face, Math.floor(p.x / TILE), Math.floor(p.y / TILE));
        assert.strictEqual(tile, nest['9'], `RA ${ra} Dec ${dec}`);
        const p4 = FOVHips.skyToFace(ra * RAD, dec * RAD, 2 ** 4 * TILE);
        assert.strictEqual(FOVHips.tileIndex(4, p4.face, Math.floor(p4.x / TILE), Math.floor(p4.y / TILE)), nest['4']);
    }
});

test('tile paths follow HiPS 1.0: Norder, Dir in steps of 10000, Npix', () => {
    assert.strictEqual(FOVHips.tilePath(3, 100), 'Norder3/Dir0/Npix100.jpg');
    assert.strictEqual(FOVHips.tilePath(6, 9999), 'Norder6/Dir0/Npix9999.jpg');
    assert.strictEqual(FOVHips.tilePath(6, 10000), 'Norder6/Dir10000/Npix10000.jpg');
    assert.strictEqual(FOVHips.tilePath(9, 1372138), 'Norder9/Dir1370000/Npix1372138.jpg');
});

test('in a tile image the HEALPix x index is the row and y the column', () => {
    // Measured against NASA SkyView's DSS2 (see fov-hips.js); this pins it
    assert.strictEqual(FOVHips.tileOffset(0, 0), 0);
    assert.strictEqual(FOVHips.tileOffset(0, 1), 4, 'y + 1 is the next column');
    assert.strictEqual(FOVHips.tileOffset(1, 0), TILE * 4, 'x + 1 is the next row');
    assert.strictEqual(FOVHips.tileOffset(TILE + 2, 3 * TILE + 5), (2 * TILE + 5) * 4, 'position within its own tile');
});

test('the tangent-plane projection lands at the right angular distance and direction', () => {
    const centres = [[83.82, -5.39], [0.1, 20], [37.95, 89.26], [6.02, -72.08], [210.8, 54.35]];
    for (const [ra0, dec0] of centres) {
        for (const [xi, eta] of [[0, 0], [0.01, 0], [0, 0.01], [-0.02, 0.015], [0.03, -0.03]]) {
            const { ra, dec } = FOVHips.tanToSky(ra0 * RAD, dec0 * RAD, xi, eta);
            // Forward gnomonic projection back to the tangent plane
            const cosC = Math.sin(dec0 * RAD) * Math.sin(dec) + Math.cos(dec0 * RAD) * Math.cos(dec) * Math.cos(ra - ra0 * RAD);
            const x = Math.cos(dec) * Math.sin(ra - ra0 * RAD) / cosC;
            const y = (Math.cos(dec0 * RAD) * Math.sin(dec) - Math.sin(dec0 * RAD) * Math.cos(dec) * Math.cos(ra - ra0 * RAD)) / cosC;
            assert.ok(Math.abs(x - xi) < 1e-12 && Math.abs(y - eta) < 1e-12, `centre ${ra0},${dec0} point ${xi},${eta}: ${x},${y}`);
        }
    }
});

test('the tile order is the coarsest at least as fine as the image, capped at the survey depth', () => {
    for (const arcsecPerPixel of [0.2, 0.8, 1.1, 3, 9, 18, 45, 400]) {
        const deg = arcsecPerPixel / 3600;
        const order = FOVHips.pickOrder(deg);
        if (order < APP_CONFIG.DSS_HIPS_MAX_ORDER) {
            assert.ok(FOVHips.pixelDegAtOrder(order) <= deg, `${arcsecPerPixel}″: order ${order} not fine enough`);
        }
        if (order > 0) {
            assert.ok(FOVHips.pixelDegAtOrder(order - 1) > deg, `${arcsecPerPixel}″: order ${order - 1} would do`);
        }
    }
    assert.strictEqual(FOVHips.pickOrder(0.1 / 3600), APP_CONFIG.DSS_HIPS_MAX_ORDER);
    // The survey's own pixel scale at its deepest order (properties: 2.236E-4°)
    assert.ok(Math.abs(FOVHips.pixelDegAtOrder(9) - 2.236e-4) < 1e-6);
});

// Tiles whose pixels are blank except one bright pixel at a given sky position
function oneStarTiles(starRa, starDec, order) {
    const nside = 2 ** order * TILE;
    const star = FOVHips.skyToFace(starRa * RAD, starDec * RAD, nside);
    const ix = Math.floor(star.x), iy = Math.floor(star.y);
    const starTile = FOVHips.tilePath(order, FOVHips.tileIndex(order, star.face, Math.floor(ix / TILE), Math.floor(iy / TILE)));
    const requested = [];
    const loadTile = async path => {
        requested.push(path);
        const data = new Uint8ClampedArray(TILE * TILE * 4);
        if (path === starTile) data.fill(255, FOVHips.tileOffset(ix, iy), FOVHips.tileOffset(ix, iy) + 3);
        return { width: TILE, height: TILE, data };
    };
    return { loadTile, requested };
}

// Brightest pixel of a built image
function brightest({ width, data }) {
    let best = -1, at = 0;
    for (let i = 0; i < data.length; i += 4) {
        if (data[i] > best) { best = data[i]; at = i / 4; }
    }
    return { col: at % width, row: Math.floor(at / width), value: best };
}

test('a star north-east of the centre appears up and to the left, at its distance', async () => {
    const frame = { raDeg: 83.82, decDeg: -5.39, fovDeg: 0.5, width: 50, height: 50 };
    const degPerPixel = frame.fovDeg / frame.width;
    const order = FOVHips.pickOrder(degPerPixel);
    // 10 pixels north and 15 east of the centre
    const starDec = frame.decDeg + 10 * degPerPixel;
    const starRa = frame.raDeg + 15 * degPerPixel / Math.cos(frame.decDeg * RAD);
    const { loadTile, requested } = oneStarTiles(starRa, starDec, order);
    const image = await FOVHips.buildPixels(frame, loadTile);
    const star = brightest(image);
    assert.ok(star.value > 0, 'star drawn');
    // Centre is between pixels 24 and 25; the star sits ~15 left and ~10 up
    assert.ok(Math.abs(star.col - (24.5 - 15)) <= 1.5, `column ${star.col}`);
    assert.ok(Math.abs(star.row - (24.5 - 10)) <= 1.5, `row ${star.row}`);
    assert.strictEqual(image.order, order);
    assert.ok(requested.every(p => p.startsWith(`Norder${order}/`)), 'every tile at the chosen order');
    assert.strictEqual(new Set(requested).size, requested.length, 'each tile fetched once');
    assert.ok(image.data.every((v, i) => i % 4 !== 3 || v === 255), 'opaque');
});

test('fields over a pole, across RA 0h and across a face edge come out whole', async () => {
    const frames = [
        { raDeg: 37.95, decDeg: 89.9, fovDeg: 1, width: 30, height: 30 },
        { raDeg: 120, decDeg: -89.9, fovDeg: 1, width: 30, height: 30 },
        { raDeg: 359.95, decDeg: 20, fovDeg: 1, width: 30, height: 20 },
        { raDeg: 45, decDeg: 41.81, fovDeg: 2, width: 20, height: 30 },
    ];
    for (const frame of frames) {
        // Tiles filled grey; any pixel left black was never sampled
        const loadTile = async () => ({ width: TILE, height: TILE, data: new Uint8ClampedArray(TILE * TILE * 4).fill(128) });
        const image = await FOVHips.buildPixels(frame, loadTile);
        assert.strictEqual(image.data.length, frame.width * frame.height * 4);
        assert.ok(image.data.every(v => v === 128 || v === 255), `RA ${frame.raDeg} Dec ${frame.decDeg}: every pixel sampled`);
    }
});

test('a tile comes from the next mirror when one fails, and that mirror is tried first after', async () => {
    const mirrors = [...APP_CONFIG.APIS.DSS_HIPS_MIRRORS].map(m => m.url);
    const names = [...APP_CONFIG.APIS.DSS_HIPS_MIRRORS].map(m => m.name);
    FOVHips._mirrorIndex = 0;
    const asked = [];
    const skips = [];
    const onSkip = (skipped, next) => skips.push(`${skipped}>${next}`);
    const down = new Set([mirrors[0], mirrors[1]]);
    const fetchFrom = async url => {
        asked.push(url);
        if ([...down].some(m => url.startsWith(m))) throw new Error('down');
        return url;
    };
    assert.strictEqual(await FOVHips.fromMirrors('Norder3/Dir0/Npix1.jpg', fetchFrom, onSkip), `${mirrors[2]}/Norder3/Dir0/Npix1.jpg`);
    assert.deepStrictEqual(asked, mirrors.slice(0, 3).map(m => `${m}/Norder3/Dir0/Npix1.jpg`));
    assert.deepStrictEqual(skips, [`${names[0]}>${names[1]}`, `${names[1]}>${names[2]}`], 'each skip named');
    asked.length = 0;
    skips.length = 0;
    await FOVHips.fromMirrors('Norder3/Dir0/Npix2.jpg', fetchFrom, onSkip);
    assert.deepStrictEqual(asked, [`${mirrors[2]}/Norder3/Dir0/Npix2.jpg`], 'the mirror that answered goes first');
    assert.deepStrictEqual(skips, [], 'nothing skipped');

    // It wraps round to the start of the list
    down.clear();
    mirrors.slice(2).forEach(m => down.add(m));
    assert.strictEqual(await FOVHips.fromMirrors('x.jpg', fetchFrom, onSkip), `${mirrors[0]}/x.jpg`);
    assert.strictEqual(skips.at(-1), `${names.at(-1)}>${names[0]}`);
    down.clear();
    mirrors.forEach(m => down.add(m));
    skips.length = 0;
    await assert.rejects(FOVHips.fromMirrors('y.jpg', fetchFrom, onSkip), /down/, 'fails once every mirror has');
    assert.strictEqual(skips.length, mirrors.length - 1, 'no skip reported after the last mirror');
    FOVHips._mirrorIndex = 0;
});

test('progress counts every tile up to the total, then reports building', async () => {
    const frame = { raDeg: 83.82, decDeg: -5.39, fovDeg: 1, width: 40, height: 40 };
    const events = [];
    const loadTile = async () => ({ width: TILE, height: TILE, data: new Uint8ClampedArray(TILE * TILE * 4) });
    const image = await FOVHips.buildPixels(frame, loadTile, e => events.push({ ...e }));
    const counts = events.filter(e => 'loaded' in e);
    assert.deepStrictEqual(counts.map(e => e.loaded), [...Array(image.tiles + 1).keys()], '0, 1, … total');
    assert.ok(counts.every(e => e.total === image.tiles));
    assert.ok(events.at(-1).building, 'building last');
    assert.strictEqual(events.filter(e => e.building).length, 1);
});

test('every mirror host is allowed by the web CSP', () => {
    const html = require('node:fs').readFileSync(require('node:path').join(__dirname, '..', 'src', 'index.html'), 'utf8');
    const connectSrc = html.match(/connect-src ([^;]+);/)[1].split(/\s+/);
    for (const { url } of APP_CONFIG.APIS.DSS_HIPS_MIRRORS) {
        assert.ok(connectSrc.includes(new URL(url).origin), `${url} missing from connect-src`);
    }
});

test('the CSP lets Tauri use its IPC protocol and allows no base or form target; the web headers forbid framing (Issue #358)', () => {
    const fs = require('node:fs');
    const path = require('node:path');
    const html = fs.readFileSync(path.join(__dirname, '..', 'src', 'index.html'), 'utf8');
    const csp = html.match(/http-equiv="Content-Security-Policy" content="([^"]+)"/)[1];
    const directives = Object.fromEntries(csp.split(';').map(d => d.trim().split(/\s+/)).map(([name, ...values]) => [name, values]));
    assert.ok(directives['connect-src'].includes('ipc:'), 'ipc: (Linux, macOS)');
    assert.ok(directives['connect-src'].includes('http://ipc.localhost'), 'http://ipc.localhost (Windows)');
    assert.deepStrictEqual(directives['base-uri'], ["'none'"]);
    assert.deepStrictEqual(directives['form-action'], ["'none'"]);

    const headers = fs.readFileSync(path.join(__dirname, '..', 'src', '_headers'), 'utf8');
    const all = headers.split('\n/*\n')[1];
    assert.match(all, /Content-Security-Policy: frame-ancestors 'none'/);
    assert.match(all, /X-Content-Type-Options: nosniff/);
});

/**
 * fov-hips.js
 * Viewfinder sky image built from HiPS survey tiles (Issue #342).
 *
 * The DSS2 colour survey is published as HiPS: a HEALPix grid (NESTED,
 * equatorial frame) cut into square JPEG tiles, served unchanged by several
 * mirrors. This file does what the CDS-only hips2fits service did: given a
 * frame centre, field and pixel size it picks the tiles that cover the frame
 * and projects them onto a gnomonic (TAN) image, north up and east left.
 *
 * Geometry follows the HEALPix paper (Górski et al. 2005) and the HiPS 1.0
 * IVOA standard. Image geometry for this one view, not observing astronomy,
 * so it lives with the Viewfinder files rather than in astro-*.js.
 */

const FOVHips = {
    // Mirror that last answered; every tile tries it first, so a mirror that
    // is down costs one timeout per session, not one per image
    _mirrorIndex: 0,

    /**
     * Degrees per pixel of the survey at a tile order: HEALPix pixels at
     * Nside = 2^(order + log2 tileWidth) are sqrt(4π / 12Nside²) across.
     */
    pixelDegAtOrder(order) {
        const nside = 2 ** order * APP_CONFIG.DSS_HIPS_TILE_WIDTH;
        return Math.sqrt(Math.PI / 3) / nside * 180 / Math.PI;
    },

    /**
     * The coarsest tile order whose pixels are at least as fine as the
     * image's, capped at the survey's deepest order
     */
    pickOrder(degPerPixel) {
        for (let order = 0; order < APP_CONFIG.DSS_HIPS_MAX_ORDER; order++) {
            if (this.pixelDegAtOrder(order) <= degPerPixel) return order;
        }
        return APP_CONFIG.DSS_HIPS_MAX_ORDER;
    },

    /**
     * Inverse gnomonic projection: a point on the tangent plane at
     * (ra0, dec0), in radians east (xi) and north (eta), to RA/Dec in radians
     */
    tanToSky(ra0, dec0, xi, eta) {
        const rho = Math.hypot(xi, eta);
        if (rho === 0) return { ra: ra0, dec: dec0 };
        const c = Math.atan(rho);
        const sinC = Math.sin(c), cosC = Math.cos(c);
        const sinD0 = Math.sin(dec0), cosD0 = Math.cos(dec0);
        const dec = Math.asin(cosC * sinD0 + eta * sinC * cosD0 / rho);
        const ra = ra0 + Math.atan2(xi * sinC, rho * cosD0 * cosC - eta * sinD0 * sinC);
        return { ra, dec };
    },

    /**
     * RA/Dec (radians) to a HEALPix base face and a continuous position on it
     * at the given Nside: floor(x), floor(y) are the pixel's ix, iy in the
     * NESTED scheme (healpix_base loc2pix, without the near-pole refinement)
     * @returns {{face: number, x: number, y: number}}
     */
    skyToFace(ra, dec, nside) {
        // On a face's top edge the pixel belongs to the last row, not the next
        const below = v => Math.min(v, nside * (1 - Number.EPSILON));
        const z = Math.sin(dec);
        const za = Math.abs(z);
        const tt = (((ra / (Math.PI / 2)) % 4) + 4) % 4;
        if (za <= 2 / 3) {
            const temp1 = nside * (0.5 + tt);
            const temp2 = nside * z * 0.75;
            const jp = temp1 - temp2;   // ascending edge line
            const jm = temp1 + temp2;   // descending edge line
            const ifp = Math.floor(jp / nside);
            const ifm = Math.floor(jm / nside);
            const face = ifp === ifm ? (ifp | 4) : (ifp < ifm ? ifp : ifm + 8);
            return { face, x: jm - ifm * nside, y: below(nside - (jp - ifp * nside)) };
        }
        const ntt = Math.min(3, Math.floor(tt));
        const tp = tt - ntt;
        const tmp = nside * Math.sqrt(3 * (1 - za));
        const jp = tp * tmp;
        const jm = (1 - tp) * tmp;
        return z > 0
            ? { face: ntt, x: below(nside - jm), y: below(nside - jp) }
            : { face: ntt + 8, x: below(jp), y: below(jm) };
    },

    /** Interleave the bits of n with zeros (n < 2^15), x bits of a NESTED index */
    spreadBits(n) {
        let out = 0;
        for (let bit = 0; n >> bit; bit++) {
            if ((n >> bit) & 1) out += 2 ** (2 * bit);
        }
        return out;
    },

    /** NESTED index of the tile at (tx, ty) on a face, at a tile order */
    tileIndex(order, face, tx, ty) {
        return face * 4 ** order + this.spreadBits(tx) + 2 * this.spreadBits(ty);
    },

    /** A tile's path below a mirror's base URL (HiPS 1.0 §4.1) */
    tilePath(order, npix) {
        return `Norder${order}/Dir${Math.floor(npix / 10000) * 10000}/Npix${npix}.jpg`;
    },

    /**
     * Offset of a face pixel's RGBA values in its tile's image data. In a
     * HiPS tile image the HEALPix x index is the row and y the column
     * (checked against NASA SkyView's DSS2 for M42: correlation 0.98, every
     * other orientation under 0.4)
     */
    tileOffset(ix, iy) {
        const w = APP_CONFIG.DSS_HIPS_TILE_WIDTH;
        return ((ix % w) * w + iy % w) * 4;
    },

    /**
     * Build the frame's pixels from tiles.
     * @param {Object} frame - {raDeg, decDeg, fovDeg, width, height}; fovDeg
     *     spans the longer side, as hips2fits takes it
     * @param {function(string): Promise<{width, height, data}>} loadTile -
     *     tile path to its RGBA pixels; rejects when no mirror has it
     * @param {function(Object): (Promise|undefined)} [onProgress] - called
     *     with {loaded, total} as tiles arrive, then {building: true}, which
     *     it may return a promise for (time for the page to show it)
     * @returns {Promise<{width, height, data: Uint8ClampedArray, order, tiles}>}
     */
    async buildPixels(frame, loadTile, onProgress) {
        const { width, height } = frame;
        const w = APP_CONFIG.DSS_HIPS_TILE_WIDTH;
        const degPerPixel = frame.fovDeg / Math.max(width, height);
        const order = this.pickOrder(degPerPixel);
        const nside = 2 ** order * w;
        const tilesPerSide = 2 ** order;
        const ra0 = frame.raDeg * Math.PI / 180;
        const dec0 = frame.decDeg * Math.PI / 180;
        const radPerPixel = degPerPixel * Math.PI / 180;
        // A tile's key: its face and its column and row of tiles on the face
        const tileKey = (face, ix, iy) =>
            (face * tilesPerSide + Math.floor(ix / w)) * tilesPerSide + Math.floor(iy / w);

        // Each output pixel's lower-left neighbour on its face, how far past
        // it the pixel falls, and the tiles its four neighbours are in
        const count = width * height;
        const faces = new Uint8Array(count);
        const x0s = new Int32Array(count), y0s = new Int32Array(count);
        const fxs = new Float32Array(count), fys = new Float32Array(count);
        const needed = new Set();
        for (let row = 0; row < height; row++) {
            const eta = (height / 2 - row - 0.5) * radPerPixel;
            for (let col = 0; col < width; col++) {
                const xi = (width / 2 - col - 0.5) * radPerPixel;   // east is left
                const { ra, dec } = this.tanToSky(ra0, dec0, xi, eta);
                const { face, x, y } = this.skyToFace(ra, dec, nside);
                // Pixel centres sit at +0.5; the four neighbours stay on the face
                const x0 = Math.min(Math.max(Math.floor(x - 0.5), 0), nside - 2);
                const y0 = Math.min(Math.max(Math.floor(y - 0.5), 0), nside - 2);
                const i = row * width + col;
                faces[i] = face;
                x0s[i] = x0;
                y0s[i] = y0;
                fxs[i] = Math.min(Math.max(x - 0.5 - x0, 0), 1);
                fys[i] = Math.min(Math.max(y - 0.5 - y0, 0), 1);
                needed.add(tileKey(face, x0, y0));
                needed.add(tileKey(face, x0 + 1, y0));
                needed.add(tileKey(face, x0, y0 + 1));
                needed.add(tileKey(face, x0 + 1, y0 + 1));
            }
        }

        const tiles = new Map();
        onProgress?.({ loaded: 0, total: needed.size });
        await Promise.all([...needed].map(async key => {
            const ty = key % tilesPerSide;
            const tx = Math.floor(key / tilesPerSide) % tilesPerSide;
            const face = Math.floor(key / tilesPerSide / tilesPerSide);
            const npix = this.tileIndex(order, face, tx, ty);
            tiles.set(key, (await loadTile(this.tilePath(order, npix))).data);
            onProgress?.({ loaded: tiles.size, total: needed.size });
        }));
        await onProgress?.({ building: true });

        // Bilinear between the four neighbouring pixel centres
        const data = new Uint8ClampedArray(count * 4);
        let r = 0, g = 0, b = 0;
        const add = (face, ix, iy, weight) => {
            const tile = tiles.get(tileKey(face, ix, iy));
            const t = this.tileOffset(ix, iy);
            r += tile[t] * weight;
            g += tile[t + 1] * weight;
            b += tile[t + 2] * weight;
        };
        for (let i = 0; i < count; i++) {
            const face = faces[i], x0 = x0s[i], y0 = y0s[i], fx = fxs[i], fy = fys[i];
            r = g = b = 0;
            add(face, x0, y0, (1 - fx) * (1 - fy));
            add(face, x0 + 1, y0, fx * (1 - fy));
            add(face, x0, y0 + 1, (1 - fx) * fy);
            add(face, x0 + 1, y0 + 1, fx * fy);
            data[i * 4] = r;
            data[i * 4 + 1] = g;
            data[i * 4 + 2] = b;
            data[i * 4 + 3] = 255;
        }
        return { width, height, data, order, tiles: needed.size };
    },

    /**
     * One tile from the first mirror that has it, starting with the one that
     * answered last. Each mirror gets DSS_HIPS_TILE_TIMEOUT_MS.
     * @param {function(string): Promise<*>} fetchFrom - full URL to the tile,
     *     rejecting on any failure
     * @param {function(string, string)} [onSkip] - called with the names of
     *     a mirror that failed and the one tried next
     */
    async fromMirrors(path, fetchFrom, onSkip) {
        const mirrors = APP_CONFIG.APIS.DSS_HIPS_MIRRORS;
        const start = this._mirrorIndex;
        let lastError = null;
        for (let k = 0; k < mirrors.length; k++) {
            const m = (start + k) % mirrors.length;
            try {
                const tile = await fetchFrom(`${mirrors[m].url}/${path}`);
                this._mirrorIndex = m;
                return tile;
            } catch (e) {
                lastError = e;
                if (k < mirrors.length - 1) onSkip?.(mirrors[m].name, mirrors[(m + 1) % mirrors.length].name);
            }
        }
        throw lastError;
    },

    /** Browser: fetch a tile and read its pixels */
    async _fetchTilePixels(url) {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), APP_CONFIG.DSS_HIPS_TILE_TIMEOUT_MS);
        try {
            const response = await fetch(url, { signal: controller.signal });
            if (!response.ok) throw new Error(`HTTP ${response.status} for ${url}`);
            const bitmap = await createImageBitmap(await response.blob());
            const canvas = document.createElement('canvas');
            canvas.width = bitmap.width;
            canvas.height = bitmap.height;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(bitmap, 0, 0);
            return ctx.getImageData(0, 0, bitmap.width, bitmap.height);
        } finally {
            clearTimeout(timer);
        }
    },

    /**
     * The frame as a JPEG data URL, the form the DSS cache stores
     * @param {Object} frame - {raDeg, decDeg, fovDeg, width, height}
     * @param {function(Object)} [onProgress] - {loaded, total} as tiles
     *     arrive, {skipped, next} when a mirror doesn't answer, then
     *     {building: true}
     */
    async buildImage(frame, onProgress) {
        const pixels = await this.buildPixels(frame,
            path => this.fromMirrors(path, url => this._fetchTilePixels(url),
                (skipped, next) => onProgress?.({ skipped, next })),
            event => {
                onProgress?.(event);
                // Building blocks the page; let it paint the message first.
                // A hidden window gets no animation frames, hence the timeout
                if (event.building) return new Promise(resolve => {
                    requestAnimationFrame(() => setTimeout(resolve, 0));
                    setTimeout(resolve, APP_CONFIG.DSS_HIPS_PAINT_WAIT_MS);
                });
            });
        const canvas = document.createElement('canvas');
        canvas.width = pixels.width;
        canvas.height = pixels.height;
        canvas.getContext('2d').putImageData(new ImageData(pixels.data, pixels.width, pixels.height), 0, 0);
        Log.debug(`DSS image: order ${pixels.order}, ${pixels.tiles} tiles`);
        return canvas.toDataURL('image/jpeg', APP_CONFIG.DSS_HIPS_JPEG_QUALITY);
    }
};

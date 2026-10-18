/**
 * viewfinder.test.js
 * Viewfinder: Wider mode's drag listeners and Field Coverage (Issue #331).
 */

const { test } = require('node:test');
const assert = require('node:assert');
const { loadApp, get } = require('./lib/app-context');

const context = loadApp(['js/config.js', 'js/fov-calculations.js', 'js/fov-canvas.js', 'js/fov-controller.js']);
const { FOVCanvas, FOVView } = get(context, '({ FOVCanvas, FOVView })');

// A canvas that counts the listeners added to it
const fakeCanvas = () => ({ added: [], addEventListener(type) { this.added.push(type); }, style: {} });

test('Wider reloads keep one set of drag listeners on the canvas (Issue #331)', () => {
    const canvas = fakeCanvas();
    FOVCanvas.canvas = canvas;
    const calls = [];
    for (let i = 0; i < 5; i++) FOVCanvas.setupDragListeners(() => calls.push(i));
    assert.deepStrictEqual([...canvas.added].sort(), ['mousedown', 'mousemove']);
    FOVCanvas._onDrag();
    assert.deepStrictEqual(calls, [4], 'only the latest callback runs');

    // Back to Actual replaces the canvas (removeDragListeners); the next Wider load sets up the new one
    const next = fakeCanvas();
    FOVCanvas.canvas = next;
    FOVCanvas.setupDragListeners(() => {});
    assert.deepStrictEqual([...next.added].sort(), ['mousedown', 'mousemove']);
});

test('Field Coverage: a round target and a nearly round one differ by under 0.1% (Issue #331)', () => {
    const fov = { fovWidthArcmin: 60, fovHeightArcmin: 40 };
    FOVView.isTargetInView = () => true;
    const coverage = (sizeMax, sizeMin) => {
        FOVView.currentTarget = { size_max: String(sizeMax), size_min: String(sizeMin) };
        return FOVView.getFieldCoverage(fov);
    };
    const round = coverage(10, 10);
    const oval = coverage(10, 9.99);
    // The oval's area is smaller by just its 0.1% smaller side, not the 27% the square gave
    assert.ok(Math.abs(round - oval) / round <= 0.0011, `${round} vs ${oval}`);
    assert.ok(Math.abs(round - Math.PI * 25 / 2400 * 100) < 1e-9, 'circle area, π·r²');
});

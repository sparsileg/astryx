/**
 * tutorial-viewfinder.js
 * Viewfinder tutorial definition.
 *
 * Covers: equipment selection, DSS sky survey image, overlays (target size,
 * full moon, crosshair), calculation results, camera rotation, Actual vs
 * Wider modes, drag-to-reframe, coordinate display, snapshot, and
 * practical planning workflow.
 *
 * Modal  — use when there is no specific element to point at
 * Callout — use when pointing at a specific element in the current DOM
 */

const TUTORIAL_VIEWFINDER = {
    id: 'viewfinder',
    title: 'Viewfinder',
    version: 1,
    nextTutorial: 'target-optimizer',
    steps: [

        {
            id: 'intro',
            type: 'modal',
            title: 'Viewfinder',
            body: 'The Viewfinder answers the most important question before an imaging session: <em>how will this target look through my telescope and sensor?</em><br><br>It calculates your exact field of view, overlays it on a real color sky survey image of your target, and lets you rotate and reframe until you have the composition you want — all before you go outside.<br><br>This tutorial takes about 8 minutes.',
            target: null,
            position: 'center',
            waitFor: 'next',
            highlight: false
        },
        {
            id: 'open-viewfinder',
            type: 'callout',
            title: 'Open Viewfinder',
            body: 'Click <strong>Viewfinder</strong> in the left navigation panel to open the view.',
            target: '#sidebar-viewfinder',
            position: 'right',
            waitFor: 'click',
            highlight: true
        },
        {
            id: 'layout',
            type: 'modal',
            title: 'Layout Overview',
            body: 'The Viewfinder has two columns.<br><br>The <strong>left column</strong> contains the Current Target card, the Equipment card with checkboxes and dropdowns, and the Results card showing the calculated numbers.<br><br>The <strong>right column</strong> is the canvas — a visual representation of your sensor\'s field of view, north always up, optionally overlaid on a real DSS2 color sky survey image.',
            target: null,
            position: 'center',
            waitFor: 'next',
            highlight: false
        },
        {
            id: 'current-target',
            type: 'callout',
            title: 'Current Target',
            body: 'The Viewfinder always works on the <strong>Current Target</strong> — the object selected from Target Search, Filter Targets, Pinned Targets, or the To Do List. The target\'s designator, common name, and angular size are shown here.<br><br>If there is no Current Target selected, navigate to Target Search first and select one, then return here.',
            target: '#fov-target-info',
            position: 'right',
            waitFor: 'next',
            highlight: true
        },
        {
            id: 'equipment',
            type: 'callout',
            title: 'Equipment Selection',
            body: 'Select the telescope and sensor you plan to use. Astryx calculates field of view from the telescope\'s focal length and multiplier (reducer or Barlow) combined with the sensor\'s pixel size and resolution — all drawn from the equipment you entered in Admin Tools.<br><br>Your last used combination is saved and restored between sessions.',
            target: '#fov-telescope-sensor',
            position: 'top',
            waitFor: 'next',
            highlight: true
        },
        {
            id: 'dss-image',
            type: 'callout',
            title: 'DSS Sky Survey Image',
            body: 'When checked, Astryx fetches a real <strong>DSS2 color sky survey image</strong> centered on your target and uses it as the canvas background. You see the actual stars and nebulosity your sensor will capture — not a simulated representation.<br><br>Images are cached locally so returning to the same target is instant. Fetching a new image requires an internet connection. The canvas size is locked when DSS is active to keep the image scale accurate.',
            target: '#fov-show-dss',
            position: 'left',
            waitFor: 'next',
            highlight: true
        },
        {
            id: 'target-size',
            type: 'callout',
            title: 'Target Size Overlay',
            body: 'When checked, draws a <strong>yellow dashed ellipse</strong> on the canvas representing the catalogued angular size of the target. The ellipse is drawn at 45° — a neutral reference orientation.<br><br>This immediately shows whether the target fits comfortably within your frame, nearly fills it, or overflows it. If the target is large relative to your field, Astryx will suggest a shorter effective focal length that would frame it better.<br><br>This overlay is helpful when you do not have an internet connection to retrieve a DSS image. The overlay will give you a general idea of how the target size matches your telescope/sensor combination. Note that the orientation of the ellipse is NOT accurate - it is for sizing purposes only.',
            target: '#fov-show-target',
            position: 'left',
            waitFor: 'next',
            highlight: true
        },
        {
            id: 'full-moon',
            type: 'callout',
            title: 'Full Moon Overlay',
            body: 'When checked, draws a <strong>yellow dashed circle</strong> representing the angular diameter of a full moon — approximately 31 arcminutes — at the center of the frame.<br><br>The full moon is a universally familiar reference. Comparing your target size to the moon circle gives you an immediate sense of scale: is this target smaller than the moon, the same size, or much larger?',
            target: '#fov-show-moon',
            position: 'left',
            waitFor: 'next',
            highlight: true
        },
        {
            id: 'crosshair',
            type: 'callout',
            title: 'Crosshair',
            body: 'When checked, draws a small crosshair at the center of the frame. In <strong>Actual</strong> mode it marks the center of your sensor. In <strong>Wider</strong> mode it marks the center of the draggable frame and rotates with it.<br><br>Useful for confirming that a specific star or the core of a galaxy will land precisely at the center of your sensor.',
            target: '#fov-show-crosshair',
            position: 'left',
            waitFor: 'next',
            highlight: true
        },
        {
            id: 'results',
            type: 'callout',
            title: 'Calculation Results',
            body: 'Shows the key numbers for your current equipment combination:<br><br><strong>Effective focal length</strong> — telescope focal length × multiplier<br><strong>Field of view</strong> — width × height in degrees and arcminutes<br><strong>Image scale</strong> — arcseconds per pixel, which determines how finely your sensor can resolve detail<br><strong>Dawes limit</strong> — the theoretical resolving limit of the telescope aperture in arcseconds',
            target: '#fov-results',
            position: 'right',
            waitFor: 'next',
            highlight: true
        },
        {
            id: 'canvas',
            type: 'callout',
            title: 'The Canvas',
            body: 'The canvas shows your exact sensor field of view as a white-bordered rectangle, north always up. The DSS image fills the background so you can see the real star field or deep space object you will be imaging.<br><br>The canvas is locked to a fixed pixel size when DSS is active, ensuring the image scale remains accurate. Everything you see here corresponds directly to what your sensor will capture.',
            target: '#fov-canvas',
            position: 'left',
            waitFor: 'next',
            highlight: true
        },
        {
            id: 'rotation',
            type: 'callout',
            title: 'Camera Rotation',
            body: 'Use the rotation controls to simulate rotating your camera on the focuser. The sensor frame rotates while the sky image stays north-up — exactly as it works at the telescope.<br><br>Rotate to find the angle that best frames your target, avoids a bright star at the corner, or aligns the long axis of a galaxy with your sensor. Type an angle directly into the field, or use the ↺ and ↻ buttons — hold them down for continuous rotation.',
            target: '#fov-rotation-control',
            position: 'left',
            width: '400px',
            waitFor: 'next',
            highlight: true
        },
        {
            id: 'modes-intro',
            type: 'callout',
            title: 'Actual and Wider Modes',
            body: 'The <strong>Actual</strong> / <strong>Wider</strong> toggle in the Field of View card header switches between two ways of working with the sky image.<br><br><strong>Actual</strong> — shows the exact field of view your equipment captures. This is what your imaging software will see.<br><br><strong>Wider</strong> — shows a sky survey image covering three times your field of view, with a draggable frame representing your actual sensor footprint. Use this to explore the surrounding area and choose a better framing point.',
            target: '#fov-mode-toggle-container',
            position: 'left',
            waitFor: 'next',
            highlight: true
        },
        {
            id: 'mode-toggle',
            type: 'callout',
            title: 'Actual / Wider Toggle',
            body: 'Click <strong>Wider</strong> to switch to the wider context view. A larger sky survey image loads and your sensor frame appears as a draggable dashed rectangle. Click <strong>Actual</strong> to return — Astryx fetches a new image centered on wherever you placed the frame.',
            target: '#fov-mode-toggle',
            position: 'left',
            waitFor: 'next',
            highlight: true
        },
        {
            id: 'drag-reframe',
            type: 'callout',
            title: 'Drag to Reframe',
            body: 'In Wider mode, click and drag the dashed frame to any position on the wider image. The cursor changes to a grab hand when you hover over the frame.<br><br>As you drag, the <strong>Center coordinates</strong> display below the canvas updates in real time, showing the RA and Dec of the new frame center in hours/degrees format.<br><br>When you click <strong>Actual</strong>, a new sky survey image is fetched centered precisely on the position you chose — giving you exactly the framing you planned.',
            target: '#fov-canvas',
            position: 'left',
            waitFor: 'next',
            highlight: false
        },
        {
            id: 'center-coords',
            type: 'callout',
            title: 'Center Coordinates',
            body: 'Shows the RA and Dec of the current frame center. In Wider mode it updates live as you drag. When you return to Actual after reframing it shows the new center point.<br><br>These coordinates are useful for entering a precise pointing position into your mount or plate-solving software to reproduce the exact framing at the telescope.',
            target: '#fov-center-coords',
            position: 'left',
            waitFor: 'next',
            highlight: true
        },
        {
            id: 'snapshot',
            type: 'callout',
            title: 'Snapshot',
            body: 'Takes a snapshot of the current canvas, cropped and rotated to match your camera orientation, and displays it in a full-screen overlay. Use snapshots to record your planned framing, compare different rotation angles, or share a preview of your intended composition.<br><br>In Actual mode the snapshot shows exactly what your sensor sees at the current rotation. If the frame has been rotated, there will be black corners in the snapshot.<br><br>In Wider mode it crops the image to show only the content inside the draggable frame (your FOV), rotated to match the frame angle.',
            target: '#fov-snapshot-btn',
            position: 'left',
            width: '450px',
            waitFor: 'next',
            highlight: true
        },
        {
            id: 'workflow',
            type: 'modal',
            title: 'Planning Your Framing',
            body: 'A typical Viewfinder workflow before an imaging session:<br><br>1. Select your target from Target Search<br>2. Open Viewfinder and select your telescope and sensor<br>3. Enable the DSS image to see the real sky background<br>4. Enable the Target Size overlay to check whether the target fits your frame<br>5. Compare with the Full Moon overlay for a quick size reference<br>6. Rotate the frame to your preferred composition<br>7. Switch to Wider mode and drag the frame if you want an offset center point<br>8. Take a Snapshot to record your planned framing<br>9. Note the center coordinates and rotation angle for use at the telescope<br><br>Do this beforehand and you arrive at your imaging session with a clear, tested plan.',
            target: null,
            position: 'center',
            waitFor: 'next',
            highlight: false
        },
        {
            id: 'complete',
            type: 'modal',
            title: 'Viewfinder Complete',
            body: 'You now know how to use the Viewfinder to preview your exact field of view, explore framing options with Wider mode, rotate and compose your shot, and record your plan with a Snapshot.<br><br>Return here any time you are considering a new target or equipment combination.',
            target: null,
            position: 'center',
            waitFor: 'next',
            highlight: false
        }

    ]
};

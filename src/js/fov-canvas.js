/**
 * fov-canvas.js
 * Canvas rendering for Field of View visualization
 */

const FOVCanvas = {
    canvas: null,
    ctx: null,
    showMoon: false,
    dssImage: null,
    largeMode: false,
    dragBox: null,       // {x, y, width, height} in canvas pixels
    dragBoxAngle: 0,     // rotation in degrees, 0 = north up
    isDragging: false,
    dragOffsetX: 0,
    dragOffsetY: 0,

    /**
     * Initialize canvas
     * @param {string} canvasId - Canvas element ID
     */
    init(canvasId) {
        this.canvas = document.getElementById(canvasId);
        if (!this.canvas) {
            console.error('Canvas element not found:', canvasId);
            return false;
        }
        this.ctx = this.canvas.getContext('2d');
        return true;
    },

    /**
     * Set moon visibility
     * @param {boolean} show - Show moon overlay
     */
    setShowMoon(show) {
        this.showMoon = show;
    },

    /**
     * Draw DSS background image on canvas
     * @param {HTMLImageElement} img - Image to draw as background
     */
    renderBackground(img) {
        if (!this.ctx || !img) return;
        this.dssImage = img;
        this.ctx.drawImage(img, 0, 0, this.canvas.width, this.canvas.height);
    },

    /**
     * Clear canvas
     */
    clear() {
        if (!this.ctx) return;
        this.ctx.fillStyle = '#000000';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    },

    /**
     * Render complete FOV visualization
     * @param {object} fovData - FOV calculation results
     * @param {object} target - Target object with size_max and size_min
     */
    render(fovData, target) {
        if (!this.ctx) return;

        this.clear();

        // Redraw DSS background if available
        if (this.dssImage) {
            this.ctx.drawImage(this.dssImage, 0, 0, this.canvas.width, this.canvas.height);
        }

        const width = this.canvas.width;
        const height = this.canvas.height;

        // Calculate scale: pixels per arcminute
        const scaleX = width / fovData.fovWidthArcmin;
        const scaleY = height / fovData.fovHeightArcmin;

        // Draw FOV border (white rectangle)
        this.drawFOVBorder(width, height);

        // Draw target if it exists
        if (target && target.size_max && target.size_min) {
            this.drawTarget(
                width / 2,
                height / 2,
                target.size_max * scaleX,
                target.size_min * scaleY
            );
        }

        // Draw moon if enabled
        if (this.showMoon) {
            const moonDiameter = FOVCalculations.getFullMoonDiameter();
            const moonRadiusX = (moonDiameter * scaleX) / 2;
            const moonRadiusY = (moonDiameter * scaleY) / 2;

            // Position in center
            const moonX = width / 2;
            const moonY = height / 2;

            this.drawMoon(moonX, moonY, moonRadiusX, moonRadiusY);
        }
    },

    /**
     * Remove all drag listeners by replacing canvas with a clone
     */
    removeDragListeners() {
        if (!this.canvas) return;
        const newCanvas = this.canvas.cloneNode(true);
        this.canvas.parentNode.replaceChild(newCanvas, this.canvas);
        this.canvas = newCanvas;
        this.ctx = newCanvas.getContext('2d');
        this.dragBox = null;
        this.isDragging = false;
        this.largeImage = null;
        this.canvas.style.cursor = 'default';
    },

    /**
     * Setup drag event listeners on canvas for larger mode
     */
    setupDragListeners(onDragCallback) {
        this.canvas.addEventListener('mousedown', (e) => {
            if (!this.dragBox) return;
            const rect = this.canvas.getBoundingClientRect();
            const mx = (e.clientX - rect.left) * (this.canvas.width / rect.width);
            const my = (e.clientY - rect.top) * (this.canvas.height / rect.height);
            const { x, y, width, height } = this.dragBox;
            if (mx >= x && mx <= x + width && my >= y && my <= y + height) {
                this.isDragging = true;
                this.dragOffsetX = mx - x;
                this.dragOffsetY = my - y;
                this.canvas.style.cursor = 'grabbing';

                const onMouseMove = (e) => {
                    if (!this.isDragging || !this.dragBox) return;
                    const rect = this.canvas.getBoundingClientRect();
                    const mx = (e.clientX - rect.left) * (this.canvas.width / rect.width);
                    const my = (e.clientY - rect.top) * (this.canvas.height / rect.height);
                    this.dragBox.x = mx - this.dragOffsetX;
                    this.dragBox.y = my - this.dragOffsetY;
                    this.clampDragBox();
                    if (onDragCallback) onDragCallback();
                };

                const onMouseUp = () => {
                    this.isDragging = false;
                    this.canvas.style.cursor = 'grab';
                    document.removeEventListener('mousemove', onMouseMove);
                    document.removeEventListener('mouseup', onMouseUp);
                };

                document.addEventListener('mousemove', onMouseMove);
                document.addEventListener('mouseup', onMouseUp);
            }
        });

        // Show grab cursor when hovering over box
        this.canvas.addEventListener('mousemove', (e) => {
            if (this.isDragging || !this.dragBox) return;
            const rect = this.canvas.getBoundingClientRect();
            const mx = (e.clientX - rect.left) * (this.canvas.width / rect.width);
            const my = (e.clientY - rect.top) * (this.canvas.height / rect.height);
            const { x, y, width, height } = this.dragBox;
            this.canvas.style.cursor = (mx >= x && mx <= x + width && my >= y && my <= y + height)
                ? 'grab' : 'default';
        });
    },

    /**
     * Draw static crosshair at canvas center for Actual mode
     */
    drawCenterCrosshair() {
        const cx = this.canvas.width / 2;
        const cy = this.canvas.height / 2;
        const armLen = 14;
        const gapLen = 4;
        this.ctx.save();
        this.ctx.globalCompositeOperation = 'difference';
        this.ctx.strokeStyle = '#ffffff';
        this.ctx.lineWidth = 2;
        this.ctx.beginPath();
        this.ctx.moveTo(cx - armLen, cy);
        this.ctx.lineTo(cx - gapLen, cy);
        this.ctx.moveTo(cx + gapLen, cy);
        this.ctx.lineTo(cx + armLen, cy);
        this.ctx.moveTo(cx, cy - armLen);
        this.ctx.lineTo(cx, cy - gapLen);
        this.ctx.moveTo(cx, cy + gapLen);
        this.ctx.lineTo(cx, cy + armLen);
        this.ctx.stroke();
        this.ctx.beginPath();
        this.ctx.arc(cx, cy, 2.5, 0, 2 * Math.PI);
        this.ctx.fillStyle = '#ffffff';
        this.ctx.fill();
        this.ctx.restore();
    },

    /**
     * Draw FOV border rectangle
     * @param {number} width - Canvas width
     * @param {number} height - Canvas height
     */
    drawFOVBorder(width, height) {
        this.ctx.strokeStyle = '#ffffff';
        this.ctx.lineWidth = 2;
        this.ctx.strokeRect(0, 0, width, height);
    },

    /**
     * Draw target shape (ellipse or circle)
     * @param {number} centerX - Center X position
     * @param {number} centerY - Center Y position
     * @param {number} width - Target width in pixels
     * @param {number} height - Target height in pixels
     */
    drawTarget(centerX, centerY, width, height) {
        const radiusX = width / 2;
        const radiusY = height / 2;

        // Draw filled ellipse
        this.ctx.beginPath();
        this.ctx.ellipse(centerX, centerY, radiusX, radiusY, Math.PI / 4, 0, 2 * Math.PI);
        this.ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
        this.ctx.fill();

        // Draw layered outline: dark outer, white middle, yellow dashed center
        // Dark outer
        this.ctx.beginPath();
        this.ctx.ellipse(centerX, centerY, radiusX, radiusY, Math.PI / 4, 0, 2 * Math.PI);
        this.ctx.strokeStyle = '#000000';
        this.ctx.lineWidth = 5;
        this.ctx.setLineDash([]);
        this.ctx.stroke();

        // Black middle
        this.ctx.beginPath();
        this.ctx.ellipse(centerX, centerY, radiusX, radiusY, Math.PI / 4, 0, 2 * Math.PI);
        this.ctx.strokeStyle = '#000000';
        this.ctx.lineWidth = 3;
        this.ctx.setLineDash([]);
        this.ctx.stroke();

        // Yellow dashed center (black gaps show white beneath)
        this.ctx.beginPath();
        this.ctx.ellipse(centerX, centerY, radiusX, radiusY, Math.PI / 4, 0, 2 * Math.PI);
        this.ctx.strokeStyle = 'rgba(255, 255, 0, 0.9)';
        this.ctx.lineWidth = 3;
        this.ctx.setLineDash([12, 8]);
        this.ctx.stroke();

        // Reset dash
        this.ctx.setLineDash([]);
    },

    /**
     * Draw draggable FOV box with crosshair for larger mode
     */
    drawDragBox() {
        if (!this.dragBox) return;
        const { x, y, width, height } = this.dragBox;
        const cx = x + width / 2;
        const cy = y + height / 2;
        const angle = (this.dragBoxAngle || 0) * Math.PI / 180;

        // Semi-transparent overlay outside the box (unrotated, approximate)
        this.ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
        this.ctx.fillRect(0, 0, this.canvas.width, y);
        this.ctx.fillRect(0, y + height, this.canvas.width, this.canvas.height - y - height);
        this.ctx.fillRect(0, y, x, height);
        this.ctx.fillRect(x + width, y, this.canvas.width - x - width, height);

        // FOV box border — rotated around center, difference blend
        this.ctx.save();
        this.ctx.translate(cx, cy);
        this.ctx.rotate(angle);
        this.ctx.globalCompositeOperation = 'difference';
        this.ctx.strokeStyle = '#ffffff';
        this.ctx.lineWidth = 2;
        this.ctx.setLineDash([6, 3]);
        this.ctx.strokeRect(-width / 2, -height / 2, width, height);
        this.ctx.setLineDash([]);
        this.ctx.restore();

        // North marker — 'N' above the top edge of the box, rotated with it
        this.ctx.save();
        this.ctx.translate(cx, cy);
        this.ctx.rotate(angle);
        this.ctx.globalCompositeOperation = 'difference';
        this.ctx.fillStyle = '#ffffff';
        this.ctx.font = 'bold 13px sans-serif';
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'bottom';
        this.ctx.fillText('N', 0, -height / 2 - 4);
        this.ctx.restore();

        // Crosshair at center — difference blend, rotated with box
        const armLen = 14;
        const gapLen = 4;
        this.ctx.save();
        this.ctx.translate(cx, cy);
        this.ctx.rotate(angle);
        this.ctx.globalCompositeOperation = 'difference';
        this.ctx.strokeStyle = '#ffffff';
        this.ctx.lineWidth = 2;
        this.ctx.beginPath();
        this.ctx.moveTo(-armLen, 0);
        this.ctx.lineTo(-gapLen, 0);
        this.ctx.moveTo(gapLen, 0);
        this.ctx.lineTo(armLen, 0);
        this.ctx.moveTo(0, -armLen);
        this.ctx.lineTo(0, -gapLen);
        this.ctx.moveTo(0, gapLen);
        this.ctx.lineTo(0, armLen);
        this.ctx.stroke();

        // Center dot
        this.ctx.beginPath();
        this.ctx.arc(0, 0, 2.5, 0, 2 * Math.PI);
        this.ctx.fillStyle = '#ffffff';
        this.ctx.fill();
        this.ctx.restore();
    },

    /**
     * Initialize drag box centered on canvas
     */
    initDragBox(fovWidthArcmin, fovHeightArcmin) {
        const largeArcmin = fovWidthArcmin * 3;
        const boxW = Math.round(this.canvas.width / 3);
        const boxH = Math.round(this.canvas.height / 3);
        this.dragBox = {
            x: Math.round((this.canvas.width - boxW) / 2),
            y: Math.round((this.canvas.height - boxH) / 2),
            width: boxW,
            height: boxH
        };
    },

    /**
     * Constrain drag box within canvas bounds
     */
    clampDragBox() {
        if (!this.dragBox) return;
        const halfW = this.dragBox.width / 2;
        const halfH = this.dragBox.height / 2;
        // Constrain center point within canvas bounds
        const cx = Math.max(0, Math.min(this.canvas.width, this.dragBox.x + halfW));
        const cy = Math.max(0, Math.min(this.canvas.height, this.dragBox.y + halfH));
        this.dragBox.x = cx - halfW;
        this.dragBox.y = cy - halfH;
    },

    /**
     * Draw draggable moon overlay. parameters are in pixels
     */
    drawMoon(centerX, centerY, radiusX, radiusY) {
        // Draw filled circle (moon is circular)
        const radius = Math.max(radiusX, radiusY); // Use larger dimension

        this.ctx.beginPath();
        this.ctx.arc(centerX, centerY, radius, 0, 2 * Math.PI);
        this.ctx.fillStyle = 'rgba(255, 255, 150, 0.25)'; // Faint yellow, translucent
        this.ctx.fill();

        // Dark outer
        this.ctx.beginPath();
        this.ctx.arc(centerX, centerY, radius, 0, 2 * Math.PI);
        this.ctx.strokeStyle = '#000000';
        this.ctx.lineWidth = 5;
        this.ctx.setLineDash([]);
        this.ctx.stroke();

        // Light blue middle
        this.ctx.beginPath();
        this.ctx.arc(centerX, centerY, radius, 0, 2 * Math.PI);
        this.ctx.strokeStyle = '#3377ff';
        this.ctx.lineWidth = 3;
        this.ctx.setLineDash([]);
        this.ctx.stroke();

        // Yellow dashed center
        this.ctx.beginPath();
        this.ctx.arc(centerX, centerY, radius, 0, 2 * Math.PI);
        this.ctx.strokeStyle = 'rgba(255, 255, 0, 0.9)';
        this.ctx.lineWidth = 3;
        this.ctx.setLineDash([12, 8]);
        this.ctx.stroke();

        // Reset dash
        this.ctx.setLineDash([]);
    }
};

/**
 * fov-canvas.js
 * Canvas rendering for Field of View visualization
 */

const FOVCanvas = {
    canvas: null,
    ctx: null,
    showMoon: false,

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

        // Draw outline
        this.ctx.strokeStyle = '#ffffff';
        this.ctx.lineWidth = 1;
        this.ctx.stroke();
    },

    /**
     * Draw moon overlay
     * @param {number} centerX - Center X position
     * @param {number} centerY - Center Y position
     * @param {number} radiusX - X radius in pixels
     * @param {number} radiusY - Y radius in pixels
     */
    drawMoon(centerX, centerY, radiusX, radiusY) {
        // Draw filled circle (moon is circular)
        const radius = Math.max(radiusX, radiusY); // Use larger dimension

        this.ctx.beginPath();
        this.ctx.arc(centerX, centerY, radius, 0, 2 * Math.PI);
        this.ctx.fillStyle = 'rgba(255, 255, 150, 0.25)'; // Faint yellow, translucent
        this.ctx.fill();

        // Draw outline
        this.ctx.strokeStyle = 'rgba(255, 255, 150, 0.5)';
        this.ctx.lineWidth = 1;
        this.ctx.stroke();
    }
};

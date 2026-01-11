/**
 * fov-calculations.js
 * Field of View calculations for telescope/sensor combinations
 */

const FOVCalculations = {

    /**
     * Calculate effective focal length with reducer/barlow
     * @param {number} focalLength - Base focal length in mm
     * @param {number} multiplier - Reducer/barlow multiplier (e.g., 0.63, 2.0)
     * @returns {number} Effective focal length in mm
     */
    getEffectiveFocalLength(focalLength, multiplier) {
        return focalLength * multiplier;
    },

    /**
     * Calculate sensor dimensions in mm
     * @param {number} resolutionX - Horizontal resolution in pixels
     * @param {number} resolutionY - Vertical resolution in pixels
     * @param {number} pixelSizeX - Horizontal pixel size in micrometers
     * @param {number} pixelSizeY - Vertical pixel size in micrometers
     * @returns {object} {width: mm, height: mm}
     */
    getSensorDimensions(resolutionX, resolutionY, pixelSizeX, pixelSizeY) {
        return {
            width: (resolutionX * pixelSizeX) / 1000, // Convert µm to mm
            height: (resolutionY * pixelSizeY) / 1000
        };
    },

    /**
     * Calculate field of view in degrees
     * @param {number} sensorSize - Sensor dimension in mm
     * @param {number} effectiveFocalLength - Effective focal length in mm
     * @returns {number} FOV in degrees
     */
    getFOVDegrees(sensorSize, effectiveFocalLength) {
        // FOV = 2 * arctan(sensor / (2 * focal_length))
        const fovRadians = 2 * Math.atan(sensorSize / (2 * effectiveFocalLength));
        return fovRadians * (180 / Math.PI);
    },

    /**
     * Calculate field of view in arcminutes
     * @param {number} sensorSize - Sensor dimension in mm
     * @param {number} effectiveFocalLength - Effective focal length in mm
     * @returns {number} FOV in arcminutes
     */
    getFOVArcminutes(sensorSize, effectiveFocalLength) {
        return this.getFOVDegrees(sensorSize, effectiveFocalLength) * 60;
    },

    /**
     * Calculate resolution in arcseconds per pixel
     * @param {number} pixelSize - Pixel size in micrometers
     * @param {number} effectiveFocalLength - Effective focal length in mm
     * @returns {number} Resolution in arcseconds per pixel
     */
    getResolution(pixelSize, effectiveFocalLength) {
        // Resolution = (pixel_size / focal_length) * 206265
        // 206265 is conversion factor from radians to arcseconds
        return (pixelSize / 1000 / effectiveFocalLength) * 206265;
    },

    /**
     * Calculate Dawes limit in arcseconds
     * @param {number} aperture - Telescope aperture in mm
     * @returns {number} Dawes limit in arcseconds
     */
    getDawesLimit(aperture) {
        // Dawes limit = 116 / aperture_mm
        return 116 / aperture;
    },

    /**
     * Calculate complete FOV data for telescope/sensor combination
     * @param {object} telescope - {focalLength, aperture, multiplier}
     * @param {object} sensor - {resolutionX, resolutionY, pixelSizeX, pixelSizeY}
     * @returns {object} Complete FOV calculation results
     */
    calculateFOV(telescope, sensor) {
        const effectiveFocalLength = this.getEffectiveFocalLength(
            telescope.focalLength,
            telescope.multiplier
        );

        const sensorDimensions = this.getSensorDimensions(
            sensor.resolutionX,
            sensor.resolutionY,
            sensor.pixelSizeX,
            sensor.pixelSizeY
        );

        const fovWidth = this.getFOVDegrees(sensorDimensions.width, effectiveFocalLength);
        const fovHeight = this.getFOVDegrees(sensorDimensions.height, effectiveFocalLength);

        const fovWidthArcmin = fovWidth * 60;
        const fovHeightArcmin = fovHeight * 60;

        // Use average pixel size for resolution calculation
        const avgPixelSize = (sensor.pixelSizeX + sensor.pixelSizeY) / 2;
        const resolution = this.getResolution(avgPixelSize, effectiveFocalLength);

        const dawesLimit = this.getDawesLimit(telescope.aperture);

        return {
            effectiveFocalLength,
            sensorDimensions,
            fovWidth,
            fovHeight,
            fovWidthArcmin,
            fovHeightArcmin,
            resolution,
            dawesLimit,
            telescopeName: telescope.name,
            sensorName: sensor.name
        };
    },

    /**
     * Check if target fits within FOV
     * @param {number} targetSizeMax - Target max dimension in arcminutes
     * @param {number} targetSizeMin - Target min dimension in arcminutes
     * @param {number} fovWidthArcmin - FOV width in arcminutes
     * @param {number} fovHeightArcmin - FOV height in arcminutes
     * @returns {object} {fits: boolean, recommendation: string}
     */
    checkTargetFit(targetSizeMax, targetSizeMin, fovWidthArcmin, fovHeightArcmin) {
        const minFOV = Math.min(fovWidthArcmin, fovHeightArcmin);
        const maxFOV = Math.max(fovWidthArcmin, fovHeightArcmin);

        // Target fits if both dimensions fit within FOV
        const fits = targetSizeMax <= maxFOV && targetSizeMin <= minFOV;

        let recommendation = '';
        if (!fits) {
            // Calculate recommended focal length
            // We want the target to occupy about 70% of the smaller FOV dimension
            const targetOccupancy = 0.7;
            const targetMaxForCalc = Math.max(targetSizeMax, targetSizeMin);

            // FOV = 2 * arctan(sensor / (2 * focal_length))
            // Solving for focal_length when we know desired FOV:
            // focal_length = sensor / (2 * tan(FOV/2))

            // Use the smaller sensor dimension to constrain the larger target dimension
            const smallerSensor = Math.min(
                fovWidthArcmin < fovHeightArcmin ?
                    this.getSensorDimensionFromFOV(fovWidthArcmin, this.effectiveFocalLength) :
                    this.getSensorDimensionFromFOV(fovHeightArcmin, this.effectiveFocalLength)
            );

            // Simpler approach: ratio of current FOV to target size
            const ratio = minFOV / targetMaxForCalc;
            const recommendedFL = Math.round(this.effectiveFocalLength * ratio * targetOccupancy);

            recommendation = `Target does not fit in field of view. Consider a telescope with ~${recommendedFL}mm effective focal length for this target.`;
        }

        return { fits, recommendation };
    },

    /**
     * Get full moon diameter in arcminutes (average)
     */
    getFullMoonDiameter() {
        return 31.0; // Average full moon diameter in arcminutes
    }
};

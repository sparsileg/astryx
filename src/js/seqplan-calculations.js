/**
 * seqplan-calculations.js
 * Core planning algorithms for Sequence Planner
 */

const SeqPlanCalculations = {

    /**
     * Calculate dusk and dawn times only
     * Session start/end will be determined after target optimization
     * @param {string} dateStr - Date in YYYY-MM-DD format
     * @param {Object} location - Location with lat, lng, timezone, isDST
     * @returns {Object|null} { duskJD, dawnJD }
     */
    calculateSessionTiming(dateStr, location) {
        const dateParts = dateStr.split('-');
        const localDate = new Date(
            parseInt(dateParts[0]),
            parseInt(dateParts[1]) - 1,
            parseInt(dateParts[2]),
            12, 0, 0
        );

        const duskJD = findAstronomicalDusk(localDate, location.latitude, location.longitude,
                                            location.timezone, location.isDST);
        const dawnJD = findNextAstronomicalDawn(localDate, location.latitude, location.longitude,
                                                location.timezone, location.isDST);

        if (!duskJD || !dawnJD) {
            console.log('No dusk/dawn found - returning null');
            return null;
        }

        return { duskJD, dawnJD };
    },

    /**
     * Check if meridian flip occurs during target imaging window
     * @param {number} raHours - Target right ascension (hours)
     * @param {number} startJD - Window start (Julian Date)
     * @param {number} endJD - Window end (Julian Date)
     * @param {number} longitude - Observer longitude (degrees)
     * @param {number} offsetMinutes - Offset from meridian (Â± minutes)
     * @returns {number|null} JD of meridian crossing (before pause), or null if no flip
     */
    checkMeridianFlip(transitJD, startJD, endJD, offsetMinutes) {
        // Use pre-calculated transit time
        if (!transitJD) {
            return null; // No transit
        }

        // Check if transit is within imaging window
        if (transitJD < startJD || transitJD > endJD) {
            return null; // Transit outside imaging window
        }

        // Apply offset (convert minutes to JD)
        const offsetJD = offsetMinutes / 1440;
        const flipJD = transitJD + offsetJD;

        // Verify flip is still within window
        if (flipJD >= startJD && flipJD <= endJD) {
            return flipJD;
        }
        return null;
    },

    /**
     * Calculate exposure counts for each target based on allocation
     * Meridian flip overhead sequence:
     *   1. Pause before (user-entered pause duration)
     *   2. Flip operation (user-entered flip duration)
     *   3. Pause after (same user-entered pause duration)
     *   4. Calibration (user-entered calibration duration)
     *
     * @param {Array} targets - Ordered targets with percentages
     * @param {Object} session - Session configuration with overhead settings
     * @returns {Array} Targets with calculated exposure counts and timing
     */
    calculateExposureCounts(targets, session) {
        const totalMinutes = (session.sessionEndJD - session.sessionStartJD) * 24 * 60;
        const netMinutes = totalMinutes;

        let currentJD = session.sessionStartJD;

        const results = [];

        for (const target of targets) {
            // Allocated time for this target
            const allocatedMinutes = netMinutes * (target.allocatedPercent / 100);

            // Account for target-specific overhead
            let targetOverhead = session.calibrationDuration; // Initial calibration

            // Account for autofocus overhead
            if (session.autofocusEnabled && session.autofocusDuration > 0) {
                // Initial AF run at start of target
                targetOverhead += session.autofocusDuration;

                // Periodic AF runs during target imaging
                if (session.autofocusInterval > 0) {
                    const imagingAfterInitial = allocatedMinutes - targetOverhead;
                    const periodicAfCount = Math.floor(imagingAfterInitial / session.autofocusInterval);
                    targetOverhead += periodicAfCount * session.autofocusDuration;
                }
            }

            // Check for meridian flip during this target's window
            const targetEndJD = currentJD + (allocatedMinutes / 1440);
            const flipJD = this.checkMeridianFlip(
                target.transitJD, currentJD, targetEndJD,
                session.meridianFlipOffset
            );

            if (flipJD) {
                // Total flip overhead: pause + flip + pause (calibration is already included in flip event)
                const flipOverhead = (session.meridianFlipPause * 2) +
                      session.meridianFlipDuration;
                targetOverhead += flipOverhead;
            }

            // Net imaging minutes for this target
            const imagingMinutes = allocatedMinutes - targetOverhead;

            // Calculate exposure count
            const exposureSeconds = target.exposureTime + session.interExposureTime;
            const exposureCount = Math.max(0, Math.floor((imagingMinutes * 60) / exposureSeconds));

            results.push({
                ...target,
                allocatedMinutes: allocatedMinutes,
                targetOverhead: targetOverhead,
                imagingMinutes: imagingMinutes,
                exposureCount: exposureCount,
                imagingStartJD: currentJD,
                imagingEndJD: targetEndJD,
                meridianFlipJD: flipJD
            });

            currentJD = targetEndJD;
        }

        return results;
    },

    /**
     * Generate timeline events for visualization
     * @param {Array} targets - Calculated target plans
     * @param {Object} session - Session configuration
     * @returns {Array} Timeline events for rendering
     */
    generateTimelineEvents(targets, session) {
        const events = [];

        for (const target of targets) {
            let currentJD = target.imagingStartJD;

            // Initial autofocus for this target (if enabled)
            if (session.autofocusEnabled) {
                events.push({
                    type: 'autofocus',
                    targetId: target.targetId,
                    startJD: currentJD,
                    endJD: currentJD + (session.autofocusDuration / 1440),
                    description: 'AF'
                });
                currentJD += session.autofocusDuration / 1440;
            }

            // Initial calibration
            events.push({
                type: 'calibration',
                targetId: target.targetId,
                startJD: currentJD,
                endJD: currentJD + (session.calibrationDuration / 1440),
                description: `Cal: ${target.name}`
            });
            currentJD += session.calibrationDuration / 1440;

            // Handle meridian flip case
            if (target.meridianFlipJD) {
                // === BEFORE FLIP ===
                const pauseBeforeJD = target.meridianFlipJD - (session.meridianFlipPause / 1440);

                // Generate imaging and AF events before flip
                let segmentStart = currentJD;
                if (session.autofocusEnabled && session.autofocusInterval > 0) {
                    let afStart = currentJD + (session.autofocusInterval / 1440);

                    while (afStart < pauseBeforeJD) {
                        // Imaging segment up to this AF
                        events.push({
                            type: 'imaging',
                            targetId: target.targetId,
                            startJD: segmentStart,
                            endJD: afStart,
                            description: target.name,
                            transitJD: target.transitJD,
                            altitudeConstraint: target.altitudeConstraint,
                            horizonViolations: target.horizonViolations || []
                        });

                        // AF event
                        const afEnd = afStart + (session.autofocusDuration / 1440);
                        events.push({
                            type: 'autofocus',
                            targetId: target.targetId,
                            startJD: afStart,
                            endJD: afEnd,
                            description: 'AF'
                        });

                        // Update for next segment
                        segmentStart = afEnd;
                        afStart = afEnd + (session.autofocusInterval / 1440);
                    }
                }

                // Imaging segment up to this AF
                events.push({
                    type: 'imaging',
                    targetId: target.targetId,
                    startJD: segmentStart,
                    endJD: pauseBeforeJD,
                    description: target.name,
                    transitJD: target.transitJD,
                    altitudeConstraint: target.altitudeConstraint,
                    horizonViolations: target.horizonViolations || []
                });

                // Meridian flip event (includes calibration)
                const flipStart = pauseBeforeJD;
                const flipEnd = target.meridianFlipJD +
                      (session.meridianFlipPause / 1440) +
                      (session.meridianFlipDuration / 1440);

                events.push({
                    type: 'flip',
                    targetId: target.targetId,
                    startJD: flipStart,
                    endJD: flipEnd,
                    description: 'Flip+Cal'
                });

                currentJD = flipEnd;

                // === AFTER FLIP ===

                // Autofocus after flip (if enabled)
                if (session.autofocusEnabled) {
                    events.push({
                        type: 'autofocus',
                        targetId: target.targetId,
                        startJD: currentJD,
                        endJD: currentJD + (session.autofocusDuration / 1440),
                        description: 'AF'
                    });
                    currentJD += session.autofocusDuration / 1440;
                }

                // Generate imaging and AF events after flip
                segmentStart = currentJD;
                if (session.autofocusEnabled && session.autofocusInterval > 0) {
                    let afStart = currentJD + (session.autofocusInterval / 1440);

                    while (afStart < target.imagingEndJD) {
                        // Imaging segment up to this AF
                        events.push({
                            type: 'imaging',
                            targetId: target.targetId,
                            startJD: segmentStart,
                            endJD: afStart,
                            description: target.name,
                            transitJD: target.transitJD,
                            altitudeConstraint: target.altitudeConstraint,
                            horizonViolations: target.horizonViolations || []
                        });

                        // AF event
                        const afEnd = afStart + (session.autofocusDuration / 1440);
                        events.push({
                            type: 'autofocus',
                            targetId: target.targetId,
                            startJD: afStart,
                            endJD: afEnd,
                            description: 'AF'
                        });

                        // Update for next segment
                        segmentStart = afEnd;
                        afStart = afEnd + (session.autofocusInterval / 1440);
                    }
                }

                // Final imaging segment after flip
                events.push({
                    type: 'imaging',
                    targetId: target.targetId,
                    startJD: segmentStart,
                    endJD: target.imagingEndJD,
                    description: target.name,
                    transitJD: target.transitJD,
                    altitudeConstraint: target.altitudeConstraint,
                    horizonViolations: target.horizonViolations || []
                });

            } else {
                // === NO FLIP - CONTINUOUS IMAGING ===

                // Generate imaging and AF events
                let segmentStart = currentJD;
                if (session.autofocusEnabled && session.autofocusInterval > 0) {
                    let afStart = currentJD + (session.autofocusInterval / 1440);

                    while (afStart < target.imagingEndJD) {
                        // Imaging segment up to this AF
                        events.push({
                            type: 'imaging',
                            targetId: target.targetId,
                            startJD: segmentStart,
                            endJD: afStart,
                            description: target.name,
                            transitJD: target.transitJD,
                            altitudeConstraint: target.altitudeConstraint,
                            horizonViolations: target.horizonViolations || []
                        });

                        // AF event
                        const afEnd = afStart + (session.autofocusDuration / 1440);
                        events.push({
                            type: 'autofocus',
                            targetId: target.targetId,
                            startJD: afStart,
                            endJD: afEnd,
                            description: 'AF'
                        });

                        // Update for next segment
                        segmentStart = afEnd;
                        afStart = afEnd + (session.autofocusInterval / 1440);
                    }
                }

                // Final imaging segment
                events.push({
                    type: 'imaging',
                    targetId: target.targetId,
                    startJD: segmentStart,
                    endJD: target.imagingEndJD,
                    description: target.name,
                    transitJD: target.transitJD,
                    altitudeConstraint: target.altitudeConstraint,
                    horizonViolations: target.horizonViolations || []
                });
            }
        }

        return events;
    },

    /**
     * Calculate session start/end based on target altitude constraints
     * @param {Array} optimizedTargets - Targets in optimized order
     * @param {number} duskJD - Dusk time
     * @param {number} dawnJD - Dawn time
     * @param {Object} location - Location data
     * @param {number} minAltitude - Minimum altitude constraint
     * @param {string} startTimeMode - 'dusk' or 'custom'
     * @param {string} customStartTime - Custom start time (HH:MM)
     * @returns {Object} { sessionStartJD, sessionEndJD }
     */
    calculateSessionWindow(optimizedTargets, duskJD, dawnJD, location, minAltitude,
                           startTimeMode, customStartTime, useHorizon = false, horizonProfile = null) {

        console.log('calculateSessionWindow - useHorizon:', useHorizon, 'horizonProfile:', horizonProfile ? 'present' : 'none');

        // Determine initial start time (dusk or custom)
        let initialStartJD = duskJD;

        if (startTimeMode === 'custom' && customStartTime) {
            const [hours, minutes] = customStartTime.split(':').map(Number);
            const timeOffset = (hours + minutes / 60) / 24;
            const dateAtMidnight = new Date(jdToDate(duskJD).toDateString() + ' 00:00:00');
            const midnightJD = dateToJD(dateAtMidnight);
            let customJD = midnightJD + timeOffset;

            if (hours < 12 && customJD < duskJD) {
                customJD += 1;
            }

            if (customJD >= duskJD && customJD <= dawnJD) {
                initialStartJD = customJD;
            } else {
                console.warn('Custom start time outside dusk-dawn window, using dusk');
            }
        }

        // Find when FIRST target rises above minimum altitude
        let sessionStartJD = initialStartJD;

        if (optimizedTargets.length > 0) {
            const firstTarget = optimizedTargets[0];
            const initialAlt = getAltitude(initialStartJD, firstTarget.ra, firstTarget.dec,
                                           location.latitude, location.longitude);

            if (initialAlt < minAltitude) {
                const riseJD = findTargetRise(
                    initialStartJD,
                    dawnJD,
                    firstTarget.ra,
                    firstTarget.dec,
                    location.latitude,
                    location.longitude,
                    minAltitude,
                    useHorizon ? horizonProfile : null
                );

                if (riseJD) {
                    sessionStartJD = riseJD;
                } else {
                    console.warn(`First target ${firstTarget.name} never rises above ${minAltitude}Â°`);
                }
            }
        }

        // Find when LAST target sets below minimum altitude
        let sessionEndJD = dawnJD;

        if (optimizedTargets.length > 0) {
            const lastTarget = optimizedTargets[optimizedTargets.length - 1];

            // Check altitude at session start
            const startAlt = getAltitude(sessionStartJD, lastTarget.ra, lastTarget.dec,
                                         location.latitude, location.longitude);
            // Check altitude at dawn
            const dawnAlt = getAltitude(dawnJD, lastTarget.ra, lastTarget.dec,
                                        location.latitude, location.longitude);
            const setJD = findTargetSet(
                sessionStartJD,
                dawnJD,
                lastTarget.ra,
                lastTarget.dec,
                location.latitude,
                location.longitude,
                minAltitude,
                useHorizon ? horizonProfile : null
            );

            if (setJD) {
                const setAlt = getAltitude(setJD, lastTarget.ra, lastTarget.dec,
                                           location.latitude, location.longitude);
                console.log(`Last target ${lastTarget.name} sets below ${minAltitude}° at ${jdToDate(setJD).toLocaleTimeString()} (altitude: ${setAlt.toFixed(1)}°)`);
                sessionEndJD = setJD;
            } else {
                console.log(`Last target ${lastTarget.name} stays visible until dawn`);
                sessionEndJD = dawnJD; // Use dawn as session end
            }
        }

        return { sessionStartJD, sessionEndJD };
    },

    /**
     * Check if target's imaging window violates altitude constraints
     * @param {Object} target - Target with imagingStartJD and imagingEndJD
     * @param {Object} session - Session configuration with location and minAltitude
     * @returns {Object} { isValid, validStartJD, validEndJD, violationType }
     */
    checkTargetAltitudeConstraint(target, session) {
        const location = session.location;
        const minAlt = session.minAltitude;

        // Find when target rises above minimum altitude
        const riseJD = findTargetRise(
            session.duskJD,
            session.dawnJD,
            target.ra,
            target.dec,
            location.latitude,
            location.longitude,
            minAlt,
            session.useHorizon ? session.location.horizon : null
        );

        // Find when target sets below minimum altitude
        const setJD = findTargetSet(
            session.duskJD,
            session.dawnJD,
            target.ra,
            target.dec,
            location.latitude,
            location.longitude,
            minAlt,
            session.useHorizon ? session.location.horizon : null
        );

        // Determine valid window
        let validStartJD = riseJD || session.sessionStartJD;
        let validEndJD = setJD || session.sessionEndJD; // If no set found, use session end
        console.log(`${target.name} constraint check - validStart: ${validStartJD ? jdToDate(validStartJD).toLocaleTimeString() : 'null'}, validEnd: ${validEndJD ? jdToDate(validEndJD).toLocaleTimeString() : 'null'}, imagingStart: ${jdToDate(target.imagingStartJD).toLocaleTimeString()}, imagingEnd: ${jdToDate(target.imagingEndJD).toLocaleTimeString()}`);

        // Check for violations
        let violationType = null;
        let isValid = true;

        if (!riseJD && !setJD) {
            // Target never rises above minimum altitude
            const altitude = getAltitude(session.sessionStartJD, target.ra, target.dec,
                                         location.latitude, location.longitude);
            if (altitude < minAlt) {
                violationType = 'never_visible';
                isValid = false;
            }
        } else {
            // Check if imaging window extends outside valid window
            if (target.imagingStartJD < validStartJD) {
                violationType = 'starts_early';
                isValid = false;
            }
            if (target.imagingEndJD > validEndJD) {
                violationType = violationType ? 'both' : 'ends_late';
                isValid = false;
            }
        }

        return {
            isValid,
            validStartJD,
            validEndJD,
            violationType
        };
    },

    /**
     * Find all periods where target violates horizon profile (but not min altitude)
     * @param {number} startJD - Imaging window start
     * @param {number} endJD - Imaging window end
     * @param {number} raHours - Target RA (hours)
     * @param {number} decDeg - Target Dec (degrees)
     * @param {number} latitude - Observer latitude
     * @param {number} longitude - Observer longitude
     * @param {number} minAltitude - Minimum altitude constraint
     * @param {Array} horizonArray - Horizon profile array
     * @returns {Array} Array of {startJD, endJD} violation periods
     */
    findHorizonViolations(startJD, endJD, raHours, decDeg, latitude, longitude, minAltitude, horizonArray) {
        if (!horizonArray || horizonArray.length === 0) {
            return []; // No horizon profile = no violations
        }

        const violations = [];
        const stepSize = APP_CONFIG.TARGET_SEARCH_STEP_SIZE;
        let jd = startJD;

        let inViolation = false;
        let violationStart = null;

        while (jd <= endJD) {
            const altitude = getAltitude(jd, raHours, decDeg, latitude, longitude);
            const azimuth = getAzimuth(jd, raHours, decDeg, latitude, longitude);

            // Check if above min altitude but below horizon
            const aboveMinAlt = altitude >= minAltitude;
            const aboveHorizon = isAboveHorizon(altitude, azimuth, minAltitude, horizonArray);

            // Violation = above min altitude but blocked by horizon
            const isViolating = aboveMinAlt && !aboveHorizon;
            if (isViolating) {
                console.log(`Horizon violation detected at ${jdToDate(jd).toLocaleTimeString()}: alt=${altitude.toFixed(1)}°, minAlt=${minAltitude}°, aboveMinAlt=${aboveMinAlt}, aboveHorizon=${aboveHorizon}`);
            }
            if (isViolating && !inViolation) {
                // Start of violation period
                violationStart = jd;
                inViolation = true;
            } else if (!isViolating && inViolation) {
                // End of violation period
                violations.push({ startJD: violationStart, endJD: jd });
                inViolation = false;
                violationStart = null;
            }

            jd += stepSize;
        }

        // Handle violation extending to end of window
        if (inViolation && violationStart !== null) {
            violations.push({ startJD: violationStart, endJD: endJD });
        }

        return violations;
    }

};

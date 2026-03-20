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
            return null;
        }

        return { duskJD, dawnJD };
    },

    /**
     * Check if meridian flip occurs during target imaging window
     * @param {number} transitJD - Pre-calculated transit time (JD)
     * @param {number} startJD - Window start (Julian Date)
     * @param {number} endJD - Window end (Julian Date)
     * @param {number} offsetMinutes - Offset from meridian (± minutes)
     * @returns {number|null} JD of flip point, or null if no flip
     */
    checkMeridianFlip(transitJD, startJD, endJD, offsetMinutes) {
        if (!transitJD) {
            return null;
        }

        if (transitJD < startJD || transitJD > endJD) {
            return null;
        }

        const offsetJD = offsetMinutes / 1440;
        const flipJD = transitJD + offsetJD;

        if (flipJD >= startJD && flipJD <= endJD) {
            return flipJD;
        }
        return null;
    },

    /**
     * Calculate exposure counts for each target based on allocation
     * Sequence: calibration, autofocus, imaging, [periodic AF+imaging], [flip, calibration, autofocus, imaging...]
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
            const allocatedMinutes = netMinutes * (target.allocatedPercent / 100);

            let targetOverhead = session.calibrationDuration; // Initial calibration

            if (session.autofocusEnabled && session.autofocusDuration > 0) {
                targetOverhead += session.autofocusDuration; // Initial AF

                if (session.autofocusInterval > 0) {
                    const imagingAfterInitial = allocatedMinutes - targetOverhead;
                    const periodicAfCount = Math.floor(imagingAfterInitial / session.autofocusInterval);
                    targetOverhead += periodicAfCount * session.autofocusDuration;
                }
            }

            const targetEndJD = currentJD + (allocatedMinutes / 1440);
            const flipJD = this.checkMeridianFlip(
                target.transitJD, currentJD, targetEndJD,
                session.meridianFlipOffset
            );

            if (flipJD) {
                // Flip overhead: pause + flip duration + calibration + autofocus after flip
                const flipOverhead = session.meridianFlipPause +
                      session.meridianFlipDuration +
                      session.calibrationDuration +
                      (session.autofocusEnabled ? session.autofocusDuration : 0);
                targetOverhead += flipOverhead;
            }

            const imagingMinutes = allocatedMinutes - targetOverhead;

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

        // Snap AF trigger time to next sub boundary to avoid cutting a sub short
        const snapToSubBoundary = (triggerJD, segStartJD, subDurationJD) => {
            if (subDurationJD <= 0) return triggerJD;
            const subsElapsed = Math.ceil((triggerJD - segStartJD) / subDurationJD);
            return segStartJD + subsElapsed * subDurationJD;
        };

        let lastTarget = null;

        for (const target of targets) {
            lastTarget = target;
            let currentJD = target.imagingStartJD;

            // Initial calibration
            events.push({
                type: 'calibration',
                targetId: target.targetId,
                startJD: currentJD,
                endJD: currentJD + (session.calibrationDuration / 1440),
                description: `Cal: ${target.name}`
            });
            currentJD += session.calibrationDuration / 1440;

            // Initial autofocus
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

            if (target.meridianFlipJD) {
                // === BEFORE FLIP ===
                const pauseBeforeJD = target.meridianFlipJD - (session.meridianFlipPause / 1440);

                let segmentStart = currentJD;
                if (session.autofocusEnabled && session.autofocusInterval > 0) {
                    const subDurationJD = (target.exposureTime + session.interExposureTime) / 86400;
                    let afStart = snapToSubBoundary(currentJD + (session.autofocusInterval / 1440), currentJD, subDurationJD);

                    while (afStart < pauseBeforeJD) {
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

                        const afEnd = afStart + (session.autofocusDuration / 1440);
                        events.push({
                            type: 'autofocus',
                            targetId: target.targetId,
                            startJD: afStart,
                            endJD: afEnd,
                            description: 'AF'
                        });

                        segmentStart = afEnd;
                        afStart = snapToSubBoundary(afEnd + (session.autofocusInterval / 1440), afEnd, subDurationJD);
                    }
                }

                // Imaging segment up to flip pause
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

                // Meridian flip event
                const flipStart = pauseBeforeJD;
                const flipEnd = target.meridianFlipJD + (session.meridianFlipDuration / 1440);

                events.push({
                    type: 'flip',
                    targetId: target.targetId,
                    startJD: flipStart,
                    endJD: flipEnd,
                    description: 'Flip'
                });

                currentJD = flipEnd;

                // === AFTER FLIP ===

                // Calibration after flip
                events.push({
                    type: 'calibration',
                    targetId: target.targetId,
                    startJD: currentJD,
                    endJD: currentJD + (session.calibrationDuration / 1440),
                    description: `Cal: ${target.name}`
                });
                currentJD += session.calibrationDuration / 1440;

                // Autofocus after flip
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

                // Imaging and periodic AF after flip
                segmentStart = currentJD;
                if (session.autofocusEnabled && session.autofocusInterval > 0) {
                    const subDurationJD = (target.exposureTime + session.interExposureTime) / 86400;
                    let afStart = snapToSubBoundary(currentJD + (session.autofocusInterval / 1440), currentJD, subDurationJD);

                    while (afStart < target.imagingEndJD) {
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

                        const afEnd = afStart + (session.autofocusDuration / 1440);
                        events.push({
                            type: 'autofocus',
                            targetId: target.targetId,
                            startJD: afStart,
                            endJD: afEnd,
                            description: 'AF'
                        });

                        segmentStart = afEnd;
                        afStart = snapToSubBoundary(afEnd + (session.autofocusInterval / 1440), afEnd, subDurationJD);
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

                let segmentStart = currentJD;
                if (session.autofocusEnabled && session.autofocusInterval > 0) {
                    const subDurationJD = (target.exposureTime + session.interExposureTime) / 86400;
                    let afStart = snapToSubBoundary(currentJD + (session.autofocusInterval / 1440), currentJD, subDurationJD);

                    while (afStart < target.imagingEndJD) {
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

                        const afEnd = afStart + (session.autofocusDuration / 1440);
                        events.push({
                            type: 'autofocus',
                            targetId: target.targetId,
                            startJD: afStart,
                            endJD: afEnd,
                            description: 'AF'
                        });

                        segmentStart = afEnd;
                        afStart = snapToSubBoundary(afEnd + (session.autofocusInterval / 1440), afEnd, subDurationJD);
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

        // Extend final imaging segment to complete the last sub even if it overruns session end
        if (lastTarget) {
            const lastImaging = [...events].reverse().find(e => e.type === 'imaging');
            if (lastImaging) {
                const subDurationJD = (lastTarget.exposureTime + session.interExposureTime) / 86400;
                if (subDurationJD > 0) {
                    const subsCount = Math.ceil((lastImaging.endJD - lastImaging.startJD) / subDurationJD);
                    lastImaging.endJD = lastImaging.startJD + subsCount * subDurationJD;
                }
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

        let initialStartJD = duskJD;

        if (startTimeMode === 'custom' && customStartTime) {
            const [hours, minutes] = customStartTime.split(':').map(Number);
            // Custom time is local — convert to UTC using location timezone
            const timezone = location ? location.timezone : 0;
            const isDST = location ? SettingsManager.isDSTActive(new Date(), timezone) : false;
            const utcOffset = timezone + (isDST ? 1 : 0);
            const localMinutes = hours * 60 + minutes;
            const utcMinutes = localMinutes - utcOffset * 60;
            const utcHours = Math.floor(((utcMinutes % 1440) + 1440) % 1440 / 60);
            const utcMins = ((utcMinutes % 1440) + 1440) % 1440 % 60;
            const dayOffset = Math.floor((utcMinutes + 1440) / 1440) - 1;

            const duskDate = jdToDate(duskJD);
            const dateAtMidnight = new Date(Date.UTC(
                duskDate.getUTCFullYear(),
                duskDate.getUTCMonth(),
                duskDate.getUTCDate(),
                0, 0, 0, 0
            ));
            const midnightJD = dateToJD(dateAtMidnight);
            const timeOffset = (utcHours + utcMins / 60) / 24;
            let customJD = midnightJD + timeOffset;
            console.log('Custom time debug:', {
                customStartTime,
                hours, minutes,
                timezone, utcOffset,
                utcHours, utcMins, dayOffset,
                midnightJD,
                customJD,
                duskJD,
                dawnJD,
                diff_dusk: (customJD - duskJD) * 1440,
                diff_dawn: (dawnJD - customJD) * 1440
            });

            // If UTC time is early morning (wrapped past midnight), advance one day
            if (utcHours < 12 && customJD < duskJD) {
                customJD += 1;
            }

            if (customJD >= duskJD && customJD <= dawnJD) {
                initialStartJD = customJD;
            } else {
                console.warn('Custom start time outside dusk-dawn window, using dusk');
            }
        }

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
                    console.warn(`First target ${firstTarget.name} never rises above ${minAltitude}°`);
                }
            }
        }

        let sessionEndJD = dawnJD;

        if (optimizedTargets.length > 0) {
            const lastTarget = optimizedTargets[optimizedTargets.length - 1];

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
                sessionEndJD = setJD;
            } else {
                sessionEndJD = dawnJD;
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

        let validStartJD = riseJD || session.sessionStartJD;
        let validEndJD = setJD || session.sessionEndJD;

        let violationType = null;
        let isValid = true;

        if (!riseJD && !setJD) {
            const altitude = getAltitude(session.sessionStartJD, target.ra, target.dec,
                                         location.latitude, location.longitude);
            if (altitude < minAlt) {
                violationType = 'never_visible';
                isValid = false;
            }
        } else {
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
     * Find transition conflicts for all target boundaries
     * Checks both end of current target and start of next target
     * for meridian flips and periodic autofocus events within tolerance window
     * @param {Array} targets - Calculated target plans (output of calculateExposureCounts)
     * @param {Object} session - Session configuration
     * @param {number} toleranceMinutes - Tolerance window in minutes
     * @returns {Array} Array of conflict objects describing each conflict found
     */
    findTransitionConflicts(targets, session, toleranceMinutes) {
        if (!targets || targets.length < 2 || toleranceMinutes <= 0) {
            return [];
        }

        const toleranceJD = toleranceMinutes / 1440;
        const conflicts = [];

        for (let i = 0; i < targets.length - 1; i++) {
            const current = targets[i];
            const next = targets[i + 1];
            const boundaryJD = current.imagingEndJD;

            // === LOOK-BACK: events near end of current target ===

            if (current.meridianFlipJD) {
                const minutesFromEnd = (boundaryJD - current.meridianFlipJD) * 1440;
                if (minutesFromEnd >= 0 && minutesFromEnd <= toleranceMinutes) {
                    conflicts.push({
                        type: 'flip_near_end',
                        targetIndex: i,
                        targetName: current.name,
                        nextTargetName: next.name,
                        eventJD: current.meridianFlipJD,
                        boundaryJD: boundaryJD,
                        minutesFromBoundary: minutesFromEnd,
                        overheadMinutes: session.meridianFlipPause + session.meridianFlipDuration
                    });
                }
            }

            if (session.autofocusEnabled && session.autofocusInterval > 0) {

                if (session.calibrationDuration < session.autofocusInterval) {
                    const afDuration = session.autofocusDuration / 1440;
                    const afInterval = session.autofocusInterval / 1440;

                    let scheduleJD = current.imagingStartJD + afDuration +
                                     (session.calibrationDuration / 1440);
                    let lastAFEndJD = current.imagingStartJD + afDuration;

                    if (current.meridianFlipJD) {
                        const pauseBeforeJD = current.meridianFlipJD -
                                              (session.meridianFlipPause / 1440);
                        let afStart = scheduleJD + afInterval;

                        while (afStart < pauseBeforeJD) {
                            const afEnd = afStart + afDuration;
                            lastAFEndJD = afEnd;
                            scheduleJD = afEnd;
                            afStart = afEnd + afInterval;
                        }

                        const flipEnd = current.meridianFlipJD +
                                        (session.meridianFlipDuration / 1440);
                        const postFlipAFEnd = flipEnd + afDuration;
                        lastAFEndJD = postFlipAFEnd;
                        scheduleJD = postFlipAFEnd;

                        let afStartPost = postFlipAFEnd + afInterval;
                        while (afStartPost < boundaryJD) {
                            const afEnd = afStartPost + afDuration;
                            lastAFEndJD = afEnd;
                            scheduleJD = afEnd;
                            afStartPost = afEnd + afInterval;
                        }

                    } else {
                        let afStart = scheduleJD + afInterval;
                        while (afStart < boundaryJD) {
                            const afEnd = afStart + afDuration;
                            lastAFEndJD = afEnd;
                            scheduleJD = afEnd;
                            afStart = afEnd + afInterval;
                        }
                    }

                    const nextAFStartJD = boundaryJD;
                    const gapMinutes = (nextAFStartJD - lastAFEndJD) * 1440;

                    if (gapMinutes < 15 &&
                        gapMinutes >= 0 &&
                        (boundaryJD - lastAFEndJD) * 1440 <= toleranceMinutes) {
                        conflicts.push({
                            type: 'af_near_end',
                            targetIndex: i,
                            targetName: current.name,
                            nextTargetName: next.name,
                            eventJD: lastAFEndJD,
                            boundaryJD: boundaryJD,
                            minutesFromBoundary: (boundaryJD - lastAFEndJD) * 1440,
                            gapToNextAF: gapMinutes,
                            overheadMinutes: session.autofocusDuration
                        });
                    }
                }
            }

            // === LOOK-AHEAD: events near start of next target ===

            if (next.meridianFlipJD) {
                const minutesFromStart = (next.meridianFlipJD - boundaryJD) * 1440;
                if (minutesFromStart >= 0 && minutesFromStart <= toleranceMinutes) {
                    conflicts.push({
                        type: 'flip_near_start',
                        targetIndex: i + 1,
                        targetName: next.name,
                        nextTargetName: next.name,
                        eventJD: next.meridianFlipJD,
                        boundaryJD: boundaryJD,
                        minutesFromBoundary: minutesFromStart,
                        overheadMinutes: session.meridianFlipPause + session.meridianFlipDuration
                    });
                }
            }
        }

        return conflicts;
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
            return [];
        }

        const violations = [];
        const stepSize = APP_CONFIG.TARGET_SEARCH_STEP_SIZE;
        let jd = startJD;

        let inViolation = false;
        let violationStart = null;

        while (jd <= endJD) {
            const altitude = getAltitude(jd, raHours, decDeg, latitude, longitude);
            const azimuth = getAzimuth(jd, raHours, decDeg, latitude, longitude);

            const aboveMinAlt = altitude >= minAltitude;
            const aboveHorizon = isAboveHorizon(altitude, azimuth, minAltitude, horizonArray);

            const isViolating = aboveMinAlt && !aboveHorizon;
            if (isViolating && !inViolation) {
                violationStart = jd;
                inViolation = true;
            } else if (!isViolating && inViolation) {
                violations.push({ startJD: violationStart, endJD: jd });
                inViolation = false;
                violationStart = null;
            }

            jd += stepSize;
        }

        if (inViolation && violationStart !== null) {
            violations.push({ startJD: violationStart, endJD: endJD });
        }

        return violations;
    }

};

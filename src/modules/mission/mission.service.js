const Mission = require("./mission.model");
const MissionPlan = require("./missionPlan.model");
const FlightPlan = require("../flightPlan/flightPlan.model");
const {
    pairwiseConflictCheck,
    segmentationConflictCheck,
} = require("../conflict/conflictDetection.service");
const { checkFlightPlanZoneViolations } = require("../conflict/zoneConflict.service");

function createValidationError(message) {
    const err = new Error(message);
    err.name = "ValidationError";
    return err;
}

function assertValid(condition, message) {
    if (!condition) {
        throw createValidationError(message);
    }
}

function parseDate(value, fieldName) {
    const parsed = new Date(value);
    assertValid(!Number.isNaN(parsed.getTime()), `${fieldName} must be a valid date.`);
    return parsed;
}

async function getMissionForUser(missionId, userId, role) {
    const query = { _id: missionId };
    if (role !== "UTM_ADMIN") {
        query.createdBy = userId;
    }

    const mission = await Mission.findOne(query);
    if (!mission) {
        throw new Error("Mission not found");
    }

    return mission;
}

function getMissionFlightPlanPopulateOptions() {
    return {
        path: "flightPlan",
        populate: {
            path: "drone",
            select: "droneId serialNumber model owner ownerType maxAltitude status route createdAt updatedAt",
            populate: {
                path: "owner",
                select: "email profile.fullName role",
            },
        },
    };
}

async function assertFlightPlanUsableForMission(flightPlanId, userId, role) {
    const flightPlan = await FlightPlan.findById(flightPlanId);
    if (!flightPlan) {
        throw new Error("Flight plan not found");
    }

    if (role !== "UTM_ADMIN" && flightPlan.pilot.toString() !== userId.toString()) {
        throw new Error("Unauthorized: You don't own this flight plan");
    }

    if (flightPlan.status !== "ACTIVE") {
        throw createValidationError(
            `Cannot add flight plan with status "${flightPlan.status}" to mission. Only ACTIVE plans can be used.`,
        );
    }

    return flightPlan;
}

async function assertNoDroneOverlapInMission({
    missionId,
    droneId,
    plannedStart,
    plannedEnd,
    excludeMissionPlanId,
}) {
    const overlappingMissionPlans = await MissionPlan.find({
        mission: missionId,
        status: "SCHEDULED",
        plannedStart: { $lt: plannedEnd },
        plannedEnd: { $gt: plannedStart },
        ...(excludeMissionPlanId ? { _id: { $ne: excludeMissionPlanId } } : {}),
    }).populate("flightPlan", "drone");

    const hasOverlap = overlappingMissionPlans.some(
        (missionPlan) =>
            missionPlan.flightPlan &&
            missionPlan.flightPlan.drone &&
            missionPlan.flightPlan.drone.toString() === droneId.toString(),
    );

    if (hasOverlap) {
        throw createValidationError(
            "Mission schedule overlaps for the same drone. Adjust plannedStart/plannedEnd.",
        );
    }
}

async function assertNoDroneOverlapAcrossMissions({
    missionId,
    droneId,
    plannedStart,
    plannedEnd,
    excludeMissionPlanId,
}) {
    // Kiểm tra xem drone có bị conflict với các missions khác không (cùng thời gian)
    const overlappingMissionPlans = await MissionPlan.find({
        mission: { $ne: missionId },
        status: "SCHEDULED",
        plannedStart: { $lt: plannedEnd },
        plannedEnd: { $gt: plannedStart },
        ...(excludeMissionPlanId ? { _id: { $ne: excludeMissionPlanId } } : {}),
    }).populate("flightPlan", "drone").populate("mission", "name");

    const conflictingPlans = overlappingMissionPlans.filter(
        (missionPlan) =>
            missionPlan.flightPlan &&
            missionPlan.flightPlan.drone &&
            missionPlan.flightPlan.drone.toString() === droneId.toString(),
    );

    if (conflictingPlans.length > 0) {
        const conflictingMissionNames = conflictingPlans
            .map((mp) => mp.mission?.name || "Unknown")
            .join(", ");
        
        throw createValidationError(
            `Drone is already scheduled in another mission(s) at the same time: [${conflictingMissionNames}]. Adjust plannedStart/plannedEnd or use a different drone.`,
        );
    }
}

async function createMission(data, userId) {
    assertValid(data && typeof data === "object", "Invalid payload.");
    assertValid(data.name && data.name.trim(), "name is required.");

    const mission = await Mission.create({
        name: data.name.trim(),
        description: data.description,
        status: data.status || "DRAFT",
        createdBy: userId,
    });

    return mission;
}

async function listMissions(userId, role) {
    const query = role === "UTM_ADMIN" ? {} : { createdBy: userId };

    return Mission.find(query)
        .populate("createdBy", "email profile.fullName role")
        .sort({ createdAt: -1 });
}

async function getMissionDetail(missionId, userId, role) {
    const mission = await getMissionForUser(missionId, userId, role);

    const missionPlans = await MissionPlan.find({ mission: mission._id })
        .populate(getMissionFlightPlanPopulateOptions())
        .sort({ order: 1, plannedStart: 1, createdAt: 1 });

    return { mission, missionPlans };
}

async function updateMission(missionId, data, userId, role) {
    const mission = await getMissionForUser(missionId, userId, role);

    if (data.name !== undefined) {
        assertValid(data.name && data.name.trim(), "name cannot be empty.");
        mission.name = data.name.trim();
    }

    if (data.description !== undefined) {
        mission.description = data.description;
    }

    if (data.status !== undefined) {
        assertValid(
            ["DRAFT", "ACTIVE", "ARCHIVED"].includes(data.status),
            "status must be one of DRAFT, ACTIVE, ARCHIVED.",
        );
        mission.status = data.status;
    }

    await mission.save();
    return mission;
}

async function addPlanToMission(missionId, data, userId, role) {
    const mission = await getMissionForUser(missionId, userId, role);

    assertValid(data && typeof data === "object", "Invalid payload.");
    assertValid(data.flightPlanId, "flightPlanId is required.");

    const plannedStart = parseDate(data.plannedStart, "plannedStart");
    const plannedEnd = parseDate(data.plannedEnd, "plannedEnd");
    assertValid(plannedEnd > plannedStart, "plannedEnd must be after plannedStart.");

    const flightPlan = await assertFlightPlanUsableForMission(
        data.flightPlanId,
        userId,
        role,
    );

    // Check drone overlap trong cùng mission
    await assertNoDroneOverlapInMission({
        missionId: mission._id,
        droneId: flightPlan.drone,
        plannedStart,
        plannedEnd,
    });

    // Check drone overlap across các missions khác
    await assertNoDroneOverlapAcrossMissions({
        missionId: mission._id,
        droneId: flightPlan.drone,
        plannedStart,
        plannedEnd,
    });

    const checks = await runMissionAddChecks({
        missionId: mission._id,
        flightPlan,
        plannedStart,
        plannedEnd,
    });

    if (checks.hasBlockingIssues) {
        const err = createValidationError(
            "Không thể thêm plan vào mission vì phát hiện conflict/zone violation trong khung thời gian đã chọn.",
        );
        err.details = {
            notification: "Conflict được phát hiện ngay khi thêm plan. Vui lòng điều chỉnh thời gian hoặc lộ trình.",
            pairwiseConflicts: checks.pairwiseConflicts,
            segmentationConflicts: checks.segmentationConflicts,
            zoneViolations: checks.zoneViolations,
        };
        throw err;
    }

    const missionPlan = await MissionPlan.create({
        mission: mission._id,
        flightPlan: flightPlan._id,
        plannedStart,
        plannedEnd,
        order: data.order || 1,
        notes: data.notes,
    });

    return missionPlan.populate(getMissionFlightPlanPopulateOptions());
}

async function updateMissionPlan(
    missionId,
    missionPlanId,
    data,
    userId,
    role,
) {
    const mission = await getMissionForUser(missionId, userId, role);

    // Populate with all fields needed for trajectory mapping + drone overlap check
    const missionPlan = await MissionPlan.findOne({
        _id: missionPlanId,
        mission: mission._id,
    }).populate("flightPlan");

    if (!missionPlan) {
        throw new Error("Mission plan not found");
    }

    const timeChanged = data.plannedStart !== undefined || data.plannedEnd !== undefined;

    const plannedStart =
        data.plannedStart ?
            parseDate(data.plannedStart, "plannedStart")
            : missionPlan.plannedStart;
    const plannedEnd =
        data.plannedEnd ? parseDate(data.plannedEnd, "plannedEnd") : missionPlan.plannedEnd;

    assertValid(plannedEnd > plannedStart, "plannedEnd must be after plannedStart.");

    // Check drone overlap trong cùng mission
    await assertNoDroneOverlapInMission({
        missionId: mission._id,
        droneId: missionPlan.flightPlan.drone,
        plannedStart,
        plannedEnd,
        excludeMissionPlanId: missionPlan._id,
    });

    // Check drone overlap across các missions khác
    await assertNoDroneOverlapAcrossMissions({
        missionId: mission._id,
        droneId: missionPlan.flightPlan.drone,
        plannedStart,
        plannedEnd,
        excludeMissionPlanId: missionPlan._id,
    });
    // Re-run conflict detection if the scheduled time window changed
    if (timeChanged) {
        const checks = await runMissionAddChecks({
            missionId: mission._id,
            flightPlan: missionPlan.flightPlan,
            plannedStart,
            plannedEnd,
            excludeMissionPlanId: missionPlan._id,
        });

        if (checks.hasBlockingIssues) {
            const err = createValidationError(
                "Không thể cập nhật thời gian vì phát hiện conflict/zone violation trong khung giờ mới.",
            );
            err.details = {
                notification: "Conflict phát hiện khi thay đổi thời gian. Vui lòng chọn khung giờ khác.",
                pairwiseConflicts: checks.pairwiseConflicts,
                segmentationConflicts: checks.segmentationConflicts,
                zoneViolations: checks.zoneViolations,
            };
            throw err;
        }
    }

    missionPlan.plannedStart = plannedStart;
    missionPlan.plannedEnd = plannedEnd;

    if (data.order !== undefined) {
        assertValid(Number.isInteger(data.order) && data.order >= 1, "order must be >= 1.");
        missionPlan.order = data.order;
    }

    if (data.status !== undefined) {
        assertValid(
            ["SCHEDULED", "CANCELLED"].includes(data.status),
            "status must be one of SCHEDULED, CANCELLED.",
        );
        missionPlan.status = data.status;
    }

    if (data.notes !== undefined) {
        missionPlan.notes = data.notes;
    }

    await missionPlan.save();
    return missionPlan.populate(getMissionFlightPlanPopulateOptions());
}

async function removePlanFromMission(missionId, missionPlanId, userId, role) {
    const mission = await getMissionForUser(missionId, userId, role);

    const missionPlan = await MissionPlan.findOneAndDelete({
        _id: missionPlanId,
        mission: mission._id,
    });

    if (!missionPlan) {
        throw new Error("Mission plan not found");
    }

    return missionPlan;
}

async function deleteMission(missionId, userId, role) {
    const mission = await getMissionForUser(missionId, userId, role);

    await MissionPlan.deleteMany({ mission: mission._id });
    await Mission.deleteOne({ _id: mission._id });

    return { _id: mission._id };
}

function mapMissionPlanToScheduledTrajectory(missionPlan) {
    const flightPlan = missionPlan.flightPlan;
    const sortedWaypoints = [...(flightPlan.waypoints || [])].sort(
        (a, b) => a.sequenceNumber - b.sequenceNumber,
    );

    const startMs = new Date(missionPlan.plannedStart).getTime();
    const endMs = new Date(missionPlan.plannedEnd).getTime();
    const durationMs = Math.max(1000, endMs - startMs);
    const segments = Math.max(1, sortedWaypoints.length - 1);

    const waypoints = sortedWaypoints.map((waypoint, index) => ({
        sequenceNumber: waypoint.sequenceNumber,
        latitude: waypoint.latitude,
        longitude: waypoint.longitude,
        altitude: waypoint.altitude,
        speed: waypoint.speed,
        action: waypoint.action,
        estimatedTime: new Date(startMs + (durationMs * index) / segments),
    }));

    return {
        _id: flightPlan._id,
        missionPlanId: missionPlan._id,
        plannedStart: missionPlan.plannedStart,
        plannedEnd: missionPlan.plannedEnd,
        routeGeometry: flightPlan.routeGeometry,
        waypoints,
    };
}

function deduplicateConflicts(conflicts) {
    const map = new Map();

    for (const conflict of conflicts) {
        const key = conflict.flightPlans
            .map((id) => id.toString())
            .sort()
            .join("_");

        if (!map.has(key)) {
            map.set(key, conflict);
        }
    }

    return [...map.values()];
}

function mergeSegmentationWithoutPairwiseDuplicates(
    pairwiseConflicts,
    segmentationConflicts,
) {
    const deduplicatedSegmentation = deduplicateConflicts(segmentationConflicts);

    const pairwisePairs = new Set(
        pairwiseConflicts.map((conflict) =>
            conflict.flightPlans
                .map((id) => id.toString())
                .sort()
                .join("_"),
        ),
    );

    return deduplicatedSegmentation.filter((conflict) => {
        const pairKey = conflict.flightPlans
            .map((id) => id.toString())
            .sort()
            .join("_");

        return !pairwisePairs.has(pairKey);
    });
}

/**
 * Build trajectories for all MissionPlans within a mission that are SCHEDULED,
 * optionally excluding a specific MissionPlan (used during update).
 */
async function getInternalTrajectories(missionId, excludeMissionPlanId = null) {
    const query = { mission: missionId, status: "SCHEDULED" };
    if (excludeMissionPlanId) {
        query._id = { $ne: excludeMissionPlanId };
    }
    const missionPlans = await MissionPlan.find(query).populate("flightPlan");
    return missionPlans.map(mapMissionPlanToScheduledTrajectory);
}

/**
 * Build trajectories for all MissionPlans SCHEDULED in OTHER missions
 * whose time window overlaps [plannedStart, plannedEnd].
 * Optionally excludes a specific mission (current mission) from the query.
 */
async function getCrossMissionTrajectories(excludeMissionId, plannedStart, plannedEnd) {
    const crossPlans = await MissionPlan.find({
        mission: { $ne: excludeMissionId },
        status: "SCHEDULED",
        plannedStart: { $lt: plannedEnd },
        plannedEnd: { $gt: plannedStart },
    }).populate("flightPlan");
    return crossPlans.map(mapMissionPlanToScheduledTrajectory);
}

/**
 * Run all pre-flight conflict checks for a candidate MissionPlan being added or updated.
 * Checks against:
 *   1. Other SCHEDULED plans within the SAME mission (internal)
 *   2. All SCHEDULED plans from OTHER missions whose time overlaps (cross-mission)
 *
 * @param {Object} options
 * @param {ObjectId} options.missionId           - The mission being modified
 * @param {Object}  options.flightPlan           - Populated FlightPlan document
 * @param {Date}    options.plannedStart          - Scheduled start time
 * @param {Date}    options.plannedEnd            - Scheduled end time
 * @param {ObjectId} [options.excludeMissionPlanId] - MissionPlan to exclude (during update)
 */
async function runMissionAddChecks({ missionId, flightPlan, plannedStart, plannedEnd, excludeMissionPlanId = null }) {
    const candidateMissionPlan = {
        _id: `candidate_${flightPlan._id.toString()}`,
        flightPlan,
        plannedStart,
        plannedEnd,
    };
    const candidateTrajectory = mapMissionPlanToScheduledTrajectory(candidateMissionPlan);

    // Gather all competing trajectories: internal (same mission) + cross-mission
    const [internalTrajectories, crossTrajectories] = await Promise.all([
        getInternalTrajectories(missionId, excludeMissionPlanId),
        getCrossMissionTrajectories(missionId, plannedStart, plannedEnd),
    ]);
    const allExistingTrajectories = [...internalTrajectories, ...crossTrajectories];

    const pairwiseConflicts = deduplicateConflicts(
        pairwiseConflictCheck(candidateTrajectory, allExistingTrajectories),
    );

    const segmentationConflicts = mergeSegmentationWithoutPairwiseDuplicates(
        pairwiseConflicts,
        segmentationConflictCheck(candidateTrajectory, allExistingTrajectories),
    );

    const zoneViolations = await checkFlightPlanZoneViolations(candidateTrajectory);

    return {
        pairwiseConflicts,
        segmentationConflicts,
        zoneViolations,
        hasBlockingIssues:
            pairwiseConflicts.length > 0 ||
            segmentationConflicts.length > 0 ||
            zoneViolations.length > 0,
    };
}

/**
 * Final conflict re-check when activating a mission (DRAFT → ACTIVE).
 * Checks:
 *   1. Internal conflicts among all plans within this mission
 *   2. Cross-mission conflicts with all other SCHEDULED plans whose time overlaps
 *
 * @param {Array}    missionPlans - All SCHEDULED MissionPlan documents (populated) for this mission
 * @param {ObjectId} missionId    - The mission being started (to exclude from cross-mission query)
 */
async function runMissionStartChecks(missionPlans, missionId) {
    const scheduledTrajectories = missionPlans.map(mapMissionPlanToScheduledTrajectory);

    // ── Internal check (plans within the same mission conflict with each other) ──
    let pairwiseConflicts = [];
    let segmentationConflicts = [];

    for (let index = 0; index < scheduledTrajectories.length; index += 1) {
        const current = scheduledTrajectories[index];
        const others = scheduledTrajectories.filter((_, i) => i !== index);

        pairwiseConflicts.push(...pairwiseConflictCheck(current, others));
        segmentationConflicts.push(...segmentationConflictCheck(current, others));
    }

    pairwiseConflicts = deduplicateConflicts(pairwiseConflicts);
    segmentationConflicts = mergeSegmentationWithoutPairwiseDuplicates(
        pairwiseConflicts,
        segmentationConflicts,
    );

    // ── Cross-mission check (each plan against other missions) ──
    const crossMissionChecks = await Promise.all(
        scheduledTrajectories.map(async (trajectory) => {
            const crossTrajectories = await getCrossMissionTrajectories(
                missionId,
                trajectory.plannedStart,
                trajectory.plannedEnd,
            );
            if (crossTrajectories.length === 0) return { pairwise: [], seg: [] };

            const crossPairwise = pairwiseConflictCheck(trajectory, crossTrajectories);
            const crossSeg = mergeSegmentationWithoutPairwiseDuplicates(
                crossPairwise,
                segmentationConflictCheck(trajectory, crossTrajectories),
            );
            return { pairwise: crossPairwise, seg: crossSeg };
        }),
    );

    for (const { pairwise, seg } of crossMissionChecks) {
        pairwiseConflicts.push(...pairwise);
        segmentationConflicts.push(...seg);
    }

    pairwiseConflicts = deduplicateConflicts(pairwiseConflicts);
    segmentationConflicts = mergeSegmentationWithoutPairwiseDuplicates(
        pairwiseConflicts,
        segmentationConflicts,
    );

    // ── Zone violations (each trajectory vs active zones) ──
    const zoneViolationsNested = await Promise.all(
        scheduledTrajectories.map((trajectory) =>
            checkFlightPlanZoneViolations({
                ...trajectory,
                _id: trajectory._id,
            }),
        ),
    );
    const zoneViolations = zoneViolationsNested.flat();

    return {
        pairwiseConflicts,
        segmentationConflicts,
        zoneViolations,
        hasBlockingIssues:
            pairwiseConflicts.length > 0 ||
            segmentationConflicts.length > 0 ||
            zoneViolations.length > 0,
    };
}

async function startMission(missionId, userId, role) {
    const mission = await getMissionForUser(missionId, userId, role);

    if (mission.status === "ARCHIVED") {
        throw createValidationError("Cannot start archived mission.");
    }

    const missionPlans = await MissionPlan.find({
        mission: mission._id,
        status: "SCHEDULED",
    }).populate("flightPlan");

    assertValid(
        missionPlans.length > 0,
        "Mission must contain at least one scheduled plan before start.",
    );

    const checks = await runMissionStartChecks(missionPlans, mission._id);

    if (checks.hasBlockingIssues) {
        const err = createValidationError(
            "Mission start blocked by conflicts or zone violations.",
        );
        err.details = {
            pairwiseConflicts: checks.pairwiseConflicts,
            segmentationConflicts: checks.segmentationConflicts,
            zoneViolations: checks.zoneViolations,
        };
        throw err;
    }

    mission.status = "ACTIVE";
    await mission.save();

    return {
        mission,
        checks: {
            pairwiseConflicts: 0,
            segmentationConflicts: 0,
            zoneViolations: 0,
        },
    };
}

module.exports = {
    createMission,
    listMissions,
    getMissionDetail,
    updateMission,
    addPlanToMission,
    updateMissionPlan,
    removePlanFromMission,
    deleteMission,
    startMission,
};
const FlightPlan = require("./flightPlan.model");
const Drone = require("../../../models/drone.model");
const { dismissOldConflicts } = require("../conflict/conflictDetection.service");

const FLIGHT_PLAN_RULES = {
    MIN_WAYPOINTS: 2,
    MAX_WAYPOINTS: 500,
    MAX_SEGMENT_DISTANCE_M: 50000,
};

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

function haversineDistanceMeters(lat1, lng1, lat2, lng2) {
    const toRad = (deg) => (deg * Math.PI) / 180;
    const earthRadius = 6371000;

    const dLat = toRad(lat2 - lat1);
    const dLng = toRad(lng2 - lng1);

    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(toRad(lat1)) *
        Math.cos(toRad(lat2)) *
        Math.sin(dLng / 2) *
        Math.sin(dLng / 2);

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return earthRadius * c;
}

function validateWaypoint(waypoint, index) {
    const waypointPosition = index + 1;

    assertValid(
        waypoint && typeof waypoint === "object",
        `Waypoint #${waypointPosition} must be a valid object.`,
    );

    assertValid(
        Number.isFinite(waypoint.sequenceNumber),
        `Waypoint #${waypointPosition}: sequenceNumber is required.`,
    );

    assertValid(
        Number.isFinite(waypoint.latitude) &&
        waypoint.latitude >= -90 &&
        waypoint.latitude <= 90,
        `Waypoint #${waypointPosition}: latitude must be between -90 and 90.`,
    );

    assertValid(
        Number.isFinite(waypoint.longitude) &&
        waypoint.longitude >= -180 &&
        waypoint.longitude <= 180,
        `Waypoint #${waypointPosition}: longitude must be between -180 and 180.`,
    );

    assertValid(
        Number.isFinite(waypoint.altitude) && waypoint.altitude >= 0,
        `Waypoint #${waypointPosition}: altitude must be >= 0.`,
    );

    if (waypoint.speed !== undefined && waypoint.speed !== null) {
        assertValid(
            Number.isFinite(waypoint.speed) && waypoint.speed >= 0,
            `Waypoint #${waypointPosition}: speed must be >= 0.`,
        );
    }
}

function validateWaypointOrderingAndGeometry(waypoints) {
    const sortedWaypoints = [...waypoints].sort(
        (a, b) => a.sequenceNumber - b.sequenceNumber,
    );

    const uniqueSequenceCount = new Set(
        sortedWaypoints.map((waypoint) => waypoint.sequenceNumber),
    ).size;

    assertValid(
        uniqueSequenceCount === sortedWaypoints.length,
        "Waypoint sequenceNumber must be unique.",
    );

    for (let index = 0; index < sortedWaypoints.length; index += 1) {
        const waypoint = sortedWaypoints[index];
        const expectedSequence = index + 1;

        assertValid(
            waypoint.sequenceNumber === expectedSequence,
            `Waypoint sequenceNumber must be continuous from 1..N. Invalid at sequence ${expectedSequence}.`,
        );

        if (index > 0) {
            const previousWaypoint = sortedWaypoints[index - 1];
            const distanceMeters = haversineDistanceMeters(
                previousWaypoint.latitude,
                previousWaypoint.longitude,
                waypoint.latitude,
                waypoint.longitude,
            );

            assertValid(
                distanceMeters <= FLIGHT_PLAN_RULES.MAX_SEGMENT_DISTANCE_M,
                `Waypoint segment ${previousWaypoint.sequenceNumber}->${waypoint.sequenceNumber} is too long (${Math.round(distanceMeters)}m).`,
            );
        }
    }
}

function validateFlightPlanPayload(data) {
    assertValid(data && typeof data === "object", "Invalid payload.");
    assertValid(data.drone, "drone is required.");

    assertValid(Array.isArray(data.waypoints), "waypoints must be an array.");
    assertValid(
        data.waypoints.length >= FLIGHT_PLAN_RULES.MIN_WAYPOINTS,
        `Flight plan must have at least ${FLIGHT_PLAN_RULES.MIN_WAYPOINTS} waypoints.`,
    );
    assertValid(
        data.waypoints.length <= FLIGHT_PLAN_RULES.MAX_WAYPOINTS,
        `Flight plan cannot exceed ${FLIGHT_PLAN_RULES.MAX_WAYPOINTS} waypoints.`,
    );

    data.waypoints.forEach((waypoint, index) => validateWaypoint(waypoint, index));
    validateWaypointOrderingAndGeometry(data.waypoints);

    if (data.priority !== undefined) {
        assertValid(
            Number.isInteger(data.priority) && data.priority >= 1 && data.priority <= 10,
            "priority must be an integer between 1 and 10.",
        );
    }

    return {
        ...data,
    };
}

async function validateDroneOwnershipAndAvailability(droneId, userId) {
    const drone = await Drone.findById(droneId);
    if (!drone) throw new Error("Drone not found");

    if (drone.owner.toString() !== userId.toString()) {
        throw new Error("Unauthorized: You don't own this drone");
    }

    if (drone.status !== "IDLE") {
        throw createValidationError(
            `Drone status "${drone.status}" is not eligible for flight plan operations. Drone must be IDLE.`,
        );
    }

    return drone;
}

function validateAltitudeAgainstDroneCapability(waypoints, drone) {
    if (!Number.isFinite(drone.maxAltitude)) {
        return;
    }

    for (const waypoint of waypoints) {
        assertValid(
            waypoint.altitude <= drone.maxAltitude,
            `Waypoint #${waypoint.sequenceNumber}: altitude ${waypoint.altitude} exceeds drone maxAltitude ${drone.maxAltitude}.`,
        );
    }
}

async function createFlightPlan(data, userId) {
    const normalizedData = validateFlightPlanPayload(data);
    const drone = await validateDroneOwnershipAndAvailability(
        normalizedData.drone,
        userId,
    );

    validateAltitudeAgainstDroneCapability(normalizedData.waypoints, drone);

    const flightPlan = new FlightPlan({
        ...normalizedData,
        pilot: userId,
        status: "DRAFT",
        conflictStatus: "CLEAR",
    });

    await flightPlan.save();
    return flightPlan;
}

async function updateFlightPlan(id, data, userId) {
    const flightPlan = await FlightPlan.findById(id);
    if (!flightPlan) throw new Error("Flight plan not found");

    if (flightPlan.pilot.toString() !== userId.toString()) {
        throw new Error("Unauthorized: You don't own this flight plan");
    }

    if (!["DRAFT", "REJECTED"].includes(flightPlan.status)) {
        throw new Error(
            `Cannot update flight plan with status "${flightPlan.status}". Only DRAFT or REJECTED plans can be edited.`,
        );
    }

    const mergedPayload = {
        drone: data.drone ?? flightPlan.drone,
        priority: data.priority ?? flightPlan.priority,
        waypoints: data.waypoints ?? flightPlan.waypoints,
        notes: data.notes ?? flightPlan.notes,
    };

    const normalizedData = validateFlightPlanPayload(mergedPayload);
    const drone = await validateDroneOwnershipAndAvailability(
        normalizedData.drone,
        userId,
    );

    validateAltitudeAgainstDroneCapability(normalizedData.waypoints, drone);

    if (flightPlan.status === "REJECTED") {
        flightPlan.status = "DRAFT";
        flightPlan.conflictStatus = "CLEAR";
        await dismissOldConflicts(id);
    }

    const allowedFields = ["drone", "priority", "waypoints", "notes"];
    for (const field of allowedFields) {
        if (normalizedData[field] !== undefined) {
            flightPlan[field] = normalizedData[field];
        }
    }

    await flightPlan.save();
    return flightPlan;
}

async function submitFlightPlan(id, userId) {
    const flightPlan = await FlightPlan.findById(id);
    if (!flightPlan) throw new Error("Flight plan not found");

    if (flightPlan.pilot.toString() !== userId.toString()) {
        throw new Error("Unauthorized: You don't own this flight plan");
    }

    if (flightPlan.status !== "DRAFT") {
        throw new Error(
            `Cannot submit flight plan with status "${flightPlan.status}". Only DRAFT plans can be submitted.`,
        );
    }

    const normalizedData = validateFlightPlanPayload({
        drone: flightPlan.drone,
        priority: flightPlan.priority,
        waypoints: flightPlan.waypoints,
        notes: flightPlan.notes,
    });

    const drone = await validateDroneOwnershipAndAvailability(
        normalizedData.drone,
        userId,
    );

    validateAltitudeAgainstDroneCapability(normalizedData.waypoints, drone);

    flightPlan.status = "APPROVED";
    flightPlan.conflictStatus = "CLEAR";
    await flightPlan.save();

    const finalPlan = await FlightPlan.findById(id)
        .populate("drone", "droneId serialNumber model")
        .populate("pilot", "email profile.fullName");

    return {
        flightPlan: finalPlan,
        conflicts: [],
        approved: true,
    };
}

async function cancelFlightPlan(id, userId) {
    const flightPlan = await FlightPlan.findById(id);
    if (!flightPlan) throw new Error("Flight plan not found");

    if (flightPlan.pilot.toString() !== userId.toString()) {
        throw new Error("Unauthorized: You don't own this flight plan");
    }

    if (!["DRAFT", "REJECTED"].includes(flightPlan.status)) {
        throw new Error(
            `Cannot cancel flight plan with status "${flightPlan.status}". Only DRAFT or REJECTED plans can be cancelled.`,
        );
    }

    await dismissOldConflicts(id);

    flightPlan.status = "CANCELLED";
    await flightPlan.save();

    return flightPlan;
}

module.exports = {
    createFlightPlan,
    updateFlightPlan,
    submitFlightPlan,
    cancelFlightPlan,
};
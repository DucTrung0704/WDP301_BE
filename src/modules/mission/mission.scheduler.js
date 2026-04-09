/**
 * Mission Scheduler - Auto-triggers flight sessions when mission time arrives
 * Runs every minute to check for scheduled missions that have reached their plannedStart time
 */

const cron = require("node-cron");
const MissionPlan = require("./missionPlan.model");
const FlightPlan = require("../flightPlan/flightPlan.model");
const FlightSession = require("../flightSession/flightSession.model");
const Drone = require("../../../models/drone.model");

let schedulerJob = null;

function getMissionSchedulerCronExpression() {
    const raw = String(process.env.MISSION_SCHEDULER_CRON || "*/10 * * * * *").trim();
    return raw || "*/10 * * * * *";
}

/**
 * Initialize the mission scheduler
 * Call this once when the app starts
 */
function initializeMissionScheduler() {
    const cronExpression = getMissionSchedulerCronExpression();

    schedulerJob = cron.schedule(cronExpression, async () => {
        try {
            await checkAndStartScheduledMissions();
        } catch (error) {
            console.error("[Mission Scheduler] Error in scheduled check:", error.message);
        }
    });

    // Run one tick immediately after init so due plans don't wait for next cron slot.
    checkAndStartScheduledMissions().catch((error) => {
        console.error("[Mission Scheduler] Initial tick failed:", error.message);
    });

    console.log(`[Mission Scheduler] Initialized - cron: ${cronExpression}`);
}

/**
 * Check for MissionPlans that should be started now
 */
async function checkAndStartScheduledMissions() {
    const now = new Date();

    try {
        // Find all SCHEDULED missions whose plannedStart <= now
        const missionsToStart = await MissionPlan.find({
            status: { $in: ["SCHEDULED", "scheduled"] },
            plannedStart: { $lte: now },
        })
            .populate("flightPlan")
            .populate("mission");

        if (missionsToStart.length > 0) {
            console.log(`\n[Mission Scheduler] Found ${missionsToStart.length} mission(s) ready to start`);

            for (const missionPlan of missionsToStart) {
                try {
                    await autoStartMissionSession(missionPlan);
                } catch (error) {
                    console.error(
                        `[Mission Scheduler] Failed to start mission plan ${missionPlan._id}:`,
                        error.message,
                    );
                    // Continue with next mission even if this one fails
                }
            }
        }

        await checkAndCompleteInProgressMissions(now);
    } catch (error) {
        console.error("[Mission Scheduler] Database query error:", error.message);
    }
}

/**
 * Auto-start a mission by creating a FlightSession
 */
async function autoStartMissionSession(missionPlan) {
    const { flightPlan, _id: missionPlanId, mission } = missionPlan;

    // Validate flight plan exists and is ACTIVE
    if (!flightPlan) {
        throw new Error("Flight plan reference not found");
    }

    if (flightPlan.status !== "ACTIVE") {
        throw new Error(`Flight plan is ${flightPlan.status}, cannot auto-start`);
    }

    const linkedActiveSession = await FlightSession.findOne({
        missionPlan: missionPlanId,
        status: { $in: ["STARTING", "IN_PROGRESS"] },
    });

    if (linkedActiveSession) {
        missionPlan.status = "IN_PROGRESS";
        await missionPlan.save();
        console.log(
            `[Mission Scheduler] Mission plan ${missionPlanId} already has active session ${linkedActiveSession._id}; synced status to IN_PROGRESS`,
        );
        return;
    }

    // Validate drone exists and is IDLE
    const drone = await Drone.findById(flightPlan.drone);
    if (!drone) {
        throw new Error("Drone not found");
    }

    // Check if drone already has active session
    const existingSession = await FlightSession.findOne({
        drone: drone._id,
        status: { $in: ["STARTING", "IN_PROGRESS"] },
    });

    if (existingSession) {
        // If an active session already exists for the same flight plan, just sync mission plan status.
        if (existingSession.flightPlan && existingSession.flightPlan.toString() === flightPlan._id.toString()) {
            missionPlan.status = "IN_PROGRESS";
            await missionPlan.save();
            console.log(
                `[Mission Scheduler] Mission plan ${missionPlanId} re-used active session ${existingSession._id}; synced status to IN_PROGRESS`,
            );
            return;
        }

        throw new Error("Drone already has an active flight session");
    }

    if (drone.status !== "IDLE") {
        // Recover stale drone state when no active session exists.
        console.warn(
            `[Mission Scheduler] Drone ${drone._id} is ${drone.status} without active session; resetting to IDLE`,
        );
        drone.status = "IDLE";
        await drone.save();
    }

    // Create flight session
    const session = await FlightSession.create({
        flightPlan: flightPlan._id,
        missionPlan: missionPlanId,
        drone: drone._id,
        pilot: flightPlan.pilot,
        sessionType: "PLANNED",
        status: "IN_PROGRESS",
        actualStart: new Date(),
    });

    // Update MissionPlan status
    missionPlan.status = "IN_PROGRESS";
    await missionPlan.save();

    // Update Drone status
    drone.status = "FLYING";
    await drone.save();

    console.log(
        `[Mission Scheduler] AUTO-STARTED Mission "${mission?.name || "Unknown"}" (MissionPlan: ${missionPlanId})`,
    );
    console.log(`   - FlightSession: ${session._id}`);
    console.log(`   - Drone: ${drone.droneId}`);
}

async function checkAndCompleteInProgressMissions(now) {
    const missionPlansToComplete = await MissionPlan.find({
        status: { $in: ["IN_PROGRESS", "in_progress"] },
        plannedEnd: { $lte: now },
    })
        .populate("flightPlan")
        .populate("mission");

    if (missionPlansToComplete.length === 0) {
        return;
    }

    console.log(`\n[Mission Scheduler] Found ${missionPlansToComplete.length} mission(s) ready to complete`);

    for (const missionPlan of missionPlansToComplete) {
        try {
            await autoCompleteMissionSession(missionPlan, now);
        } catch (error) {
            console.error(
                `[Mission Scheduler] Failed to complete mission plan ${missionPlan._id}:`,
                error.message,
            );
        }
    }
}

async function autoCompleteMissionSession(missionPlan, now) {
    const { _id: missionPlanId, mission, flightPlan } = missionPlan;

    const activeSessions = await FlightSession.find({
        missionPlan: missionPlanId,
        status: { $in: ["STARTING", "IN_PROGRESS"] },
    });

    if (activeSessions.length > 0) {
        for (const session of activeSessions) {
            session.status = "COMPLETED";
            session.actualEnd = now;
            await session.save();

            await Drone.findByIdAndUpdate(session.drone, { status: "IDLE" });
        }
    } else if (flightPlan?.drone) {
        // Safety fallback: ensure drone is not stuck in FLYING when no active session exists.
        await Drone.findByIdAndUpdate(flightPlan.drone, { status: "IDLE" });
    }

    missionPlan.status = "COMPLETED";
    await missionPlan.save();

    console.log(
        `[Mission Scheduler] AUTO-COMPLETED Mission "${mission?.name || "Unknown"}" (MissionPlan: ${missionPlanId})`,
    );
}

/**
 * Stop the scheduler (useful for testing or graceful shutdown)
 */
function stopMissionScheduler() {
    if (schedulerJob) {
        schedulerJob.stop();
        console.log("[Mission Scheduler] Stopped");
    }
}

module.exports = {
    initializeMissionScheduler,
    stopMissionScheduler,
    checkAndStartScheduledMissions,
};

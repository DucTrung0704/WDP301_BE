const jwt = require("jsonwebtoken");
const mongoose = require("mongoose");
const Mission = require("../mission/mission.model");
const MissionPlan = require("../mission/missionPlan.model");
const simulationService = require("./simulation.service");

const DEFAULT_SCHEDULER_INTERVAL_MS = 30 * 1000;
const DEFAULT_RETRY_COOLDOWN_MS = 60 * 1000;

let schedulerTimer = null;
let isTickRunning = false;
const missionAttemptState = new Map();

function getSchedulerIntervalMs() {
    const value = Number(process.env.SIMULATION_SCHEDULER_INTERVAL_MS || DEFAULT_SCHEDULER_INTERVAL_MS);
    return Number.isFinite(value) && value >= 5000 ? value : DEFAULT_SCHEDULER_INTERVAL_MS;
}

function getRetryCooldownMs() {
    const value = Number(process.env.SIMULATION_SCHEDULER_RETRY_MS || DEFAULT_RETRY_COOLDOWN_MS);
    return Number.isFinite(value) && value >= 10000 ? value : DEFAULT_RETRY_COOLDOWN_MS;
}

function isSchedulerEnabled() {
    const value = String(process.env.ENABLE_SIMULATION_SCHEDULER || "true").trim().toLowerCase();
    return value !== "false";
}

function buildBaseUrl(port) {
    return (
        (process.env.SIMULATION_SCHEDULER_BASE_URL || "").trim() ||
        (process.env.BASE_URL || "").trim() ||
        `http://127.0.0.1:${port || process.env.PORT || 5000}`
    );
}

function buildWsUrl(port) {
    return (
        (process.env.SIMULATION_SCHEDULER_WS_URL || "").trim() ||
        (process.env.WS_URL || "").trim() ||
        buildBaseUrl(port)
    );
}

function createSchedulerToken(user) {
    return jwt.sign(
        {
            userId: user._id.toString(),
            role: user.role,
        },
        process.env.JWT_SECRET,
        { expiresIn: "15m" },
    );
}

function shouldAttemptMission(missionId, nowMs) {
    const state = missionAttemptState.get(missionId);
    if (!state) return true;
    return nowMs - state.lastAttemptAt >= getRetryCooldownMs();
}

async function getDueDraftMissions() {
    const now = new Date();
    const groupedDuePlans = await MissionPlan.aggregate([
        {
            $match: {
                status: "SCHEDULED",
                plannedStart: { $lte: now },
            },
        },
        {
            $group: {
                _id: "$mission",
                earliestPlannedStart: { $min: "$plannedStart" },
            },
        },
        {
            $sort: {
                earliestPlannedStart: 1,
            },
        },
    ]);

    if (groupedDuePlans.length === 0) {
        return [];
    }

    const missionIds = groupedDuePlans.map((item) => item._id);
    const missions = await Mission.find({
        _id: { $in: missionIds },
        status: "DRAFT",
    }).populate("createdBy", "email profile.fullName role");

    const missionMap = new Map(missions.map((mission) => [mission._id.toString(), mission]));

    return groupedDuePlans
        .map((item) => ({
            mission: missionMap.get(item._id.toString()) || null,
            earliestPlannedStart: item.earliestPlannedStart,
        }))
        .filter((item) => item.mission);
}

async function schedulerTick(context) {
    if (isTickRunning) return;
    if (!isSchedulerEnabled()) return;
    if (mongoose.connection.readyState !== 1) return;

    isTickRunning = true;

    try {
        const dueMissions = await getDueDraftMissions();
        const nowMs = Date.now();

        for (const item of dueMissions) {
            const mission = item.mission;
            const missionId = mission._id.toString();

            if (!shouldAttemptMission(missionId, nowMs)) {
                continue;
            }

            missionAttemptState.set(missionId, {
                lastAttemptAt: nowMs,
                status: "attempting",
            });

            const actor = mission.createdBy;
            if (!actor || !["FLEET_OPERATOR", "UTM_ADMIN"].includes(actor.role)) {
                console.warn(
                    `[simulation-scheduler] Skip mission ${missionId}: owner role ${actor?.role || "unknown"} cannot start simulations.`,
                );
                missionAttemptState.set(missionId, {
                    lastAttemptAt: nowMs,
                    status: "skipped-invalid-role",
                });
                continue;
            }

            try {
                const run = await simulationService.startMissionSimulation({
                    missionId,
                    token: createSchedulerToken(actor),
                    actor: {
                        id: actor._id.toString(),
                        role: actor.role,
                    },
                    options: {
                        baseUrl: buildBaseUrl(context.port),
                        wsUrl: buildWsUrl(context.port),
                        autoStartedByScheduler: true,
                    },
                });

                missionAttemptState.set(missionId, {
                    lastAttemptAt: nowMs,
                    status: "started",
                    runId: run.runId,
                });

                console.log(
                    `[simulation-scheduler] Auto-started simulation for mission ${missionId} (run ${run.runId}).`,
                );
            } catch (error) {
                missionAttemptState.set(missionId, {
                    lastAttemptAt: nowMs,
                    status: `failed:${error.statusCode || 500}`,
                });

                console.error(
                    `[simulation-scheduler] Failed to auto-start mission ${missionId}: ${error.message}`,
                );
            }
        }
    } finally {
        isTickRunning = false;
    }
}

function startScheduler(context = {}) {
    if (schedulerTimer || !isSchedulerEnabled()) {
        return;
    }

    const intervalMs = getSchedulerIntervalMs();
    console.log(`[simulation-scheduler] Started with interval ${intervalMs}ms.`);

    schedulerTick(context).catch((error) => {
        console.error("[simulation-scheduler] Initial tick failed:", error);
    });

    schedulerTimer = setInterval(() => {
        schedulerTick(context).catch((error) => {
            console.error("[simulation-scheduler] Tick failed:", error);
        });
    }, intervalMs);
}

function stopScheduler() {
    if (!schedulerTimer) {
        return;
    }

    clearInterval(schedulerTimer);
    schedulerTimer = null;
    console.log("[simulation-scheduler] Stopped.");
}

module.exports = {
    startScheduler,
    stopScheduler,
};

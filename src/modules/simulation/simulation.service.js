const { spawn } = require("child_process");
const path = require("path");
const { randomUUID } = require("crypto");
const MissionPlan = require("../mission/missionPlan.model");
const FlightSession = require("../flightSession/flightSession.model");
const Drone = require("../../../models/drone.model");

const SIM_SCRIPT_PATH = path.join(process.cwd(), "scripts", "simulate-mission.js");
const MAX_LOG_LINES = 300;

const runs = new Map();

function makeError(message, statusCode) {
  const err = new Error(message);
  err.statusCode = statusCode;
  return err;
}

async function forceCleanupRunSessions(run) {
  const missionPlans = await MissionPlan.find({ mission: run.missionId }).populate({
    path: "flightPlan",
    select: "_id drone",
  });

  const flightPlanIds = missionPlans
    .map((plan) => plan.flightPlan?._id)
    .filter(Boolean);

  const droneIds = missionPlans
    .map((plan) => plan.flightPlan?.drone)
    .filter(Boolean);

  if (flightPlanIds.length === 0 && droneIds.length === 0) {
    return;
  }

  const activeSessions = await FlightSession.find({
    pilot: run.userId,
    status: { $in: ["STARTING", "IN_PROGRESS"] },
    $or: [
      ...(flightPlanIds.length > 0 ? [{ flightPlan: { $in: flightPlanIds } }] : []),
      ...(droneIds.length > 0 ? [{ drone: { $in: droneIds } }] : []),
    ],
  }).select("_id notes");

  if (activeSessions.length === 0) {
    return;
  }

  const now = new Date();
  const note = `Auto-aborted by simulation stop for run ${run.runId}.`;

  await Promise.all(
    activeSessions.map((session) =>
      FlightSession.updateOne(
        { _id: session._id },
        {
          status: "ABORTED",
          actualEnd: now,
          notes: [session.notes, note].filter(Boolean).join("\n"),
        },
      ),
    ),
  );

  if (droneIds.length > 0) {
    await Drone.updateMany({ _id: { $in: droneIds } }, { status: "IDLE" });
  }
}

async function precheckMissionSimulation(missionId) {
  const missionPlans = await MissionPlan.find({
    mission: missionId,
    status: "SCHEDULED",
  }).populate({
    path: "flightPlan",
    select: "drone status pilot",
  });

  if (missionPlans.length === 0) {
    throw makeError("Mission must contain at least one scheduled plan before starting simulation", 400);
  }

  const invalidPlans = missionPlans
    .filter((plan) => !plan.flightPlan || plan.flightPlan.status !== "ACTIVE")
    .map((plan) => ({
      missionPlanId: plan._id,
      flightPlanId: plan.flightPlan?._id || null,
      reason: !plan.flightPlan ? "Flight plan not found" : `Flight plan status is ${plan.flightPlan.status}`,
    }));

  if (invalidPlans.length > 0) {
    const err = makeError("Simulation start blocked because one or more flight plans are not ACTIVE", 400);
    err.details = { invalidPlans };
    throw err;
  }

  const droneIds = [...new Set(missionPlans.map((plan) => plan.flightPlan.drone.toString()))];
  const drones = await Drone.find({ _id: { $in: droneIds } }).select("droneId status");
  const droneMap = new Map(drones.map((drone) => [drone._id.toString(), drone]));

  const unavailableDrones = missionPlans
    .map((plan) => {
      const droneId = plan.flightPlan.drone.toString();
      const drone = droneMap.get(droneId);
      if (!drone) {
        return {
          missionPlanId: plan._id,
          flightPlanId: plan.flightPlan._id,
          droneId,
          reason: "Drone not found",
        };
      }

      if (drone.status !== "IDLE") {
        return {
          missionPlanId: plan._id,
          flightPlanId: plan.flightPlan._id,
          droneId,
          droneCode: drone.droneId,
          status: drone.status,
          reason: `Drone is currently ${drone.status}`,
        };
      }

      return null;
    })
    .filter(Boolean);

  const activeSessions = await FlightSession.find({
    drone: { $in: droneIds },
    status: { $in: ["STARTING", "IN_PROGRESS"] },
  }).select("drone status flightPlan actualStart notes");

  const staleSessions = activeSessions.filter((session) => {
    const drone = droneMap.get(session.drone.toString());
    return drone && drone.status === "IDLE";
  });

  if (staleSessions.length > 0) {
    await Promise.all(
      staleSessions.map((session) =>
        FlightSession.updateOne(
          { _id: session._id },
          {
            status: "ABORTED",
            actualEnd: new Date(),
            notes: [
              session.notes,
              "Auto-aborted by simulation pre-check because drone status is IDLE while session was active.",
            ]
              .filter(Boolean)
              .join("\n"),
          },
        ),
      ),
    );
  }

  const blockingActiveSessions = activeSessions.filter((session) => {
    const drone = droneMap.get(session.drone.toString());
    return !drone || drone.status !== "IDLE";
  });

  if (blockingActiveSessions.length > 0) {
    const sessionByDrone = new Map(
      blockingActiveSessions.map((session) => [session.drone.toString(), session]),
    );

    missionPlans.forEach((plan) => {
      const droneId = plan.flightPlan.drone.toString();
      const session = sessionByDrone.get(droneId);
      if (!session) return;

      const existingIndex = unavailableDrones.findIndex((entry) => entry.droneId === droneId);
      const sessionInfo = {
        missionPlanId: plan._id,
        flightPlanId: plan.flightPlan._id,
        droneId,
        activeSessionId: session._id,
        activeSessionStatus: session.status,
        actualStart: session.actualStart,
        reason: "Drone already has an active flight session",
      };

      if (existingIndex >= 0) {
        unavailableDrones[existingIndex] = {
          ...unavailableDrones[existingIndex],
          ...sessionInfo,
        };
        return;
      }

      unavailableDrones.push(sessionInfo);
    });
  }

  if (unavailableDrones.length > 0) {
    const err = makeError("Simulation start blocked because one or more drones are not available", 409);
    err.details = { unavailableDrones };
    throw err;
  }
}

function normalizeOptions(raw = {}) {
  const continuous = raw.continuous === true || raw.mode === "continuous";
  const mode = ["normal", "deviation", "battery-drop"].includes(raw.mode)
    ? raw.mode
    : "normal";

  const timeScale = Number(raw.timeScale);
  const tickMs = Number(raw.tickMs);
  const deviationDroneIndex =
    raw.deviationDroneIndex === undefined || raw.deviationDroneIndex === null
      ? undefined
      : Number(raw.deviationDroneIndex);

  return {
    mode,
    continuous,
    timeScale: Number.isFinite(timeScale) && timeScale > 0 ? timeScale : 1,
    tickMs: Number.isInteger(tickMs) && tickMs >= 100 ? tickMs : 1000,
    deviationDroneIndex:
      Number.isInteger(deviationDroneIndex) && deviationDroneIndex >= 0
        ? deviationDroneIndex
        : undefined,
    skipSafetyCheck: raw.skipSafetyCheck === true,
    baseUrl: typeof raw.baseUrl === "string" && raw.baseUrl.trim() ? raw.baseUrl.trim() : undefined,
    wsUrl: typeof raw.wsUrl === "string" && raw.wsUrl.trim() ? raw.wsUrl.trim() : undefined,
  };
}

function buildArgs(missionId, token, options) {
  const args = [
    SIM_SCRIPT_PATH,
    `--missionId=${missionId}`,
    `--token=${token}`,
    `--mode=${options.mode}`,
    `--timeScale=${options.timeScale}`,
    `--tickMs=${options.tickMs}`,
  ];

  if (options.mode === "deviation" && options.deviationDroneIndex !== undefined) {
    args.push(`--deviationDroneIndex=${options.deviationDroneIndex}`);
  }
  if (options.skipSafetyCheck) {
    args.push("--skipSafetyCheck=1");
  }
  if (options.continuous) {
    args.push("--continuous=1");
  }

  return args;
}

function redactTokenInCommand(command = "") {
  return String(command).replace(/--token=\S+/g, "--token=[REDACTED]");
}

function sanitizeSensitiveText(text, token) {
  let output = String(text);

  if (token && typeof token === "string" && token.length > 0) {
    output = output.split(token).join("[REDACTED]");
  }

  return output.replace(/(Bearer\s+)[A-Za-z0-9\-_.]+/gi, "$1[REDACTED]");
}

function appendLog(run, stream, chunk) {
  const lines = sanitizeSensitiveText(chunk, run.token)
    .split(/\r?\n/)
    .filter((line) => line.trim().length > 0);

  lines.forEach((line) => {
    run.logs.push({
      ts: new Date().toISOString(),
      stream,
      message: line,
    });
  });

  if (run.logs.length > MAX_LOG_LINES) {
    run.logs.splice(0, run.logs.length - MAX_LOG_LINES);
  }
}

function toPublicRun(run) {
  return {
    runId: run.runId,
    missionId: run.missionId,
    userId: run.userId,
    status: run.status,
    startedAt: run.startedAt,
    endedAt: run.endedAt,
    exitCode: run.exitCode,
    signal: run.signal,
    cleanup: run.cleanup,
    pid: run.pid,
    command: redactTokenInCommand(run.command),
    options: run.options,
    logs: run.logs,
  };
}

function ensureRunExists(runId) {
  const run = runs.get(runId);
  if (!run) throw makeError("Simulation run not found", 404);
  return run;
}

function ensureRunAccess(run, actor) {
  if (actor.role === "UTM_ADMIN") return;
  if (run.userId.toString() !== actor.id.toString()) {
    throw makeError("Forbidden: not your simulation run", 403);
  }
}

async function startMissionSimulation({ missionId, token, actor, options }) {
  if (!missionId) throw makeError("missionId is required", 400);
  if (!token) throw makeError("Bearer token is required", 401);

  const normalizedOptions = normalizeOptions(options);

  for (const run of runs.values()) {
    if (
      run.status === "RUNNING" &&
      run.missionId === missionId &&
      run.userId.toString() === actor.id.toString()
    ) {
      throw makeError("A simulation is already running for this mission", 409);
    }
  }

  await precheckMissionSimulation(missionId);

  const runId = randomUUID();
  const args = buildArgs(missionId, token, normalizedOptions);
  const env = {
    ...process.env,
    ...(normalizedOptions.baseUrl ? { BASE_URL: normalizedOptions.baseUrl } : {}),
    ...(normalizedOptions.wsUrl ? { WS_URL: normalizedOptions.wsUrl } : {}),
  };

  const child = spawn(process.execPath, args, {
    cwd: process.cwd(),
    env,
    stdio: ["ignore", "pipe", "pipe"],
  });

  const run = {
    runId,
    missionId,
    userId: actor.id,
    status: "RUNNING",
    startedAt: new Date().toISOString(),
    endedAt: null,
    exitCode: null,
    signal: null,
    cleanup: null,
    pid: child.pid,
    command: `${process.execPath} ${args.join(" ")}`,
    options: normalizedOptions,
    logs: [],
    token,
    child,
  };

  child.stdout.on("data", (chunk) => appendLog(run, "stdout", chunk));
  child.stderr.on("data", (chunk) => appendLog(run, "stderr", chunk));

  child.on("error", (err) => {
    appendLog(run, "stderr", `Process error: ${err.message}`);
    run.status = "FAILED";
    run.endedAt = new Date().toISOString();
  });

  child.on("exit", (code, signal) => {
    run.exitCode = code;
    run.signal = signal;
    run.endedAt = new Date().toISOString();

    if (run.status === "STOPPING") {
      run.status = "STOPPED";
      forceCleanupRunSessions(run)
        .then(() => {
          run.cleanup = "completed";
        })
        .catch((err) => {
          run.cleanup = "failed";
          appendLog(run, "stderr", `Post-stop session cleanup failed: ${err.message}`);
        });
      return;
    }

    run.status = code === 0 ? "COMPLETED" : "FAILED";
  });

  runs.set(runId, run);
  return toPublicRun(run);
}

function stopSimulation(runId, actor) {
  const run = ensureRunExists(runId);
  ensureRunAccess(run, actor);

  if (run.status !== "RUNNING") {
    return toPublicRun(run);
  }

  run.status = "STOPPING";
  run.cleanup = "scheduled";

  try {
    run.child.kill("SIGTERM");
  } catch (err) {
    appendLog(run, "stderr", `Failed to stop process: ${err.message}`);
    run.status = "FAILED";
    run.cleanup = "failed";
    run.endedAt = new Date().toISOString();
  }

  return toPublicRun(run);
}

function getSimulationStatus(runId, actor) {
  const run = ensureRunExists(runId);
  ensureRunAccess(run, actor);
  return toPublicRun(run);
}

module.exports = {
  startMissionSimulation,
  stopSimulation,
  getSimulationStatus,
};

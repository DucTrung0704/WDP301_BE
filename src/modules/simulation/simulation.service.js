const { spawn } = require("child_process");
const path = require("path");
const { randomUUID } = require("crypto");

const SIM_SCRIPT_PATH = path.join(process.cwd(), "scripts", "simulate-mission.js");
const MAX_LOG_LINES = 300;

const runs = new Map();

function makeError(message, statusCode) {
  const err = new Error(message);
  err.statusCode = statusCode;
  return err;
}

function normalizeOptions(raw = {}) {
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

  return args;
}

function appendLog(run, stream, chunk) {
  const lines = String(chunk)
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
    pid: run.pid,
    command: run.command,
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

function startMissionSimulation({ missionId, token, actor, options }) {
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
    pid: child.pid,
    command: `${process.execPath} ${args.join(" ")}`,
    options: normalizedOptions,
    logs: [],
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

  try {
    run.child.kill("SIGTERM");
  } catch (err) {
    appendLog(run, "stderr", `Failed to stop process: ${err.message}`);
    run.status = "FAILED";
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

const simulationService = require("./simulation.service");

function buildErrorResponse(err) {
  return {
    message: err.message,
    ...(err.details ? { details: err.details } : {}),
  };
}

function setSimulationResponseHeaders(res) {
  res.set({
    "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
    Pragma: "no-cache",
    Expires: "0",
    "Surrogate-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
  });
}

function getBearerToken(req) {
  const authHeader = req.headers.authorization || "";
  if (!authHeader.startsWith("Bearer ")) return null;
  return authHeader.slice(7);
}

function resolveRequestBaseUrl(req) {
  const host = req.get("host");
  if (!host) return null;

  const forwardedProto = req.headers["x-forwarded-proto"];
  const protocol = typeof forwardedProto === "string"
    ? forwardedProto.split(",")[0].trim()
    : (req.protocol || "http");

  return `${protocol}://${host}`;
}

exports.startMissionSimulation = async (req, res) => {
  try {
    setSimulationResponseHeaders(res);
    const token = getBearerToken(req);
    const requestBaseUrl = resolveRequestBaseUrl(req);
    const options = {
      ...(req.body || {}),
      ...(requestBaseUrl && !(req.body || {}).baseUrl
        ? { baseUrl: requestBaseUrl }
        : {}),
      ...(requestBaseUrl && !(req.body || {}).wsUrl
        ? { wsUrl: requestBaseUrl }
        : {}),
    };

    const run = await simulationService.startMissionSimulation({
      missionId: req.params.id,
      token,
      actor: req.user,
      options,
    });

    return res.status(202).json({
      message: "Simulation started",
      run,
    });
  } catch (err) {
    return res.status(err.statusCode || 500).json(buildErrorResponse(err));
  }
};

exports.stopSimulation = async (req, res) => {
  try {
    setSimulationResponseHeaders(res);
    const run = simulationService.stopSimulation(req.params.runId, req.user);
    const cleanup = run.cleanup || (run.status === "STOPPING" ? "scheduled" : null);
    return res.json({
      message: run.status === "STOPPING" ? "Stopping simulation" : "Simulation is not running",
      cleanup,
      run,
    });
  } catch (err) {
    return res.status(err.statusCode || 500).json(buildErrorResponse(err));
  }
};

exports.getSimulationStatus = async (req, res) => {
  try {
    setSimulationResponseHeaders(res);
    const run = simulationService.getSimulationStatus(req.params.runId, req.user);
    return res.json({ run });
  } catch (err) {
    return res.status(err.statusCode || 500).json(buildErrorResponse(err));
  }
};

exports.getMissionSimulationStatus = async (req, res) => {
  try {
    setSimulationResponseHeaders(res);
    const result = simulationService.getMissionSimulationStatus(req.params.id, req.user);
    return res.json(result);
  } catch (err) {
    return res.status(err.statusCode || 500).json(buildErrorResponse(err));
  }
};

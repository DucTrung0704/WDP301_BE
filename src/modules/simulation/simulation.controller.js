const simulationService = require("./simulation.service");

function getBearerToken(req) {
  const authHeader = req.headers.authorization || "";
  if (!authHeader.startsWith("Bearer ")) return null;
  return authHeader.slice(7);
}

exports.startMissionSimulation = async (req, res) => {
  try {
    const token = getBearerToken(req);
    const run = simulationService.startMissionSimulation({
      missionId: req.params.id,
      token,
      actor: req.user,
      options: req.body || {},
    });

    return res.status(202).json({
      message: "Simulation started",
      run,
    });
  } catch (err) {
    return res.status(err.statusCode || 500).json({ message: err.message });
  }
};

exports.stopSimulation = async (req, res) => {
  try {
    const run = simulationService.stopSimulation(req.params.runId, req.user);
    return res.json({
      message: run.status === "STOPPING" ? "Stopping simulation" : "Simulation is not running",
      run,
    });
  } catch (err) {
    return res.status(err.statusCode || 500).json({ message: err.message });
  }
};

exports.getSimulationStatus = async (req, res) => {
  try {
    const run = simulationService.getSimulationStatus(req.params.runId, req.user);
    return res.json({ run });
  } catch (err) {
    return res.status(err.statusCode || 500).json({ message: err.message });
  }
};

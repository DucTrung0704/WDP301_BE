const FlightSession = require("./flightSession.model");
const flightSessionService = require("./flightSession.service");
const { getSessionTelemetry } = require("../telemetry/telemetry.service");
const { getSessionAlerts } = require("../alert/alert.service");
const mongoose = require("mongoose");

/**
 * POST /api/flight-sessions/start
 * Start planned session (requires flightPlanId)
 */
exports.startPlanned = async (req, res) => {
  try {
    const { flightPlanId } = req.body;
    if (!flightPlanId) {
      return res.status(400).json({ message: "flightPlanId is required" });
    }

    const session = await flightSessionService.startPlannedSession(
      flightPlanId,
      req.user.id,
    );

    const populated = await session.populate([
      { path: "drone", select: "droneId serialNumber model" },
      { path: "flightPlan", select: "status plannedStart plannedEnd" },
    ]);

    return res.status(201).json(populated);
  } catch (err) {
    if (err.message.includes("not found")) {
      return res.status(404).json({ message: err.message });
    }
    if (
      err.message.includes("Unauthorized") ||
      err.message.includes("Cannot") ||
      err.message.includes("Only") ||
      err.message.includes("already")
    ) {
      return res.status(400).json({ message: err.message });
    }
    return res.status(500).json({ message: err.message });
  }
};

/**
 * POST /api/flight-sessions/free-flight
 * Start free flight (INDIVIDUAL_OPERATOR only)
 */
exports.startFreeFlight = async (req, res) => {
  try {
    const { droneId } = req.body;
    if (!droneId) {
      return res.status(400).json({ message: "droneId is required" });
    }

    const session = await flightSessionService.startFreeFlightSession(
      droneId,
      req.user.id,
      req.user.role,
    );

    const populated = await session.populate({
      path: "drone",
      select: "droneId serialNumber model",
    });

    return res.status(201).json(populated);
  } catch (err) {
    if (err.message.includes("not found")) {
      return res.status(404).json({ message: err.message });
    }
    if (
      err.message.includes("Unauthorized") ||
      err.message.includes("Only") ||
      err.message.includes("already")
    ) {
      return res.status(403).json({ message: err.message });
    }
    if (err.message.includes("Cannot")) {
      return res.status(400).json({ message: err.message });
    }
    return res.status(500).json({ message: err.message });
  }
};

/**
 * GET /api/flight-sessions
 * List sessions
 */
exports.list = async (req, res) => {
  try {
    const { status, sessionType, page = 1, limit = 10 } = req.query;
    const filter = {};

    // Admin can see all, operators see only their own
    if (req.user.role !== "UTM_ADMIN") {
      filter.pilot = req.user.id;
    }

    if (status) filter.status = status;
    if (sessionType) filter.sessionType = sessionType;

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [sessions, totalCount] = await Promise.all([
      FlightSession.find(filter)
        .populate("drone", "droneId serialNumber model")
        .populate("flightPlan", "status plannedStart plannedEnd")
        .populate("pilot", "fullName email")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit)),
      FlightSession.countDocuments(filter),
    ]);

    const totalPages = Math.ceil(totalCount / parseInt(limit));
    return res.json({
      data: sessions,
      pagination: {
        currentPage: parseInt(page),
        totalPages,
        totalCount,
        limit: parseInt(limit),
        hasNextPage: parseInt(page) < totalPages,
        hasPrevPage: parseInt(page) > 1,
      },
    });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

/**
 * GET /api/flight-sessions/:id
 * Session detail
 */
exports.getById = async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ message: "Invalid session ID" });
    }

    const session = await FlightSession.findById(req.params.id)
      .populate("drone", "droneId serialNumber model status")
      .populate("flightPlan")
      .populate("pilot", "fullName email role");

    if (!session) {
      return res.status(404).json({ message: "Flight session not found" });
    }

    // Ownership check
    if (
      req.user.role !== "UTM_ADMIN" &&
      session.pilot._id.toString() !== req.user.id.toString()
    ) {
      return res.status(403).json({ message: "Forbidden" });
    }

    return res.json(session);
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

/**
 * POST /api/flight-sessions/:id/end
 */
exports.endSession = async (req, res) => {
  try {
    const session = await flightSessionService.endSession(
      req.params.id,
      req.user.id,
    );
    return res.json({
      message: "Flight session completed",
      flightSession: session,
    });
  } catch (err) {
    if (err.message.includes("not found")) {
      return res.status(404).json({ message: err.message });
    }
    if (err.message.includes("Unauthorized")) {
      return res.status(403).json({ message: err.message });
    }
    return res.status(400).json({ message: err.message });
  }
};

/**
 * POST /api/flight-sessions/:id/abort
 */
exports.abortSession = async (req, res) => {
  try {
    const session = await flightSessionService.abortSession(
      req.params.id,
      req.user.id,
    );
    return res.json({
      message: "Flight session aborted",
      flightSession: session,
    });
  } catch (err) {
    if (err.message.includes("not found")) {
      return res.status(404).json({ message: err.message });
    }
    if (err.message.includes("Unauthorized")) {
      return res.status(403).json({ message: err.message });
    }
    return res.status(400).json({ message: err.message });
  }
};

/**
 * POST /api/flight-sessions/:id/emergency
 */
exports.emergencyLand = async (req, res) => {
  try {
    const session = await flightSessionService.emergencyLand(
      req.params.id,
      req.user.id,
    );
    return res.json({
      message: "Emergency landing recorded",
      flightSession: session,
    });
  } catch (err) {
    if (err.message.includes("not found")) {
      return res.status(404).json({ message: err.message });
    }
    if (err.message.includes("Unauthorized")) {
      return res.status(403).json({ message: err.message });
    }
    return res.status(400).json({ message: err.message });
  }
};

/**
 * GET /api/flight-sessions/:id/telemetry
 */
exports.getSessionTelemetry = async (req, res) => {
  try {
    // Ownership check
    const session = await FlightSession.findById(req.params.id);
    if (!session) {
      return res.status(404).json({ message: "Flight session not found" });
    }
    if (
      req.user.role !== "UTM_ADMIN" &&
      session.pilot.toString() !== req.user.id.toString()
    ) {
      return res.status(403).json({ message: "Forbidden" });
    }

    const { page, limit } = req.query;
    const result = await getSessionTelemetry(req.params.id, {
      page: parseInt(page) || 1,
      limit: parseInt(limit) || 100,
    });

    return res.json(result);
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

/**
 * GET /api/flight-sessions/:id/alerts
 */
exports.getSessionAlerts = async (req, res) => {
  try {
    const session = await FlightSession.findById(req.params.id);
    if (!session) {
      return res.status(404).json({ message: "Flight session not found" });
    }
    if (
      req.user.role !== "UTM_ADMIN" &&
      session.pilot.toString() !== req.user.id.toString()
    ) {
      return res.status(403).json({ message: "Forbidden" });
    }

    const { type, status, page, limit } = req.query;
    const result = await getSessionAlerts(req.params.id, {
      type,
      status,
      page: parseInt(page) || 1,
      limit: parseInt(limit) || 50,
    });

    return res.json(result);
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

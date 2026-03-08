const Alert = require("./alert.model");
const FlightSession = require("../flightSession/flightSession.model");
const alertService = require("./alert.service");
const mongoose = require("mongoose");

/**
 * GET /api/alerts
 * List alerts with filters
 */
exports.list = async (req, res) => {
  try {
    const { flightSession, type, status, page = 1, limit = 20 } = req.query;
    const filter = {};

    // Non-admin: only own sessions
    if (req.user.role !== "UTM_ADMIN") {
      const ownSessions = await FlightSession.find({
        pilot: req.user.id,
      }).select("_id");
      filter.flightSession = { $in: ownSessions.map((s) => s._id) };
    }

    if (flightSession) filter.flightSession = flightSession;
    if (type) filter.type = type;
    if (status) filter.status = status;

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [alerts, totalCount] = await Promise.all([
      Alert.find(filter)
        .populate("flightSession", "sessionType status actualStart")
        .populate("drone", "droneId serialNumber model")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit)),
      Alert.countDocuments(filter),
    ]);

    const totalPages = Math.ceil(totalCount / parseInt(limit));
    return res.json({
      data: alerts,
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
 * GET /api/alerts/:id
 */
exports.getById = async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ message: "Invalid alert ID" });
    }

    const alert = await Alert.findById(req.params.id)
      .populate("flightSession")
      .populate("drone", "droneId serialNumber model");

    if (!alert) {
      return res.status(404).json({ message: "Alert not found" });
    }

    // Ownership check
    if (req.user.role !== "UTM_ADMIN") {
      const session = await FlightSession.findById(alert.flightSession);
      if (session && session.pilot.toString() !== req.user.id.toString()) {
        return res.status(403).json({ message: "Forbidden" });
      }
    }

    return res.json(alert);
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

/**
 * PUT /api/alerts/:id/acknowledge
 */
exports.acknowledge = async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ message: "Invalid alert ID" });
    }

    const alert = await alertService.acknowledgeAlert(req.params.id);
    return res.json({ message: "Alert acknowledged", alert });
  } catch (err) {
    if (err.message.includes("not found")) {
      return res.status(404).json({ message: err.message });
    }
    return res.status(400).json({ message: err.message });
  }
};

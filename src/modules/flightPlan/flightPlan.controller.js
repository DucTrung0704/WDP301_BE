const FlightPlan = require("./flightPlan.model");
const ConflictEvent = require("../conflict/conflictEvent.model");
const flightPlanService = require("./flightPlan.service");

/**
 * POST /api/flight-plans — Tạo flight plan mới (DRAFT)
 */
exports.createFlightPlan = async (req, res) => {
  try {
    const flightPlan = await flightPlanService.createFlightPlan(
      req.body,
      req.user.id,
    );

    await flightPlan.populate("drone", "droneId serialNumber model");
    await flightPlan.populate("pilot", "email profile.fullName");

    res.status(201).json(flightPlan);
  } catch (err) {
    console.error("Create flight plan error:", err);
    if (
      err.message.includes("Unauthorized") ||
      err.message.includes("don't own")
    ) {
      return res.status(403).json({ message: err.message });
    }
    if (err.message.includes("not found")) {
      return res.status(404).json({ message: err.message });
    }
    if (err.name === "ValidationError") {
      return res.status(400).json({ message: err.message });
    }
    res
      .status(500)
      .json({ message: "Create flight plan failed", error: err.message });
  }
};

/**
 * GET /api/flight-plans — Danh sách flight plans
 */
exports.getFlightPlans = async (req, res) => {
  try {
    const { status, page = 1, limit = 10 } = req.query;
    const filter = { pilot: req.user.id };

    if (status) filter.status = status;

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 10));
    const skip = (pageNum - 1) * limitNum;

    const [flightPlans, totalCount] = await Promise.all([
      FlightPlan.find(filter)
        .populate("drone", "droneId serialNumber model")
        .populate("pilot", "email profile.fullName")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum),
      FlightPlan.countDocuments(filter),
    ]);

    const totalPages = Math.ceil(totalCount / limitNum);

    res.json({
      data: flightPlans,
      pagination: {
        currentPage: pageNum,
        totalPages,
        totalCount,
        limit: limitNum,
        hasNextPage: pageNum < totalPages,
        hasPrevPage: pageNum > 1,
      },
    });
  } catch (err) {
    console.error("Get flight plans error:", err);
    res.status(500).json({ message: "Get flight plans failed" });
  }
};

/**
 * GET /api/flight-plans/:id — Chi tiết flight plan
 */
exports.getFlightPlanById = async (req, res) => {
  try {
    const flightPlan = await FlightPlan.findById(req.params.id)
      .populate("drone", "droneId serialNumber model")
      .populate("pilot", "email profile.fullName");

    if (!flightPlan) {
      return res.status(404).json({ message: "Flight plan not found" });
    }

    // Chỉ owner hoặc admin mới xem được
    if (
      flightPlan.pilot._id.toString() !== req.user.id.toString() &&
      req.user.role !== "UTM_ADMIN"
    ) {
      return res.status(403).json({ message: "Unauthorized" });
    }

    res.json(flightPlan);
  } catch (err) {
    console.error("Get flight plan error:", err);
    if (err.name === "CastError") {
      return res.status(400).json({ message: "Invalid flight plan ID" });
    }
    res.status(500).json({ message: "Get flight plan failed" });
  }
};

/**
 * PUT /api/flight-plans/:id — Cập nhật (DRAFT/REJECTED → reset DRAFT)
 */
exports.updateFlightPlan = async (req, res) => {
  try {
    const flightPlan = await flightPlanService.updateFlightPlan(
      req.params.id,
      req.body,
      req.user.id,
    );

    await flightPlan.populate("drone", "droneId serialNumber model");
    await flightPlan.populate("pilot", "email profile.fullName");

    res.json(flightPlan);
  } catch (err) {
    console.error("Update flight plan error:", err);
    if (
      err.message.includes("Unauthorized") ||
      err.message.includes("don't own")
    ) {
      return res.status(403).json({ message: err.message });
    }
    if (err.message.includes("not found")) {
      return res.status(404).json({ message: err.message });
    }
    if (
      err.message.includes("Cannot update") ||
      err.name === "ValidationError"
    ) {
      return res.status(400).json({ message: err.message });
    }
    res
      .status(500)
      .json({ message: "Update flight plan failed", error: err.message });
  }
};

/**
 * POST /api/flight-plans/:id/submit — Submit → detect → APPROVED/REJECTED
 */
exports.submitFlightPlan = async (req, res) => {
  try {
    const result = await flightPlanService.submitFlightPlan(
      req.params.id,
      req.user.id,
    );

    res.json({
      message:
        result.approved ?
          "Flight plan approved — no conflicts detected"
          : "Flight plan rejected — conflicts detected",
      ...result,
    });
  } catch (err) {
    console.error("Submit flight plan error:", err);
    if (
      err.message.includes("Unauthorized") ||
      err.message.includes("don't own")
    ) {
      return res.status(403).json({ message: err.message });
    }
    if (err.message.includes("not found")) {
      return res.status(404).json({ message: err.message });
    }
    if (
      err.message.includes("Cannot submit") ||
      err.message.includes("must have") ||
      err.name === "ValidationError"
    ) {
      return res.status(400).json({ message: err.message });
    }
    res
      .status(500)
      .json({ message: "Submit flight plan failed", error: err.message });
  }
};

/**
 * POST /api/flight-plans/:id/cancel — Cancel (DRAFT/REJECTED → CANCELLED)
 */
exports.cancelFlightPlan = async (req, res) => {
  try {
    const flightPlan = await flightPlanService.cancelFlightPlan(
      req.params.id,
      req.user.id,
    );

    res.json({ message: "Flight plan cancelled", flightPlan });
  } catch (err) {
    console.error("Cancel flight plan error:", err);
    if (
      err.message.includes("Unauthorized") ||
      err.message.includes("don't own")
    ) {
      return res.status(403).json({ message: err.message });
    }
    if (err.message.includes("not found")) {
      return res.status(404).json({ message: err.message });
    }
    if (err.message.includes("Cannot cancel")) {
      return res.status(400).json({ message: err.message });
    }
    res
      .status(500)
      .json({ message: "Cancel flight plan failed", error: err.message });
  }
};

/**
 * GET /api/flight-plans/:id/conflicts — Xem xung đột của flight plan
 */
exports.getFlightPlanConflicts = async (req, res) => {
  try {
    const flightPlan = await FlightPlan.findById(req.params.id);
    if (!flightPlan) {
      return res.status(404).json({ message: "Flight plan not found" });
    }

    // Chỉ owner hoặc admin
    if (
      flightPlan.pilot.toString() !== req.user.id.toString() &&
      req.user.role !== "UTM_ADMIN"
    ) {
      return res.status(403).json({ message: "Unauthorized" });
    }

    const conflicts = await ConflictEvent.find({
      flightPlans: req.params.id,
    })
      .populate("flightPlans", "status plannedStart plannedEnd")
      .populate("violatedZone", "name type")
      .sort({ detectedAt: -1 });

    res.json(conflicts);
  } catch (err) {
    console.error("Get flight plan conflicts error:", err);
    res.status(500).json({ message: "Get conflicts failed" });
  }
};

/**
 * DELETE /api/flight-plans/:id — Xóa flight plan (chỉ DRAFT)
 */
exports.deleteFlightPlan = async (req, res) => {
  try {
    const flightPlan = await FlightPlan.findById(req.params.id);
    if (!flightPlan) {
      return res.status(404).json({ message: "Flight plan not found" });
    }

    if (flightPlan.pilot.toString() !== req.user.id.toString()) {
      return res.status(403).json({ message: "Unauthorized" });
    }

    if (flightPlan.status !== "DRAFT") {
      return res.status(400).json({
        message: `Cannot delete flight plan with status "${flightPlan.status}". Only DRAFT plans can be deleted.`,
      });
    }

    await FlightPlan.findByIdAndDelete(req.params.id);
    res.json({ message: "Flight plan deleted successfully" });
  } catch (err) {
    console.error("Delete flight plan error:", err);
    res.status(500).json({ message: "Delete flight plan failed" });
  }
};

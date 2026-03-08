const ConflictEvent = require("./conflictEvent.model");

/**
 * GET /api/conflicts — Admin: xem tất cả conflicts
 */
exports.getConflicts = async (req, res) => {
  try {
    const { status, method, page = 1, limit = 10 } = req.query;
    const filter = {};

    if (status) filter.status = status;
    if (method) filter.detectionMethod = method;

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 10));
    const skip = (pageNum - 1) * limitNum;

    const [conflicts, totalCount] = await Promise.all([
      ConflictEvent.find(filter)
        .populate({
          path: "flightPlans",
          select: "status plannedStart plannedEnd drone pilot",
          populate: [
            { path: "drone", select: "droneId serialNumber model" },
            { path: "pilot", select: "email profile.fullName" },
          ],
        })
        .populate("violatedZone", "name type")
        .sort({ detectedAt: -1 })
        .skip(skip)
        .limit(limitNum),
      ConflictEvent.countDocuments(filter),
    ]);

    const totalPages = Math.ceil(totalCount / limitNum);

    res.json({
      data: conflicts,
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
    console.error("Get conflicts error:", err);
    res.status(500).json({ message: "Get conflicts failed" });
  }
};

/**
 * GET /api/conflicts/:id — Chi tiết conflict
 */
exports.getConflictById = async (req, res) => {
  try {
    const conflict = await ConflictEvent.findById(req.params.id)
      .populate({
        path: "flightPlans",
        select: "status plannedStart plannedEnd waypoints drone pilot",
        populate: [
          { path: "drone", select: "droneId serialNumber model" },
          { path: "pilot", select: "email profile.fullName" },
        ],
      })
      .populate("violatedZone", "name type description geometry");

    if (!conflict) {
      return res.status(404).json({ message: "Conflict event not found" });
    }

    res.json(conflict);
  } catch (err) {
    console.error("Get conflict error:", err);
    if (err.name === "CastError") {
      return res.status(400).json({ message: "Invalid conflict ID" });
    }
    res.status(500).json({ message: "Get conflict failed" });
  }
};

/**
 * PUT /api/conflicts/:id/resolve — Resolve conflict + ghi resolution note
 */
exports.resolveConflict = async (req, res) => {
  try {
    const { resolution } = req.body;

    if (!resolution || !resolution.trim()) {
      return res
        .status(400)
        .json({ message: "Resolution description is required" });
    }

    const conflict = await ConflictEvent.findById(req.params.id);
    if (!conflict) {
      return res.status(404).json({ message: "Conflict event not found" });
    }

    if (conflict.status !== "ACTIVE") {
      return res.status(400).json({
        message: `Conflict is already "${conflict.status}". Only ACTIVE conflicts can be resolved.`,
      });
    }

    conflict.status = "RESOLVED";
    conflict.resolution = resolution.trim();
    await conflict.save();

    res.json({ message: "Conflict resolved", conflict });
  } catch (err) {
    console.error("Resolve conflict error:", err);
    res.status(500).json({ message: "Resolve conflict failed" });
  }
};

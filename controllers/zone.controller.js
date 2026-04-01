const Zone = require("../models/zone.model");
// Helper to check temporal validity
const isEffective = (zone) => {
  const now = new Date();
  if (zone.effectiveFrom && now < zone.effectiveFrom) return false;
  if (zone.effectiveTo && now > zone.effectiveTo) return false;
  return true;
};

// Refresh active/inactive statuses from effective time window.
// Archived zones are excluded to preserve soft-delete behavior.
const refreshZoneStatuses = async () => {
  const now = new Date();

  // Zones outside their effective window become inactive.
  await Zone.updateMany(
    {
      status: { $ne: "archived" },
      $or: [{ effectiveFrom: { $gt: now } }, { effectiveTo: { $lt: now } }],
    },
    { $set: { status: "inactive" } },
  );

  // Zones inside their effective window become active.
  await Zone.updateMany(
    {
      status: { $ne: "archived" },
      effectiveFrom: { $lte: now },
      $or: [{ effectiveTo: { $exists: false } }, { effectiveTo: null }, { effectiveTo: { $gte: now } }],
    },
    { $set: { status: "active" } },
  );
};

// CREATE Zone
exports.createZone = async (req, res) => {
  try {
    const {
      name,
      description,
      type,
      geometry,
      minAltitude,
      maxAltitude,
      effectiveFrom,
      effectiveTo,
    } = req.body;

    // Basic validation happens in Model (including maxAlt >= minAlt)
    // GeoJSON geometry validation happens in Model Pre-save hook (Turf.js)

    const zone = await Zone.create({
      name,
      description,
      type,
      geometry,
      minAltitude,
      maxAltitude,
      effectiveFrom,
      effectiveTo,
      createdBy: req.user ? req.user.id : null,
    });

    res.status(201).json(zone);
  } catch (err) {
    console.error("Create Zone Error:", err);
    // Handle Mongoose Validation Errors
    if (err.name === "ValidationError") {
      return res.status(400).json({ message: err.message });
    }
    // Handle GeoJSON Validation Errors from Pre-save
    if (
      err.message.startsWith("Invalid Polygon") ||
      err.message.startsWith("GeoJSON")
    ) {
      return res.status(400).json({ message: err.message });
    }
    res
      .status(500)
      .json({ message: "Failed to create zone", error: err.message });
  }
};

// GET Zones with pagination, search, and sorting
exports.getZones = async (req, res) => {
  try {
    await refreshZoneStatuses();

    const {
      status,
      type,
      search,
      page = 1,
      limit = 10,
      sortBy = "createdAt",
      sortOrder = "desc",
    } = req.query;

    const filter = {};

    // Default to showing only active/inactive, hide archived unless specifically asked
    if (status) {
      filter.status = status;
    } else {
      filter.status = { $ne: "archived" };
    }

    if (type) {
      filter.type = type;
    }

    // Search by name (case-insensitive)
    if (search) {
      filter.name = { $regex: search, $options: "i" };
    }

    // Parse pagination parameters
    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 10));
    const skip = (pageNum - 1) * limitNum;

    // Build sort object
    const allowedSortFields = [
      "createdAt",
      "updatedAt",
      "name",
      "type",
      "minAltitude",
      "maxAltitude",
    ];
    const sortField = allowedSortFields.includes(sortBy) ? sortBy : "createdAt";
    const sortDirection = sortOrder === "asc" ? 1 : -1;
    const sort = { [sortField]: sortDirection };

    // Execute query with pagination
    const [zones, totalCount] = await Promise.all([
      Zone.find(filter).sort(sort).skip(skip).limit(limitNum),
      Zone.countDocuments(filter),
    ]);

    // Calculate pagination metadata
    const totalPages = Math.ceil(totalCount / limitNum);
    const hasNextPage = pageNum < totalPages;
    const hasPrevPage = pageNum > 1;

    res.json({
      data: zones,
      pagination: {
        currentPage: pageNum,
        totalPages,
        totalCount,
        limit: limitNum,
        hasNextPage,
        hasPrevPage,
      },
    });
  } catch (err) {
    console.error("Get Zones Error:", err);
    res.status(500).json({ message: "Failed to retrieve zones" });
  }
};

// GET Zone by ID
exports.getZoneById = async (req, res) => {
  try {
    await refreshZoneStatuses();

    const { id } = req.params;

    const zone = await Zone.findById(id);

    if (!zone) {
      return res.status(404).json({ message: "Zone not found" });
    }

    res.json(zone);
  } catch (err) {
    console.error("Get Zone By ID Error:", err);
    if (err.name === "CastError") {
      return res.status(400).json({ message: "Invalid zone ID format" });
    }
    res.status(500).json({ message: "Failed to retrieve zone" });
  }
};

// UPDATE Zone
exports.updateZone = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      name,
      description,
      type,
      geometry,
      minAltitude,
      maxAltitude,
      effectiveFrom,
      effectiveTo,
    } = req.body;

    // Find the zone first
    const zone = await Zone.findById(id);

    if (!zone) {
      return res.status(404).json({ message: "Zone not found" });
    }

    // Check if zone is archived - prevent editing archived zones
    if (zone.status === "archived") {
      return res.status(400).json({ message: "Cannot edit an archived zone" });
    }

    // Update fields if provided
    if (name !== undefined) zone.name = name;
    if (description !== undefined) zone.description = description;
    if (type !== undefined) zone.type = type;
    if (geometry !== undefined) zone.geometry = geometry;
    if (minAltitude !== undefined) zone.minAltitude = minAltitude;
    if (maxAltitude !== undefined) zone.maxAltitude = maxAltitude;
    if (effectiveFrom !== undefined) zone.effectiveFrom = effectiveFrom;
    if (effectiveTo !== undefined) zone.effectiveTo = effectiveTo;

    // Save will trigger pre-save validation (polygon closure, self-intersection)
    const updatedZone = await zone.save();

    res.json(updatedZone);
  } catch (err) {
    console.error("Update Zone Error:", err);
    // Handle Mongoose Validation Errors
    if (err.name === "ValidationError") {
      return res.status(400).json({ message: err.message });
    }
    // Handle CastError (invalid ObjectId)
    if (err.name === "CastError") {
      return res.status(400).json({ message: "Invalid zone ID format" });
    }
    // Handle GeoJSON Validation Errors from Pre-save
    if (
      err.message.startsWith("Invalid Polygon") ||
      err.message.startsWith("GeoJSON")
    ) {
      return res.status(400).json({ message: err.message });
    }
    res
      .status(500)
      .json({ message: "Failed to update zone", error: err.message });
  }
};

// CHECK Spatial Status
exports.checkPoint = async (req, res) => {
  try {
    await refreshZoneStatuses();

    const { lat, lng, altitude } = req.body;

    if (lat === undefined || lng === undefined || altitude === undefined) {
      return res
        .status(400)
        .json({ message: "lat, lng, and altitude are required" });
    }

    const point = {
      type: "Point",
      coordinates: [parseFloat(lng), parseFloat(lat)], // GeoJSON is [lng, lat]
    };

    // 1. Find all zones that geometrically containing this point
    // Using $geoIntersects
    const potentialZones = await Zone.find({
      status: "active",
      geometry: {
        $geoIntersects: {
          $geometry: point,
        },
      },
    });

    // 2. Filter in memory by Altitude and Time
    const matchingZones = potentialZones.filter((zone) => {
      // Check Altitude
      // If zone has minAlt/maxAlt, we must be within range to be 'inside' the zone volume.
      // Requirement: "max_altitude >= min_altitude"
      // If altitude is within [min, max], effective.
      if (altitude < zone.minAltitude || altitude > zone.maxAltitude) {
        return false;
      }

      // Check Time
      if (!isEffective(zone)) {
        return false;
      }

      return true;
    });

    if (matchingZones.length === 0) {
      return res.json({ status: "allowed", message: "Use caution", zones: [] });
    }

    // 3. Determine Priority (no_fly > restricted)
    const hasNoFly = matchingZones.some((z) => z.type === "no_fly");
    const status = hasNoFly ? "no_fly" : "restricted";

    res.json({
      status: status,
      message: hasNoFly ? "No Fly Zone Detected" : "Restricted Zone Detected",
      zones: matchingZones.map((z) => ({
        id: z._id,
        name: z.name,
        type: z.type,
        minAltitude: z.minAltitude,
        maxAltitude: z.maxAltitude,
      })),
    });
  } catch (err) {
    console.error("Check Point Error:", err);
    res.status(500).json({ message: "Spatial check failed" });
  }
};

// DELETE Zone (Soft Delete)
exports.deleteZone = async (req, res) => {
  try {
    const { id } = req.params;

    const zone = await Zone.findByIdAndUpdate(
      id,
      { status: "archived" },
      { new: true },
    );

    if (!zone) {
      return res.status(404).json({ message: "Zone not found" });
    }

    res.json({ message: "Zone archived successfully", zone });
  } catch (err) {
    res.status(500).json({ message: "Failed to archive zone" });
  }
};

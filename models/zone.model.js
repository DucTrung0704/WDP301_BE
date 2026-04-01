const mongoose = require("mongoose");
const turf = require("@turf/turf");

const ZoneSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      trim: true,
    },
    type: {
      type: String,
      enum: ["no_fly", "restricted"],
      required: true,
    },
    status: {
      type: String,
      enum: ["active", "inactive", "archived"],
      default: "active",
      index: true,
    },
    geometry: {
      type: {
        type: String,
        enum: ["Polygon"],
        required: true,
      },
      coordinates: {
        type: [[[Number]]], // Array of arrays of arrays of numbers
        required: true,
      },
    },
    minAltitude: {
      type: Number,
      default: 0,
      min: 0,
    },
    maxAltitude: {
      type: Number,
      required: true,
      min: 0,
    },
    effectiveFrom: {
      type: Date,
      default: Date.now,
    },
    effectiveTo: {
      type: Date,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
  },
  { timestamps: true },
);

// Indexes
ZoneSchema.index({ geometry: "2dsphere" });
ZoneSchema.index({ status: 1, effectiveFrom: 1, effectiveTo: 1 });

// Validation: maxAltitude >= minAltitude
ZoneSchema.path("maxAltitude").validate(function (value) {
  return value >= this.minAltitude;
}, "maxAltitude must be greater than or equal to minAltitude.");

// Validation: effectiveTo must be after or equal effectiveFrom when provided
ZoneSchema.path("effectiveTo").validate(function (value) {
  if (!value) return true;
  if (!this.effectiveFrom) return true;
  return value >= this.effectiveFrom;
}, "effectiveTo must be greater than or equal to effectiveFrom.");

// Pre-save hook for GeoJSON validation
ZoneSchema.pre("save", async function () {
  // Auto-calculate status from effective time window.
  // Keep archived status untouched for soft-deleted zones.
  if (this.status !== "archived") {
    const now = new Date();
    const from = this.effectiveFrom;
    const to = this.effectiveTo;
    const isActive = (!from || now >= from) && (!to || now <= to);
    this.status = isActive ? "active" : "inactive";
  }

  // 1. Validate Polygon Closure
  if (
    !this.geometry ||
    !this.geometry.coordinates ||
    !this.geometry.coordinates[0]
  ) {
    return; // Let mongoose required validators handle it
  }

  const coordinates = this.geometry.coordinates[0];
  if (
    coordinates.length < 4 ||
    coordinates[0][0] !== coordinates[coordinates.length - 1][0] ||
    coordinates[0][1] !== coordinates[coordinates.length - 1][1]
  ) {
    throw new Error(
      "Invalid Polygon: First and last points must be identical.",
    );
  }

  // 2. Validate Self-Intersection using Turf.js
  try {
    const polygon = turf.polygon(this.geometry.coordinates);
    const kinks = turf.kinks(polygon);
    if (kinks.features.length > 0) {
      throw new Error("Invalid Polygon: Self-intersection detected.");
    }
  } catch (err) {
    // If turf fails (e.g. bad coords), rethrow as validation error
    // But distinguish schema errors from turf errors
    if (err.message.startsWith("Invalid Polygon")) throw err;
    throw new Error("GeoJSON validation failed: " + err.message);
  }
});

module.exports = mongoose.model("Zone", ZoneSchema);

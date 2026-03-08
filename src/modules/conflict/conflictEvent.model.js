const mongoose = require("mongoose");

const ConflictEventSchema = new mongoose.Schema(
  {
    flightPlans: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "FlightPlan",
        required: true,
      },
    ],
    detectedAt: {
      type: Date,
      default: Date.now,
    },
    predictedCollisionTime: {
      type: Date,
    },
    severity: {
      type: String,
      enum: ["LOW", "MEDIUM", "HIGH", "CRITICAL"],
      default: "MEDIUM",
    },
    location: {
      type: {
        type: String,
        enum: ["Point"],
        default: "Point",
      },
      coordinates: {
        type: [Number], // [lng, lat]
      },
    },
    altitude: {
      type: Number,
    },
    detectionMethod: {
      type: String,
      enum: ["PAIRWISE", "SEGMENTATION", "ZONE_VIOLATION"],
      required: true,
    },
    horizontalDistance: {
      type: Number, // meters
    },
    verticalDistance: {
      type: Number, // meters
    },
    status: {
      type: String,
      enum: ["ACTIVE", "RESOLVED", "DISMISSED"],
      default: "ACTIVE",
    },
    resolution: {
      type: String,
      trim: true,
    },
    // For ZONE_VIOLATION: reference to the violated zone
    violatedZone: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Zone",
    },
  },
  { timestamps: true },
);

// Indexes
ConflictEventSchema.index({ status: 1, detectedAt: -1 });
ConflictEventSchema.index({ flightPlans: 1 });
ConflictEventSchema.index({ location: "2dsphere" });

module.exports = mongoose.model("ConflictEvent", ConflictEventSchema);

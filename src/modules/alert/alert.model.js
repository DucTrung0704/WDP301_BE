const mongoose = require("mongoose");

const AlertSchema = new mongoose.Schema(
  {
    flightSession: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "FlightSession",
      required: true,
    },
    drone: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Drone",
      required: true,
    },
    type: {
      type: String,
      enum: [
        "CONFLICT",
        "ZONE_VIOLATION",
        "DEVIATION",
        "BATTERY_LOW",
        "CONNECTION_LOST",
      ],
      required: true,
    },
    severity: {
      type: String,
      enum: ["LOW", "MEDIUM", "HIGH", "CRITICAL"],
      default: "MEDIUM",
    },
    message: {
      type: String,
      required: true,
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
    // Chi tiết bổ sung tùy loại alert
    data: {
      type: mongoose.Schema.Types.Mixed,
      // Ví dụ:
      // CONFLICT: { conflictEventId, otherDroneId, distance }
      // ZONE_VIOLATION: { zoneId, zoneName, zoneType }
      // DEVIATION: { expectedLat, expectedLng, actualLat, actualLng, deviationDistance }
      // BATTERY_LOW: { batteryLevel, threshold }
    },
    status: {
      type: String,
      enum: ["ACTIVE", "ACKNOWLEDGED", "RESOLVED"],
      default: "ACTIVE",
    },
  },
  { timestamps: true },
);

// Indexes
AlertSchema.index({ flightSession: 1, createdAt: -1 });
AlertSchema.index({ type: 1, status: 1 });
AlertSchema.index({ drone: 1, createdAt: -1 });
AlertSchema.index({ location: "2dsphere" });

module.exports = mongoose.model("Alert", AlertSchema);

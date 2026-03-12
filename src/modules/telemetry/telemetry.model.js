const mongoose = require("mongoose");

const TelemetrySchema = new mongoose.Schema(
  {
    drone: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Drone",
      required: true,
    },
    flightSession: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "FlightSession",
      required: true,
    },
    timestamp: {
      type: Date,
      required: true,
      default: Date.now,
    },
    location: {
      type: {
        type: String,
        enum: ["Point"],
        default: "Point",
      },
      coordinates: {
        type: [Number], // [lng, lat]
        required: true,
      },
    },
    altitude: {
      type: Number,
      required: true,
      min: 0,
    },
    speed: {
      type: Number,
      min: 0,
    },
    heading: {
      type: Number, // degrees 0-360
      min: 0,
      max: 360,
    },
    batteryLevel: {
      type: Number, // percentage 0-100
      min: 0,
      max: 100,
    },
    // Optional: For sampling/aggregation tracking
    isSampled: {
      type: Boolean,
      default: false,
      index: true,
    },
  },
  {
    timestamps: true,
    // Auto-delete records after 7 days
    expireAfterSeconds: 604800 // 7 days in seconds
  },
);

// Indexes for query optimization
TelemetrySchema.index({ location: "2dsphere" });
TelemetrySchema.index({ drone: 1, timestamp: -1 }); // Querying by drone + time
TelemetrySchema.index({ flightSession: 1, timestamp: -1 }); // Session-based queries
TelemetrySchema.index({ drone: 1, isSampled: 1, timestamp: -1 }); // For sampling queries
TelemetrySchema.index({ timestamp: 1 }, { expireAfterSeconds: 604800 }); // TTL index

module.exports = mongoose.model("Telemetry", TelemetrySchema);

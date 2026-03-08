const mongoose = require("mongoose");

const TelemetrySchema = new mongoose.Schema(
  {
    drone: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Drone",
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
  },
  { timestamps: true },
);

// Indexes for real-time spatial queries (future use)
TelemetrySchema.index({ location: "2dsphere" });
TelemetrySchema.index({ drone: 1, timestamp: -1 });

module.exports = mongoose.model("Telemetry", TelemetrySchema);

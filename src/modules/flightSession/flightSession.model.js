const mongoose = require("mongoose");

const FlightSessionSchema = new mongoose.Schema(
  {
    flightPlan: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "FlightPlan",
      // Optional — null cho FREE_FLIGHT
    },
    drone: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Drone",
      required: true,
    },
    pilot: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    sessionType: {
      type: String,
      enum: ["PLANNED", "FREE_FLIGHT"],
      required: true,
    },
    status: {
      type: String,
      enum: [
        "STARTING",
        "IN_PROGRESS",
        "COMPLETED",
        "ABORTED",
        "EMERGENCY_LANDED",
      ],
      default: "STARTING",
    },
    actualStart: {
      type: Date,
      default: Date.now,
    },
    actualEnd: {
      type: Date,
    },
    actualRoute: {
      type: {
        type: String,
        enum: ["LineString"],
      },
      coordinates: {
        type: [[Number]], // [[lng, lat], ...]
      },
    },
    notes: {
      type: String,
      trim: true,
    },
  },
  { timestamps: true },
);

// Indexes
FlightSessionSchema.index({ flightPlan: 1 });
FlightSessionSchema.index({ drone: 1, status: 1 });
FlightSessionSchema.index({ pilot: 1, status: 1 });
FlightSessionSchema.index({ status: 1 });
FlightSessionSchema.index({ sessionType: 1 });

module.exports = mongoose.model("FlightSession", FlightSessionSchema);

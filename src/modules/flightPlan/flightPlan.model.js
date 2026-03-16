const mongoose = require("mongoose");

const WaypointSchema = new mongoose.Schema(
  {
    sequenceNumber: {
      type: Number,
      required: true,
    },
    latitude: {
      type: Number,
      required: true,
      min: -90,
      max: 90,
    },
    longitude: {
      type: Number,
      required: true,
      min: -180,
      max: 180,
    },
    altitude: {
      type: Number,
      required: true,
      min: 0,
    },
    speed: {
      type: Number,
      min: 0,
      default: 10, // m/s
    },
    estimatedTime: {
      type: Date,
    },
    action: {
      type: String,
      enum: ["TAKEOFF", "WAYPOINT", "HOVER", "LAND"],
      default: "WAYPOINT",
    },
  },
  { _id: false },
);

const FlightPlanSchema = new mongoose.Schema(
  {
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
    status: {
      type: String,
      enum: ["DRAFT", "PENDING", "APPROVED", "REJECTED", "CANCELLED"],
      default: "DRAFT",
    },
    priority: {
      type: Number,
      default: 1,
      min: 1,
      max: 10,
    },
    waypoints: {
      type: [WaypointSchema],
      validate: {
        validator: function (v) {
          return v && v.length >= 2;
        },
        message:
          "Flight plan must have at least 2 waypoints (takeoff and land).",
      },
    },
    routeGeometry: {
      type: {
        type: String,
        enum: ["LineString"],
      },
      coordinates: {
        type: [[Number]], // [[lng, lat], [lng, lat], ...]
      },
    },
    conflictStatus: {
      type: String,
      enum: ["CLEAR", "CONFLICT_DETECTED", "RESOLVED"],
      default: "CLEAR",
    },
    notes: {
      type: String,
      trim: true,
    },
  },
  { timestamps: true },
);

// Indexes
FlightPlanSchema.index({ routeGeometry: "2dsphere" });
FlightPlanSchema.index({ status: 1, createdAt: -1 });
FlightPlanSchema.index({ pilot: 1, status: 1 });
FlightPlanSchema.index({ drone: 1, status: 1 });

// Pre-save: auto-generate routeGeometry from waypoints
FlightPlanSchema.pre("save", function () {
  if (this.waypoints && this.waypoints.length >= 2) {
    // Sort waypoints by sequenceNumber
    const sorted = [...this.waypoints].sort(
      (a, b) => a.sequenceNumber - b.sequenceNumber,
    );

    this.routeGeometry = {
      type: "LineString",
      coordinates: sorted.map((wp) => [wp.longitude, wp.latitude]),
    };
  }
});

module.exports = mongoose.model("FlightPlan", FlightPlanSchema);

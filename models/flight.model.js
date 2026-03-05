const mongoose = require("mongoose");

const FlightSchema = new mongoose.Schema(
    {
        drone: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Drone",
            required: true,
        },
        operator: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
        },
        startTime: {
            type: Date,
            required: true,
        },
        endTime: {
            type: Date,
        },
        origin: {
            type: String,
        },
        destination: {
            type: String,
        },
        status: {
            type: String,
            enum: ["SCHEDULED", "IN_PROGRESS", "COMPLETED", "CANCELLED"],
            default: "SCHEDULED",
        },
        notes: {
            type: String,
        },
    },
    { timestamps: true }
);

module.exports = mongoose.model("Flight", FlightSchema);


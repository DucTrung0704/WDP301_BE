const mongoose = require("mongoose");

const DroneSchema = new mongoose.Schema(
    {
        droneId: {
            type: String,
            unique: true,
            required: true,
        },

        serialNumber: {
            type: String,
            required: true,
        },

        model: String,

        owner: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
        },

        ownerType: {
            type: String,
            enum: ["INDIVIDUAL", "FLEET"],
            default: "INDIVIDUAL",
        },

        maxAltitude: Number,

        status: {
            type: String,
            enum: ["IDLE", "FLYING", "MAINTENANCE", "DISABLED"],
            default: "IDLE",
        },
    },
    { timestamps: true }
);

module.exports = mongoose.model("Drone", DroneSchema);

const mongoose = require("mongoose");

const MissionPlanSchema = new mongoose.Schema(
    {
        mission: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Mission",
            required: true,
            index: true,
        },
        flightPlan: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "FlightPlan",
            required: true,
            index: true,
        },
        plannedStart: {
            type: Date,
            required: true,
            index: true,
        },
        plannedEnd: {
            type: Date,
            required: true,
            index: true,
        },
        order: {
            type: Number,
            default: 1,
            min: 1,
        },
        status: {
            type: String,
            enum: ["SCHEDULED", "CANCELLED"],
            default: "SCHEDULED",
            index: true,
        },
        notes: {
            type: String,
            trim: true,
            maxlength: 2000,
        },
    },
    { timestamps: true },
);

MissionPlanSchema.index({ mission: 1, flightPlan: 1 }, { unique: true });

MissionPlanSchema.path("plannedEnd").validate(function (value) {
    return value > this.plannedStart;
}, "plannedEnd must be after plannedStart.");

module.exports = mongoose.model("MissionPlan", MissionPlanSchema);

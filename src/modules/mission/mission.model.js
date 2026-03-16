const mongoose = require("mongoose");

const MissionSchema = new mongoose.Schema(
    {
        name: {
            type: String,
            required: true,
            trim: true,
            maxlength: 200,
        },
        description: {
            type: String,
            trim: true,
            maxlength: 2000,
        },
        createdBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
            index: true,
        },
        status: {
            type: String,
            enum: ["DRAFT", "ACTIVE", "ARCHIVED"],
            default: "DRAFT",
            index: true,
        },
    },
    { timestamps: true },
);

MissionSchema.index({ createdBy: 1, createdAt: -1 });

module.exports = mongoose.model("Mission", MissionSchema);

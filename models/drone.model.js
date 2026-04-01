const mongoose = require("mongoose");

const RouteSchema = new mongoose.Schema(
    {
        type: {
            type: String,
            enum: ["LineString"],
            required: true,
        },
        coordinates: {
            type: [[Number]], // [[lng, lat], [lng, lat], ...]
            required: true,
            validate: {
                validator: function (coordinates) {
                    if (!Array.isArray(coordinates)) return false;
                    if (coordinates.length < 2) return false;

                    return coordinates.every((point) => {
                        if (!Array.isArray(point) || point.length !== 2) {
                            return false;
                        }

                        const [lng, lat] = point;
                        const isLngValid = Number.isFinite(lng) && lng >= -180 && lng <= 180;
                        const isLatValid = Number.isFinite(lat) && lat >= -90 && lat <= 90;

                        return isLngValid && isLatValid;
                    });
                },
                message:
                    "route.coordinates must contain at least 2 points and each point must be [lng, lat] with valid ranges.",
            },
        },
    },
    { _id: false }
);

const DroneSchema = new mongoose.Schema(
    {
        droneId: {
            type: String,
            unique: true,
            default: () => `DRONE-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
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

        route: {
            type: RouteSchema,
            default: undefined,
        },
    },
    { timestamps: true }
);

DroneSchema.index({ route: "2dsphere" });

module.exports = mongoose.model("Drone", DroneSchema);

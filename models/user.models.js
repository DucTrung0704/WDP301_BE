const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
    {
        //Identity
        email: {
            type: String,
            required: true,
            lowercase: true,
            trim: true,
            unique: true,
            index: true,
        },

        password: {
            type: String,
            select: false,
        },

        //Providers
        providers: {
            local: {
                type: Boolean,
                default: false,
            },
            google: {
                id: String,
                email: String,
            },
        },

        //Profile
        profile: {
            fullName: String,
            avatar: String,
            phone: String,
        },

        //Authorization
        role: {
            type: String,
            enum: [
                "UTM_ADMIN",
                "INDIVIDUAL_OPERATOR",
                "FLEET_OPERATOR",
            ],
            default: "INDIVIDUAL_OPERATOR",
        },

        //Account status
        status: {
            type: String,
            enum: ["active", "inactive", "banned"],
            default: "active",
        },

        //Token management
        refreshTokens: [
            {
                type: String,
            },
        ],

        //Audit
        lastLoginAt: Date,
    },
    {
        timestamps: true,
    }
);

module.exports = mongoose.model("User", userSchema);

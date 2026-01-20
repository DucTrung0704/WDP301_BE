// controllers/auth.controller.js
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const User = require("../models/user.models");
const { OAuth2Client } = require("google-auth-library");

const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

/**
 * GOOGLE LOGIN / REGISTER (Web + Mobile)
 * Frontend gửi: { idToken }
 */
exports.googleLogin = async (req, res) => {
    try {
        const { idToken } = req.body;

        if (!idToken) {
            return res.status(400).json({ message: "Missing Google token" });
        }

        // Verify token with Google
        const ticket = await googleClient.verifyIdToken({
            idToken,
            audience: process.env.GOOGLE_CLIENT_ID,
        });

        const payload = ticket.getPayload();

        const {
            sub: googleId,
            email,
            name,
            picture,
            email_verified,
        } = payload;

        if (!email_verified) {
            return res.status(401).json({ message: "Email not verified by Google" });
        }

        // Check user exists
        let user = await User.findOne({ email });

        if (!user) {
            // 👉 REGISTER new user by Google (default role: Individual Operator)
            user = await User.create({
                email,
                providers: {
                    google: true,
                },
                googleId,
                profile: {
                    fullName: name,
                    avatar: picture,
                },
                role: "INDIVIDUAL_OPERATOR",
                status: "active",
            });
        } else {
            // Nếu user tồn tại nhưng chưa link Google
            if (!user.providers.google) {
                user.providers.google = true;
                user.googleId = googleId;
                user.profile.avatar = user.profile.avatar || picture;
                await user.save();
            }
        }

        // Normalize legacy role to new enum
        const allowedRoles = [
            "UTM_ADMIN",
            "INDIVIDUAL_OPERATOR",
            "FLEET_OPERATOR",
        ];
        if (!allowedRoles.includes(user.role)) {
            user.role = "INDIVIDUAL_OPERATOR";
        }

        if (user.status !== "active") {
            return res.status(403).json({ message: "Account disabled" });
        }

        // Update last login
        user.lastLoginAt = new Date();
        await user.save();

        // Generate JWT
        const token = jwt.sign(
            { userId: user._id, role: user.role },
            process.env.JWT_SECRET,
            { expiresIn: "7d" }
        );

        res.json({
            data: {
                user,
                token,
            }
        });
    } catch (err) {
        console.error("Google login error:", err);
        res.status(500).json({ message: "Google login failed" });
    }
};

/**
 * REGISTER
 */
exports.register = async (req, res) => {
    try {
        const { email, password, fullName, role } = req.body;

        if (!email || !password) {
            return res.status(400).json({ message: "Missing fields" });
        }

        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return res.status(409).json({ message: "Email already exists" });
        }

        // Validate role (if provided) - chỉ cho phép 2 role ngoài UTM_ADMIN
        const allowedRoles = ["INDIVIDUAL_OPERATOR", "FLEET_OPERATOR"];

        let userRole = "INDIVIDUAL_OPERATOR";
        if (role) {
            if (!allowedRoles.includes(role)) {
                return res.status(400).json({
                    message:
                        "Invalid role. Allowed: INDIVIDUAL_OPERATOR, FLEET_OPERATOR",
                });
            }
            userRole = role;
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        const profileData = fullName ? { fullName } : {};

        const user = await User.create({
            email,
            password: hashedPassword,
            providers: { local: true },
            profile: profileData,
            role: userRole,
        });

        const token = jwt.sign(
            { userId: user._id, role: user.role },
            process.env.JWT_SECRET,
            { expiresIn: "7d" }
        );

        res.status(201).json({
            data: {
                user,
                token,
            }
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Register failed" });
    }
};

/**
 * LOGIN
 */
exports.login = async (req, res) => {
    try {
        const { email, password } = req.body;

        const user = await User.findOne({ email }).select("+password");

        if (!user || !user.providers.local) {
            return res.status(401).json({ message: "Invalid credentials" });
        }

        // Normalize legacy role to new enum
        const allowedRoles = [
            "UTM_ADMIN",
            "INDIVIDUAL_OPERATOR",
            "FLEET_OPERATOR",
        ];
        if (!allowedRoles.includes(user.role)) {
            user.role = "INDIVIDUAL_OPERATOR";
        }

        if (user.status !== "active") {
            return res.status(403).json({ message: "Account disabled" });
        }

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(401).json({ message: "Invalid credentials" });
        }

        user.lastLoginAt = new Date();
        await user.save();

        const token = jwt.sign(
            { userId: user._id, role: user.role },
            process.env.JWT_SECRET,
            { expiresIn: "7d" }
        );

        res.json({
            data: {
                user,
                token,
            }
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Login failed" });
    }
};

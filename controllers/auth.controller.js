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

        // Generate JWT access token
        const token = jwt.sign(
            { userId: user._id, role: user.role },
            process.env.JWT_SECRET,
            { expiresIn: "7d" }
        );

        // Generate refresh token
        const refreshToken = jwt.sign(
            { userId: user._id },
            process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET,
            { expiresIn: "30d" }
        );

        // Store refresh token in database
        user.refreshTokens.push(refreshToken);
        await user.save();

        res.json({
            token,
            refreshToken,
            user,
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
        const allowedRoles = ["INDIVIDUAL_OPERATOR", "FLEET_OPERATOR", "UTM_ADMIN"];

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

        // Generate JWT access token
        const token = jwt.sign(
            { userId: user._id, role: user.role },
            process.env.JWT_SECRET,
            { expiresIn: "7d" }
        );

        // Generate refresh token
        const refreshToken = jwt.sign(
            { userId: user._id },
            process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET,
            { expiresIn: "30d" }
        );

        // Store refresh token in database
        user.refreshTokens.push(refreshToken);
        await user.save();

        res.status(201).json({
            token,
            refreshToken,
            user,
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

        // Generate refresh token
        const refreshToken = jwt.sign(
            { userId: user._id },
            process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET,
            { expiresIn: "30d" }
        );

        // Store refresh token in database
        user.refreshTokens.push(refreshToken);
        await user.save();

        res.json({
            token,
            refreshToken,
            user,
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Login failed" });
    }
};

/**
 * REFRESH TOKEN
 * Frontend gửi: { refreshToken }
 * Trả về: new access token + user data
 */
exports.refreshToken = async (req, res) => {
    try {
        const { refreshToken } = req.body;

        if (!refreshToken) {
            return res.status(400).json({ message: "Missing refresh token" });
        }

        // Verify refresh token
        let decoded;
        try {
            decoded = jwt.verify(
                refreshToken,
                process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET
            );
        } catch (err) {
            return res.status(401).json({ message: "Invalid refresh token" });
        }

        // Find user and check if refresh token exists
        const user = await User.findById(decoded.userId);

        if (!user || !user.refreshTokens.includes(refreshToken)) {
            return res.status(401).json({ message: "Refresh token not found or expired" });
        }

        if (user.status !== "active") {
            return res.status(403).json({ message: "Account disabled" });
        }

        // Generate new access token
        const newAccessToken = jwt.sign(
            { userId: user._id, role: user.role },
            process.env.JWT_SECRET,
            { expiresIn: "7d" }
        );

        res.json({
            token: newAccessToken,
            refreshToken,
            user: {
                _id: user._id,
                email: user.email,
                profile: user.profile,
                role: user.role,
            },
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Token refresh failed" });
    }
};

/**
 * LOGOUT
 * Xóa refresh token khỏi database
 * Frontend gửi: { refreshToken } hoặc Authorization header
 */
exports.logout = async (req, res) => {
    try {
        const userId = req.user.id;
        const { refreshToken } = req.body;

        if (refreshToken) {
            // Xóa refresh token cụ thể
            await User.findByIdAndUpdate(
                userId,
                { $pull: { refreshTokens: refreshToken } },
                { new: true }
            );
        } else {
            // Xóa tất cả refresh tokens (logout all devices)
            await User.findByIdAndUpdate(
                userId,
                { refreshTokens: [] },
                { new: true }
            );
        }

        return res.status(200).json({ message: "Logged out successfully" });
    } catch (err) {
        console.error(err);
        return res.status(500).json({ message: "Logout failed" });
    }
};

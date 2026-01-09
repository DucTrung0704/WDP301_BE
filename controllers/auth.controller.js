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

        // ✅ Verify token with Google
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

        // ✅ Check user exists
        let user = await User.findOne({ email });

        if (!user) {
            // 👉 REGISTER new user by Google
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
                status: "active",
            });
        } else {
            // 👉 Nếu user tồn tại nhưng chưa link Google
            if (!user.providers.google) {
                user.providers.google = true;
                user.googleId = googleId;
                user.profile.avatar = user.profile.avatar || picture;
                await user.save();
            }
        }

        if (user.status !== "active") {
            return res.status(403).json({ message: "Account disabled" });
        }

        // ✅ Update last login
        user.lastLoginAt = new Date();
        await user.save();

        // ✅ Generate JWT
        const token = jwt.sign(
            { userId: user._id, role: user.role },
            process.env.JWT_SECRET,
            { expiresIn: "7d" }
        );

        res.json({
            token,
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
        const { email, password, fullName } = req.body;

        if (!email || !password) {
            return res.status(400).json({ message: "Missing fields" });
        }

        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return res.status(409).json({ message: "Email already exists" });
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        const user = await User.create({
            email,
            password: hashedPassword,
            providers: { local: true },
            profile: { fullName },
        });

        const token = jwt.sign(
            { userId: user._id, role: user.role },
            process.env.JWT_SECRET,
            { expiresIn: "7d" }
        );

        res.status(201).json({
            token,
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
            token,
            user,
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Login failed" });
    }
};

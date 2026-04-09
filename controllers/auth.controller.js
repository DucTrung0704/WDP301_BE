// controllers/auth.controller.js
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const User = require("../models/user.models");
const { OAuth2Client } = require("google-auth-library");
const {
    sendGoogleVerificationCodeEmail,
    sendRegisterVerificationCodeEmail,
    sendPasswordResetCodeEmail,
} = require("../services/email.service");

const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);
const GOOGLE_VERIFY_CODE_TTL_MS = 10 * 60 * 1000;
const GOOGLE_VERIFY_RESEND_COOLDOWN_MS = 60 * 1000;
const GMAIL_REGISTER_VERIFY_CODE_TTL_MS = 10 * 60 * 1000;
const GMAIL_REGISTER_RESEND_COOLDOWN_MS = 60 * 1000;
const PASSWORD_RESET_CODE_TTL_MS = 10 * 60 * 1000;
const PASSWORD_RESET_RESEND_COOLDOWN_MS = 60 * 1000;

function generateVerificationCode() {
    return Math.floor(100000 + Math.random() * 900000).toString();
}

function issueAuthTokens(user) {
    const token = jwt.sign(
        { userId: user._id, role: user.role },
        process.env.JWT_SECRET,
        { expiresIn: "7d" }
    );

    const refreshToken = jwt.sign(
        { userId: user._id },
        process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET,
        { expiresIn: "30d" }
    );

    user.refreshTokens.push(refreshToken);
    return { token, refreshToken };
}

function isStrongPassword(password) {
    return typeof password === "string" && password.length >= 8;
}

function isGmailAddress(email) {
    return typeof email === "string" && email.toLowerCase().trim().endsWith("@gmail.com");
}

/**
 * GMAIL REGISTER (LOCAL ACCOUNT + EMAIL OTP VERIFICATION)
 * Frontend gửi: { email, password, fullName, role }
 */
exports.registerWithGmailVerification = async (req, res) => {
    try {
        const email = (req.body.email || "").toLowerCase().trim();
        const { password, fullName, role } = req.body;

        if (!email || !password) {
            return res.status(400).json({ message: "email and password are required" });
        }

        if (!isGmailAddress(email)) {
            return res.status(400).json({ message: "Only Gmail addresses are allowed for this method" });
        }

        if (!isStrongPassword(password)) {
            return res.status(400).json({ message: "password must be at least 8 characters" });
        }

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

        const code = generateVerificationCode();
        const now = Date.now();
        const hashedPassword = await bcrypt.hash(password, 10);

        const existingUser = await User.findOne({ email }).select("+emailVerification.code +emailVerification.codeExpiresAt");
        if (existingUser) {
            if (existingUser.providers?.local) {
                return res.status(409).json({
                    message: "Email already exists",
                    isLocalLoginEnabled: true,
                });
            }

            existingUser.password = hashedPassword;
            existingUser.providers = existingUser.providers || {};
            existingUser.providers.local = true;
            existingUser.profile = existingUser.profile || {};
            if (!existingUser.profile.fullName && fullName) {
                existingUser.profile.fullName = fullName;
            }

            const isAlreadyVerified = existingUser.emailVerification?.isVerified !== false;
            if (isAlreadyVerified) {
                existingUser.status = "active";
                await existingUser.save();
                return res.status(200).json({
                    message: "Local login has been enabled for this Gmail account",
                    email,
                    linkedWithGoogle: !!existingUser.providers?.google?.id,
                    requiresEmailVerification: false,
                });
            }

            existingUser.status = "inactive";
            existingUser.emailVerification = {
                ...(existingUser.emailVerification || {}),
                isVerified: false,
                code,
                codeExpiresAt: new Date(now + GMAIL_REGISTER_VERIFY_CODE_TTL_MS),
                lastSentAt: new Date(now),
            };

            const sent = await sendRegisterVerificationCodeEmail({
                to: existingUser.email,
                fullName: existingUser.profile?.fullName,
                code,
            });

            if (!sent) {
                return res.status(500).json({ message: "Failed to send verification code" });
            }

            await existingUser.save();

            return res.status(202).json({
                message: "Verification code sent to your email",
                email,
                linkedWithGoogle: !!existingUser.providers?.google?.id,
                requiresEmailVerification: true,
                expiresInSeconds: Math.floor(GMAIL_REGISTER_VERIFY_CODE_TTL_MS / 1000),
            });
        }

        const user = await User.create({
            email,
            password: hashedPassword,
            providers: { local: true },
            profile: fullName ? { fullName } : {},
            role: userRole,
            status: "inactive",
            emailVerification: {
                isVerified: false,
                code,
                codeExpiresAt: new Date(now + GMAIL_REGISTER_VERIFY_CODE_TTL_MS),
                lastSentAt: new Date(now),
            },
        });

        const sent = await sendRegisterVerificationCodeEmail({
            to: user.email,
            fullName: user.profile?.fullName,
            code,
        });

        if (!sent) {
            await User.findByIdAndDelete(user._id);
            return res.status(500).json({ message: "Failed to send verification code" });
        }

        return res.status(202).json({
            message: "Verification code sent to your email",
            email,
            requiresEmailVerification: true,
            expiresInSeconds: Math.floor(GMAIL_REGISTER_VERIFY_CODE_TTL_MS / 1000),
        });
    } catch (err) {
        console.error("Gmail register error:", err);
        return res.status(500).json({ message: "Gmail register failed" });
    }
};

/**
 * GMAIL REGISTER EMAIL VERIFICATION
 * Frontend gửi: { email, code }
 */
exports.verifyGmailRegisterEmail = async (req, res) => {
    try {
        const email = (req.body.email || "").toLowerCase().trim();
        const code = String(req.body.code || "").trim();

        if (!email || !code) {
            return res.status(400).json({ message: "email and code are required" });
        }

        const user = await User.findOne({ email }).select("+emailVerification.code +emailVerification.codeExpiresAt");
        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }

        if (!user.providers?.local || !isGmailAddress(user.email)) {
            return res.status(400).json({ message: "This account is not registered with Gmail method" });
        }

        const verification = user.emailVerification || {};
        if (verification.isVerified) {
            return res.status(200).json({ message: "Email already verified" });
        }

        if (!verification.code || verification.code !== code) {
            return res.status(400).json({ message: "Invalid verification code" });
        }

        if (!verification.codeExpiresAt || new Date(verification.codeExpiresAt).getTime() < Date.now()) {
            return res.status(400).json({ message: "Verification code expired" });
        }

        user.emailVerification = {
            ...(user.emailVerification || {}),
            isVerified: true,
            code: undefined,
            codeExpiresAt: undefined,
            lastSentAt: undefined,
        };
        user.status = "active";
        user.lastLoginAt = new Date();

        const { token, refreshToken } = issueAuthTokens(user);
        await user.save();

        return res.status(200).json({ token, refreshToken, user });
    } catch (err) {
        console.error("Verify Gmail register email error:", err);
        return res.status(500).json({ message: "Gmail email verification failed" });
    }
};

/**
 * RESEND GMAIL REGISTER VERIFICATION CODE
 * Frontend gửi: { email }
 */
exports.resendGmailRegisterCode = async (req, res) => {
    try {
        const email = (req.body.email || "").toLowerCase().trim();
        if (!email) {
            return res.status(400).json({ message: "email is required" });
        }

        const user = await User.findOne({ email }).select("+emailVerification.code +emailVerification.codeExpiresAt");
        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }

        if (!user.providers?.local || !isGmailAddress(user.email)) {
            return res.status(400).json({ message: "This account is not registered with Gmail method" });
        }

        if (user.emailVerification?.isVerified) {
            return res.status(200).json({ message: "Email already verified" });
        }

        const lastSentAt = user.emailVerification?.lastSentAt
            ? new Date(user.emailVerification.lastSentAt).getTime()
            : 0;
        const now = Date.now();
        const cooldownRemainingMs = GMAIL_REGISTER_RESEND_COOLDOWN_MS - (now - lastSentAt);

        if (cooldownRemainingMs > 0) {
            return res.status(429).json({
                message: "Please wait before requesting a new verification code",
                retryAfterSeconds: Math.ceil(cooldownRemainingMs / 1000),
            });
        }

        const code = generateVerificationCode();
        user.emailVerification = {
            ...(user.emailVerification || {}),
            isVerified: false,
            code,
            codeExpiresAt: new Date(now + GMAIL_REGISTER_VERIFY_CODE_TTL_MS),
            lastSentAt: new Date(now),
        };

        const sent = await sendRegisterVerificationCodeEmail({
            to: user.email,
            fullName: user.profile?.fullName,
            code,
        });

        if (!sent) {
            return res.status(500).json({ message: "Failed to send verification code" });
        }

        await user.save();

        return res.status(200).json({
            message: "Verification code resent",
            email: user.email,
            expiresInSeconds: Math.floor(GMAIL_REGISTER_VERIFY_CODE_TTL_MS / 1000),
        });
    } catch (err) {
        console.error("Resend Gmail register verification code error:", err);
        return res.status(500).json({ message: "Resend verification code failed" });
    }
};

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

        const { sub: googleId, email, name, picture, email_verified } = payload;

        if (!email_verified) {
            return res.status(401).json({ message: "Email not verified by Google" });
        }

        // Check user exists
        let user = await User.findOne({ email }).select("+emailVerification.code +emailVerification.codeExpiresAt");

        if (!user) {
            user = await User.create({
                email,
                providers: {
                    google: {
                        id: googleId,
                        email,
                    },
                },
                profile: {
                    fullName: name,
                    avatar: picture,
                },
                role: "INDIVIDUAL_OPERATOR",
                status: "active",
                emailVerification: {
                    isVerified: false,
                },
            });
            user = await User.findById(user._id).select("+emailVerification.code +emailVerification.codeExpiresAt");
        } else {
            if (!user.providers) user.providers = {};
            if (!user.providers.google || !user.providers.google.id) {
                user.providers.google = { id: googleId, email };
            }

            user.profile = user.profile || {};
            user.profile.avatar = user.profile.avatar || picture;
            user.profile.fullName = user.profile.fullName || name;
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

        const isEmailVerified = user.emailVerification?.isVerified !== false;
        if (!isEmailVerified) {
            const code = generateVerificationCode();

            user.emailVerification = {
                ...(user.emailVerification || {}),
                isVerified: false,
                code,
                codeExpiresAt: new Date(Date.now() + GOOGLE_VERIFY_CODE_TTL_MS),
                lastSentAt: new Date(),
            };

            const sent = await sendGoogleVerificationCodeEmail({
                to: user.email,
                fullName: user.profile?.fullName,
                code,
            });

            if (!sent) {
                return res.status(500).json({ message: "Failed to send verification code" });
            }

            await user.save();

            return res.status(202).json({
                message: "Verification code sent to your email",
                email: user.email,
                requiresEmailVerification: true,
            });
        }

        user.lastLoginAt = new Date();
        const { token, refreshToken } = issueAuthTokens(user);
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
 * GOOGLE EMAIL VERIFICATION
 * Frontend gửi: { email, code }
 */
exports.verifyGoogleEmail = async (req, res) => {
    try {
        const email = (req.body.email || "").toLowerCase().trim();
        const code = String(req.body.code || "").trim();

        if (!email || !code) {
            return res.status(400).json({ message: "email and code are required" });
        }

        const user = await User.findOne({ email }).select("+emailVerification.code +emailVerification.codeExpiresAt");
        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }

        if (!user.providers?.google?.id) {
            return res.status(400).json({ message: "This account is not registered with Google" });
        }

        const verification = user.emailVerification || {};
        if (verification.isVerified) {
            return res.status(200).json({ message: "Email already verified" });
        }

        if (!verification.code || verification.code !== code) {
            return res.status(400).json({ message: "Invalid verification code" });
        }

        if (!verification.codeExpiresAt || new Date(verification.codeExpiresAt).getTime() < Date.now()) {
            return res.status(400).json({ message: "Verification code expired" });
        }

        user.emailVerification = {
            ...(user.emailVerification || {}),
            isVerified: true,
            code: undefined,
            codeExpiresAt: undefined,
        };

        user.lastLoginAt = new Date();
        const { token, refreshToken } = issueAuthTokens(user);
        await user.save();

        return res.json({ token, refreshToken, user });
    } catch (err) {
        console.error("Google verify email error:", err);
        return res.status(500).json({ message: "Google email verification failed" });
    }
};

/**
 * RESEND GOOGLE EMAIL VERIFICATION CODE
 * Frontend gửi: { email }
 */
exports.resendGoogleVerificationCode = async (req, res) => {
    try {
        const email = (req.body.email || "").toLowerCase().trim();
        if (!email) {
            return res.status(400).json({ message: "email is required" });
        }

        const user = await User.findOne({ email }).select("+emailVerification.code +emailVerification.codeExpiresAt");
        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }

        if (!user.providers?.google?.id) {
            return res.status(400).json({ message: "This account is not registered with Google" });
        }

        if (user.emailVerification?.isVerified) {
            return res.status(200).json({ message: "Email already verified" });
        }

        const lastSentAt = user.emailVerification?.lastSentAt
            ? new Date(user.emailVerification.lastSentAt).getTime()
            : 0;
        const now = Date.now();
        const cooldownRemainingMs = GOOGLE_VERIFY_RESEND_COOLDOWN_MS - (now - lastSentAt);

        if (cooldownRemainingMs > 0) {
            return res.status(429).json({
                message: "Please wait before requesting a new verification code",
                retryAfterSeconds: Math.ceil(cooldownRemainingMs / 1000),
            });
        }

        const code = generateVerificationCode();
        user.emailVerification = {
            ...(user.emailVerification || {}),
            isVerified: false,
            code,
            codeExpiresAt: new Date(now + GOOGLE_VERIFY_CODE_TTL_MS),
            lastSentAt: new Date(now),
        };

        const sent = await sendGoogleVerificationCodeEmail({
            to: user.email,
            fullName: user.profile?.fullName,
            code,
        });

        if (!sent) {
            return res.status(500).json({ message: "Failed to send verification code" });
        }

        await user.save();

        return res.status(200).json({
            message: "Verification code resent",
            email: user.email,
            expiresInSeconds: Math.floor(GOOGLE_VERIFY_CODE_TTL_MS / 1000),
        });
    } catch (err) {
        console.error("Resend Google verification code error:", err);
        return res.status(500).json({ message: "Resend verification code failed" });
    }
};

/**
 * GMAIL FORGOT PASSWORD - REQUEST CODE
 * Frontend gửi: { email }
 */
exports.requestGmailPasswordResetCode = async (req, res) => {
    try {
        const email = (req.body.email || "").toLowerCase().trim();
        if (!email) {
            return res.status(400).json({ message: "email is required" });
        }

        if (!isGmailAddress(email)) {
            return res.status(400).json({ message: "Only Gmail addresses are allowed for this method" });
        }

        const user = await User.findOne({ email }).select("+passwordReset.code +passwordReset.codeExpiresAt");
        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }

        if (!user.providers?.local) {
            return res.status(400).json({ message: "This account is not registered with Gmail method" });
        }

        const lastSentAt = user.passwordReset?.lastSentAt
            ? new Date(user.passwordReset.lastSentAt).getTime()
            : 0;
        const now = Date.now();
        const cooldownRemainingMs = PASSWORD_RESET_RESEND_COOLDOWN_MS - (now - lastSentAt);

        if (cooldownRemainingMs > 0) {
            return res.status(429).json({
                message: "Please wait before requesting another reset code",
                retryAfterSeconds: Math.ceil(cooldownRemainingMs / 1000),
            });
        }

        const code = generateVerificationCode();
        user.passwordReset = {
            ...(user.passwordReset || {}),
            code,
            codeExpiresAt: new Date(now + PASSWORD_RESET_CODE_TTL_MS),
            lastSentAt: new Date(now),
        };

        const sent = await sendPasswordResetCodeEmail({
            to: user.email,
            fullName: user.profile?.fullName,
            code,
        });

        if (!sent) {
            return res.status(500).json({ message: "Failed to send reset code" });
        }

        await user.save();

        return res.status(200).json({
            message: "Reset code sent to your email",
            email: user.email,
            expiresInSeconds: Math.floor(PASSWORD_RESET_CODE_TTL_MS / 1000),
        });
    } catch (err) {
        console.error("Request Gmail password reset code error:", err);
        return res.status(500).json({ message: "Request reset code failed" });
    }
};

/**
 * GMAIL FORGOT PASSWORD - RESEND CODE
 * Frontend gửi: { email }
 */
exports.resendGmailPasswordResetCode = async (req, res) => {
    return exports.requestGmailPasswordResetCode(req, res);
};

/**
 * GMAIL FORGOT PASSWORD - RESET PASSWORD
 * Frontend gửi: { email, code, newPassword }
 */
exports.resetGmailPasswordWithCode = async (req, res) => {
    try {
        const email = (req.body.email || "").toLowerCase().trim();
        const code = String(req.body.code || "").trim();
        const { newPassword } = req.body;

        if (!email || !code || !newPassword) {
            return res.status(400).json({ message: "email, code and newPassword are required" });
        }

        if (!isGmailAddress(email)) {
            return res.status(400).json({ message: "Only Gmail addresses are allowed for this method" });
        }

        if (!isStrongPassword(newPassword)) {
            return res.status(400).json({ message: "newPassword must be at least 8 characters" });
        }

        const user = await User.findOne({ email }).select("+passwordReset.code +passwordReset.codeExpiresAt");
        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }

        if (!user.providers?.local) {
            return res.status(400).json({ message: "This account is not registered with Gmail method" });
        }

        const passwordReset = user.passwordReset || {};
        if (!passwordReset.code || passwordReset.code !== code) {
            return res.status(400).json({ message: "Invalid reset code" });
        }

        if (!passwordReset.codeExpiresAt || new Date(passwordReset.codeExpiresAt).getTime() < Date.now()) {
            return res.status(400).json({ message: "Reset code expired" });
        }

        user.password = await bcrypt.hash(newPassword, 10);
        user.passwordReset = {
            code: undefined,
            codeExpiresAt: undefined,
            lastSentAt: undefined,
        };

        // Invalidate old sessions after password reset
        user.refreshTokens = [];
        await user.save();

        return res.status(200).json({ message: "Password reset successful" });
    } catch (err) {
        console.error("Reset Gmail password with code error:", err);
        return res.status(500).json({ message: "Reset password failed" });
    }
};

/**
 * FORGOT PASSWORD - REQUEST CODE
 * Frontend gửi: { email }
 */
exports.requestPasswordResetCode = async (req, res) => {
    try {
        const email = (req.body.email || "").toLowerCase().trim();
        if (!email) {
            return res.status(400).json({ message: "email is required" });
        }

        const user = await User.findOne({ email }).select("+passwordReset.code +passwordReset.codeExpiresAt");

        // Do not reveal account existence
        if (!user) {
            return res.status(200).json({
                message: "If the email exists, a reset code has been sent",
            });
        }

        const lastSentAt = user.passwordReset?.lastSentAt
            ? new Date(user.passwordReset.lastSentAt).getTime()
            : 0;
        const now = Date.now();
        const cooldownRemainingMs = PASSWORD_RESET_RESEND_COOLDOWN_MS - (now - lastSentAt);

        if (cooldownRemainingMs > 0) {
            return res.status(429).json({
                message: "Please wait before requesting another reset code",
                retryAfterSeconds: Math.ceil(cooldownRemainingMs / 1000),
            });
        }

        const code = generateVerificationCode();
        user.passwordReset = {
            ...(user.passwordReset || {}),
            code,
            codeExpiresAt: new Date(now + PASSWORD_RESET_CODE_TTL_MS),
            lastSentAt: new Date(now),
        };

        const sent = await sendPasswordResetCodeEmail({
            to: user.email,
            fullName: user.profile?.fullName,
            code,
        });

        if (!sent) {
            return res.status(500).json({ message: "Failed to send reset code" });
        }

        await user.save();

        return res.status(200).json({
            message: "If the email exists, a reset code has been sent",
            expiresInSeconds: Math.floor(PASSWORD_RESET_CODE_TTL_MS / 1000),
        });
    } catch (err) {
        console.error("Request password reset code error:", err);
        return res.status(500).json({ message: "Request reset code failed" });
    }
};

/**
 * FORGOT PASSWORD - RESEND CODE
 * Frontend gửi: { email }
 */
exports.resendPasswordResetCode = async (req, res) => {
    // Reuse request flow so behavior and anti-spam are consistent
    return exports.requestPasswordResetCode(req, res);
};

/**
 * FORGOT PASSWORD - RESET PASSWORD
 * Frontend gửi: { email, code, newPassword }
 */
exports.resetPasswordWithCode = async (req, res) => {
    try {
        const email = (req.body.email || "").toLowerCase().trim();
        const code = String(req.body.code || "").trim();
        const { newPassword } = req.body;

        if (!email || !code || !newPassword) {
            return res.status(400).json({ message: "email, code and newPassword are required" });
        }

        if (!isStrongPassword(newPassword)) {
            return res.status(400).json({ message: "newPassword must be at least 8 characters" });
        }

        const user = await User.findOne({ email }).select("+passwordReset.code +passwordReset.codeExpiresAt");
        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }

        const passwordReset = user.passwordReset || {};
        if (!passwordReset.code || passwordReset.code !== code) {
            return res.status(400).json({ message: "Invalid reset code" });
        }

        if (!passwordReset.codeExpiresAt || new Date(passwordReset.codeExpiresAt).getTime() < Date.now()) {
            return res.status(400).json({ message: "Reset code expired" });
        }

        user.password = await bcrypt.hash(newPassword, 10);
        user.providers = user.providers || {};
        user.providers.local = true;
        user.passwordReset = {
            code: undefined,
            codeExpiresAt: undefined,
            lastSentAt: undefined,
        };

        // Invalidate old sessions after password reset
        user.refreshTokens = [];
        await user.save();

        return res.status(200).json({ message: "Password reset successful" });
    } catch (err) {
        console.error("Reset password with code error:", err);
        return res.status(500).json({ message: "Reset password failed" });
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

        const isEmailVerified = user.emailVerification?.isVerified !== false;
        if (!isEmailVerified) {
            return res.status(403).json({
                message: "Email is not verified",
                requiresEmailVerification: true,
                email: user.email,
            });
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

// routes/auth.routes.js
const express = require("express");
const router = express.Router();
const {
    register,
    login,
    googleLogin,
    verifyGoogleEmail,
    resendGoogleVerificationCode,
    requestPasswordResetCode,
    resendPasswordResetCode,
    resetPasswordWithCode,
    logout,
    refreshToken,
} = require("../controllers/auth.controller");
const authenticate = require("../middleware/auth.middleware");

router.post("/register", register);
router.post("/login", login);
router.post("/logout", authenticate, logout);
router.post("/refresh", refreshToken);

router.post("/google", googleLogin);
router.post("/google/verify-email", verifyGoogleEmail);
router.post("/google/resend-code", resendGoogleVerificationCode);

router.post("/forgot-password/request", requestPasswordResetCode);
router.post("/forgot-password/resend-code", resendPasswordResetCode);
router.post("/forgot-password/reset", resetPasswordWithCode);

module.exports = router;

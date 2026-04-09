// routes/auth.routes.js
const express = require("express");
const router = express.Router();
const {
    login,
    registerWithGmailVerification,
    verifyGmailRegisterEmail,
    resendGmailRegisterCode,
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

router.post("/login", login);
router.post("/logout", authenticate, logout);
router.post("/refresh", refreshToken);

router.post("/gmail/register", registerWithGmailVerification);
router.post("/gmail/verify-email", verifyGmailRegisterEmail);
router.post("/gmail/resend-code", resendGmailRegisterCode);

router.post("/google", googleLogin);
router.post("/google/verify-email", verifyGoogleEmail);
router.post("/google/resend-code", resendGoogleVerificationCode);

router.post("/forgot-password/request", requestPasswordResetCode);
router.post("/forgot-password/resend-code", resendPasswordResetCode);
router.post("/forgot-password/reset", resetPasswordWithCode);

module.exports = router;

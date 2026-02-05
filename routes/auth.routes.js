// routes/auth.routes.js
const express = require("express");
const router = express.Router();
const { register, login, googleLogin, logout, refreshToken } = require("../controllers/auth.controller");
const authenticate = require("../middleware/auth.middleware");

router.post("/register", register);
router.post("/login", login);
router.post("/logout", authenticate, logout);
router.post("/refresh", refreshToken);

router.post("/google", googleLogin);

module.exports = router;

const express = require("express");
const router = express.Router();

const {
  createUser,
  getUsers,
  getUserById,
  updateUserById,
  deleteUser,
  getMyProfile,
  updateMyProfile,
  deleteMyAccount,
} = require("../controllers/user.controller");

const {
  authenticate,
  authorizeRoles,
} = require("../middleware/auth.middleware");

/* =========================================================
   USER EXPLICIT ENDPOINTS (ME)
   ========================================================= */

// Apply authenticate middleware to all /me routes
router.use("/me", authenticate);

router.get("/me", getMyProfile);
router.patch("/me", updateMyProfile);
router.delete("/me", deleteMyAccount);

/* =========================================================
   ADMIN ENDPOINTS
   ========================================================= */

// Apply authenticate & authorizeRoles middleware to all root routes
router.use("/", authenticate, authorizeRoles("UTM_ADMIN"));

router.get("/", getUsers);
router.post("/", createUser);
router.get("/:id", getUserById);
router.put("/:id", updateUserById);
router.patch("/:id", updateUserById); // Support both PUT and PATCH
router.delete("/:id", deleteUser);

module.exports = router;

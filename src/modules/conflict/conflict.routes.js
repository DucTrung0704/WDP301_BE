const express = require("express");
const router = express.Router();
const {
  authenticate,
  authorizeRoles,
} = require("../../../middleware/auth.middleware");
const conflictController = require("./conflict.controller");

// Tất cả conflict management routes chỉ dành cho UTM_ADMIN

// Danh sách tất cả conflicts
router.get(
  "/",
  authenticate,
  authorizeRoles("UTM_ADMIN"),
  conflictController.getConflicts,
);

// Chi tiết conflict
router.get(
  "/:id",
  authenticate,
  authorizeRoles("UTM_ADMIN"),
  conflictController.getConflictById,
);

// Resolve conflict
router.put(
  "/:id/resolve",
  authenticate,
  authorizeRoles("UTM_ADMIN"),
  conflictController.resolveConflict,
);

module.exports = router;

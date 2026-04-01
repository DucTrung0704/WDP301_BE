const express = require("express");
const router = express.Router();
const {
  authenticate,
  authorizeRoles,
} = require("../../../middleware/auth.middleware");
const flightPlanController = require("./flightPlan.controller");

// Tất cả routes yêu cầu authentication
// Chỉ INDIVIDUAL_OPERATOR và FLEET_OPERATOR được tạo/sửa/update flight plan templates

// Tạo flight plan mới (ACTIVE)
router.post(
  "/",
  authenticate,
  authorizeRoles("INDIVIDUAL_OPERATOR", "FLEET_OPERATOR"),
  flightPlanController.createFlightPlan,
);

// Danh sách flight plans của user hiện tại
router.get(
  "/",
  authenticate,
  authorizeRoles("INDIVIDUAL_OPERATOR", "FLEET_OPERATOR", "UTM_ADMIN"),
  flightPlanController.getFlightPlans,
);

// Chi tiết flight plan
router.get(
  "/:id",
  authenticate,
  authorizeRoles("INDIVIDUAL_OPERATOR", "FLEET_OPERATOR", "UTM_ADMIN"),
  flightPlanController.getFlightPlanById,
);

// Cập nhật flight plan (ACTIVE)
router.put(
  "/:id",
  authenticate,
  authorizeRoles("INDIVIDUAL_OPERATOR", "FLEET_OPERATOR"),
  flightPlanController.updateFlightPlan,
);

// Archive flight plan (soft-delete: ACTIVE → INACTIVE)
router.post(
  "/:id/submit",
  authenticate,
  authorizeRoles("INDIVIDUAL_OPERATOR", "FLEET_OPERATOR"),
  flightPlanController.archiveFlightPlan,
);

// Delete flight plan (soft-delete: ACTIVE → INACTIVE)
router.post(
  "/:id/cancel",
  authenticate,
  authorizeRoles("INDIVIDUAL_OPERATOR", "FLEET_OPERATOR"),
  flightPlanController.deleteFlightPlan,
);

// Xem xung đột của flight plan
router.get(
  "/:id/conflicts",
  authenticate,
  authorizeRoles("INDIVIDUAL_OPERATOR", "FLEET_OPERATOR", "UTM_ADMIN"),
  flightPlanController.getFlightPlanConflicts,
);

// Delete flight plan (soft-delete: ACTIVE → INACTIVE) — same as /cancel
router.delete(
  "/:id",
  authenticate,
  authorizeRoles("INDIVIDUAL_OPERATOR", "FLEET_OPERATOR"),
  flightPlanController.deleteFlightPlan,
);

module.exports = router;

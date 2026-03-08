const express = require("express");
const router = express.Router();
const {
  authenticate,
  authorizeRoles,
} = require("../../../middleware/auth.middleware");
const flightPlanController = require("./flightPlan.controller");

// Tất cả routes yêu cầu authentication
// Chỉ INDIVIDUAL_OPERATOR và FLEET_OPERATOR được tạo/sửa/submit flight plans

// Tạo flight plan mới (DRAFT)
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

// Cập nhật flight plan (DRAFT/REJECTED)
router.put(
  "/:id",
  authenticate,
  authorizeRoles("INDIVIDUAL_OPERATOR", "FLEET_OPERATOR"),
  flightPlanController.updateFlightPlan,
);

// Submit flight plan → conflict detection
router.post(
  "/:id/submit",
  authenticate,
  authorizeRoles("INDIVIDUAL_OPERATOR", "FLEET_OPERATOR"),
  flightPlanController.submitFlightPlan,
);

// Cancel flight plan
router.post(
  "/:id/cancel",
  authenticate,
  authorizeRoles("INDIVIDUAL_OPERATOR", "FLEET_OPERATOR"),
  flightPlanController.cancelFlightPlan,
);

// Xem xung đột của flight plan
router.get(
  "/:id/conflicts",
  authenticate,
  authorizeRoles("INDIVIDUAL_OPERATOR", "FLEET_OPERATOR", "UTM_ADMIN"),
  flightPlanController.getFlightPlanConflicts,
);

// Xóa flight plan (chỉ DRAFT)
router.delete(
  "/:id",
  authenticate,
  authorizeRoles("INDIVIDUAL_OPERATOR", "FLEET_OPERATOR"),
  flightPlanController.deleteFlightPlan,
);

module.exports = router;

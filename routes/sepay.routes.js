const express = require("express");
const router = express.Router();
const sepayController = require("../controllers/sepay.controller");
const authenticate = require("../middleware/auth.middleware");
const { authorizeRoles } = require("../middleware/auth.middleware");

router.post("/payment", sepayController.SepayPayment);
router.post("/webhook", sepayController.webhook);
router.get("/payment-history", authenticate, sepayController.getPaymentHistory);

router.get("/admin/payments", authenticate, authorizeRoles("UTM_ADMIN"), sepayController.getAllPayments);
router.get("/admin/revenue", authenticate, authorizeRoles("UTM_ADMIN"), sepayController.getRevenueStatistics);

module.exports = router;
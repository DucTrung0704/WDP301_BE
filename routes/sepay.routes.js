const express = require("express");
const router = express.Router();
const sepayController = require("../controllers/sepay.controller");

router.post("/payment", sepayController.SepayPayment);
router.post("/webhook", sepayController.webhook);

module.exports = router
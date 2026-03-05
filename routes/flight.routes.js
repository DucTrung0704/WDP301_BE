const express = require("express");
const router = express.Router();

const { createFlight, getMyFlights } = require("../controllers/flight.controller");
const { authenticate, authorizeRoles } = require("../middleware/auth.middleware");

// Chỉ INDIVIDUAL_OPERATOR và FLEET_OPERATOR được ghi nhận và xem lịch sử bay của chính mình

router.post(
    "/",
    authenticate,
    authorizeRoles("INDIVIDUAL_OPERATOR", "FLEET_OPERATOR"),
    createFlight
);

router.get(
    "/me",
    authenticate,
    authorizeRoles("INDIVIDUAL_OPERATOR", "FLEET_OPERATOR"),
    getMyFlights
);

module.exports = router;


const express = require("express");
const router = express.Router();
const zoneController = require("../controllers/zone.controller");
const auth = require("../middleware/auth.middleware");

// Create a new zone
router.post("/", auth, zoneController.createZone);

// Get all zones
router.get("/", auth, zoneController.getZones);

// Check if a point is in a zone
router.post("/check", auth, zoneController.checkPoint);

// Delete (archive) a zone
router.delete("/:id", auth, zoneController.deleteZone);

module.exports = router;

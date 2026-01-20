const express = require("express");
const router = express.Router();
const { createDrone, getAllDrones, getDroneById, updateDrone, deleteDrone } = require("../controllers/drone.controller");
const auth = require("../middleware/auth.middleware");

router.post("/", auth, createDrone);
router.get("/", auth, getAllDrones);
router.get("/:id", auth, getDroneById);
router.put("/:id", auth, updateDrone);
router.delete("/:id", auth, deleteDrone);
module.exports = router;

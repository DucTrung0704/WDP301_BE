const express = require("express");
const router = express.Router();
const packageController = require("../controllers/package.controller");
const { authenticate, authorizeRoles } = require("../middleware/auth.middleware");


router.get("/", packageController.getAllPackages);

router.get("/:id", packageController.getPackageById);

router.post("/", authenticate, authorizeRoles("UTM_ADMIN"), packageController.createPackage);

router.put("/:id", authenticate, authorizeRoles("UTM_ADMIN"), packageController.updatePackage);

router.delete("/:id", authenticate, authorizeRoles("UTM_ADMIN"), packageController.deletePackage);

module.exports = router;

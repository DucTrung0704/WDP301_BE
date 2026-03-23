const express = require("express");
const router = express.Router();
const favouriteController = require("../controllers/favourite.controller");

router.get("/", favouriteController.getFavorite);
router.post("/add", favouriteController.addFavorite);
router.get("/:id", favouriteController.getFavoriteById);
router.delete("/:id", favouriteController.deleteFavoriteById);

module.exports = router;
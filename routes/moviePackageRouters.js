const router = require("express").Router();
const authMiddleware = require("../middlewares/authMiddleware");

const moviePack = require("../controllers/moviePackageControllers");

router.get("/packagePrice", moviePack.getPackage);
router.post("/createMoviePackage", moviePack.createPackage);
router.get(
  "/getTotalPackageMonth",
  authMiddleware,
  moviePack.getTotalPackageMonthDuration
);
module.exports = router;

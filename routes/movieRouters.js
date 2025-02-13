const router = require("express").Router();
const authMiddlewareNoReturn = require("../middlewares/authMiddlewareNoReturnCode");
const movieController = require("../controllers/movieController");
const authMiddleware = require("../middlewares/authMiddleware");

router.get("/getListMovie", movieController.getAllMovies);
router.get("/searchMovie", movieController.searchMovies);
router.get(
  "/getMovieDetail/:slug",
  authMiddlewareNoReturn,
  movieController.getMovieBySlug
);
router.post(
  "/getMovieEpisode",
  authMiddlewareNoReturn,
  movieController.getDetailMovieEpisode
);

module.exports = router;

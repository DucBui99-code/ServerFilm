const router = require("express").Router();
const authMiddlewareNoReturn = require("../middlewares/authMiddlewareNoReturnCode");
const movieController = require("../controllers/movieController");
const commentController = require("../controllers/commentController");

const authMiddleware = require("../middlewares/authMiddleware");

router.get("/getListMovie", movieController.getAllMovies);
router.get("/searchMovie", movieController.searchMovies);
router.get(
  "/getMovieDetail/:slug",
  authMiddlewareNoReturn,
  movieController.getMovieBySlug
);
router.get(
  "/getMovieComments/:movieId",
  authMiddlewareNoReturn,
  commentController.getCommentsByMovie
);
router.post(
  "/getMovieEpisode",
  authMiddlewareNoReturn,
  movieController.getDetailMovieEpisode
);

module.exports = router;

const router = require("express").Router();
const authMiddlewareNoReturn = require("../middlewares/authMiddlewareNoReturnCode");
const movieController = require("../controllers/movieController");
const commentController = require("../controllers/commentController");
const liveCommentController = require("../controllers/liveCommentController");

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
router.get("/getLiveComments/:movieId", liveCommentController.getCommentLive);
router.post(
  "/getMovieEpisode",
  authMiddlewareNoReturn,
  movieController.getDetailMovieEpisode
);

module.exports = router;

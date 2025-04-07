const router = require("express").Router();
const authMiddlewareNoReturn = require("../middlewares/authMiddlewareNoReturnCode");
const authMiddleware = require("../middlewares/authMiddleware");
const movieController = require("../controllers/movieController");
const commentController = require("../controllers/commentController");
const liveCommentController = require("../controllers/liveCommentController");

router.get("/getListMovie", movieController.getAllMovies);
router.get("/geRandomLiveMovie", movieController.getRandomLiveMovie);
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
router.get("/getRateMovie/:movieId", movieController.getRateMovie);
router.get("/getMovieByCountry", movieController.getMovieByCountry);
router.get("/getMovieByCategory", movieController.getMovieByCategory);
router.get("/getMovieByType", movieController.getMovieByType);
router.get(
  "/getReplyComments/:commentId",
  authMiddlewareNoReturn,
  commentController.getRepliesByComment
);
router.get("/getLiveComments/:movieId", liveCommentController.getCommentLive);
router.post(
  "/getMovieEpisode",
  authMiddlewareNoReturn,
  movieController.getDetailMovieEpisode
);
router.post("/rateMovie", authMiddleware, movieController.rateMovie);

module.exports = router;

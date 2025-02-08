const router = require("express").Router();

const movieController = require("../controllers/movieController");

router.get("/getListMovie", movieController.getAllMovies);
router.get("/searchMovie", movieController.searchMovies);
router.get("/getMovieDetail/:slug", movieController.getMovieBySlug);
router.post("/getMovieEpisode", movieController.getDetailMovieEpisode);

module.exports = router;

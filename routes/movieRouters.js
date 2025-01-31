const router = require("express").Router();

const movieController = require("../controllers/movieController");

router.get("/getListMovie", movieController.getAllMovies);

module.exports = router;

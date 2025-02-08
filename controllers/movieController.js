const { Movie } = require("../models/MovieModel");
const { DetailMovie } = require("../models/DetailMovieModel");

const PATH_IMAGE = "https://img.ophim.live/uploads/movies/";

exports.getAllMovies = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const type = req.query.type || "movie";
    const limit = 24;
    const skip = (page - 1) * limit;

    let filter = {};

    // Xác định loại phim cần lấy
    if (type === "movie") {
      filter = { __t: { $ne: "MovieRent" } }; // Lấy các Movie bình thường
    } else if (type === "movieRent") {
      filter = { __t: "MovieRent" }; // Lấy các MovieRent
    }

    const totalMovies = await Movie.countDocuments(filter);

    const movies = await Movie.find(filter).skip(skip).limit(limit);

    return res.json({
      status: true,
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(totalMovies / limit),
        totalMovies,
      },
      items: movies,
      pathImage: PATH_IMAGE,
      message: "Get moive success",
    });
  } catch (error) {
    res.status(500).json({ message: error.message, status: false });
  }
};

exports.searchMovies = async (req, res) => {
  try {
    const { q } = req.query;

    if (!q || typeof q !== "string" || q.trim().length === 0) {
      return res
        .status(400)
        .json({ message: "Invalid Query", items: [], status: false });
    }

    const safeQuery = q.replace(
      /[^a-zA-Z0-9\sàáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ]/g,
      ""
    );

    if (safeQuery.length > 50) {
      return res
        .status(400)
        .json({ message: "Query is to long", items: [], status: false });
    }

    const movies = await Movie.find({
      $or: [
        { name: { $regex: q, $options: "i" } },
        { origin_name: { $regex: q, $options: "i" } },
      ],
    });

    return res.status(200).json({
      status: true,
      data: {
        items: movies,
        pathImage: PATH_IMAGE,
      },
      message: "Search movie success",
    });
  } catch (error) {
    res.status(500).json({ message: error.message, status: false });
  }
};

exports.getMovieBySlug = async (req, res) => {
  try {
    const { slug } = req.params;

    if (!slug || typeof slug !== "string" || slug.trim().length === 0) {
      return res.status(400).json({
        status: false,
        message: ["Invalid Slug"],
      });
    }

    const movie = await DetailMovie.findOne({ slug });

    if (!movie) {
      return res.status(404).json({
        status: false,
        data: {
          movie: null,
          episodes: [],
        },
        message: ["Movie not found"],
      });
    }

    const movieData = movie.toObject();
    delete movieData.episodes;

    return res.status(200).json({
      status: true,
      data: movieData,
      message: "Get movie success",
    });
  } catch (error) {
    res.status(500).json({ message: error.message, status: false });
  }
};

exports.getDetailMovieEpisode = async (req, res) => {
  try {
    const { movieId, indexEpisode } = req.body;

    const dataDetailMovie = await DetailMovie.findById(movieId);

    if (!dataDetailMovie) {
      return res.status(404).json({
        message: ["Detail movie not found"],
        staus: false,
      });
    }

    const dataEpisodes = dataDetailMovie.episodes[0].server_data[indexEpisode];
    if (!dataEpisodes) {
      return res.status(404).json({
        message: ["Index Episode not found"],
        staus: false,
      });
    }
    return res.status(200).json({
      status: true,
      data: dataEpisodes,
    });
  } catch (error) {
    res.status(500).json({ message: error.message, status: false });
  }
};

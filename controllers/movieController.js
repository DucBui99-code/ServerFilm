const Movie = require("../models/MovieModel");
const DetailMovie = require("../models/DetailMovieModel");

const PATH_IMAGE = "https://img.ophim.live/uploads/movies/";

exports.getAllMovies = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = 24;
    const skip = (page - 1) * limit;

    // Lấy tổng số lượng phim
    const totalMovies = await Movie.countDocuments();

    // Lấy danh sách phim theo trang
    const movies = await Movie.find().skip(skip).limit(limit);

    return res.json({
      status: true,
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(totalMovies / limit),
        totalMovies,
      },
      items: movies,
      pathImage: PATH_IMAGE,
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

    return res.json({
      status: true,
      items: movies,
      pathImage: PATH_IMAGE,
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
        movie: null,
        episodes: [],
        message: ["Movie not found"],
      });
    }

    const movieData = movie.toObject();
    delete movieData.episodes;

    return res.status(200).json({
      status: true,
      movie: movieData,
      episodes: movie.episodes,
    });
  } catch (error) {
    res.status(500).json({ message: error.message, status: false });
  }
};

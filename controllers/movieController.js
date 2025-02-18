const { Movie } = require("../models/MovieModel");
const { DetailMovie } = require("../models/DetailMovieModel");
const UserDB = require("../models/UserModel");
const {
  checkPackMonthExpiration,
  checkRentExpiration,
} = require("../utils/checkPack");
const { PATH_IMAGE } = require("../config/CONSTANT");

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

    const totalMovies = await Movie.countDocuments(filter).lean();

    const movies = await Movie.find(filter).skip(skip).limit(limit).lean();

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
    }).lean();

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
    const userId = req?.user?.userId || null;

    const { slug } = req.params;

    if (!slug?.trim()) {
      return res.status(400).json({
        status: false,
        message: "Invalid Slug",
      });
    }

    const movie = await DetailMovie.findOne({ slug }).lean();

    if (!movie) {
      return res.status(404).json({
        status: false,
        data: { movie: null, episodes: [] },
        message: "Movie not found",
      });
    }

    delete movie.episodes;

    // Nếu người dùng đăng nhập, kiểm tra thuê phim
    if (userId && movie.__t === "DetailMovieRent" && movie.isBuyBySingle) {
      movie.isRent = await isNeedRent(userId, movie);
    } else {
      movie.isRent = false;
    }

    return res.status(200).json({
      status: true,
      data: movie,
      message: "Get movie success",
    });
  } catch (error) {
    return res.status(500).json({ status: false, message: [error.message] });
  }
};

exports.getDetailMovieEpisode = async (req, res) => {
  try {
    const { movieId, indexEpisode } = req.body;
    const userId = req.user?.userId || null;

    // Lấy chi tiết phim
    const dataDetailMovie = await DetailMovie.findById(movieId).lean();
    if (!dataDetailMovie) {
      return res.status(404).json({
        message: "Detail movie not found",
        status: false,
      });
    }

    const episodes = dataDetailMovie.episodes?.[0]?.server_data || [];
    const dataEpisodes = episodes[indexEpisode];

    if (!dataEpisodes) {
      return res.status(404).json({
        message: "Index Episode not found",
        status: false,
      });
    }

    if (dataDetailMovie.__t === "DetailMovieRent") {
      if (!userId) {
        return res.status(404).json({
          message: "Please login to watch",
          status: false,
        });
      }
      const user = await UserDB.findById(userId).lean();

      if (
        dataDetailMovie.isBuyBySingle &&
        checkRentExpiration(user, dataDetailMovie._id)
      ) {
        return res.status(404).json({
          message: "Please rent this movie",
          status: false,
        });
      }
      if (dataDetailMovie.isBuyByMonth && checkPackMonthExpiration(user)) {
        return res.status(404).json({
          message: "Please buy package",
          status: false,
        });
      }
    }

    return res.status(200).json({
      status: true,
      data: dataEpisodes,
    });
  } catch (error) {
    return res.status(500).json({ message: error.message, status: false });
  }
};

const isNeedRent = async (userId, movieData) => {
  if (!userId) return false;
  const user = await UserDB.findById(userId);
  return (
    checkPackMonthExpiration(user) || checkRentExpiration(user, movieData._id)
  );
};

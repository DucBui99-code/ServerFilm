const { Movie } = require("../models/MovieModel");
const { DetailMovie } = require("../models/DetailMovieModel");
const UserDB = require("../models/UserModel");
const {
  checkPackMonthExpiration,
  checkRentExpiration,
} = require("../utils/checkPack");
const { PATH_IMAGE } = require("../config/CONSTANT");
const throwError = require("../utils/throwError");
const cacheService = require("../services/cacheService");

exports.getAllMovies = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const type = req.query.type || "movie";
    const limit = 15;
    const skip = (page - 1) * limit;

    let filter = {};
    if (type === "movie") {
      filter = { __t: { $ne: "MovieRent" } };
    } else if (type === "movieRent") {
      filter = { __t: "MovieRent" };
    }

    // 👉 Tạo cache key
    const cacheKey = `movies:${type}:page:${page}`;

    // 🔹 Kiểm tra cache
    const cachedData = await cacheService.getCache(cacheKey);
    if (cachedData) {
      return res.json(cachedData);
    }

    // 🔹 Nếu không có cache, truy vấn MongoDB
    const totalMovies = await Movie.countDocuments(filter).lean();
    const movies = await Movie.find(filter).skip(skip).limit(limit).lean();

    const response = {
      status: true,
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(totalMovies / limit),
        totalMovies,
      },
      items: movies,
      pathImage: PATH_IMAGE,
      message: "Get movie success",
    };

    // 🔹 Lưu cache (1 ngày)
    await cacheService.setCache(cacheKey, response, 86400);

    return res.json(response);
  } catch (error) {
    next(error);
  }
};

exports.searchMovies = async (req, res, next) => {
  try {
    const { q, page = 1 } = req.query;
    const limit = 5;
    const skip = (page - 1) * limit;

    if (!q || typeof q !== "string" || q.trim().length === 0) {
      return res
        .status(400)
        .json({ message: "Invalid Query", items: [], status: false });
    }

    const cacheKey = `search:${q}:${page}`;

    // Kiểm tra cache trước khi truy vấn MongoDB
    const cachedData = await cacheService.getCache(cacheKey);
    if (cachedData) {
      return res.status(200).json(cachedData);
    }

    const totalMovies = await Movie.countDocuments({
      $or: [
        { name: { $regex: q, $options: "i" } },
        { origin_name: { $regex: q, $options: "i" } },
      ],
    }).lean();

    const movies = await Movie.find({
      $or: [
        { name: { $regex: q, $options: "i" } },
        { origin_name: { $regex: q, $options: "i" } },
      ],
    })
      .skip(skip)
      .limit(limit)
      .lean();

    const response = {
      status: true,
      data: {
        items: movies,
        pathImage: PATH_IMAGE,
        pagination: {
          currentPage: page,
          totalPages: Math.ceil(totalMovies / limit),
          totalMovies,
          lastPage: page >= Math.ceil(totalMovies / limit),
        },
      },
      message: "Search movie success",
    };

    // Lưu kết quả vào Redis với thời gian hết hạn là 10 phút (600 giây)
    await cacheService.setCache(cacheKey, response, 600);

    return res.status(200).json(response);
  } catch (error) {
    next(error);
  }
};

exports.getMovieBySlug = async (req, res, next) => {
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

    const response = {
      status: true,
      data: movie,
      message: "Get movie success",
    };

    return res.status(200).json(response);
  } catch (error) {
    next(error);
  }
};

exports.getDetailMovieEpisode = async (req, res, next) => {
  try {
    const { movieId, indexEpisode } = req.body;
    const userId = req.user?.userId || null;

    // Lấy chi tiết phim
    const dataDetailMovie = await DetailMovie.findById(movieId).lean();
    if (!dataDetailMovie) {
      throwError("Detail movie not found");
    }

    const episodes = dataDetailMovie.episodes?.[0]?.server_data || [];
    const dataEpisodes = episodes[indexEpisode];

    if (!dataEpisodes) {
      throwError("Index Episode not found");
    }

    if (dataDetailMovie.__t === "DetailMovieRent") {
      if (!userId) {
        throwError("Please login to watch");
      }
      const user = await UserDB.findById(userId).lean();

      if (
        dataDetailMovie.isBuyBySingle &&
        checkRentExpiration(user, dataDetailMovie._id)
      ) {
        throwError("Please rent this movie");
      }
      if (dataDetailMovie.isBuyByMonth && checkPackMonthExpiration(user)) {
        throwError("Please buy package");
      }
    }

    return res.status(200).json({
      status: true,
      data: dataEpisodes,
    });
  } catch (error) {
    next(error);
  }
};

const isNeedRent = async (userId, movieData) => {
  if (!userId) return false;
  const user = await UserDB.findById(userId);
  return (
    checkPackMonthExpiration(user) || checkRentExpiration(user, movieData._id)
  );
};

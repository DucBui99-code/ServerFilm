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

    const cacheKey = `movie:${slug}`;
    // Kiểm tra cache trước
    const cachedMovie = await cacheService.getCache(cacheKey);

    if (cachedMovie) {
      console.log("Cache hit for movie:", slug);

      return res.status(200).json({
        status: true,
        data: cachedMovie,
        message: "Get movie success (from cache)",
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

    // Cache chỉ lưu khi không cần thuê phim
    if (!movie.isRent) {
      console.log("Cache miss for movie:", slug);

      await cacheService.setCache(cacheKey, movie, 3600); // Lưu cache trong 1 giờ
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

    const cacheKey = `episodes:${movieId}`;
    let episodesCache = await cacheService.getCache(cacheKey); // dạng object: { "0": {...}, "1": {...} }

    // Nếu cache chưa tồn tại, tạo mới object rỗng
    if (!episodesCache) {
      episodesCache = {};
    }

    // Nếu đã có tập trong cache
    if (episodesCache[indexEpisode]) {
      return res.status(200).json({
        status: true,
        data: episodesCache[indexEpisode],
        message: "Get episode success",
      });
    }

    // Nếu chưa có tập trong cache → lấy từ DB
    const dataDetailMovie = await DetailMovie.findById(movieId).lean();
    if (!dataDetailMovie) throwError("Detail movie not found");

    const episodesList = dataDetailMovie.episodes?.[0]?.server_data || [];
    const dataEpisode = episodesList[indexEpisode];
    if (!dataEpisode) throwError("Index Episode not found");

    // Nếu là phim thuê → check quyền
    if (dataDetailMovie.__t === "DetailMovieRent") {
      if (!userId) throwError("Please login to watch");
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

      // KHÔNG cache nếu là phim thuê
      return res.status(200).json({
        status: true,
        data: dataEpisode,
        message: "Get episode success",
      });
    }

    // Nếu không phải phim thuê → cập nhật cache (giữ các tập cũ)
    episodesCache[indexEpisode] = dataEpisode;
    await cacheService.setCache(cacheKey, episodesCache, 86400); // cache 1 ngày

    return res.status(200).json({
      status: true,
      data: dataEpisode,
      message: "Get episode success",
    });
  } catch (error) {
    next(error);
  }
};

exports.getMovieByCountry = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;
    const country = req.query.country;

    if (!country) {
      throwError("Country query parameter is required");
    }

    const cacheKey = `movies:country:${country}:page:${page}:limit:${limit}`;
    const cachedData = await cacheService.getCache(cacheKey);

    if (cachedData) {
      return res.json(cachedData);
    }

    const totalMovies = await DetailMovie.countDocuments({
      "country.slug": country,
    }).lean();

    const movies = await DetailMovie.aggregate([
      {
        $match: {
          "country.slug": country,
        },
      },
      {
        $project: {
          _id: 1,
          origin_name: 1,
          name: 1,
          thumb_url: 1,
          poster_url: 1,
          year: 1,
          slug: 1,
          tmdb: 1,
          __t: 1,
        },
      },
      { $skip: skip },
      { $limit: limit },
    ]);
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

    await cacheService.setCache(cacheKey, response, 3600);

    res.json(response);
  } catch (error) {
    next(error);
  }
};

exports.getMovieByType = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;
    const type = req.query.type;

    if (!type) {
      throwError("type query parameter is required");
    }

    const cacheKey = `movies:type:${type}:page:${page}:limit:${limit}`;
    const cachedData = await cacheService.getCache(cacheKey);

    if (cachedData) {
      return res.json(cachedData);
    }

    const totalMovies = await DetailMovie.countDocuments({
      type: type,
    }).lean();

    const movies = await DetailMovie.aggregate([
      {
        $match: {
          type: type,
        },
      },
      {
        $project: {
          _id: 1,
          origin_name: 1,
          name: 1,
          thumb_url: 1,
          poster_url: 1,
          year: 1,
          slug: 1,
          tmdb: 1,
          __t: 1,
        },
      },
      { $skip: skip },
      { $limit: limit },
    ]);
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

    await cacheService.setCache(cacheKey, response, 3600);

    res.json(response);
  } catch (error) {
    next(error);
  }
};

exports.getMovieByCategory = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;
    const category = req.query.category;

    if (!category) {
      throwError("category query parameter is required");
    }

    const cacheKey = `movies:category:${category}:page:${page}:limit:${limit}`;
    const cachedData = await cacheService.getCache(cacheKey);

    if (cachedData) {
      return res.json(cachedData);
    }

    const totalMovies = await DetailMovie.countDocuments({
      "category.slug": category,
    }).lean();

    const movies = await DetailMovie.aggregate([
      {
        $match: {
          "category.slug": category,
        },
      },
      {
        $project: {
          _id: 1,
          origin_name: 1,
          name: 1,
          thumb_url: 1,
          poster_url: 1,
          year: 1,
          slug: 1,
          tmdb: 1,
          __t: 1,
        },
      },
      { $skip: skip },
      { $limit: limit },
    ]);
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

    await cacheService.setCache(cacheKey, response, 3600);

    res.json(response);
  } catch (error) {
    next(error);
  }
};

const isNeedRent = async (userId, movieData) => {
  if (!userId) return false;
  const user = await UserDB.findById(userId).lean();
  return (
    checkPackMonthExpiration(user) || checkRentExpiration(user, movieData._id)
  );
};

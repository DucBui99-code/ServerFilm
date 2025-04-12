const { Movie } = require("../models/MovieModel");
const RateModel = require("../models/RateModel");
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
    const cachedData = await cacheService.getCache(cacheKey);
    if (cachedData) {
      return res.status(200).json(cachedData);
    }

    // Tìm phim bằng Atlas Search
    const result = await Movie.aggregate([
      {
        $search: {
          index: "search_movie", // Đổi nếu bạn đặt tên index khác
          text: {
            query: q,
            path: ["name", "origin_name"],
          },
        },
      },
      {
        $facet: {
          items: [{ $skip: skip }, { $limit: limit }],
          totalCount: [{ $count: "count" }],
        },
      },
    ]);

    const items = result[0]?.items || [];
    const totalCount = result[0]?.totalCount[0]?.count || 0;

    const response = {
      status: true,
      data: {
        items,
        pathImage: PATH_IMAGE,
        pagination: {
          currentPage: Number(page),
          totalPages: Math.ceil(totalCount / limit),
          totalMovies: totalCount,
          lastPage: Number(page) >= Math.ceil(totalCount / limit),
        },
      },
      message: "Search movie success",
    };

    await cacheService.setCache(cacheKey, response, 600); // 10 phút cache

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

exports.getRandomLiveMovie = async (req, res, next) => {
  try {
    const cacheKey = `randomLiveMovie`;
    const cachedData = await cacheService.getCache(cacheKey);

    if (cachedData) {
      return res.json(cachedData);
    }

    const liveMovies = await DetailMovie.find({ isLiveComment: true })
      .select("slug thumb_url poster_url name origin_name __t")
      .lean();

    if (!liveMovies || liveMovies.length === 0) {
      return res.status(404).json({
        status: false,
        message: "No live movies found",
      });
    }

    const randomIndex = Math.floor(Math.random() * liveMovies.length);
    const randomMovie = liveMovies[randomIndex];

    const response = {
      status: true,
      data: randomMovie,
      message: "Get random live movie success",
    };

    await cacheService.setCache(cacheKey, response, 3600);

    res.json(response);
  } catch (error) {
    next(error);
  }
};

exports.getMovieByCountry = async (req, res, next) => {
  try {
    // Validate and parse input parameters
    const page = Math.max(parseInt(req.query.page) || 1, 1);
    const limit = Math.min(parseInt(req.query.limit) || 10, 100); // Set max limit to 100
    const skip = (page - 1) * limit;
    const country = req.query.country?.trim(); // Trim whitespace

    if (!country) {
      throwError("Country query parameter is required", 400); // Added status code
    }

    // Cache handling
    const cacheKey = `movies:country:${country}:page:${page}:limit:${limit}`;
    const cachedData = await cacheService.getCache(cacheKey);

    if (cachedData) {
      return res.json(cachedData);
    }

    // Use regular index and find method for better performance
    const totalMovies = await DetailMovie.countDocuments({
      "country.slug": country,
    });

    // Validate pagination
    const totalPages = Math.ceil(totalMovies / limit);
    if (page > totalPages && totalPages > 0) {
      throwError("Page number exceeds total pages", 404);
    }

    // Find movies with pagination
    const movies = await DetailMovie.find({ "country.slug": country })
      .select("_id origin_name name thumb_url poster_url year slug tmdb __t") // Select specific fields
      .skip(skip)
      .limit(limit);

    // Prepare response
    const response = {
      status: true,
      data: {
        items: movies,
        pathImage: PATH_IMAGE,
        pagination: {
          currentPage: page,
          totalPages,
          totalMovies,
          lastPage: page >= totalPages,
          hasNextPage: page < totalPages,
        },
      },
      message: "Search movie by country success", // More specific message
    };

    // Set cache with error handling
    await cacheService.setCache(cacheKey, response, 3600);

    return res.json(response);
  } catch (error) {
    next(error);
  }
};

exports.getMovieByType = async (req, res, next) => {
  try {
    // Validate and parse input parameters
    const page = Math.max(parseInt(req.query.page) || 1, 1);
    const limit = Math.min(parseInt(req.query.limit) || 10, 100); // Set max limit to 100
    const skip = (page - 1) * limit;
    const type = req.query.type?.trim(); // Trim whitespace and make case-insensitive if needed

    if (!type) {
      throwError("Type query parameter is required", 400); // Added status code
    }

    // Cache handling
    const cacheKey = `movies:type:${type.toLowerCase()}:page:${page}:limit:${limit}`;
    const cachedData = await cacheService.getCache(cacheKey);

    if (cachedData) {
      return res.json(cachedData);
    }

    // Use regular index and find method for better performance
    const totalMovies = await DetailMovie.countDocuments({
      type: { $regex: new RegExp(`^${type}$`, "i") }, // Case-insensitive match
    });

    // Validate pagination
    const totalPages = Math.ceil(totalMovies / limit);
    if (page > totalPages && totalPages > 0) {
      throwError("Page number exceeds total pages", 404);
    }

    // Find movies with pagination
    const movies = await DetailMovie.find({
      type: { $regex: new RegExp(`^${type}$`, "i") }, // Case-insensitive match
    })
      .select("_id origin_name name thumb_url poster_url year slug tmdb __t") // Select specific fields
      .skip(skip)
      .limit(limit);

    // Prepare response
    const response = {
      status: true,
      data: {
        items: movies,
        pathImage: PATH_IMAGE,
        pagination: {
          currentPage: page,
          totalPages,
          totalMovies,
          lastPage: page >= totalPages,
          hasNextPage: page < totalPages, // Added for better client handling
        },
      },
      message: `Movies of type '${type}' retrieved successfully`, // More specific message
    };

    // Set cache with error handling
    await cacheService.setCache(cacheKey, response, 3600);

    return res.json(response);
  } catch (error) {
    next(error);
  }
};

exports.getMovieByCategory = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = Math.min(parseInt(req.query.limit) || 10, 100); // Giới hạn max limit
    const skip = (page - 1) * limit;
    const category = req.query.category?.trim(); // Thêm trim() để loại bỏ khoảng trắng thừa

    if (!category) {
      throwError("Category query parameter is required", 400); // Thêm status code
    }

    const cacheKey = `movies:category:${category}:page:${page}:limit:${limit}`;
    const cachedData = await cacheService.getCache(cacheKey);

    if (cachedData) {
      return res.json(cachedData);
    }

    // Tối ưu: Đếm và query song song với find() thay vì aggregate
    const [totalMovies, movies] = await Promise.all([
      DetailMovie.countDocuments({ "category.slug": category }),
      DetailMovie.find({ "category.slug": category })
        .select("_id origin_name name thumb_url poster_url year slug tmdb __t") // Lọc trường cần thiết
        .skip(skip)
        .limit(limit),
    ]);

    // Kiểm tra page hợp lệ
    const totalPages = Math.ceil(totalMovies / limit);
    if (page > totalPages && totalPages > 0) {
      throwError("Page number exceeds total pages", 404);
    }

    const response = {
      status: true,
      data: {
        items: movies,
        pathImage: PATH_IMAGE,
        pagination: {
          currentPage: page,
          totalPages,
          totalMovies,
          lastPage: page >= totalPages,
        },
      },
      message: "Search movie success",
    };

    // Cập nhật cache
    await cacheService.setCache(cacheKey, response, 3600);

    res.json(response);
  } catch (error) {
    next(error);
  }
};

exports.rateMovie = async (req, res, next) => {
  try {
    const { movieId, star, content } = req.body;
    const { userId, typeLogin } = req.user;

    const movie = await DetailMovie.findById(movieId).lean();
    if (!movie) throwError("Movie not found");

    if (
      typeof star !== "number" ||
      star < 1 ||
      star > 5 ||
      !Number.isInteger(star)
    ) {
      throwError("Star must be an integer between 1 and 5");
    }

    const existingRate = await RateModel.findOne({
      user: userId,
      movie: movieId,
    }).lean();

    if (existingRate) {
      return res.status(200).json({
        status: true,
        message: "Rate movie success",
      });
    } else {
      const newRate = new RateModel({
        user: userId,
        movie: movieId,
        star,
        content,
        typeComment: typeLogin,
      });
      await newRate.save();
    }

    // Cập nhật thông tin đánh giá trong DetailMovie
    const totalCount = (movie.tmdb.total_count || 0) + 1;
    const totalStar = movie.tmdb.vote_count + star;
    const averageStar = totalStar / totalCount;

    await DetailMovie.updateOne(
      { _id: movieId },
      {
        $set: {
          "tmdb.vote_average": averageStar,
          "tmdb.vote_count": totalStar,
          "tmdb.total_count": totalCount,
        },
      }
    );

    return res.status(200).json({
      status: true,
      message: "Rate movie success",
    });
  } catch (error) {
    next(error);
  }
};

exports.getRateMovie = async (req, res, next) => {
  try {
    const { movieId } = req.params;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const totalRates = await RateModel.countDocuments({
      movie: movieId,
    }).lean();

    const rates = await RateModel.find({ movie: movieId })
      .populate({
        path: "user",
        select: "username avatar inforAccountGoogle sex", // Chọn các trường bạn muốn lấy từ User
      })
      .skip(skip)
      .limit(limit)
      .lean();

    const formattedRates = rates.map((rate) => {
      return {
        ...rate,
        user: {
          username: rate.user.username,
          avatar:
            rate.typeComment === "byPass"
              ? rate.user.avatar
              : rate.user.inforAccountGoogle?.avatar,
          sex: rate.user?.sex || "other",
        },
      };
    });

    const response = {
      status: true,
      data: {
        items: formattedRates,
        pagination: {
          currentPage: page,
          totalPages: Math.ceil(totalRates / limit),
          totalRates,
          lastPage: page >= Math.ceil(totalRates / limit),
        },
      },
      message: "Get rate movie success",
    };

    return res.status(200).json(response);
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

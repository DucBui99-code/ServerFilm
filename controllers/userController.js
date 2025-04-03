const User = require("../models/UserModel");
const moment = require("moment");
const cloudinary = require("cloudinary").v2;

const { DetailMovie } = require("../models/DetailMovieModel");
const BIll = require("../models/BillModel");
const { TYPE_LOGIN } = require("../config/CONSTANT");
const throwError = require("../utils/throwError");

const redis = require("../services/cacheService"); // Import Redis đã setup

const CACHE_EXPIRE_TIME = {
  profile: 600, // 10 phút
  bills: 1800, // 30 phút
  purchasedMovies: 3600, // 1 giờ
  favoriteMovies: 3600, // 1 giờ
  deviceManagement: 1800, // 30 phút
};

// Get Profile API
exports.getProfile = async (req, res, next) => {
  try {
    const { userId, typeLogin } = req.user;
    const { type } = req.query;
    const cacheKey = `profile:${userId}:type-${type}`;

    // 🟢 Kiểm tra cache trước khi truy vấn MongoDB
    const cachedData = await redis.getCache(cacheKey);
    if (cachedData) {
      return res.status(200).json(cachedData); // Không cần parse JSON
    }

    const user = await User.findById(userId).lean();
    let response = { status: true, data: null, message: "" };

    switch (type) {
      case "0": // Thông tin cá nhân
        response.data =
          typeLogin === TYPE_LOGIN.byGoogle
            ? {
                avatar: user.inforAccountGoogle?.avatar || null,
                email: user.email,
                firstName: user.inforAccountGoogle?.firstName,
                lastName: user.inforAccountGoogle?.lastName,
                birthDay: user.birthDay,
                sex: user.sex,
                username: user.username,
                phoneNumber: user.phoneNumber,
              }
            : {
                avatar: user.avatar || null,
                email: user.email,
                firstName: user.firstName,
                lastName: user.lastName,
                birthDay: user.birthDay,
                sex: user.sex,
                username: user.username,
                phoneNumber: user.phoneNumber,
              };
        response.message = "Get info successfully";
        break;

      case "1": // Lịch sử giao dịch
        const { page = 1, limit = 10 } = req.query;
        const bills = await BIll.find({ userId })
          .select(
            "packageType _id paymentMethod price paymentStatus createdAt packageName"
          )
          .sort({ createdAt: -1 })
          .skip((page - 1) * limit)
          .limit(parseInt(limit))
          .lean();
        const totalItems = await BIll.countDocuments({ userId });
        const totalPages = Math.ceil(totalItems / limit);

        response.data = bills.map((bill) => ({
          ...bill,
          createdAt: moment(bill.createdAt)
            .utcOffset("+07:00")
            .format("YYYY-MM-DD HH:mm:ss"),
        }));
        response.message = "Get history purchase successfully";
        response.currentPage = parseInt(page);
        response.totalPages = totalPages;
        response.totalItems = totalItems;

        break;

      case "2": // Lịch sử mua gói tháng
        response.data = user.purchasedMoviesMonth.map((movie) => ({
          ...movie,
          isExpired: moment().isAfter(
            moment(movie.exprationDate, "DD/MM/YYYY")
          ),
        }));
        response.message = "Get history pack month successfully";

        break;

      case "3": // Danh sách phim yêu thích
        response.data = await Promise.all(
          user.favoriteMovies.map(async (movie) => {
            const movieDetailDB = await DetailMovie.findById(movie.movieId)
              .select("name slug origin_name thumb_url poster_url year")
              .lean();
            return { _id: movie._id, ...(movieDetailDB || {}) };
          })
        );
        response.message = "Get favorite movie successfully";
        await redis.setCache(
          cacheKey,
          response,
          CACHE_EXPIRE_TIME.favoriteMovies
        );
        break;

      case "4": // Danh sách phim thuê
        response.data = await Promise.all(
          user.purchasedMoviesRent.map(async (movie) => {
            const movieDetailDB = await DetailMovie.findById(movie.movieId)
              .select(
                "name origin_name thumb_url poster_url price duration slug"
              )
              .lean();
            return {
              _id: movie._id,
              purchaseDate: movie.purchaseDate,
              exprationDate: movie.exprationDate,
              isExpired: moment().isAfter(
                moment(movie.exprationDate, "DD/MM/YYYY")
              ),
              ...(movieDetailDB || {}),
            };
          })
        );
        response.message = "Get rented movies successfully";
        await redis.setCache(
          cacheKey,
          response,
          CACHE_EXPIRE_TIME.rentedMovies
        );
        break;

      case "5": // Quản lý thiết bị
        response.data = user.deviceManagement;
        response.message = "Get device management successfully";
        await redis.setCache(
          cacheKey,
          response,
          CACHE_EXPIRE_TIME.deviceManagement
        );
        break;

      default:
        throwError("Invalid Type");
    }

    return res.status(200).json(response);
  } catch (error) {
    next(error);
  }
};

// Update user information
exports.updateInformation = async (req, res, next) => {
  try {
    const { userId, typeLogin } = req.user;
    const { username, firstName, lastName, phoneNumber, birthDay, sex } =
      req.body;

    if (
      !username &&
      !lastName &&
      !firstName &&
      !phoneNumber &&
      !birthDay &&
      !sex
    ) {
      throwError("Not found information to update");
    }

    const user = await User.findById(userId);

    if (phoneNumber) {
      const checkPhoneNumber = await User.findOne({ phoneNumber: phoneNumber });
      if (checkPhoneNumber) {
        throwError("Phone number is already exit", 429);
      }

      user.phoneNumber = phoneNumber.trim();
    }

    // Kiểm tra định dạng birthDay
    if (birthDay) {
      if (!moment(birthDay, "MM/DD/YYYY", true).isValid()) {
        throwError("Invalid birthDay format. Use MM/DD/YYYY");
      }

      // Kiểm tra birthDay không nằm trong tương lai
      if (moment(birthDay, "MM/DD/YYYY").isAfter(moment())) {
        throwError("BirthDay cannot be in the future");
      }

      user.birthDay = birthDay.trim();
    }

    if (typeLogin === TYPE_LOGIN.byPass) {
      // Cập nhật các trường còn lại nếu có
      if (lastName) user.lastName = lastName.trim();
      if (firstName) user.firstName = firstName.trim();
    }
    if (username) {
      const findUserByUsername = await User.findOne({ username: username });
      if (findUserByUsername) {
        throwError("Username is already exits", 429);
      }
      user.username = username.trim();
    }
    if (sex) user.sex = sex;

    await user.save({ validateModifiedOnly: true });

    return res.status(200).json({
      status: true,
      message: "User info updated successfully",
    });
  } catch (error) {
    next(error);
  }
};

// Upload avatar
exports.upLoadAvatar = async (req, res, next) => {
  try {
    const { userId } = req.user;
    let oldImageId = null;

    // Kiểm tra nếu không có file
    if (!req.files.avatar || req.files.avatar.length === 0) {
      throwError("Avatar file not found");
    }

    const fileImage = req.files.avatar[0];

    const allowedTypes = ["image/jpeg", "image/jpg", "image/png", "image/gif"];
    if (!allowedTypes.includes(fileImage.mimetype)) {
      await cloudinary.uploader.destroy(fileImage.filename);
      return throwError(
        "Only .jpeg, .jpg, .png, and .gif formats are allowed!"
      );
    }

    const user = await User.findById(userId);
    if (user?.avatar?.id) {
      oldImageId = user.avatar.id;
    }

    user.avatar = {
      id: fileImage.filename,
      url: fileImage.path,
    };
    await user.save({ validateModifiedOnly: true });

    if (oldImageId) {
      await cloudinary.uploader.destroy(oldImageId);
    }

    return res.status(200).json({
      status: true,
      message: "Upload avatar successfully",
    });
  } catch (error) {
    next(error);
  }
};

// Remove or add movie
exports.toggleFavoriteMovie = async (req, res, next) => {
  try {
    const { userId } = req.user;
    const { movieId, action } = req.body;

    if (!["add", "remove"].includes(action)) {
      throwError("Invalid action. Use 'add' or 'remove'");
    }

    const movie = await DetailMovie.findById(movieId);
    if (!movie) {
      throwError("Movie not found");
    }

    const user = await User.findById(userId);

    const index = user.favoriteMovies.findIndex(
      (fav) => fav.movieId.toString() === movieId.toString()
    );

    if (action === "add") {
      if (index !== -1) {
        throwError("Movie has already been added to favorites list");
      }
      user.favoriteMovies.push({ movieId });
    } else if (action === "remove") {
      if (index === -1) {
        throwError("Movie is not in favorites list");
      }
      user.favoriteMovies.splice(index, 1);
    }

    await user.save({ validateModifiedOnly: true });
    // 🟢 Cập nhật Redis
    const cacheKey = `profile:${userId}:type-3`;
    await redis.deleteCache(cacheKey); // Xóa cache danh sách phim yêu thích để lần sau lấy mới

    return res.status(200).json({
      status: true,
      message: `Movie ${
        action === "add" ? "added to" : "removed from"
      } favorites successfully`,
    });
  } catch (error) {
    next(error);
  }
};

// Removie Device
exports.removeDeviceManagement = async (req, res, next) => {
  try {
    const { userId } = req.user;
    const { deviceId } = req.body;

    const user = await User.findById(userId);

    const deviceIndex = user.deviceManagement.findIndex(
      (device) => device.deviceId.toString() === deviceId.toString()
    );

    if (deviceIndex === -1) {
      throwError("Device not found");
    }

    user.deviceManagement.splice(deviceIndex, 1);

    await user.save({ validateModifiedOnly: true });

    return res.status(200).json({
      status: true,
      message: "Device removed successfully",
    });
  } catch (error) {
    next(error);
  }
};

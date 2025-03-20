const User = require("../models/UserModel");
const moment = require("moment");
const cloudinary = require("cloudinary").v2;

const { DetailMovie } = require("../models/DetailMovieModel");
const BIll = require("../models/BillModel");
const { PATH_IMAGE, TYPE_LOGIN } = require("../config/CONSTANT");
const throwError = require("../utils/throwError");

// Get Profile
exports.getProfile = async (req, res, next) => {
  try {
    const { userId, typeLogin } = req.user;
    const { type } = req.query;

    const user = await User.findById(userId).lean();

    switch (type) {
      case "0":
        const getUserInfoByGoogle = (user) => ({
          avatar: user.inforAccountGoogle.avatar,
          email: user.email,
          firstName: user.inforAccountGoogle.firstName,
          lastName: user.inforAccountGoogle.lastName,
          birthDay: user.birthDay,
          sex: user.sex,
          username: user.username,
          phoneNumber: user.phoneNumber,
        });

        const getUserInfoByPass = (user) => ({
          avatar: user.avatar,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          birthDay: user.birthDay,
          sex: user.sex,
          username: user.username,
          phoneNumber: user.phoneNumber,
        });

        let dataInforAcc = {};

        if (typeLogin === TYPE_LOGIN.byGoogle) {
          dataInforAcc = getUserInfoByGoogle(user);
        } else if (typeLogin === TYPE_LOGIN.byPass) {
          dataInforAcc = getUserInfoByPass(user);
        } else {
          throwError("Invalid type login");
        }

        return res.status(200).json({
          status: true,
          data: dataInforAcc,
          message: "Get info successfully",
        });
      case "1":
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

        const formattedBills = bills.map((bill) => ({
          ...bill,
          createdAt: moment(bill.createdAt)
            .utcOffset("+07:00")
            .format("YYYY-MM-DD HH:mm:ss"),
        }));

        return res.status(200).json({
          status: true,
          data: formattedBills,
          message: "Get history purchase successfully",
          currentPage: parseInt(page),
          totalPages,
          totalItems,
        });
      case "2":
        user.purchasedMoviesMonth = user.purchasedMoviesMonth.map((movie) => ({
          ...movie,
          isExpired: moment().isAfter(
            moment(movie.exprationDate, "DD/MM/YYYY")
          ),
        }));
        return res.status(200).json({
          status: true,
          data: user.purchasedMoviesMonth,
          message: "Get history pack month successfully",
        });
      case "3":
        const dataFavoriteMovie = await Promise.all(
          user.favoriteMovies.map(async (movie) => {
            const movieDetailDB = await DetailMovie.findById(movie.movieId)
              .select(
                "name slug origin_name thumb_url poster_url year episode_current quality __t tmdb quality"
              )
              .lean();

            return {
              _id: movie._id,
              ...(movieDetailDB || {}),
            };
          })
        );

        return res.status(200).json({
          status: true,
          data: dataFavoriteMovie,
          pathImage: PATH_IMAGE,
          message: "Get favorite movie successfully",
        });
      case "4":
        const dataMovieRent = await Promise.all(
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
        return res.status(200).json({
          status: true,
          data: dataMovieRent,
          pathImage: PATH_IMAGE,
          message: "Get pack movie rent successfully",
        });
      case "5":
        return res.status(200).json({
          status: true,
          data: user.deviceManagement,
          message: "Get device management successfully",
        });
      default:
        throwError("Invalid Type");
    }
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

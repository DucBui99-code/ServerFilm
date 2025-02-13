const User = require("../models/UserModel");
const { DetailMovie } = require("../models/DetailMovieModel");
const moment = require("moment");
const { PATH_IMAGE } = require("../config/CONSTANT");

// Get Profile
exports.getProfile = async (req, res) => {
  try {
    const { userId } = req.user;
    const { type } = req.query;

    const user = await User.findById(userId);

    switch (type) {
      case "0":
        const dataInforAcc = {};
        dataInforAcc.avatar = user.avatar;
        dataInforAcc.email = user.email;
        dataInforAcc.firstLastName = user.firstLastName;
        dataInforAcc.username = user.username;
        dataInforAcc.birthDay = user.birthDay;
        dataInforAcc.sex = user.sex;
        dataInforAcc.phoneNumber = user.phoneNumber;

        return res.status(200).json({
          status: true,
          data: dataInforAcc,
          message: "Get infor successfully",
        });
      case "1":
        return res.status(200).json({
          status: true,
          data: user.purchasedHistory,
          message: "Get history purchase successfully",
        });
      case "2":
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
                "name slug origin_name thumb_url poster_url year episode_current quality"
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
              .select("name origin_name thumb_url poster_url price duration")
              .lean();

            return {
              _id: movie._id,
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
        return res.status(400).json({
          status: false,
          message: ["Invalid Type"],
        });
    }
  } catch (error) {
    return res.status(500).json({
      status: false,
      message: ["Internal server error", error.message],
    });
  }
};

// Update user information
exports.updateInformation = async (req, res) => {
  try {
    const { userId } = req.user;
    const { username, firstLastName, phoneNumber, birthDay, sex } = req.body;

    if (!username && !firstLastName && !phoneNumber && !birthDay && !sex) {
      return res.status(400).json({
        status: false,
        message: ["Not found information to update"],
      });
    }

    const user = await User.findById(userId);

    if (phoneNumber) {
      const checkPhoneNumber = await User.findOne({ phoneNumber: phoneNumber });
      if (checkPhoneNumber) {
        return res.status(429).json({
          status: false,
          message: ["Phone number is already exit"],
        });
      }
      user.phoneNumber = phoneNumber.trim();
    }
    // Kiểm tra định dạng birthDay
    if (birthDay) {
      if (!moment(birthDay, "DD/MM/YYYY", true).isValid()) {
        return res.status(400).json({
          status: false,
          message: ["Invalid birthDay format. Use DD/MM/YYYY"],
        });
      }

      // Kiểm tra birthDay không nằm trong tương lai
      if (moment(birthDay, "DD/MM/YYYY").isAfter(moment())) {
        return res.status(400).json({
          status: false,
          message: ["BirthDay cannot be in the future"],
        });
      }

      user.birthDay = birthDay;
    }

    // Cập nhật các trường còn lại nếu có
    if (username) user.username = username.trim();
    if (firstLastName) user.firstLastName = firstLastName.trim();
    if (sex) user.sex = sex;

    await user.save({ validateModifiedOnly: true });

    return res.status(200).json({
      status: true,
      message: "User info updated successfully",
    });
  } catch (error) {
    return res.status(500).json({
      status: false,
      message: ["Internal server error", error.message],
    });
  }
};

// Upload avatar
exports.upLoadAvatar = async (req, res) => {
  try {
    const { userId } = req.user;
    let oldImageId = null;

    // Kiểm tra nếu không có file
    if (!req.files.avatar || req.files.avatar.length === 0) {
      return res.status(400).json({
        status: false,
        message: "Avatar file not found",
      });
    }

    const fileImage = req.files.avatar[0];

    const allowedTypes = ["image/jpeg", "image/jpg", "image/png", "image/gif"];
    if (!allowedTypes.includes(fileImage.mimetype)) {
      await cloudinary.uploader.destroy(fileImage.filename);
      return res.status(400).json({
        status: false,
        message: "Only .jpeg, .jpg, .png, and .gif formats are allowed!",
      });
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
    return res.status(500).json({
      status: false,
      message: ["Internal server error", error.message],
    });
  }
};

// Remove or add movie
exports.toggleFavoriteMovie = async (req, res) => {
  try {
    const { userId } = req.user;
    const { movieId, action } = req.body;

    if (!["add", "remove"].includes(action)) {
      return res.status(400).json({
        message: ["Invalid action. Use 'add' or 'remove'"],
        status: false,
      });
    }

    const movie = await DetailMovie.findById(movieId);
    if (!movie) {
      return res.status(404).json({
        message: ["Movie not found"],
        status: false,
      });
    }

    const user = await User.findById(userId);

    const index = user.favoriteMovies.findIndex(
      (fav) => fav.movieId.toString() === movieId.toString()
    );

    if (action === "add") {
      if (index !== -1) {
        return res.status(400).json({
          message: ["Movie has already been added to favorites list"],
          status: false,
        });
      }
      user.favoriteMovies.push({ movieId });
    } else if (action === "remove") {
      if (index === -1) {
        return res.status(400).json({
          message: ["Movie is not in favorites list"],
          status: false,
        });
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
    return res.status(500).json({ message: error.message, status: false });
  }
};

// Removie Device
exports.removeDeviceManagement = async (req, res) => {
  try {
    const { userId } = req.user;
    const { deviceId } = req.body;

    const user = await User.findById(userId);

    const deviceIndex = user.deviceManagement.findIndex(
      (device) => device.deviceId.toString() === deviceId.toString()
    );

    if (deviceIndex === -1) {
      return res.status(404).json({
        message: ["Device not found"],
        status: false,
      });
    }

    user.deviceManagement.splice(deviceIndex, 1);

    await user.save({ validateModifiedOnly: true });

    return res.status(200).json({
      status: true,
      message: "Device removed successfully",
    });
  } catch (error) {
    return res.status(500).json({ message: error.message, status: false });
  }
};

const User = require("../models/UserModel");
const cloudinary = require("cloudinary").v2;
const { DetailMovie } = require("../models/DetailMovieModel");
const moment = require("moment");
const { PATH_IMAGE, TYPE_LOGIN } = require("../config/CONSTANT");

// Get Profile
exports.getProfile = async (req, res) => {
  try {
    const { userId, typeLogin } = req.user;
    const { type } = req.query;

    const user = await User.findById(userId);

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
          return res.status(400).json({
            status: false,
            message: "Invalid type login",
          });
        }

        return res.status(200).json({
          status: true,
          data: dataInforAcc,
          message: "Get info successfully",
        });
      case "1":
        return res.status(200).json({
          status: true,
          data: user.purchasedHistory,
          message: "Get history purchase successfully",
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
        return res.status(400).json({
          status: false,
          message: "Invalid Type",
        });
    }
  } catch (error) {
    return res.status(500).json({
      status: false,
      message: error.message,
    });
  }
};

// Update user information
exports.updateInformation = async (req, res) => {
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
      return res.status(400).json({
        status: false,
        message: "Not found information to update",
      });
    }

    const user = await User.findById(userId);

    if (phoneNumber) {
      const checkPhoneNumber = await User.findOne({ phoneNumber: phoneNumber });
      if (checkPhoneNumber) {
        return res.status(429).json({
          status: false,
          message: "Phone number is already exit",
        });
      }

      user.phoneNumber = phoneNumber.trim();
    }

    // Kiểm tra định dạng birthDay
    if (birthDay) {
      if (!moment(birthDay, "MM/DD/YYYY", true).isValid()) {
        return res.status(400).json({
          status: false,
          message: "Invalid birthDay format. Use MM/DD/YYYY",
        });
      }

      // Kiểm tra birthDay không nằm trong tương lai
      if (moment(birthDay, "MM/DD/YYYY").isAfter(moment())) {
        return res.status(400).json({
          status: false,
          message: "BirthDay cannot be in the future",
        });
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
        return res.status(429).json({
          status: false,
          message: "Username is already exits",
        });
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
    return res.status(500).json({
      status: false,
      message: error.message,
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
      message: error.message,
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
        message: "Invalid action. Use 'add' or 'remove'",
        status: false,
      });
    }

    const movie = await DetailMovie.findById(movieId);
    if (!movie) {
      return res.status(404).json({
        message: "Movie not found",
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
          message: "Movie has already been added to favorites list",
          status: false,
        });
      }
      user.favoriteMovies.push({ movieId });
    } else if (action === "remove") {
      if (index === -1) {
        return res.status(400).json({
          message: "Movie is not in favorites list",
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
        message: "Device not found",
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

// Comment Movie
exports.commentMovie = async (req, res) => {
  try {
    const { userId } = req.user;
    const { content, movieId } = req.body;

    if (!movieId || !content || !content.trim()) {
      return res
        .status(400)
        .json({ message: "movieId and content are required", status: false });
    }

    const detailMovie = await DetailMovie.findById(movieId);
    if (!detailMovie) {
      return res
        .status(404)
        .json({ message: "Not found detailMovie", status: false });
    }

    const commentMovie = {
      user: userId,
      content,
      time: new Date().toISOString(),
      edited: false,
      likes: 0,
      disLikes: 0,
      replies: [],
    };

    detailMovie.comments.push(commentMovie);
    await detailMovie.save({ validateModifiedOnly: true });
    return res
      .status(201)
      .json({ message: "Comment added successfully", status: true });
  } catch (error) {
    return res.status(500).json({ message: error.message, status: false });
  }
};

exports.editCommentMovie = async (req, res) => {
  try {
    const { userId } = req.user;
    const { movieId, content, commentId } = req.body;
    if (!movieId || !content || !content.trim()) {
      return res
        .status(400)
        .json({ message: "movieId and content are required", status: false });
    }

    const detailMovie = await DetailMovie.findById(movieId);

    if (!detailMovie) {
      return res
        .status(404)
        .json({ message: "Not found detailMovie", status: false });
    }

    const indexCommentById = detailMovie.comments.findIndex(
      (comment) => comment._id.toString() === commentId.toString()
    );

    if (indexCommentById < 0) {
      return res
        .status(404)
        .json({ message: "Not found comment to edit", status: false });
    }

    const commentMovie = detailMovie.comments[indexCommentById];

    if (commentMovie.user.toString() !== userId.toString()) {
      return res
        .status(400)
        .json({ message: "This is not your comment", status: false });
    }

    detailMovie.comments[indexCommentById].content = content;
    detailMovie.comments[indexCommentById].time = Date.now();
    detailMovie.comments[indexCommentById].edited = true;

    await detailMovie.save({ validateModifiedOnly: true });
    return res
      .status(200)
      .json({ message: "Edit comment successfully", status: true });
  } catch (error) {
    return res.status(500).json({ message: error.message, status: false });
  }
};

exports.deleteCommentMovie = async (req, res) => {
  try {
    const { userId } = req.user;
    const { movieId, commentId } = req.body;

    if (!movieId || !commentId) {
      return res.status(400).json({
        message: "movieId and commentId are required",
        status: false,
      });
    }

    const detailMovie = await DetailMovie.findById(movieId);

    if (!detailMovie) {
      return res
        .status(404)
        .json({ message: "Not found detailMovie", status: false });
    }

    const indexCommentById = detailMovie.comments.findIndex(
      (comment) => comment._id.toString() === commentId.toString()
    );

    if (indexCommentById < 0) {
      return res
        .status(404)
        .json({ message: "Not found comment to delete", status: false });
    }

    const commentMovie = detailMovie.comments[indexCommentById];

    if (commentMovie.user.toString() !== userId.toString()) {
      return res
        .status(403)
        .json({ message: "This is not your comment", status: false });
    }

    // Xóa comment khỏi mảng comments
    detailMovie.comments.splice(indexCommentById, 1);

    await detailMovie.save({ validateModifiedOnly: true });

    return res
      .status(200)
      .json({ message: "Delete comment successfully", status: true });
  } catch (error) {
    return res.status(500).json({ message: error.message, status: false });
  }
};

exports.replyComment = async (req, res) => {
  try {
    const { userId } = req.user;
    const { movieId, commentId, content, replyTo } = req.body;

    if (!movieId || !commentId || !content || !content.trim()) {
      return res.status(400).json({
        message: "movieId, commentId, and content are required",
        status: false,
      });
    }

    const detailMovie = await DetailMovie.findById(movieId);
    if (!detailMovie) {
      return res
        .status(404)
        .json({ message: "Not found detailMovie", status: false });
    }

    // Tìm comment gốc
    const comment = detailMovie.comments.find(
      (comment) => comment._id.toString() === commentId.toString()
    );

    if (!comment) {
      return res
        .status(404)
        .json({ message: "Not found comment to reply", status: false });
    }

    // Tạo reply mới
    const newReply = {
      content,
      user: userId,
      time: Date.now(),
      edited: false,
      likes: 0,
      disLikes: 0,
    };

    // Nếu có `replyTo`, kiểm tra xem `replyTo` có tồn tại trong `replies[]` không
    if (replyTo) {
      const replyToData = comment.replies.find(
        (reply) => reply._id.toString() === replyTo.toString()
      );

      if (
        replyToData &&
        replyToData.user.toString() !== userId.toString() &&
        replyToData.user.toString() !== comment.user.toString()
      ) {
        newReply.replyTo = replyToData.user; // Chỉ gán nếu `replyTo` hợp lệ
      }
    }

    // Thêm vào danh sách `replies`
    comment.replies.push(newReply);

    // Lưu lại thay đổi
    await detailMovie.save({ validateModifiedOnly: true });

    return res.status(201).json({
      message: "Reply added successfully",
      status: true,
      reply: newReply, // Trả về reply mới để frontend cập nhật
    });
  } catch (error) {
    return res.status(500).json({ message: error.message, status: false });
  }
};

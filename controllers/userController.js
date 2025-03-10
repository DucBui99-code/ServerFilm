const User = require("../models/UserModel");
const moment = require("moment");
const cloudinary = require("cloudinary").v2;

const { CommentMovie } = require("../models/CommentModel");
const { DetailMovie } = require("../models/DetailMovieModel");
const {
  PATH_IMAGE,
  TYPE_LOGIN,
  ACTION_COMMENT_TYPE,
  COMMENT_TYPE,
} = require("../config/CONSTANT");
const throwError = require("../utils/throwError");

// Get Profile
exports.getProfile = async (req, res, next) => {
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
        const { page = 1, limit = 10 } = req.query;
        const startIndex = (page - 1) * limit;
        const endIndex = page * limit;

        const paginatedHistory = user.purchasedHistory
          .slice()
          .reverse()
          .slice(startIndex, endIndex);

        return res.status(200).json({
          status: true,
          data: paginatedHistory,
          message: "Get history purchase successfully",
          currentPage: page,
          totalPages: Math.ceil(user.purchasedHistory.length / limit),
          totalItems: user.purchasedHistory.length,
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
    next(error);
  }
};

// Remove or add movie
exports.toggleFavoriteMovie = async (req, res, next) => {
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
    next(error);
  }
};

exports.commentMovie = async (req, res, next) => {
  try {
    const { userId, typeLogin } = req.user;
    const { content, movieId, type, commentId, replyTo } = req.body;

    if (!movieId || !content || !content.trim()) {
      throwError("movieId and content are required");
    }

    const movieExists = await DetailMovie.exists({ _id: movieId });
    if (!movieExists) {
      throwError("Not found movie to comment");
    }

    let movieComments = await CommentMovie.findOne({ movieId });
    if (!movieComments) {
      movieComments = new CommentMovie({ movieId, comments: [] });
    }

    let newCommentOrReply;
    if (type === COMMENT_TYPE.comment) {
      newCommentOrReply = {
        user: userId,
        content,
        likes: 0,
        disLikes: 0,
        time: Date.now(),
        edited: false,
        replies: [],
        typeComment: typeLogin,
      };
      movieComments.comments.push(newCommentOrReply);
    } else if (type === COMMENT_TYPE.reply) {
      if (!commentId) {
        throwError("commentId is required for replies");
      }

      const comment = movieComments.comments.id(commentId);
      if (!comment) {
        throwError("Not found comment to reply");
      }

      newCommentOrReply = {
        user: userId,
        content,
        time: Date.now(),
        edited: false,
        likes: 0,
        disLikes: 0,
        typeComment: typeLogin,
      };

      if (replyTo) {
        const replyToData = comment.replies.id(replyTo);
        if (replyToData && replyToData.user.toString() !== userId.toString()) {
          newCommentOrReply.replyTo = replyToData.user;
        }
      }

      comment.replies.push(newCommentOrReply);
    } else {
      throwError("Invalid type. Use 'comment' or 'reply'");
    }

    await movieComments.save({ validateModifiedOnly: true });

    const savedCommentOrReply =
      type === COMMENT_TYPE.comment
        ? movieComments.comments[movieComments.comments.length - 1]
        : movieComments.comments.id(commentId).replies[
            movieComments.comments.id(commentId).replies.length - 1
          ];

    const userDetails = await getUserDetails(
      userId,
      savedCommentOrReply.typeComment
    );

    return res.status(201).json({
      message: `${type} added successfully`,
      status: true,
      data: {
        ...savedCommentOrReply.toObject(),
        userDetails,
      },
    });
  } catch (error) {
    next(error);
  }
};

exports.editCommentMovie = async (req, res, next) => {
  try {
    const { userId } = req.user;
    const { movieId, content, commentId, type, replyId, replyTo } = req.body;

    if (!movieId || !content || !content.trim()) {
      throwError("movieId and content are required");
    }

    const commentMovieDb = await CommentMovie.findOne({ movieId });

    if (!commentMovieDb) {
      throwError("Not found commentMovie");
    }

    if (type === COMMENT_TYPE.comment) {
      // 🔹 Tìm comment trong danh sách comments
      const comment = commentMovieDb.comments.id(commentId);
      if (!comment) {
        throwError("Not found comment to edit");
      }

      // 🔹 Kiểm tra quyền chỉnh sửa
      if (comment.user.toString() !== userId.toString()) {
        throwError("This is not your comment");
      }

      // 🔹 Cập nhật nội dung comment
      comment.content = content;
      comment.time = Date.now();
      comment.edited = true;
    } else if (type === COMMENT_TYPE.reply) {
      if (!replyId) {
        throwError("Not found replyId");
      }

      // 🔹 Tìm comment chứa reply
      const comment = commentMovieDb.comments.id(commentId);
      if (!comment) {
        throwError("Not found comment to edit reply");
      }

      // 🔹 Tìm reply trong danh sách replies
      const reply = comment.replies.id(replyId);
      if (!reply) {
        throwError("Not found reply to edit");
      }

      // 🔹 Kiểm tra quyền chỉnh sửa
      if (reply.user.toString() !== userId.toString()) {
        throwError("This is not your reply");
      }

      // 🔹 Cập nhật nội dung reply
      reply.content = content;
      reply.time = Date.now();
      reply.edited = true;

      // 🔹 Nếu có `replyTo`, kiểm tra và cập nhật
      if (replyTo) {
        const replyToData = comment.replies.id(replyTo);
        if (replyToData && replyToData.user.toString() !== userId.toString()) {
          reply.replyTo = replyToData.user;
        }
      }
    } else {
      throwError("Invalid type. Use 'comment' or 'reply'");
    }

    // 🔹 Lưu thay đổi vào database
    await commentMovieDb.save({ validateModifiedOnly: true });

    return res
      .status(200)
      .json({ message: `Edit ${type} successfully`, status: true });
  } catch (error) {
    next(error);
  }
};

exports.deleteCommentMovie = async (req, res, next) => {
  try {
    const { userId } = req.user;
    const { movieId, commentId, type, replyId } = req.body;

    if (!movieId || !commentId) {
      throwError("movieId and commentId are required");
    }

    const commentMovieDb = await CommentMovie.findOne({ movieId });
    if (!commentMovieDb) {
      throwError("Not found Comment");
    }

    if (type === COMMENT_TYPE.comment) {
      // 🔹 Tìm comment theo id
      const comment = commentMovieDb.comments.id(commentId);
      if (!comment) {
        return res
          .status(404)
          .json({ message: "Not found comment to delete", status: false });
      }

      // 🔹 Kiểm tra quyền sở hữu
      if (comment.user.toString() !== userId.toString()) {
        throwError("This is not your comment");
      }

      // 🔹 Xóa comment
      comment.deleteOne();
    } else if (type === COMMENT_TYPE.reply) {
      if (!replyId) {
        throwError("Not found replyId");
      }

      // 🔹 Tìm comment chứa reply
      const comment = commentMovieDb.comments.id(commentId);
      if (!comment) {
        throwError("Not found comment to delete reply");
      }

      // 🔹 Tìm reply trong danh sách replies
      const reply = comment.replies.id(replyId);
      if (!reply) {
        throwError("Not found reply to delete");
      }

      // 🔹 Kiểm tra quyền sở hữu
      if (reply.user.toString() !== userId.toString()) {
        throwError("This is not your reply");
      }

      // 🔹 Xóa reply
      reply.deleteOne();
    } else {
      throwError("Invalid type. Use 'comment' or 'reply'");
    }

    await commentMovieDb.save({ validateModifiedOnly: true });

    return res
      .status(200)
      .json({ message: `Delete ${type} successfully`, status: true });
  } catch (error) {
    next(error);
  }
};

exports.likeOrDislikeComment = async (req, res, next) => {
  try {
    const { movieId, commentId, typeAction, type, replyId } = req.body;
    const { userId } = req.user;

    if (
      !userId ||
      !movieId ||
      !commentId ||
      ![ACTION_COMMENT_TYPE.like, ACTION_COMMENT_TYPE.disLike].includes(
        typeAction
      )
    ) {
      throwError("Invalid request data");
    }

    const movieComments = await CommentMovie.findOne({ movieId });
    if (!movieComments) {
      throwError("Comments not found");
    }

    let comment, reactionTarget;

    if (type === COMMENT_TYPE.comment) {
      comment = movieComments.comments.id(commentId);
      if (!comment) {
        throwError("Comment not found");
      }
      reactionTarget = comment;
    } else if (type === COMMENT_TYPE.reply) {
      if (!replyId) {
        throwError("replyId is required for replies");
      }
      comment = movieComments.comments.id(commentId);
      if (!comment) {
        throwError("Comment not found");
      }
      const reply = comment.replies.id(replyId);
      if (!reply) {
        throwError("Reply not found");
      }
      reactionTarget = reply;
    } else {
      throwError("Invalid type. Use 'comment' or 'reply'");
    }

    const hasLiked = reactionTarget.likesRef.includes(userId);
    const hasDisliked = reactionTarget.disLikesRef.includes(userId);

    const updateReaction = (add, remove, countField, refField) => {
      if (add) {
        reactionTarget[refField].push(userId);
        reactionTarget[countField] += 1;
      } else {
        reactionTarget[refField] = reactionTarget[refField].filter(
          (id) => id.toString() !== userId
        );
        reactionTarget[countField] -= 1;
      }
    };

    if (typeAction === ACTION_COMMENT_TYPE.like) {
      updateReaction(!hasLiked, hasDisliked, "likes", "likesRef");
      if (hasDisliked) {
        updateReaction(false, true, "disLikes", "disLikesRef");
      }
    } else if (typeAction === ACTION_COMMENT_TYPE.disLike) {
      updateReaction(!hasDisliked, hasLiked, "disLikes", "disLikesRef");
      if (hasLiked) {
        updateReaction(false, true, "likes", "likesRef");
      }
    }

    await movieComments.save({ validateModifiedOnly: true });

    res.status(200).json({
      message: `${typeAction} ${type} successful`,
      status: true,
      likes: reactionTarget.likes,
      disLikes: reactionTarget.disLikes,
    });
  } catch (error) {
    next(error);
  }
};

const getUserDetails = async (userId, typeComment) => {
  const user = await User.findById(userId).lean();
  if (!user) {
    return {
      username: "Unknown User",
      avatar: null,
    };
  }

  return {
    username: user.username || "Unknown User",
    avatar:
      typeComment === "byGoogle"
        ? user?.inforAccountGoogle?.avatar?.url
        : user?.avatar?.url || null,
  };
};

const { COMMENT_TYPE, ACTION_COMMENT_TYPE } = require("../config/CONSTANT");
const Comment = require("../models/CommentModel");
const Reply = require("../models/ReplyCommentModel");
const { DetailMovie } = require("../models/DetailMovieModel");
const Notification = require("../models/NotificationModel");
const User = require("../models/UserModel");
const throwError = require("../utils/throwError");
const { getIo } = require("../config/socket");

exports.getCommentsByMovie = async (req, res, next) => {
  try {
    const { movieId } = req.params;
    const { page = 1, limit = 5 } = req.query;

    const pageNumber = Math.max(parseInt(page), 1);
    const limitNumber = Math.max(parseInt(limit), 1);
    const skip = (pageNumber - 1) * limitNumber;

    // 🔹 Lấy danh sách comment theo movieId (phân trang)
    const comments = await Comment.find({ movieId })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNumber)
      .lean();

    if (comments.length === 0) {
      return res.status(200).json({
        comments: [],
        totalItems: 0,
        currentPage: pageNumber,
        totalPages: 0,
        isLastPage: true,
      });
    }
    // 🔹 Lấy tổng số comment (không tính reply) TRƯỚC KHI kiểm tra comments.length
    const totalItems = await Comment.countDocuments({ movieId });

    // 🔹 Lấy số lượng reply của mỗi comment
    const commentIds = comments.map((c) => c._id);
    const replyCounts = await Reply.aggregate([
      { $match: { commentId: { $in: commentIds } } },
      { $group: { _id: "$commentId", count: { $sum: 1 } } },
    ]);

    // 🔹 Tạo map số lượng reply
    const replyCountMap = {};
    replyCounts.forEach((item) => {
      replyCountMap[item._id.toString()] = item.count;
    });

    // 🔹 Gom tất cả userId từ comment
    const userIds = new Set();
    comments.forEach((c) => userIds.add(c.user.toString()));

    // 🔹 Truy vấn thông tin user một lần
    const users = await User.find({ _id: { $in: [...userIds] } }).lean();
    const userMap = {};
    users.forEach((user) => {
      userMap[user._id.toString()] = user;
    });

    // 🔹 Định dạng dữ liệu gửi về client
    const formattedComments = comments.map((comment) => ({
      ...comment,
      userDetails: {
        avatar:
          comment.typeComment === "byGoogle"
            ? userMap[comment.user.toString()]?.inforAccountGoogle?.avatar?.url
            : userMap[comment.user.toString()]?.avatar?.url || null,
        username: userMap[comment.user.toString()]?.username || "Unknown User",
        sex: userMap[comment.user.toString()]?.sex || "other",
      },
      replyCount: replyCountMap[comment._id.toString()] || 0,
    }));

    const totalPages = Math.ceil(totalItems / limitNumber);
    const isLastPage = pageNumber >= totalPages;

    res.status(200).json({
      comments: formattedComments,
      totalItems,
      currentPage: pageNumber,
      totalPages,
      isLastPage,
    });
  } catch (error) {
    next(error);
  }
};

exports.getRepliesByComment = async (req, res, next) => {
  try {
    const { commentId } = req.params;
    const { page = 1, limit = 5 } = req.query;

    const pageNumber = Math.max(parseInt(page), 1);
    const limitNumber = Math.max(parseInt(limit), 1);
    const skip = (pageNumber - 1) * limitNumber;

    // 🔹 Lấy danh sách reply theo commentId (phân trang)
    const replies = await Reply.find({ commentId })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNumber)
      .lean();

    if (replies.length === 0) {
      return res.status(200).json({
        replies: [],
        totalItems: 0,
        currentPage: pageNumber,
        isLastPage: true,
      });
    }
    // 🔹 Lấy tổng số comment (không tính reply) TRƯỚC KHI kiểm tra comments.length
    const totalItems = await Comment.countDocuments({ commentId });

    // 🔹 Gom tất cả userId từ reply và replyTo
    const userIds = new Set();
    replies.forEach((r) => {
      userIds.add(r.user.toString());
      if (r.replyTo) userIds.add(r.replyTo.toString());
    });

    // 🔹 Truy vấn thông tin user một lần
    const users = await User.find({ _id: { $in: [...userIds] } }).lean();
    const userMap = {};
    users.forEach((user) => {
      userMap[user._id.toString()] = user;
    });

    // 🔹 Định dạng dữ liệu gửi về client
    const formattedReplies = replies.map((reply) => ({
      ...reply,
      userDetails: {
        avatar:
          reply.typeComment === "byGoogle"
            ? userMap[reply.user.toString()]?.inforAccountGoogle?.avatar?.url
            : userMap[reply.user.toString()]?.avatar?.url || null,
        username: userMap[reply.user.toString()]?.username || "Unknown User",
        sex: userMap[reply.user.toString()]?.sex || "other",
      },
      replyToUsername: reply.replyTo
        ? userMap[reply.replyTo.toString()]?.username || "Unknown User"
        : null,
    }));

    const totalPages = Math.ceil(totalItems / limitNumber);
    const isLastPage = pageNumber >= totalPages;

    res.status(200).json({
      replies: formattedReplies,
      totalPages,
      currentPage: pageNumber,
      isLastPage,
      totalItems,
    });
  } catch (error) {
    next(error);
  }
};

exports.addCommentOrReply = async (req, res, next) => {
  try {
    const { userId, typeLogin } = req.user;
    const { content, movieId, type, commentId, replyId, isTagName } = req.body;

    if (!content || !content.trim()) {
      throwError("Content is required");
    }

    let newCommentOrReply;
    let userDetails = null;

    let replyToUser = {
      username: null,
      movieId: null,
    };

    // 🔹 Lấy thông tin người dùng
    const user = await User.findById(userId).select("avatar username").lean();
    if (user) {
      userDetails = {
        avatar: user?.avatar?.url || null,
        username: user.username,
      };
    }

    if (type === COMMENT_TYPE.comment) {
      if (!movieId) {
        throwError("movieId is required");
      }

      // 🔹 Kiểm tra xem phim có tồn tại không
      const movieExists = await DetailMovie.exists({ _id: movieId }).lean();
      if (!movieExists) {
        throwError("Movie not found");
      }

      // 🔹 Tạo comment mới
      newCommentOrReply = await Comment.create({
        movieId,
        user: userId,
        content,
        time: Date.now(),
        typeComment: typeLogin,
      });
    } else if (type === COMMENT_TYPE.reply) {
      if (!commentId) {
        throwError("commentId is required for replies");
      }

      // 🔹 Kiểm tra xem comment có tồn tại không
      const comment = await Comment.findById(commentId).lean();
      if (!comment) {
        throwError("Comment not found");
      }

      let finalReplyTo = null;

      if (replyId) {
        const replyTarget = await Reply.findById(replyId)
          .populate({
            path: "commentId",
            select: "movieId user",
            populate: {
              path: "user",
              select: "username",
            },
          })
          .lean();

        if (
          !replyTarget ||
          replyTarget.commentId._id.toString() !== commentId
        ) {
          throwError("Reply target not found");
        }

        if (
          isTagName &&
          replyTarget.user._id.toString() !== userId.toString()
        ) {
          finalReplyTo = replyTarget.user;
          replyToUser.username = replyTarget.commentId.user?.username;
          replyToUser.movieId = replyTarget.commentId?.movieId;
        }
      }

      // 🔹 Tạo reply mới
      newCommentOrReply = await Reply.create({
        commentId,
        user: userId,
        content,
        time: Date.now(),
        typeComment: typeLogin,
        replyTo: finalReplyTo,
      });

      if (finalReplyTo) {
        await sendNotification(
          finalReplyTo,
          userId,
          content,
          replyToUser.movieId,
          COMMENT_TYPE.reply,
          typeLogin
        );
      }
    } else {
      throwError("Invalid type. Use 'comment' or 'reply'");
    }

    return res.status(201).json({
      message: `${type} added successfully`,
      status: true,
      data: {
        ...newCommentOrReply.toObject(),
        userDetails,
        replyToUsername: replyToUser.username,
      },
    });
  } catch (error) {
    next(error);
  }
};

exports.editCommentOrReply = async (req, res, next) => {
  try {
    const { userId } = req.user;
    const { content, commentId, replyId, type } = req.body;

    if (!content || !content.trim()) {
      throwError("Content is required");
    }

    if (type === COMMENT_TYPE.comment) {
      // 🔹 Cập nhật comment
      const updatedComment = await Comment.findOneAndUpdate(
        { _id: commentId, user: userId },
        {
          $set: {
            content: content,
            time: Date.now(),
            edited: true,
          },
        },
        { new: true }
      );

      if (!updatedComment) {
        throwError("Not found comment or no permission to edit");
      }

      return res.status(200).json({
        message: "Edit comment successfully",
        status: true,
      });
    } else if (type === COMMENT_TYPE.reply) {
      // 🔹 Cập nhật reply từ model riêng
      const updatedReply = await Reply.findOneAndUpdate(
        { _id: replyId, user: userId },
        {
          $set: {
            content: content,
            time: Date.now(),
            edited: true,
          },
        },
        { new: true }
      );

      if (!updatedReply) {
        throwError("Not found reply or no permission to edit");
      }

      return res.status(200).json({
        message: "Edit reply successfully",
        status: true,
      });
    } else {
      throwError("Invalid type. Use 'comment' or 'reply'");
    }
  } catch (error) {
    next(error);
  }
};

exports.deleteCommentOrReply = async (req, res, next) => {
  try {
    const { userId } = req.user;
    const { commentId, replyId, type } = req.body;

    if (type === COMMENT_TYPE.comment) {
      if (!commentId) {
        throwError("commentId is required");
      }

      // 🔹 Xóa comment từ model Comment
      const deletedComment = await Comment.findOneAndDelete({
        _id: commentId,
        user: userId,
      });

      if (!deletedComment) {
        throwError("Not found comment or no permission to delete");
      }

      return res.status(200).json({
        message: "Delete comment successfully",
        status: true,
      });
    } else if (type === COMMENT_TYPE.reply) {
      if (!replyId) {
        throwError("replyId is required");
      }

      // 🔹 Xóa reply từ model Reply
      const deletedReply = await Reply.findOneAndDelete({
        _id: replyId,
        user: userId,
      });

      if (!deletedReply) {
        throwError("Not found reply or no permission to delete");
      }

      return res.status(200).json({
        message: "Delete reply successfully",
        status: true,
      });
    } else {
      throwError("Invalid type. Use 'comment' or 'reply'");
    }
  } catch (error) {
    next(error);
  }
};

exports.likeOrDislikeComment = async (req, res, next) => {
  try {
    const { commentId, typeAction, type, replyId } = req.body;
    const { userId, typeLogin } = req.user;

    if (
      !userId ||
      ![ACTION_COMMENT_TYPE.like, ACTION_COMMENT_TYPE.disLike].includes(
        typeAction
      )
    ) {
      throwError("Invalid request data");
    }

    let comment;

    if (type === COMMENT_TYPE.comment) {
      if (!commentId) {
        throwError("Invalid request data");
      }

      comment = await Comment.findById(commentId);
      if (!comment) {
        throwError("Comment not found");
      }
    } else if (type === COMMENT_TYPE.reply) {
      if (!replyId) {
        throwError("replyId is required for replies");
      }
      comment = await Reply.findById(replyId).populate({
        path: "commentId",
        select: "movieId user",
        populate: {
          path: "user",
        },
      });
      if (!comment) {
        throwError("Reply not found");
      }
    } else {
      throwError("Invalid type. Use 'comment' or 'reply'");
    }

    const hasLiked = comment.likesRef.includes(userId);
    const hasDisliked = comment.disLikesRef.includes(userId);

    if (typeAction === ACTION_COMMENT_TYPE.like) {
      if (hasLiked) {
        // Hủy like nếu đã like trước đó
        comment.likesRef = comment.likesRef.filter(
          (id) => id.toString() !== userId
        );
        comment.likes -= 1;
      } else {
        // Thêm like
        comment.likesRef.push(userId);
        comment.likes += 1;

        // Nếu đã dislike trước đó, xóa dislike
        if (hasDisliked) {
          comment.disLikesRef = comment.disLikesRef.filter(
            (id) => id.toString() !== userId
          );
          comment.disLikes -= 1;
        }
      }
    } else if (typeAction === ACTION_COMMENT_TYPE.disLike) {
      if (hasDisliked) {
        // Hủy dislike nếu đã dislike trước đó
        comment.disLikesRef = comment.disLikesRef.filter(
          (id) => id.toString() !== userId
        );
        comment.disLikes -= 1;
      } else {
        // Thêm dislike
        comment.disLikesRef.push(userId);
        comment.disLikes += 1;

        // Nếu đã like trước đó, xóa like
        if (hasLiked) {
          comment.likesRef = comment.likesRef.filter(
            (id) => id.toString() !== userId
          );
          comment.likes -= 1;
        }
      }
    }

    await comment.save({ validateModifiedOnly: true });

    if (
      typeAction === ACTION_COMMENT_TYPE.like &&
      !hasLiked &&
      comment.user.toString() !== userId.toString()
    ) {
      const existingNotification = await Notification.findOne({
        senderId: userId,
        receiverId: comment.user,
        type: "like", // Chỉ thông báo nếu chưa có like/dislike từ user này
        movieId:
          type === COMMENT_TYPE.comment
            ? comment.movieId
            : comment.commentId?.movieId,
        userType: typeLogin,
      }).lean();
      if (!existingNotification) {
        await sendNotification(
          comment.user,
          userId,
          null,
          type === COMMENT_TYPE.comment
            ? comment.movieId
            : comment.commentId?.movieId,
          ACTION_COMMENT_TYPE.like,
          typeLogin
        );
      }
    }

    return res.status(200).json({
      message: `${typeAction} ${type} successful`,
      status: true,
      likes: comment.likes,
      disLikes: comment.disLikes,
      likesRef: comment.likesRef,
      disLikesRef: comment.disLikesRef,
    });
  } catch (error) {
    next(error);
  }
};

// 🛠 Hàm gửi thông báo
const sendNotification = async (
  receiverId,
  senderId,
  content,
  movieId,
  type,
  userType
) => {
  try {
    const notification = new Notification({
      receiverId,
      senderId,
      content,
      movieId,
      type,
      userType,
    });

    await notification.save();

    const io = getIo(); // 🔥 Lấy instance của Socket.io
    io.to(`user_${receiverId.toString()}`).emit("receiveNotification", {
      status: true,
    });

    console.log(`📩 Gửi thông báo đến user ${receiverId}`);
  } catch (error) {
    console.error("❌ Lỗi khi gửi thông báo:", error);
  }
};

const { CommentMovie } = require("../models/CommentModel");
const { DetailMovie } = require("../models/DetailMovieModel");
const UserDB = require("../models/UserModel");

exports.getCommentsByMovie = async (req, res, next) => {
  try {
    const { movieId } = req.params;

    // Lấy danh sách comments theo movieId
    const movieComments = await CommentMovie.findOne({ movieId }).lean();
    if (!movieComments) {
      return res.status(200).json([]); // Trả về mảng rỗng nếu không có bình luận
    }

    // Lấy danh sách userIds từ comments và replies
    const userIds = new Set();
    movieComments.comments.forEach((comment) => {
      userIds.add(comment.user.toString());
      comment.replies.forEach((reply) => {
        userIds.add(reply.user.toString());
      });
    });

    // Truy vấn thông tin người dùng từ database
    const users = await UserDB.find({ _id: { $in: [...userIds] } }).lean();

    // Tạo object map userId -> user details
    const userMap = users.reduce((acc, user) => {
      acc[user._id.toString()] = {
        avatar: user.avatar?.url || null,
        username: user.username || "Unknown User",
      };
      return acc;
    }, {});

    // Gán thông tin user vào comments và replies
    const formattedComments = movieComments.comments.map((comment) => ({
      ...comment,
      userDetails: userMap[comment.user.toString()] || null,
      replies: comment.replies.map((reply) => ({
        ...reply,
        userDetails: userMap[reply.user.toString()] || null,
        replyToUsername: userMap[reply.replyTo?.toString()]?.username || null,
      })),
    }));

    res.status(200).json(formattedComments);
  } catch (error) {
    next(error);
  }
};

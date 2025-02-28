const { CommentMovie } = require("../models/CommentModel");
const UserDB = require("../models/UserModel");

exports.getCommentsByMovie = async (req, res, next) => {
  try {
    const { movieId } = req.params;
    const { page = 1, limit = 5 } = req.query;

    // 🔹 Bước 1: Lấy danh sách comments theo movieId
    const movieComments = await CommentMovie.findOne({ movieId }).lean();
    if (!movieComments) {
      return res.status(200).json({
        comments: [],
        totalItems: 0,
        currentPage: page,
        isLastPage: true,
      });
    }

    // 🔹 Bước 1: Làm phẳng danh sách userId (chỉ lấy userId không trùng)
    const userIds = new Set();
    const commentMap = new Map(); // Để gom replies vào comment tương ứng

    movieComments.comments.forEach((comment) => {
      userIds.add(comment.user.toString()); // Lưu user từ comment
      commentMap.set(comment._id.toString(), { ...comment, replies: [] });

      comment.replies.forEach((reply) => {
        userIds.add(reply.user.toString()); // Lưu user từ reply
        if (reply.replyTo) userIds.add(reply.replyTo.toString()); // Lưu cả người được reply
        commentMap.get(comment._id.toString()).replies.push(reply); // Nhóm replies vào comment
      });
    });

    // 🔹 Bước 2: Truy vấn danh sách users
    const users = await UserDB.find({ _id: { $in: [...userIds] } }).lean();

    // 🔹 Tạo userMap để tra cứu nhanh
    const userMap = {};
    users.forEach((user) => {
      userMap[user._id.toString()] = user;
    });

    // 🔹 Bước 3: Gán thông tin user vào comments & replies
    const formattedComments = Array.from(commentMap.values()).map(
      (comment) => ({
        ...comment,
        userDetails: {
          avatar:
            comment.typeComment === "byGoogle"
              ? userMap[comment.user.toString()]?.inforAccountGoogle?.avatar
                  ?.url
              : userMap[comment.user.toString()]?.avatar?.url || null,
          username:
            userMap[comment.user.toString()]?.username || "Unknown User",
        },
        replies: comment.replies
          .map((reply) => ({
            ...reply,
            userDetails: {
              avatar:
                reply.typeComment === "byGoogle"
                  ? userMap[reply.user.toString()]?.inforAccountGoogle?.avatar
                      ?.url
                  : userMap[reply.user.toString()]?.avatar?.url || null,
              username:
                userMap[reply.user.toString()]?.username || "Unknown User",
            },
            replyToUsername: reply.replyTo
              ? userMap[reply.replyTo.toString()]?.username || null
              : null,
          }))
          .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)), // Sắp xếp replies theo thời gian
      })
    );

    // 🔹 Sắp xếp comments theo thời gian (mới nhất lên đầu)
    formattedComments.sort(
      (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
    );

    // 🔹 Phân trang dữ liệu
    const totalItems = formattedComments.length;
    const startIndex = (page - 1) * limit;
    const endIndex = page * limit;
    const paginatedComments = formattedComments.slice(startIndex, endIndex);
    const isLastPage = endIndex >= totalItems;

    res.status(200).json({
      comments: paginatedComments,
      totalItems: Number(totalItems),
      currentPage: Number(page),
      isLastPage: Boolean(isLastPage),
    });
  } catch (error) {
    next(error);
  }
};

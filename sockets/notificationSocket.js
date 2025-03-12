const Notification = require("../models/NotificationModel");
const { CommentMovie } = require("../models/CommentModel");
const socketAuthMiddleware = require("./socketMiddleware");

module.exports = function (io) {
  io.use(socketAuthMiddleware); // ✅ Áp dụng middleware xác thực JWT

  io.on("connection", (socket) => {
    // Đưa user vào room theo userId để có thể nhận thông báo
    if (socket.user) {
      socket.join(socket.user.userId.toString());
    }
    socket.on("newReply", async ({ movieId, replyId, commentId }) => {
      if (!commentId || !replyId || !movieId) {
        return socket.emit("error", "Invalid movieId, replyId, commentId");
      }

      try {
        // Tìm comment chứa reply
        const commentDoc = await CommentMovie.findOne(
          {
            movieId,
            "comments._id": commentId,
            "comments.replies._id": replyId,
          },
          { "comments.$": 1 } // Lấy đúng comment chứa reply
        ).lean();

        if (!commentDoc || commentDoc.comments.length === 0) {
          return socket.emit("error", "Comment or reply not found");
        }

        // Lấy reply từ comment
        const reply = commentDoc.comments[0].replies.find(
          (rep) => rep._id.toString() === replyId
        );

        if (!reply) {
          return socket.emit("error", "Reply not found");
        }

        const notification = new Notification({
          receiverId: reply.replyTo,
          senderId: reply.user,
          content: reply.content,
          movieId,
          type: "reply",
          isRead: false,
          userType: reply.typeComment,
        });

        await notification.save();

        // Gửi thông báo real-time đến user nhận
        io.to(reply.replyTo.toString()).emit("receiveNotification", {
          status: true,
        });
      } catch (error) {
        console.error("Error finding reply:", error);
        return socket.emit("error", "Server error while finding reply");
      }
    });

    socket.on("disconnect", () => {});
  });
};

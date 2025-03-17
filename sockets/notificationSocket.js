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
        return socket.emit("error", "Lỗi khi tạo thông báo");
      }
    });

    socket.on("newLike", async ({ movieId, userSend, userReceive, type }) => {
      if (!movieId || !userSend || !userReceive || type) {
        return socket.emit(
          "error",
          "Invalid movieId, userSend, type and userReceive"
        );
      }

      try {
        const commentDoc = await CommentMovie.findOne({
          movieId,
        }).lean();

        if (!commentDoc || commentDoc.comments.length === 0) {
          return socket.emit("error", "Comment or reply not found");
        }

        const notification = new Notification({
          receiverId: userReceive,
          senderId: userSend,
          movieId,
          type: "like",
          isRead: false,
          userType: type,
        });

        await notification.save();

        // Gửi thông báo real-time đến user nhận
        io.to(userReceive.toString()).emit("receiveNotification", {
          status: true,
        });
      } catch (error) {
        return socket.emit("error", "Lỗi khi tạo thông báo");
      }
    });

    socket.on("disconnect", () => {});
  });
};

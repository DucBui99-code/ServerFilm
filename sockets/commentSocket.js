const { saveCommentToCache, canSendComment } = require("./dataComments");
const { DetailMovie } = require("../models/DetailMovieModel");
const socketAuthMiddleware = require("./socketMiddleware");
const { getIo } = require("../config/socket");

const viewers = new Map();

exports.commentLiveSocket = () => {
  try {
    const io = getIo(); // Lấy instance của Socket.io

    io.use(socketAuthMiddleware); // ✅ Áp dụng middleware xác thực JWT

    io.on("connection", (socket) => {
      // Người dùng tham gia phòng xem phim
      socket.on("joinMovie", ({ movieId }) => {
        if (!viewers.has(movieId)) {
          viewers.set(movieId, new Set());
        }

        viewers.get(movieId).add(socket.id);
        io.emit("viewersCount", { movieId, count: viewers.get(movieId).size });
      });

      // Người dùng rời phòng xem phim
      socket.on("leaveMovie", ({ movieId }) => {
        if (viewers.has(movieId)) {
          viewers.get(movieId).delete(socket.id);
          io.emit("viewersCount", {
            movieId,
            count: viewers.get(movieId).size,
          });
        }
      });

      // Xử lý gửi bình luận trực tiếp
      socket.on("sendComment", async ({ movieId, content }) => {
        if (!content || !content.trim() || !movieId) {
          return socket.emit("error", "Invalid movieId or content");
        }
        if (content.length >= 100) {
          return socket.emit(
            "error",
            "Comment quá dài, vui lòng rút ngắn lại dưới 100 ký tự"
          );
        }

        const { avatar, username, userId } = socket.user; // ✅ Lấy từ middleware
        const allowed = await canSendComment(userId);

        if (!allowed) {
          return socket.emit("error", "Bạn chat nhanh quá, vui lòng chờ");
        }

        const movie = await DetailMovie.findById(movieId).lean();
        if (!movie) {
          return socket.emit("error", "Không tìm thấy phim");
        }
        if (!movie.isLiveComment) {
          return socket.emit(
            "error",
            "Phim này không hỗ trợ bình luận trực tiếp"
          );
        }

        const comment = {
          id: new Date().getTime(),
          movieId,
          avatar,
          username,
          content,
          createdAt: new Date(),
        };

        await saveCommentToCache(movieId, comment);

        const viewersSet = viewers.get(movieId);
        if (viewersSet) {
          viewersSet.forEach((viewerId) => {
            io.to(viewerId).emit("receiveComment", comment);
          });
        }
      });

      // Xử lý khi người dùng ngắt kết nối
      socket.on("disconnect", () => {
        viewers.forEach((viewersSet, movieId) => {
          if (viewersSet.has(socket.id)) {
            viewersSet.delete(socket.id);
            io.emit("viewersCount", { movieId, count: viewersSet.size });
          }
        });
      });
    });
  } catch (error) {
    console.error("❌ Lỗi khi thiết lập Socket.io:", error);
  }
};

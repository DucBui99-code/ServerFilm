const { saveCommentToCache, canSendComment } = require("./dataComments");
const User = require("../models/UserModel");
const { DetailMovie } = require("../models/DetailMovieModel");
const socketAuthMiddleware = require("./socketMiddleware");

const viewers = new Map();

module.exports = function (io) {
  io.use(socketAuthMiddleware); // ✅ Áp dụng middleware xác thực JWT

  io.on("connection", (socket) => {
    console.log("User connected:", socket.id);

    socket.on("joinMovie", ({ movieId }) => {
      if (!viewers.has(movieId)) {
        viewers.set(movieId, new Set());
      }
      viewers.get(movieId).add(socket.id);
      io.emit("viewersCount", { movieId, count: viewers.get(movieId).size });
    });

    socket.on("leaveMovie", ({ movieId }) => {
      if (viewers.has(movieId)) {
        viewers.get(movieId).delete(socket.id);
        io.emit("viewersCount", { movieId, count: viewers.get(movieId).size });
      }
    });

    socket.on("sendComment", async ({ movieId, content }) => {
      if (!content || !content.trim() || !movieId) {
        return socket.emit("error", "Invalid movieId or content");
      }
      const { avatar, username, userId } = socket.user; // ✅ Lấy từ middleware

      const allowed = await canSendComment(userId);

      if (!allowed) {
        return socket.emit("error", "Bạn chat nhanh qua, vui lòng chờ");
      }

      const exitMovie = await DetailMovie.findById(movieId).lean();

      if (!exitMovie) {
        return socket.emit("error", "Movie not found");
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

    socket.on("disconnect", () => {
      console.log("User disconnected:", socket.id);
      viewers.forEach((viewersSet, movieId) => {
        if (viewersSet.has(socket.id)) {
          viewersSet.delete(socket.id);
          io.emit("viewersCount", { movieId, count: viewersSet.size });
        }
      });
    });
  });
};

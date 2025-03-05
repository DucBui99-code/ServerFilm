const { saveCommentToCache } = require("./dataComments");
const User = require("../models/UserModel");
const { DetailMovie } = require("../models/DetailMovieModel");

const viewers = new Map();

module.exports = function (io) {
  // WebSocket nhận & gửi comment
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

    socket.on("sendComment", async ({ movieId, userId, content }) => {
      if (!content || !content.trim() || !movieId || !userId) {
        return socket.emit(
          "error",
          "Invalid information movieId, userId or content"
        );
      }
      const user = await User.findById(userId).lean();
      const exitMovie = await DetailMovie.findById(movieId).lean();
      if (!exitMovie) {
        return socket.emit("error", "Movie not found");
      }
      if (!user) {
        return socket.emit("error", "User not found");
      }

      const { avatar, username } = user;

      const comment = {
        id: new Date().getTime(), // Use timestamp to ensure uniqueness
        movieId,
        avatar,
        username,
        content,
        createdAt: new Date(),
      };
      await saveCommentToCache(movieId, comment);
      io.emit("receiveComment", comment); // Gửi cho tất cả client
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

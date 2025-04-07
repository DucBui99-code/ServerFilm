const { Server } = require("socket.io");
const authSocketMiddleware = require("../middlewares/authSocketMiddleware");

let io = null;
const isDevelopment = process.env.NODE_ENV === "development";

const initSocket = (server) => {
  io = new Server(server, {
    cors: {
      origin: isDevelopment
        ? process.env.DEV_ALLOW_URL
        : process.env.PRODUCTION_ALLOW_URL,
      methods: ["GET", "POST"],
      credentials: true,
    },
  });

  io.use(authSocketMiddleware);
  io.on("connection", (socket) => {
    const { userId } = socket.user;

    if (userId) {
      socket.join(`user_${userId}`); // 🔥 Thêm user vào room riêng
    }

    socket.on("disconnect", () => {});
  });
  return io;
};

// Hàm lấy instance của io để sử dụng ở nơi khác
const getIo = () => {
  if (!io) {
    throw new Error(
      "Socket.io chưa được khởi tạo! Hãy gọi initSocket(server) trước."
    );
  }
  return io;
};

module.exports = { initSocket, getIo };

const jwt = require("jsonwebtoken");
const dotenv = require("dotenv");
const User = require("../models/UserModel");

dotenv.config({ path: "./.env" });

const authSocketMiddleware = async (socket, next) => {
  const token = socket.handshake.auth?.token; // Lấy token từ handshake

  if (!token) {
    return next(new Error("Authentication token is missing"));
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.userId)
      .select("username avatar inforAccountGoogle")
      .lean();

    if (!user) {
      return next(new Error("User not found"));
    }

    if (user.isDisabled) {
      return next(new Error("User is disabled. Please contact admin"));
    }

    const data = {};
    data.userId = decoded.userId;
    socket.user = data;
    next();
  } catch (err) {
    return next(new Error("Invalid token"));
  }
};

module.exports = authSocketMiddleware;

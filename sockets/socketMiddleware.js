const jwt = require("jsonwebtoken");
const dotenv = require("dotenv");
const User = require("../models/UserModel");
const { TYPE_LOGIN, LINK_AVATAR_DEFAULT } = require("../config/CONSTANT");
dotenv.config({ path: "./.env" });

const socketAuthMiddleware = async (socket, next) => {
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
    if (decoded.typeLogin === TYPE_LOGIN.byGoogle) {
      data.avatar = user.inforAccountGoogle.avatar.url || LINK_AVATAR_DEFAULT;
    } else {
      data.avatar = user.avatar.url || LINK_AVATAR_DEFAULT;
    }
    data.username = user.username;
    data.userId = decoded.userId;
    socket.user = data;
    next();
  } catch (err) {
    return next(new Error("Invalid token"));
  }
};

module.exports = socketAuthMiddleware;

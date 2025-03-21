const jwt = require("jsonwebtoken");
const cookie = require("cookie");
const dotenv = require("dotenv");
const User = require("../models/UserModel");
const { TYPE_LOGIN, LINK_AVATAR_DEFAULT } = require("../config/CONSTANT");
dotenv.config({ path: "./.env" });

const socketAuthMiddleware = async (socket, next) => {
  try {
    // Lấy cookie từ handshake headers
    const cookies = socket.handshake.headers.cookie;
    if (!cookies) return next(new Error("Unauthorized: No cookies found"));

    // Parse cookie để lấy token
    const parsedCookies = cookie.parse(cookies);
    const token = parsedCookies.access_token;

    if (!token) return next(new Error("Unauthorized: No token found"));
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

const jwt = require("jsonwebtoken");
const dotenv = require("dotenv");
const User = require("../models/UserModel");
const cookie = require("cookie");

dotenv.config({ path: "./.env" });

const authSocketMiddleware = async (socket, next) => {
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
    data.userId = decoded.userId;
    socket.user = data;
    next();
  } catch (err) {
    return next(new Error("Invalid token"));
  }
};

module.exports = authSocketMiddleware;

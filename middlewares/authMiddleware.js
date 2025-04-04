const jwt = require("jsonwebtoken");
const dotenv = require("dotenv");
const User = require("../models/UserModel");
const redis = require("../config/redis");

dotenv.config({ path: "./.env" });

const authMiddleware = async (req, res, next) => {
  let token = req.cookies.access_token; // Lấy token từ cookie

  if (!token && req.headers.authorization) {
    const authHeader = req.headers.authorization;
    token = authHeader.split(" ")[1]; // Lấy token từ header Authorization: Bearer <token>
  }

  if (!token) {
    return res.status(401).json({
      message: ["Authorization token is missing"],
      status: false,
    });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const user = await User.findById(decoded.userId, "isDisabled").lean();

    if (!user) {
      return res
        .status(403)
        .json({ message: ["User not found"], status: false });
    }

    if (user.isDisabled) {
      return res.status(403).json({
        message: ["User is disabled. Please contact the admin"],
        status: false,
      });
    }

    const isTokenRevoked = await redis.get(
      `TOKEN_BLACK_LIST_${decoded.userId}_${decoded.jit}`
    );
    if (isTokenRevoked) {
      return res
        .status(401)
        .json({ message: ["Token revoked"], status: false });
    }

    req.user = decoded;
    next();
  } catch (err) {
    return res.status(403).json({ message: ["Invalid token"], status: false });
  }
};

module.exports = authMiddleware;

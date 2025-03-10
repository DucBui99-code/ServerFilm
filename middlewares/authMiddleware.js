const jwt = require("jsonwebtoken");
const dotenv = require("dotenv");
const User = require("../models/UserModel");

dotenv.config({ path: "./.env" });

const authMiddleware = async (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({
      message: ["Authorization header is missing or invalid"],
      status: false,
    });
  }

  const token = authHeader.split(" ")[1];

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const user = await User.findById(decoded.userId).lean();

    if (!user) {
      return res
        .status(403)
        .json({ message: ["User not found"], status: false });
    }

    if (user.isDisabled) {
      return res.status(403).json({
        message: ["User is disabled. Please contact with admin"],
        status: false,
      });
    }

    req.user = decoded;
    next();
  } catch (err) {
    return res.status(403).json({ message: ["Invalid token"], status: false });
  }
};

module.exports = authMiddleware;

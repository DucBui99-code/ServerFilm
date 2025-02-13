const jwt = require("jsonwebtoken");
const UserDB = require("../models/UserModel");

const authMiddlewareNoReturn = async (req, res, next) => {
  try {
    const token = req.header("Authorization")?.split(" ")[1];

    if (!token) {
      req.user = null; // Không có token => req.user = null
      return next();
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await UserDB.findById(decoded.userId);

    if (!user) {
      req.user = null;
    } else if (user.isDisabled) {
      return res.status(403).json({
        message: ["User is disabled. Please contact with admin"],
        status: false,
      });
    } else {
      req.user = decoded;
    }

    next();
  } catch (error) {
    req.user = null; // Nếu token sai, vẫn cho phép tiếp tục nhưng không có user
    next();
  }
};

module.exports = authMiddlewareNoReturn;

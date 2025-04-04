const jwt = require("jsonwebtoken");
const UserDB = require("../models/UserModel");

const authMiddlewareNoReturn = async (req, res, next) => {
  try {
    let token = req.cookies.access_token;

    if (!token && req.headers.authorization) {
      token = req.headers.authorization.split(" ")[1]; // Bearer <token>
    }

    if (!token) {
      req.user = null;
      return next();
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await UserDB.findById(decoded.userId).lean();

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
    req.user = null;
    next();
  }
};

module.exports = authMiddlewareNoReturn;

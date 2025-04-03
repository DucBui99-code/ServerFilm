const User = require("../models/UserModel.js");
const Notification = require("../models/NotificationModel.js");
const throwError = require("../utils/throwError.js");
const cacheService = require("../services/cacheService.js");

exports.toggleBanUser = async (req, res, next) => {
  try {
    const { userId } = req.user;
    const { identifier, type } = req.body;

    if (type !== "ban" && type !== "unBan") {
      throwError("Type invalid", 400);
    }

    const adminUser = await User.findById(userId).lean();

    if (!adminUser || adminUser.role !== "admin") {
      throwError("You do not have permission to perform this action", 403);
    }

    const targetUser = await User.findOne({
      $or: [{ email: identifier }, { username: identifier }],
    });

    if (adminUser._id.toString() === targetUser._id.toString()) {
      throwError("You cannot ban or unban yourself", 400);
    }

    if (!targetUser) {
      throwError("User not found", 404);
    }

    if (type === "ban") {
      targetUser.isDisabled = true;
    } else if (type === "unBan") {
      targetUser.isDisabled = false;
    }

    await targetUser.save({ validateModifiedOnly: true });

    return res.status(200).json({
      status: true,
      message: `User status updated successfully`,
    });
  } catch (error) {
    next(error);
  }
};

exports.setRoleUser = async (req, res, next) => {
  try {
    const { userId } = req.user;
    const { identifier, role } = req.body;

    if (role !== "normal" && role !== "admin") {
      throwError("role invalid", 400);
    }

    const adminUser = await User.findById(userId).lean();

    if (!adminUser || adminUser.role !== "admin") {
      throwError("You do not have permission to perform this action", 403);
    }

    const targetUser = await User.findOne({
      $or: [{ email: identifier }, { username: identifier }],
    });

    if (adminUser._id.toString() === targetUser._id.toString()) {
      throwError("You cannot set role yourself", 400);
    }

    if (!targetUser) {
      throwError("User not found", 404);
    }

    targetUser.role = role;

    await targetUser.save({ validateModifiedOnly: true });

    return res.status(200).json({
      status: true,
      message: `User status updated successfully`,
    });
  } catch (error) {
    next(error);
  }
};

exports.sendGlobalNotification = async (req, res, next) => {
  try {
    const { userId } = req.user;
    const { content } = req.body;

    if (!content) {
      throwError("Missing senderId, content, or type");
    }
    const adminUser = await User.findById(userId).lean();

    if (!adminUser || adminUser.role !== "admin") {
      throwError("You do not have permission to perform this action", 403);
    }

    // Lưu thông báo vào database
    const notification = new Notification({
      content,
      type: "system",
    });

    await notification.save();

    // Gửi thông báo real-time đến tất cả user qua Socket.IO
    const io = req.app.get("socketio"); // Lấy instance của Socket.IO từ Express
    io.emit("receiveNotification", { content });

    res.status(200).json({ message: "Notification sent successfully" });
  } catch (error) {
    next(error);
  }
};

exports.clearCache = async (req, res, next) => {
  try {
    await cacheService.clearCache(); // Xóa toàn bộ cache Redis
    res.status(200).json({
      status: true,
      message: "Cache cleared successfully",
    });
  } catch (error) {
    next(error);
  }
};

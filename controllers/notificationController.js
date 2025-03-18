const Notification = require("../models/NotificationModel");
const { TYPE_LOGIN } = require("../config/CONSTANT");
const throwError = require("../utils/throwError");

exports.getCountNotification = async (req, res, next) => {
  try {
    const { userId } = req.user;

    const totalNotifications = await Notification.countDocuments({
      $or: [
        { receiverId: userId, isHiden: { $ne: true }, isRead: false },
        {
          receiverId: null,
          type: "system",
          isHiden: { $ne: true },
          isRead: false,
        },
      ],
    });

    return res.status(200).json({
      status: true,
      total: totalNotifications,
    });
  } catch (error) {
    next(error);
  }
};

exports.getNotification = async (req, res, next) => {
  try {
    const { userId } = req.user;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 3;

    const notifications = await Notification.find({
      $or: [
        { receiverId: userId, isHiden: { $ne: true } }, // Thông báo cá nhân
        { receiverId: null, type: "system", isHiden: { $ne: true } }, // Thông báo hệ thống
      ],
    })
      .populate("movieId")
      .populate("senderId")
      .populate("receiverId")
      .sort({ isRead: 1, createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean();

    const totalNotifications = await Notification.countDocuments({
      receiverId: userId,
      isHiden: { $ne: true },
    });

    const response = notifications.map((notification) => {
      // Kiểm tra nếu đây là thông báo của hệ thống
      const isSystemNotification =
        !notification.movieId &&
        !notification.senderId &&
        !notification.receiverId &&
        notification.type === "system";

      return {
        movieData: notification.movieId
          ? {
              image: notification.movieId.poster_url,
              name: notification.movieId.name,
              slug: notification.movieId.slug,
              type: notification.movieId.__t,
            }
          : null,
        userSend: notification.senderId
          ? {
              username: notification.senderId.username,
              avatar:
                notification.userType === TYPE_LOGIN.byGoogle
                  ? notification.senderId.inforAccountGoogle.avatar.url
                  : notification.senderId.avatar.url,
            }
          : isSystemNotification
          ? {
              username: "System", // Tên hiển thị cho thông báo hệ thống
            }
          : null,
        content: notification.content,
        _id: notification._id,
        createdAt: notification.createdAt,
        isRead: notification.isRead,
        isHiden: notification.isHiden,
        type: notification.type,
      };
    });

    const totalPages = Math.ceil(totalNotifications / limit); // Tính tổng số trang
    const currentPage = Number(page); // Chuyển đổi page thành số
    const isLastPage = currentPage >= totalPages; // Kiểm tra có phải trang cuối không

    return res.status(200).json({
      status: true,
      total: totalNotifications, // Tổng số thông báo
      currentPage, // Trang hiện tại
      totalPages, // Tổng số trang
      isLastPage, // Có phải trang cuối cùng không
      data: response, // Dữ liệu thông báo
    });
  } catch (error) {
    next(error);
  }
};

exports.updateIsRead = async (req, res, next) => {
  try {
    const { notificationId } = req.body;
    const { userId } = req.user; // Lấy userId từ token

    // Tìm thông báo trước
    const notification = await Notification.findById(notificationId);

    if (!notification) {
      throwError("Notification not found");
    }
    if (notification.type !== "system") {
      // Kiểm tra xem người dùng có quyền cập nhật không
      if (notification.receiverId.toString() !== userId) {
        throwError("You don't have permission to update this notification");
      }
    }

    // Cập nhật isRead
    notification.isRead = true;
    await notification.save();

    res.status(200).json({ message: "Updated successfully", status: true });
  } catch (error) {
    next(error);
  }
};

exports.updateAllIsRead = async (req, res, next) => {
  try {
    const { userId } = req.user; // Lấy userId từ token

    // Cập nhật tất cả thông báo của người dùng và thông báo hệ thống thành đã đọc
    await Notification.updateMany(
      {
        $or: [
          { receiverId: userId, isRead: false },
          { receiverId: null, type: "system", isRead: false },
        ],
      },
      { $set: { isRead: true } }
    );

    res
      .status(200)
      .json({ message: "All notifications marked as read", status: true });
  } catch (error) {
    next(error);
  }
};

exports.updateIsHiden = async (req, res, next) => {
  try {
    const { notificationId } = req.body;
    const { userId } = req.user; // Lấy userId từ token

    // Tìm thông báo trước
    const notification = await Notification.findById(notificationId);

    if (!notification) {
      throwError("Notification not found");
    }
    if (notification.type !== "system") {
      // Kiểm tra quyền cập nhật
      if (notification.receiverId.toString() !== userId) {
        throwError("You don't have permission to update this notification");
      }
    }

    // Cập nhật isHiden
    notification.isHiden = true;
    await notification.save();

    res.status(200).json({ message: "Updated successfully", status: true });
  } catch (error) {
    next(error);
  }
};

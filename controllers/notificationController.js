const Notification = require("../models/NotificationModel");
const { TYPE_LOGIN } = require("../config/CONSTANT");

exports.getCountNotification = async (req, res, next) => {
  try {
    const { userId } = req.user;

    const totalNotifications = await Notification.countDocuments({
      receiverId: userId,
      isHiden: { $ne: true },
      isRead: false,
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
      receiverId: userId,
      isHiden: { $ne: true },
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

    const response = notifications.map((notification) => ({
      movieData: notification.movieId
        ? {
            image: notification.movieId.poster_url,
            name: notification.movieId.name,
            slug: notification.movieId.slug,
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
        : null,
      content: notification.content,
      _id: notification._id,
      createdAt: notification.createdAt,
      isRead: notification.isRead,
      isHiden: notification.isHiden,
      type: notification.type,
    }));

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
      return res.status(404).json({ message: "Notification not found" });
    }

    // Kiểm tra xem người dùng có quyền cập nhật không
    if (notification.receiverId.toString() !== userId) {
      return res.status(404).json({
        message: "You don't have permission to update this notification",
      });
    }

    // Cập nhật isRead
    notification.isRead = true;
    await notification.save();

    res.status(200).json({ message: "Updated successfully", status: true });
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
      return res.status(404).json({ message: "Notification not found" });
    }

    // Kiểm tra quyền cập nhật
    if (notification.receiverId.toString() !== userId) {
      return res.status(404).json({
        message: "You don't have permission to update this notification",
      });
    }

    // Cập nhật isHiden
    notification.isHiden = true;
    await notification.save();

    res.status(200).json({ message: "Updated successfully", status: true });
  } catch (error) {
    next(error);
  }
};

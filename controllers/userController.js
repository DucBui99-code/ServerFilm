const User = require("../models/UserModel.js");
const moment = require("moment");

// Get Profile
exports.getProfile = async (req, res) => {
  try {
    const { userId } = req.user;

    const user = await User.findById(userId).select(
      "username avatar createdAt email updatedAt"
    );

    if (!user) {
      return res.status(404).json({
        status: false,
        message: ["User not found"],
      });
    }

    res.status(200).json({
      status: true,
      data: user,
    });
  } catch (error) {
    return res.status(500).json({
      status: false,
      message: ["Internal server error", error.message],
    });
  }
};

// Update user information
exports.updateInformation = async (req, res) => {
  try {
    const { userId } = req.user;
    const { username, firstLastName, phoneNumber, birthDay, sex } = req.body;

    if (!username && !firstLastName && !phoneNumber && !birthDay && !sex) {
      return res.status(400).json({
        status: false,
        message: ["Not found information to update"],
      });
    }

    const user = await User.findById(userId);

    // Kiểm tra định dạng birthDay
    if (birthDay) {
      if (!moment(birthDay, "DD/MM/YYYY", true).isValid()) {
        return res.status(400).json({
          status: false,
          message: ["Invalid birthDay format. Use DD/MM/YYYY"],
        });
      }

      // Kiểm tra birthDay không nằm trong tương lai
      if (moment(birthDay, "DD/MM/YYYY").isAfter(moment())) {
        return res.status(400).json({
          status: false,
          message: ["BirthDay cannot be in the future"],
        });
      }

      user.birthDay = birthDay;
    }

    // Cập nhật các trường còn lại nếu có
    if (username) user.username = username.trim();
    if (firstLastName) user.firstLastName = firstLastName.trim();
    if (phoneNumber) user.phoneNumber = phoneNumber.trim();
    if (sex) user.sex = sex;

    await user.save({ validateModifiedOnly: true });

    return res.status(200).json({
      status: true,
      message: "User info updated successfully",
    });
  } catch (error) {
    return res.status(500).json({
      status: false,
      message: ["Internal server error", error.message],
    });
  }
};

// Upload avatar
exports.upLoadAvatar = async (req, res) => {
  try {
    const { userId } = req.user;
    let oldImageId = null;

    // Kiểm tra nếu không có file
    if (!req.files.avatar || req.files.avatar.length === 0) {
      return res.status(400).json({
        status: false,
        message: "Avatar file not found",
      });
    }

    const fileImage = req.files.avatar[0];

    const allowedTypes = ["image/jpeg", "image/jpg", "image/png", "image/gif"];
    if (!allowedTypes.includes(fileImage.mimetype)) {
      await cloudinary.uploader.destroy(fileImage.filename);
      return res.status(400).json({
        status: false,
        message: "Only .jpeg, .jpg, .png, and .gif formats are allowed!",
      });
    }

    const user = await User.findById(userId);
    if (user?.avatar?.id) {
      oldImageId = user.avatar.id;
    }

    user.avatar = {
      id: fileImage.filename,
      url: fileImage.path,
    };
    await user.save({ validateModifiedOnly: true });

    if (oldImageId) {
      await cloudinary.uploader.destroy(oldImageId);
    }

    return res.status(200).json({
      status: true,
      message: "Upload avatar successfully",
    });
  } catch (error) {
    return res.status(500).json({
      status: false,
      message: ["Internal server error", error.message],
    });
  }
};

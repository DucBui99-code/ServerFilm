const User = require("../models/UserModel.js");
const mongoose = require("mongoose");
const { default: isValidAvatarURL } = require("../utils/validateLinkAvatar.js");

exports.getProfile = async (req, res) => {
  const { userId } = req.user;
  if (!mongoose.Types.ObjectId.isValid(userId)) {
    return res
      .status(400)
      .json({ message: ["Invalid userId format"], status: "error" });
  }

  const user = await User.findById(userId).select(
    "username avatar createdAt email updatedAt"
  );

  if (!user) {
    return res.status(404).json({
      status: "error",
      message: ["User not found"],
    });
  }

  res.status(200).json({
    status: "success",
    data: user,
  });
};

// Update user information
exports.updateInfomation = async (req, res) => {
  const { userId } = req.user;
  const { username, avatar } = req.body;

  if (!username && !avatar) {
    return res.status(400).json({
      status: "error",
      message: ["Both username or avatar are required"],
    });
  }

  if (!mongoose.Types.ObjectId.isValid(userId)) {
    return res
      .status(400)
      .json({ message: ["Invalid userId format"], status: "error" });
  }

  if (!isValidAvatarURL(avatar)) {
    return res.status(400).json({
      status: "error",
      message: ["Invalid avatar link"],
    });
  }

  const user = await User.findById(userId).select("username avatar");

  if (!user) {
    return res.status(404).json({
      status: "error",
      message: ["User not found"],
    });
  }

  if (username) {
    user.username = username;
  }
  if (avatar) {
    user.avatar = avatar;
  }

  await user.save();

  res.status(200).json({
    status: "success",
    message: "User info updated",
  });
};

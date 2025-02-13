const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const otpGenerator = require("otp-generator");
const mongoose = require("mongoose");
const uaParser = require("ua-parser-js");
const moment = require("moment");

const {
  LIMIT_DEVICE,
  EXPIRED_TIME_OTP,
  EXPIRED_TIME_TOKEN,
  NUMBER_OTP_GENERATE,
} = require("../config/CONSTANT.js");
const filterObj = require("../utils/fillterObject");
const mailServices = require("../services/mailer");
const User = require("../models/UserModel.js");
const resetPassword = require("../templates/Mail/resetPassword.js");
const otp = require("../templates/Mail/otp");
const { getDeviceId } = require("../services/getDeviceId.js");

const options = {
  expiresIn: EXPIRED_TIME_TOKEN,
};

const signToken = (userId) =>
  jwt.sign({ userId }, process.env.JWT_SECRET, options);

// Register
exports.register = async (req, res) => {
  try {
    const { email } = req.body;
    const filteredBody = filterObj(req.body, "username", "password", "email");

    let userDoc = await User.findOne({ email });

    if (userDoc && userDoc.verified) {
      return res.status(409).json({
        status: false,
        message: ["Email is already in use"],
      });
    }

    if (userDoc) {
      userDoc.set(filteredBody);
      await userDoc.save();
    } else {
      userDoc = await User.create(filteredBody);
    }

    return res.status(200).json({
      status: true,
      message: "Register successfully",
      userId: userDoc._id,
    });
  } catch (error) {
    return res.status(500).json({
      status: false,
      message: error.message || "Something went wrong!",
    });
  }
};

// Send OTP
exports.sendOTP = async (req, res) => {
  try {
    const { userId } = req.body;

    const new_otp = otpGenerator.generate(NUMBER_OTP_GENERATE, {
      upperCaseAlphabets: false,
      specialChars: false,
      lowerCaseAlphabets: false,
    });

    const otpExpires = Date.now() + EXPIRED_TIME_OTP * 60 * 1000;

    const user = await User.findByIdAndUpdate(userId, {
      otpExpires,
    });
    if (!user) {
      return res.status(404).json({
        status: false,
        message: ["User does not exist"],
      });
    }
    user.otp = new_otp.toString();
    await user.save({ new: true, validateModifiedOnly: true });

    mailServices.sendEmail({
      to: user.email,
      subject: "Verification OTP",
      html: otp(user.username, new_otp, EXPIRED_TIME_OTP),
      attachments: [],
    });

    return res.status(200).json({
      status: true,
      message: "Send OTP successfully",
      timeExpired: EXPIRED_TIME_OTP,
    });
  } catch (error) {
    return res.status(500).json({
      status: false,
      message: error.message || "Something went wrong!",
    });
  }
};

// Verify OTP
exports.verifyOTP = async (req, res) => {
  try {
    const { email, otp } = req.body;

    const user = await User.findOne({
      email: email,
    });

    if (!user) {
      return res.status(400).json({
        status: false,
        message: ["Email is invalid"],
      });
    }

    if (new Date(user.otpExpires).getTime() < Date.now()) {
      return res.status(400).json({
        status: false,
        message: ["OTP is expired"],
      });
    }
    if (!(await user.correctOTP(otp, user.otp))) {
      return res.status(400).json({
        status: false,
        message: ["OTP is incorrect"],
      });
    }

    user.otp = undefined;
    user.verified = true;

    await user.save({
      new: true,
      validateModifiedOnly: true,
    });

    return res.status(200).json({
      status: true,
      message: "Verify OTP successfully",
      data: {
        id: user._id,
        username: user.username,
        email: user.email,
        createdAt: user.createdAt,
      },
    });
  } catch (error) {
    return res.status(500).json({
      status: false,
      message: error.message || "Something went wrong!",
    });
  }
};

// Login
exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        status: false,
        message: ["Both email and password are required"],
      });
    }

    const userDoc = await User.findOne({ email: email }).select("+password");

    if (!userDoc) {
      return res.status(404).json({
        status: false,
        message: ["Email or Password is incorrect"],
      });
    }
    if (!(await userDoc.isCorrectPassword(password, userDoc.password))) {
      return res.status(404).json({
        status: false,
        message: ["Email or Password is incorrect"],
      });
    }

    if (!userDoc.verified) {
      return res.status(400).json({
        status: false,
        message: ["Account has not been verified"],
      });
    }

    if (userDoc.isDisabled) {
      return res.status(400).json({
        status: false,
        message: ["Account has been disalbe. Please contact to admin"],
      });
    }

    if (userDoc.deviceManagement.length > LIMIT_DEVICE) {
      return res.status(400).json({
        status: false,
        message: [`Just only allow ${LIMIT_DEVICE} login`],
      });
    }

    const parser = new uaParser(req.headers["user-agent"]);
    const resultInforDevice = parser.getResult();
    const deviceId = getDeviceId(req);

    const isAlearadyExit = userDoc.deviceManagement.find((deivce) => {
      return deivce.deviceId === deviceId;
    });

    if (!isAlearadyExit) {
      userDoc.deviceManagement.push({
        deviceId,
        deviceName: resultInforDevice.device.model || "Unknown",
        deviceType: resultInforDevice.device.type || "PC",
        browser: resultInforDevice.browser.name || "Unknown",
        timeDetected: moment().format("HH:mm:ss DD-MM-YYYY"),
      });

      await userDoc.save({
        new: true,
        validateModifiedOnly: true,
      });
    }

    const token = signToken(userDoc._id);

    return res.status(200).json({
      status: true,
      message: "Logged in successfully",
      data: {
        token: token,
        userId: userDoc._id,
      },
    });
  } catch (error) {
    return res.status(500).json({
      status: false,
      message: error.message || "Something went wrong!",
    });
  }
};

// Remove Account
exports.deleteAccount = async (req, res) => {
  try {
    const { userId } = req.user;
    const userDoc = await User.findByIdAndDelete(userId);

    if (!userDoc) {
      return res.status(404).json({
        status: false,
        message: "User not found",
      });
    }

    return res.status(200).json({
      status: true,
      message: "Account deleted successfully",
    });
  } catch (error) {
    return res.status(500).json({
      status: false,
      message: error.message || "Something went wrong!",
    });
  }
};
// Logout Acount
exports.logout = async (req, res) => {
  try {
    const { userId } = req.user;
    const deviceId = getDeviceId(req);

    const userDoc = await User.findById(userId);
    if (!userDoc) return res.status(404).json({ message: "Not found user" });

    // Xóa session của thiết bị hiện tại
    userDoc.deviceManagement = userDoc.deviceManagement.filter(
      (device) => device.deviceId !== deviceId
    );
    await userDoc.save({
      new: true,
      validateModifiedOnly: true,
    });

    return res.status(200).json({
      status: true,
      message: "Log out successfully",
    });
  } catch (error) {
    return res.status(500).json({
      status: false,
      message: error.message || "Something went wrong!",
    });
  }
};

// Forgot Password
exports.forgotPassword = async (req, res, next) => {
  const { email } = req.body;

  const user = await User.findOne({ email: email });

  if (!user) {
    return res.status(404).json({
      status: false,
      message: ["There is no user with given email"],
    });
  }

  const resetToken = user.createPasswordResetToken();

  const urlReset = `http://localhost:/${process.env.PORT}/auth/newPassword?code=${resetToken}`;
  try {
    // Send Email
    mailServices.sendEmail({
      to: user.email,
      subject: "Reset Password",
      html: resetPassword(user.username, urlReset),
      attachments: [],
    });
    user.passwordResetToken = resetToken;
    await user.save({ new: true, validateModifiedOnly: true });

    return res.status(200).json({
      status: true,
      message: "Send reset password successfully",
    });
  } catch (err) {
    user.passwordResetToken = undefined;
    user.passwordResetExpires = undefined;

    await user.save({ validateBeforeSave: false });
    return res.status(500).json({
      status: false,
      message: ["There was an error sending the email, Please try again later"],
    });
  }
};

// Reset Password
exports.resetPassword = async (req, res, next) => {
  try {
    const { token, password } = req.body;

    const tokenHash = crypto.createHash("sha256").update(token).digest("hex");

    const user = await User.findOne({
      passwordResetToken: tokenHash,
      passwordResetExpires: { $gt: Date.now() },
    });

    if (!user) {
      return res.status(404).json({
        status: false,
        message: ["Token is Invalid or Expired"],
      });
    }
    user.password = password;
    user.passwordResetToken = undefined;
    user.passwordResetExpires = undefined;

    await user.save({ validateModifiedOnly: true });

    return res.status(200).json({
      status: true,
      message: "Password Rested Successfully",
    });
  } catch (error) {
    let errors = [];
    for (const property in error.errors) {
      errors.push(`${error.errors[property]}`);
    }
    return res.status(500).json({
      status: false,
      message: errors,
    });
  }
};

// Change Password
exports.updatePassword = async (req, res, next) => {
  try {
    const { userId } = req.user;
    const { currentPassword, newPassword } = req.body;

    const user = await User.findById(userId).select("+password");

    if (!(await user.isCorrectPassword(currentPassword, user.password))) {
      return res.status(400).json({
        status: false,
        message: ["Current password is incorrect"],
      });
    }

    user.password = newPassword;

    await user.save({ validateModifiedOnly: true });

    return res.status(200).json({
      status: true,
      message: "Password updated successfully",
    });
  } catch (error) {
    return res.status(500).json({
      status: false,
      message: error.message,
    });
  }
};

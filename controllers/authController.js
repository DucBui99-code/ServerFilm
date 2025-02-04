const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const otpGenerator = require("otp-generator");
const mongoose = require("mongoose");
const { promisify } = require("util");

const filterObj = require("../utils/fillterObject");
const mailServices = require("../services/mailer");
const User = require("../models/UserModel.js");
const resetPassword = require("../templates/Mail/resetPassword.js");
const otp = require("../templates/Mail/otp");

const EXPIRED_TIME = 6;

const options = {
  expiresIn: "1h", // token sẽ hết hạn sau 1 giờ
};

const signToken = (userId) =>
  jwt.sign({ userId }, process.env.JWT_SECRET, options);

exports.protect = async (req, res, next) => {
  let token;
  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith("Bearer")
  ) {
    token = req.headers.authorization.split(" ")[1];
  } else {
    return res.status(401).json({
      status: "error",
      message: "You are not logged in! Please log in to access",
    });
  }

  try {
    // Verify Token
    const decoded = await promisify(jwt.verify)(token, process.env.JWT_SECRET);

    // Check if the user still exists
    const this_user = await User.findById(decoded.userId);
    if (!this_user) {
      return res.status(400).json({
        status: "error",
        message: "The user doesn't exist",
      });
    }

    // Set user on request
    req.user = this_user;
    next();
  } catch (err) {
    if (err.name === "TokenExpiredError") {
      return res.status(401).json({
        status: "error",
        message: "Token has expired. Please log in again",
      });
    } else if (err.name === "JsonWebTokenError") {
      return res.status(401).json({
        status: "error",
        message: "Invalid token. Please log in again",
      });
    } else {
      return res.status(500).json({
        status: "error",
        message: "Internal server error. Please contact the administrator.",
      });
    }
  }
};

// Register
exports.register = async (req, res, next) => {
  try {
    const { email } = req.body;

    const filteredBody = filterObj(req.body, "username", "password", "email");

    const userDoc = await User.findOne({ email: email });

    if (userDoc && userDoc.verified) {
      return res.status(400).json({
        status: "error",
        message: ["Email is already in use"],
      });
    } else if (userDoc) {
      await User.findOneAndUpdate({ email: email }, filteredBody, {
        new: true,
        runValidators: true,
      });

      return res.status(200).json({
        status: true,
        message: "Register successfully",
        userId: userDoc._id,
      });
    } else {
      const new_user = await User.create(filteredBody);
      return res.status(200).json({
        status: true,
        message: "Register successfully",
        userId: new_user._id,
      });
    }
  } catch (error) {
    let errors = [];
    for (const property in error.errors) {
      errors.push(`${error.errors[property]}`);
    }
    return res.status(404).json({
      status: "error",
      message: errors,
    });
  }
};

// Send OTP
exports.sendOTP = async (req, res, next) => {
  const { userId } = req.body;

  if (!mongoose.Types.ObjectId.isValid(userId)) {
    return res.status(400).json({ message: ["Invalid userId format"] });
  }

  const new_otp = otpGenerator.generate(6, {
    upperCaseAlphabets: false,
    specialChars: false,
    lowerCaseAlphabets: false,
  });
  const otpExpires = Date.now() + EXPIRED_TIME * 60 * 1000;

  const user = await User.findByIdAndUpdate(userId, {
    otpExpires,
  });
  if (!user) {
    return res.status(404).json({
      status: "error",
      message: ["User does not exist"],
    });
  }
  user.otp = new_otp.toString();
  await user.save({ new: true, validateModifiedOnly: true });

  mailServices.sendEmail({
    to: user.email,
    subject: "Verification OTP",
    html: otp(user.username, new_otp, EXPIRED_TIME),
    attachments: [],
  });

  return res.status(200).json({
    status: true,
    message: "Send OTP successfully",
    timeExpired: EXPIRED_TIME,
  });
};

// Verify OTP
exports.verifyOTP = async (req, res, next) => {
  const { email, otp } = req.body;

  const user = await User.findOne({
    email: email,
  });

  if (!user) {
    return res.status(400).json({
      status: "error",
      message: ["Email is invalid"],
    });
  }

  if (new Date(user.otpExpires).getTime() < Date.now()) {
    return res.status(400).json({
      status: "error",
      message: ["OTP is expired"],
    });
  }
  if (!(await user.correctOTP(otp, user.otp))) {
    return res.status(400).json({
      status: "error",
      message: ["OTP is incorrect"],
    });
  }

  user.otp = undefined;
  user.verified = true;

  await user.save({
    new: true,
    validateModifiedOnly: true,
  });

  const token = signToken(user._id);

  return res.status(200).json({
    status: true,
    message: "Logged in successfully",
    data: {
      id: user._id,
      username: user.username,
      email: user.email,
      createdAt: user.createdAt,
      token: token,
    },
  });
};

// Login
exports.login = async (req, res, next) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({
      status: "error",
      message: ["Both email and password are required"],
    });
  }

  const userDoc = await User.findOne({ email: email }).select("+password");

  if (
    !userDoc ||
    !(await userDoc.isCorrectPassword(password, userDoc.password))
  ) {
    return res.status(404).json({
      status: "error",
      message: ["Email or Password is incorrect"],
    });
  }

  if (!userDoc.verified) {
    return res.status(400).json({
      status: "error",
      message: ["Account has not been verified"],
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
};

// Forgot Password
exports.forgotPassword = async (req, res, next) => {
  const { email } = req.body;

  const user = await User.findOne({ email: email });

  if (!user) {
    return res.status(404).json({
      status: "error",
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
      status: "error",
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
        status: "error",
        message: ["Token is Invalid or Expired"],
      });
    }
    user.password = password;
    user.passwordResetToken = undefined;
    user.passwordResetExpires = undefined;

    await user.save();
    return res.status(200).json({
      status: true,
      message: "Password Rested Successfully",
    });
  } catch (error) {
    let errors = [];
    for (const property in error.errors) {
      errors.push(`${error.errors[property]}`);
    }
    return res.status(404).json({
      status: "error",
      message: errors,
    });
  }
};

// Change Password
exports.updatePassword = async (req, res, next) => {
  const { userId } = req.user;
  const { currentPassword, newPassword } = req.body;

  if (!mongoose.Types.ObjectId.isValid(userId)) {
    return res.status(400).json({ message: ["Invalid userId format"] });
  }

  const user = await User.findById(userId).select("+password");

  if (!user) {
    return res.status(404).json({
      status: "error",
      message: ["User does not exist"],
    });
  }

  if (!(await user.isCorrectPassword(currentPassword, user.password))) {
    return res.status(400).json({
      status: "error",
      message: ["Current password is incorrect"],
    });
  }

  user.password = newPassword;

  await user.save();

  return res.status(200).json({
    status: true,
    message: "Password updated successfully",
  });
};

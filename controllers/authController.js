const jwt = require("jsonwebtoken");
const otpGenerator = require("otp-generator");
const uaParser = require("ua-parser-js");
const moment = require("moment");

const {
  LIMIT_DEVICE,
  EXPIRED_TIME_OTP,
  EXPIRED_TIME_TOKEN,
  NUMBER_OTP_GENERATE,
  DEV_URL,
  TYPE_LOGIN,
} = require("../config/CONSTANT.js");
const filterObj = require("../utils/fillterObject");
const mailServices = require("../services/mailer");
const User = require("../models/UserModel.js");
const resetPassword = require("../templates/Mail/resetPassword.js");
const otp = require("../templates/Mail/otp");
const { getDeviceId } = require("../services/getDeviceId.js");
const throwError = require("../utils/throwError.js");

const options = {
  expiresIn: EXPIRED_TIME_TOKEN,
};

const signToken = (userId, typeLogin) =>
  jwt.sign({ userId, typeLogin }, process.env.JWT_SECRET, options);

// Register
exports.register = async (req, res) => {
  try {
    const { email, username } = req.body;
    const filteredBody = filterObj(req.body, "username", "password", "email");

    let userDocEmail = await User.findOne({ email: email });
    let userDocUsername = await User.findOne({ username: username }).lean();

    if (userDocUsername) {
      if (
        userDocUsername.username === username &&
        userDocUsername.email !== email
      ) {
        return res.status(410).json({
          status: false,
          message: "Username is already in use",
        });
      }
    }

    if (userDocEmail && userDocEmail.verified && userDocEmail.isCreatedByPass) {
      if (userDocEmail.email === email) {
        return res.status(409).json({
          status: false,
          message: "Email is already in use",
        });
      }
    }

    if (userDocEmail) {
      userDocEmail.set(filteredBody);
      await userDocEmail.save({ new: true, validateModifiedOnly: true });
    } else {
      userDocEmail = await User.create(filteredBody);
    }

    return res.status(200).json({
      status: true,
      message: "Register successfully",
      userId: userDocEmail._id,
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
        message: "User does not exist",
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
        message: "Email is invalid",
      });
    }

    if (new Date(user.otpExpires).getTime() < Date.now()) {
      return res.status(400).json({
        status: false,
        message: "OTP is expired",
      });
    }
    if (!(await user.correctOTP(otp, user.otp))) {
      return res.status(400).json({
        status: false,
        message: "OTP is incorrect",
      });
    }

    user.otp = undefined;
    user.verified = true;
    user.isCreatedByPass = true;

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
exports.login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    if (!email.trim() || !password.trim()) {
      throwError("Both email and password are required");
    }

    const userDoc = await User.findOne({ email: email }).select("+password");

    if (!userDoc) {
      return res.status(404).json({
        status: false,
        message: "Email or Password is incorrect",
      });
    }

    if (!(await userDoc.isCorrectPassword(password, userDoc.password))) {
      return res.status(404).json({
        status: false,
        message: "Email or Password is incorrect",
      });
    }

    if (!userDoc.verified || !userDoc.isCreatedByPass) {
      return res.status(400).json({
        status: false,
        message: "Account has not been verified",
      });
    }

    if (userDoc.isDisabled) {
      return res.status(400).json({
        status: false,
        message: "Account has been disalbe. Please contact to admin",
      });
    }

    if (userDoc.deviceManagement.length > LIMIT_DEVICE) {
      return res.status(400).json({
        status: false,
        message: `Just only allow ${LIMIT_DEVICE} login`,
      });
    }

    await updateDeviceManagement(userDoc, req);

    const token = signToken(userDoc._id, TYPE_LOGIN.byPass);

    return res.status(200).json({
      status: true,
      message: "Logged in successfully",
      data: {
        token: token,
        userId: userDoc._id,
        typeLogin: TYPE_LOGIN.byPass,
      },
    });
  } catch (error) {
    next(error);
  }
};

exports.loginWithGoogle = async (req, res) => {
  try {
    const { googleId, email, avatar, firstName, lastName } = req.body;

    if (!googleId || !email) {
      return res.status(400).json({
        status: false,
        message: "Google ID and email are required",
      });
    }

    let user = await User.findOne({ $or: [{ googleId }, { email }] });

    if (!user) {
      user = await User.create({
        googleId,
        email,
        verified: true,
        inforAccountGoogle: {
          avatar: {
            url: avatar,
          },
          firstName,
          lastName,
        },
      });
    } else {
      if (user.isDisabled) {
        return res.status(400).json({
          status: false,
          message: "Account has been disabled. Please contact admin",
        });
      }

      if (!user.googleId) {
        user.googleId = googleId;
        user.inforAccountGoogle = {
          avatar: {
            url: avatar,
          },
          firstName,
          lastName,
        };
        await user.save({
          new: true,
          validateModifiedOnly: true,
        });
      }
    }

    const token = signToken(user._id, TYPE_LOGIN.byGoogle);

    await updateDeviceManagement(user, req);

    return res.status(200).json({
      status: true,
      message: "Logged in successfully",
      data: {
        token,
        userId: user._id,
        loginType: TYPE_LOGIN.byGoogle,
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
    if (!userDoc)
      return res.status(404).json({ message: "Not found user", status: false });

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

  if (!user || !user.isCreatedByPass) {
    return res.status(404).json({
      status: false,
      message: "Not found user",
    });
  }

  const resetToken = await user.createPasswordResetToken();

  const urlReset = `${DEV_URL}/auth/newPassword/${resetToken}`;
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
      message: "There was an error sending the email, Please try again later",
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
        message: "Token is Invalid or Expired",
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
    return res.status(500).json({
      status: false,
      message: error,
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
        message: "Current password is incorrect",
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

const updateDeviceManagement = async (user, req) => {
  const parser = new uaParser(req.headers["user-agent"]);
  const resultInforDevice = parser.getResult();
  const deviceId = getDeviceId(req);

  const isAlreadyExist = user.deviceManagement.find(
    (device) => device.deviceId === deviceId
  );

  if (!isAlreadyExist) {
    user.deviceManagement.push({
      deviceId,
      deviceName: resultInforDevice.device.model || "Unknown",
      deviceType: resultInforDevice.device.type || "PC",
      browser: resultInforDevice.browser.name || "Unknown",
      timeDetected: moment().format("HH:mm:ss DD-MM-YYYY"),
    });

    await user.save({
      new: true,
      validateModifiedOnly: true,
    });
  }
};

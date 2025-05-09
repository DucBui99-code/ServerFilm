const jwt = require("jsonwebtoken");
const otpGenerator = require("otp-generator");
const uaParser = require("ua-parser-js");
const moment = require("moment");
const { v4 } = require("uuid");
const crypto = require("crypto");

const {
  LIMIT_DEVICE,
  EXPIRED_TIME_OTP,
  EXPIRED_TIME_TOKEN,
  NUMBER_OTP_GENERATE,
  TYPE_LOGIN,
  MAX_AGE_COOKIE,
  TIME_CHANGE_PASSWORD,
} = require("../config/CONSTANT.js");

const filterObj = require("../utils/fillterObject");
const mailServices = require("../services/mailer");
const User = require("../models/UserModel.js");
const resetPassword = require("../templates/Mail/resetPassword.js");
const otp = require("../templates/Mail/otp");
const { getDeviceId } = require("../services/getDeviceId.js");
const redis = require("../config/redis.js");
const throwError = require("../utils/throwError.js");

const options = {
  expiresIn: EXPIRED_TIME_TOKEN,
};

const signToken = (userId, typeLogin, jit) =>
  jwt.sign({ userId, typeLogin, jit }, process.env.JWT_SECRET, options);

const isDevelopment = process.env.NODE_ENV === "development";

// Register
exports.register = async (req, res, next) => {
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
        throwError("Username is already in use", 410);
      }
    }

    if (userDocEmail && userDocEmail.verified && userDocEmail.isCreatedByPass) {
      if (userDocEmail.email === email) {
        throwError("Email is already in use", 409);
      }
    }
    if (
      userDocEmail &&
      new Date(userDocEmail.otpExpires).getTime() > Date.now()
    ) {
      return res.status(400).json({
        status: false,
        message: "OTP is still valid. Please check your email.",
        timeExpired: EXPIRED_TIME_OTP,
      });
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
    next(error);
  }
};

// Send OTP
exports.sendOTP = async (req, res, next) => {
  try {
    const { userId } = req.body;

    const user = await User.findById(userId);

    if (!user) {
      throwError("User does not exist");
    }

    if (user.isCreatedByPass) {
      throwError("This account has been verify");
    }

    if (new Date(user.otpExpires).getTime() > Date.now()) {
      return res.status(400).json({
        status: false,
        message: "OTP is still valid. Please check your email.",
        timeExpired: EXPIRED_TIME_OTP,
      });
    }

    const new_otp = otpGenerator.generate(NUMBER_OTP_GENERATE, {
      upperCaseAlphabets: false,
      specialChars: false,
      lowerCaseAlphabets: false,
    });

    const otpExpires = Date.now() + EXPIRED_TIME_OTP * 60 * 1000;

    user.otpExpires = otpExpires;
    user.otp = new_otp;

    await user.save({
      validateModifiedOnly: true,
      new: true,
    });

    await mailServices.sendEmail({
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
    next(error);
  }
};

// Verify OTP
exports.verifyOTP = async (req, res, next) => {
  try {
    const { email, otp } = req.body;

    const user = await User.findOne({
      email: email,
    });

    if (!user) {
      throwError("Email is invalid");
    }

    if (user.isCreatedByPass) {
      throwError("This account has been verify");
    }

    if (new Date(user.otpExpires).getTime() < Date.now()) {
      throwError("OTP is expired");
    }

    if (!(await user.correctOTP(otp, user.otp))) {
      throwError("OTP is incorrect");
    }

    user.otp = undefined;
    user.verified = true;
    user.isCreatedByPass = true;
    user.avatar = {
      url: `https://ui-avatars.com/api/?name=${user.username}&background=0D8ABC&color=fff`,
      id: "",
    };

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
    next(error);
  }
};

exports.getMe = async (req, res, next) => {
  try {
    const { userId, typeLogin } = req.user;

    const user = await User.findById(userId)
      .select("avatar username inforAccountGoogle email")
      .lean();

    if (!user) {
      throwError("User not found");
    }

    let avatar = null;
    if (typeLogin === TYPE_LOGIN.byGoogle) {
      avatar = user.inforAccountGoogle?.avatar || null;
    } else if (typeLogin === TYPE_LOGIN.byPass) {
      avatar = user.avatar || null;
    }

    return res.status(200).json({
      status: true,
      message: "User information retrieved successfully",
      data: {
        userInfo: {
          username: user.username,
          avatar,
          email: user.email,
        },
        userId,
        loginType: typeLogin,
      },
    });
  } catch (error) {
    next(error);
  }
};

// Login
exports.login = async (req, res, next) => {
  try {
    const { identifier, password } = req.body;

    if (!identifier.trim() || !password.trim()) {
      throwError("Both identifier and password are required");
    }

    const userDoc = await User.findOne({
      $or: [{ email: identifier }, { username: identifier }],
    }).select("+password");

    if (!userDoc) {
      throwError("Identifier or Password is incorrect");
    }

    if (!(await userDoc.isCorrectPassword(password, userDoc.password))) {
      throwError("Identifier or Password is incorrect");
    }

    if (!userDoc.verified || !userDoc.isCreatedByPass) {
      throwError("Account has not been verified");
    }

    if (userDoc.isDisabled) {
      throwError("Account has been disabled. Please contact the admin");
    }

    if (userDoc.deviceManagement.length > LIMIT_DEVICE) {
      throwError(`Just only allow ${LIMIT_DEVICE} login`);
    }

    await updateDeviceManagement(userDoc, req);

    const token = signToken(userDoc._id, TYPE_LOGIN.byPass, v4());

    // Lưu token vào HttpOnly Cookie
    res.cookie("access_token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production", // Chỉ gửi qua HTTPS khi ở môi trường production
      sameSite: isDevelopment ? "Strict" : "None",
      maxAge: MAX_AGE_COOKIE,
    });

    return res.status(200).json({
      status: true,
      message: "Logged in successfully",
      data: {
        userId: userDoc._id,
        typeLogin: TYPE_LOGIN.byPass,
        token: token,
      },
    });
  } catch (error) {
    next(error);
  }
};

exports.loginWithGoogle = async (req, res, next) => {
  try {
    const { googleId, email, avatar, firstName, lastName } = req.body;

    if (!googleId || !email) {
      throwError("Google ID and email are required");
    }

    const user = await User.findOne({ $or: [{ googleId }, { email }] });

    if (!user) {
      // gen random number to username
      const randomNumber = otpGenerator.generate(3, {
        upperCaseAlphabets: false,
        specialChars: false,
        lowerCaseAlphabets: false,
      });
      const username = firstName + lastName + randomNumber;

      user = await User.create({
        googleId,
        email,
        username,
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
        throwError("Account has been disabled. Please contact admin");
      }

      if (!user.googleId) {
        user.googleId = googleId;
        user.inforAccountGoogle = {}; // Đảm bảo không bị undefined
        user.inforAccountGoogle.avatar = { url: avatar };
        user.inforAccountGoogle.firstName = firstName;
        user.inforAccountGoogle.lastName = lastName;

        user.markModified("inforAccountGoogle"); // Báo MongoDB rằng field này đã thay đổi
        await user.save({ validateModifiedOnly: true });
      }
    }

    const token = signToken(user._id, TYPE_LOGIN.byGoogle, v4());

    await updateDeviceManagement(user, req);
    // Lưu token vào HttpOnly Cookie
    res.cookie("access_token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production", // Chỉ gửi qua HTTPS khi ở môi trường production
      sameSite: isDevelopment ? "Strict" : "None",
      maxAge: MAX_AGE_COOKIE,
    });

    return res.status(200).json({
      status: true,
      message: "Logged in successfully",
      data: {
        userId: user._id,
        typeLogin: TYPE_LOGIN.byGoogle,
        token: token,
      },
    });
  } catch (error) {
    next(error);
  }
};

// Remove Account
exports.deleteAccount = async (req, res, next) => {
  try {
    const { userId } = req.user;
    const userDoc = await User.findById(userId);

    if (!userDoc) {
      throwError("User not found");
    }

    userDoc.isDisabled = true;
    await userDoc.save({ validateModifiedOnly: true });

    return res.status(200).json({
      status: true,
      message: "Account disabled successfully",
    });
  } catch (error) {
    next(error);
  }
};

// Logout Acount
exports.logout = async (req, res, next) => {
  try {
    const { userId, jit } = req.user;
    const deviceId = getDeviceId(req);

    const userDoc = await User.findById(userId);
    if (!userDoc) return throwError("User not found");

    // Xóa session của thiết bị hiện tại
    userDoc.deviceManagement = userDoc.deviceManagement.filter(
      (device) => device.deviceId !== deviceId
    );
    await userDoc.save({
      new: true,
      validateModifiedOnly: true,
    });

    // Đưa token vào danh sách đen trong Redis
    await redis.set(
      `TOKEN_BLACK_LIST_${userId}_${jit}`,
      1,
      "EX",
      7 * 24 * 60 * 60
    ); // Hết hạn sau 7 ngày

    // Xóa token từ cookie
    res.clearCookie("access_token", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "Strict",
    });

    return res.status(200).json({
      status: true,
      message: "Logged out successfully",
    });
  } catch (error) {
    next(error);
  }
};

// Forgot Password
exports.forgotPassword = async (req, res, next) => {
  try {
    const { email } = req.body;

    const user = await User.findOne({ email: email });

    if (!user || !user.isCreatedByPass) {
      throwError("Not found user");
    }

    if (!user.verified) {
      throwError("Account has not been verified");
    }
    if (user.isDisabled) {
      throwError("Account has been disabled. Please contact admin");
    }
    if (user.passwordResetExpires && user.passwordResetExpires > Date.now()) {
      throwError("Please try again after sometime");
    }

    const resetToken = await user.createPasswordResetToken();
    await user.save({ validateModifiedOnly: true });

    const urlReset = `${
      isDevelopment
        ? process.env.DEV_ALLOW_URL
        : process.env.PRODUCTION_ALLOW_URL
    }/auth/newPassword/${resetToken}`;
    // Send Email
    await mailServices.sendEmail({
      to: user.email,
      subject: "Reset Password",
      html: resetPassword(user.username, urlReset, TIME_CHANGE_PASSWORD),
      attachments: [],
    });

    return res.status(200).json({
      status: true,
      message: "Send reset password successfully",
    });
  } catch (error) {
    next(error);
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
      throwError("Token is invalid or has expired");
    }
    user.password = password;
    user.passwordResetToken = undefined;
    user.passwordResetExpires = undefined;

    await user.save({ validateModifiedOnly: true });

    return res.status(200).json({
      status: true,
      message: "Send reset password successfully",
    });
  } catch (error) {
    next(error);
  }
};

// Change Password
exports.updatePassword = async (req, res, next) => {
  try {
    const { userId } = req.user;
    const { currentPassword, password } = req.body;

    const user = await User.findById(userId).select("+password");

    if (!(await user.isCorrectPassword(currentPassword, user.password))) {
      throwError("Current password is incorrect", 410);
    }

    user.password = password;

    await user.save({ validateModifiedOnly: true });
    return res.status(200).json({
      status: true,
      message: "Password updated successfully",
    });
  } catch (error) {
    next(error);
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

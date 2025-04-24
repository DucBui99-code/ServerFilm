const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const crypto = require("crypto");
const { TIME_CHANGE_PASSWORD } = require("../config/CONSTANT");

const UserSchema = new mongoose.Schema(
  {
    googleId: { type: String, unique: true, sparse: true },
    inforAccountGoogle: {
      firstName: {
        type: String,
      },
      lastName: {
        type: String,
      },
      avatar: {
        url: {
          type: String,
        },
      },
    },
    role: { type: String, enum: ["admin", "normal"], default: "normal" },
    username: {
      type: String,
      unique: true,
      sparse: true,
      maxLength: [20, "username must be less than 20 characters"],
    },
    avatar: {
      id: String,
      url: String,
    },
    firstName: {
      type: String,
      maxLength: [20, "firstName must be less than 20 characters"],
    },
    lastName: {
      type: String,
      maxLength: [20, "lastName must be less than 20 characters"],
    },
    birthDay: {
      type: String,
    },
    sex: {
      type: String,
      enum: ["Male", "Female", "Other"],
    },

    phoneNumber: {
      type: String,
      validate: {
        validator: function (v) {
          return /^(?:\+84|0)(3[2-9]|5[2689]|7[0-9]|8[1-9]|9[0-9])\d{7}$/.test(
            v
          );
        },
        message: (props) =>
          `${props.value} is not a valid Vietnamese phone number!`,
      },
    },
    email: {
      type: String,
      required: [true, "Email is required"],
      validate: {
        validator: function (email) {
          return String(email)
            .toLowerCase()
            .match(
              /^(([^<>()[\]\\.,;:\s@"]+(\.[^<>()[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/
            );
        },
        message: (props) => `Email (${props.value}) is invalid!`,
      },
    },
    password: {
      type: String,
      minLength: [3, "Password must be greater than 3 characters"],
      maxLength: [15, "Password must be less than 15 characters"],
    },
    passwordResetToken: {
      type: String,
    },
    passwordResetExpires: {
      type: Date,
    },
    isCreatedByPass: {
      type: Boolean,
      default: false,
    },
    verified: {
      type: Boolean,
      default: false,
    },
    otp: {
      type: String,
    },
    otpExpires: {
      type: Date,
    },
    isDisabled: {
      type: Boolean,
      default: false,
    },
    purchasedMoviesMonth: [
      {
        packageId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "PackagesPrice",
          required: true,
        },
        name: String,
        purchaseDate: String,
        exprationDate: String,
      },
    ],

    purchasedMoviesRent: [
      {
        movieId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "DetailMovie",
          required: true,
        },
        purchaseDate: String,
        exprationDate: String,
      },
    ],

    favoriteMovies: [
      {
        movieId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "DetailMovie",
          required: true,
        },
      },
    ],
    deviceManagement: [
      {
        deviceId: String,
        deviceName: String,
        deviceType: String,
        browser: String,
        timeDetected: String,
      },
    ],
  },
  { timestamps: true }
);

UserSchema.pre("save", async function (next) {
  // Xử lý OTP
  if (this.isModified("otp") && this.otp) {
    this.otp = await bcrypt.hash(this.otp, 12);
  }

  // Xử lý password
  if (this.isModified("password") && this.password) {
    this.password = await bcrypt.hash(this.password, 12);
  }

  // Xử lý passwordResetToken
  if (this.isModified("passwordResetToken") && this.passwordResetToken) {
    this.passwordResetToken = crypto
      .createHash("sha256")
      .update(this.passwordResetToken)
      .digest("hex");
    this.passwordResetExpires = Date.now() + 5 * 60 * 1000;
  }

  next();
});
UserSchema.methods.isCorrectPassword = async function (
  candidatePassword,
  userPassword
) {
  if (!userPassword || !candidatePassword) return false;
  return await bcrypt.compare(candidatePassword, userPassword);
};

UserSchema.methods.correctOTP = async function (candidateOTP, userOTP) {
  if (!candidateOTP || !userOTP) return false;

  return await bcrypt.compare(candidateOTP, userOTP);
};

UserSchema.methods.createPasswordResetToken = function () {
  const resetToken = crypto.randomBytes(32).toString("hex");
  const hashToken = crypto
    .createHash("sha256")
    .update(resetToken)
    .digest("hex");
  this.passwordResetToken = hashToken;
  this.passwordResetExpires = Date.now() + TIME_CHANGE_PASSWORD * 60 * 1000;
  // You need to save the user object after modifying it
  return hashToken;
};

const User = mongoose.model("Users", UserSchema);

module.exports = User;

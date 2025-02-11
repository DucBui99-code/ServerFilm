const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const crypto = require("crypto");

const UserSchema = new mongoose.Schema(
  {
    username: {
      type: String,
      required: [true, "Name is required"],
      maxLength: [10, "username must be less than 10 characters"],
    },
    avatar: {
      id: String,
      url: String,
    },
    firstLastName: {
      type: String,
      maxLength: [20, "firstLastName must be less than 20 characters"],
    },
    birthDay: {
      type: String,
    },
    sex: {
      type: String,
      enum: ["Male", "Female", "Ohter"],
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
      required: [true, "Password is required"],
      minLength: [3, "Password must be greater than 3 characters"],
      maxLength: [15, "Password must be less than 15 characters"],
    },
    passwordResetToken: {
      type: String,
    },
    passwordResetExpires: {
      type: Date,
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

    purchasedHistory: [
      {
        name: String,
        price: Number,
        purchaseDate: String,
        status: {
          type: String,
          enum: ["success", "fault", "pending"],
        },
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
  // Only run this function if password was actually modified
  if (!this.isModified("otp") || !this.otp) return next();

  // Hash the otp with cost of 12
  this.otp = await bcrypt.hash(this.otp.toString(), 12);

  next();
});

UserSchema.pre("save", async function (next) {
  // Chỉ hash nếu mật khẩu bị thay đổi
  if (!this.isModified("password") || !this.password) return next();

  this.password = await bcrypt.hash(this.password, 12);

  next();
});

UserSchema.pre("save", async function (next) {
  // Only run this function if password was actually modified
  if (!this.isModified("passwordResetToken") || !this.passwordResetToken)
    return next();

  // Hash the password with cost of 12
  this.passwordResetToken = crypto
    .createHash("sha256")
    .update(this.passwordResetToken)
    .digest("hex");
  this.passwordResetExpires = Date.now() + 5 * 60 * 1000;

  next();
});

UserSchema.methods.isCorrectPassword = async function (
  candidatePassword,
  userPassword
) {
  return await bcrypt.compare(candidatePassword, userPassword);
};

UserSchema.methods.correctOTP = async function (candidateOTP, userOTP) {
  return await bcrypt.compare(candidateOTP, userOTP);
};

UserSchema.methods.createPasswordResetToken = function () {
  const resetToken = crypto.randomBytes(32).toString("hex");
  return resetToken;
};

const User = new mongoose.model("Users", UserSchema);

module.exports = User;

const mongoose = require("mongoose");
const { PAYMENT_METHODS, PACKAGE_TYPE, STATUS } = require("../config/CONSTANT");

const billSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Users",
      required: true,
    },
    packageId: { type: String, required: true },
    packageName: { type: String, required: true },
    packageType: {
      type: String,
      enum: PACKAGE_TYPE,
    },
    isApplied: { type: Boolean },
    price: { type: Number, required: true },
    paymentMethod: {
      type: String,
      enum: PAYMENT_METHODS,
      required: true,
    },
    paymentStatus: {
      type: String,
      enum: STATUS,
      default: "pending",
    },
    transactionId: { type: String },
    refundStatus: {
      type: String,
      enum: ["none", "pending", "completed"],
      default: "none",
    },
    orderStatus: {
      type: String,
      enum: ["processing", "completed", "cancelled"],
      default: "completed",
    },
    note: { type: String },
    logs: [
      {
        status: String,
        message: String,
        timestamp: { type: Date, default: Date.now }, // ✅ Giữ nguyên mặc định
      },
    ],
    createdAt: { type: Date, default: Date.now }, // ✅ Giữ nguyên mặc định
    paidAt: { type: Date, default: null },
    updatedAt: { type: Date, default: Date.now }, // ✅ Giữ nguyên mặc định
  },
  { timestamps: true } // ✅ Mongoose sẽ tự động tạo `createdAt` và `updatedAt`
);

module.exports = mongoose.model("Bill", billSchema);

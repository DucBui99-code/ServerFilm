const mongoose = require("mongoose");
const { PAYMENT_METHODS } = require("../config/CONSTANT");

const billSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Users",
      required: true,
    },
    packageId: { type: String, required: true },
    packageName: { type: String, required: true },
    quantity: { type: Number, required: true, default: 1 },
    totalAmount: { type: Number, required: true },
    paymentMethod: {
      type: String,
      enum: PAYMENT_METHODS,
      required: true,
    },
    paymentStatus: {
      type: String,
      enum: ["pending", "completed", "failed"],
      default: "pending",
    },
    transactionId: { type: String },
    paymentTime: { type: Date },
    refundStatus: {
      type: String,
      enum: ["none", "pending", "completed"],
      default: "none",
    },
    orderStatus: {
      type: String,
      enum: ["processing", "completed", "cancelled"],
      default: "processing",
    },
    note: { type: String },
    logs: [
      {
        status: String,
        message: String,
        timestamp: { type: Date, default: Date.now },
      },
    ],
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now },
  },
  { timestamps: true } // Tự động tạo createdAt và updatedAt
);

module.exports = mongoose.model("Bill", billSchema);

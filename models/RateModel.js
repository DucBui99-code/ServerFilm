const mongoose = require("mongoose");

const rateSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Users",
      required: true,
    },
    content: {
      type: String,
      default: "",
    },
    movie: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "DetailMovie",
      required: true,
    },
    star: {
      type: Number,
      min: 1,
      max: 5,
      required: true,
    },
    typeComment: { type: String, enum: ["byGoogle", "byPass"] },
    createdAt: {
      type: Date,
      default: Date.now,
    },
    updatedAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("Rate", rateSchema);

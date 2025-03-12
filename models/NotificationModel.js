const mongoose = require("mongoose");

const Schema = mongoose.Schema;

const NotificationSchema = new Schema({
  senderId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Users",
    required: true,
  },
  receiverId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Users",
    required: true,
  },
  userType: {
    type: String,
    enum: ["byGoogle", "byPass"],
  },
  content: {
    type: String,
    required: true,
  },
  isRead: {
    type: Boolean,
    default: false,
  },
  isHiden: {
    type: Boolean,
    default: false,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  movieId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "DetailMovie",
    required: true,
  },

  type: String,
});

module.exports = mongoose.model("Notification", NotificationSchema);

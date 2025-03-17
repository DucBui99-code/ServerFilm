const mongoose = require("mongoose");

const Schema = mongoose.Schema;

const NotificationSchema = new Schema({
  senderId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Users",
  },
  receiverId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Users",
  },
  userType: {
    type: String,
    enum: ["byGoogle", "byPass"],
  },
  content: {
    type: String,
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
  },
  type: {
    type: String,
    enum: ["reply", "like", "system"],
    required: true,
  },
});

module.exports = mongoose.model("Notification", NotificationSchema);

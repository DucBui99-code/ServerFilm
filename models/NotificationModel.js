const mongoose = require("mongoose");

const Schema = mongoose.Schema;

const NotificationSchema = new Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Users",
    required: true,
  },
  messages: [
    {
      userSend: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Users",
        required: true,
      },
      message: {
        type: String,
        required: true,
      },
      read: {
        type: Boolean,
        default: false,
      },
      createdAt: {
        type: Date,
        default: Date.now,
      },
      movie: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "DetailMovie",
        required: true,
      },
    },
  ],
});

module.exports = mongoose.model("Notification", NotificationSchema);

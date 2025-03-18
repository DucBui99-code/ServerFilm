const mongoose = require("mongoose");

const replySchema = new mongoose.Schema({
  commentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Comment",
    required: true,
  },
  user: { type: mongoose.Schema.Types.ObjectId, ref: "Users", required: true },
  content: { type: String, required: true },
  likesRef: [{ type: mongoose.Schema.Types.ObjectId, ref: "Users" }],
  disLikesRef: [{ type: mongoose.Schema.Types.ObjectId, ref: "Users" }],
  likes: { type: Number, default: 0 },
  disLikes: { type: Number, default: 0 },
  time: { type: Date, default: Date.now },
  edited: { type: Boolean, default: false },
  replyTo: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Users",
    required: false,
  },
  typeComment: { type: String, enum: ["byGoogle", "byPass"] },
});

const Reply = mongoose.model("Reply", replySchema);
module.exports = Reply;

const mongoose = require("mongoose");

const commentSchema = new mongoose.Schema({
  movieId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "DetailMovie",
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
  typeComment: { type: String, enum: ["byGoogle", "byPass"] },
});

const Comment = mongoose.model("Comment", commentSchema);
module.exports = Comment;

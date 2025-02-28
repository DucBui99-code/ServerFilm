const mongoose = require("mongoose");

const replySchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: "Users", required: true },
  content: { type: String, required: true },
  likesRef: [{ type: mongoose.Schema.Types.ObjectId, ref: "Users" }],
  disLikesRef: [{ type: mongoose.Schema.Types.ObjectId, ref: "Users" }],
  likes: { type: Number, default: 0 }, // Tổng số like
  disLikes: { type: Number, default: 0 }, // Tổng số dislike
  time: { type: Date, default: Date.now },
  edited: { type: Boolean, default: false },
  replyTo: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Users",
    required: false,
  },
  typeComment: {
    type: String,
    enum: ["byGoogle", "byPass"],
  },
});

const commentsSchema = new mongoose.Schema({
  movieId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "DetailMovie",
    required: true,
  },
  comments: [
    {
      user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Users",
        required: true,
      },
      content: { type: String, required: true },
      likesRef: [{ type: mongoose.Schema.Types.ObjectId, ref: "Users" }],
      disLikesRef: [{ type: mongoose.Schema.Types.ObjectId, ref: "Users" }],
      likes: { type: Number, default: 0 }, // Tổng số like
      disLikes: { type: Number, default: 0 }, // Tổng số dislike
      time: { type: Date, default: Date.now },
      edited: { type: Boolean, default: false },
      typeComment: {
        type: String,
        enum: ["byGoogle", "byPass"],
      },
      replies: [replySchema], // Gắn replies vào comment
    },
  ],
});

const CommentMovie = mongoose.model("Comments", commentsSchema);

module.exports = { CommentMovie };

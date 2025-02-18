const mongoose = require("mongoose");

const detailMovieSchema = new mongoose.Schema({
  name: { type: String, required: true },
  slug: { type: String, required: true, unique: true },
  origin_name: { type: String },
  thumb_url: { type: String },
  poster_url: { type: String },
  tmdb: {
    type: { type: String },
    season: { type: Number },
    vote_average: { type: Number, default: 0 },
    vote_count: { type: Number, default: 0 },
  },
  year: { type: Number },
  category: [{ name: { type: String }, slug: { type: String } }],
  country: [{ name: { type: String }, slug: { type: String } }],
  director: [{ type: String }],
  actor: [{ type: String }],
  status: { type: String },
  type: { type: String },
  content: { type: String },
  episode_total: { type: String },
  episode_current: { type: String },
  quality: { type: String },
  lang: { type: String },
  time: { type: String },
  view: { type: Number, default: 0 },
  isCopyRight: { type: Boolean },
  isCenima: { type: Boolean },
  isMono: { type: Boolean },
  created: {
    time: { type: Date, default: Date.now },
  },
  showtimes: { type: String },
  episodes: [
    {
      server_name: { type: String, required: true },
      server_data: [
        {
          name: { type: String, required: true },
          slug: { type: String, required: true },
          filename: { type: String },
          link_embed: { type: String, required: true },
          link_m3u8: { type: String },
        },
      ],
    },
  ],
  modified: {
    time: { type: Date },
  },
  comments: [
    {
      user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Users",
        required: true,
      },
      content: { type: String, required: true },
      likes: { type: Number, default: 0 },
      disLikes: { type: Number, default: 0 },
      time: { type: Date, default: Date.now },
      edited: {
        type: Boolean,
        deafault: false,
      },
      replies: [
        {
          user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Users",
            required: true,
          },
          content: { type: String, required: true },
          likes: { type: Number, default: 0 },
          disLikes: { type: Number, default: 0 },
          time: { type: Date, default: Date.now },
          edited: {
            type: Boolean,
            deafault: false,
          },
          replyTo: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Users",
            required: false,
          },
        },
      ],
    },
  ],
});

const DetailMovie = mongoose.model("DetailMovie", detailMovieSchema);

const DetailMovieRent = DetailMovie.discriminator(
  "DetailMovieRent",
  new mongoose.Schema(
    {
      movieId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Movie",
        required: true,
      },
      isBuyByMonth: { type: Boolean, default: true },
      isBuyBySingle: { type: Boolean, default: true },
      price: { type: Number },
      duration: { type: Number, defaulValue: 2 },
    },
    { discriminatorKey: "__t" }
  )
);

module.exports = { DetailMovie, DetailMovieRent };

const mongoose = require("mongoose");

const movieSchema = new mongoose.Schema({
  tmdb: {
    type: {
      type: String, // "tv" hoặc "movie"
      required: true,
    },
    season: { type: Number },
    vote_average: { type: Number },
    vote_count: { type: Number },
  },
  imdb: {
    id: { type: String },
  },
  modified: {
    time: { type: Date },
  },
  name: { type: String, required: true },
  slug: { type: String, required: true },
  origin_name: { type: String, required: true },
  thumb_url: { type: String, required: true },
  poster_url: { type: String, required: true },
  year: { type: Number, required: true },
});

const Movie = mongoose.model("Movie", movieSchema);

const MovieRent = Movie.discriminator(
  "MovieRent",
  new mongoose.Schema(
    {
      isBuyByMonth: { type: Boolean, default: true },
      isBuyBySingle: { type: Boolean, default: true },
      price: { type: Number },
      duration: { type: Number, defaulValue: 2 },
    },
    { discriminatorKey: "__t" }
  ) // Đặt discriminatorKey trong options
);

module.exports = { Movie, MovieRent };

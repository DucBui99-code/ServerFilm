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
  category: [{ name: { type: String }, slug: { type: String } }], // Danh mục thể loại
  country: [{ name: { type: String }, slug: { type: String } }], // Quốc gia
  director: [{ type: String }], // Đạo diễn
  actor: [{ type: String }], // Diễn viên
  status: { type: String }, // Trạng thái (Full, Đang chiếu,...)
  type: { type: String },
  content: { type: String }, // Loại (Phim bộ, Phim lẻ,...)
  episode_total: { type: String }, // Tổng số tập
  episode_current: { type: String }, // Số tập hiện tại
  quality: { type: String }, // Chất lượng phim
  lang: { type: String }, // Ngôn ngữ phim
  time: { type: String }, // Thời lượng phim,
  view: { type: Number, default: 0 }, // Số lượt xem
  isCopyRight: { type: Boolean }, // Bản quyền
  isCenima: { type: Boolean }, // Phim chiếu rạp
  isMono: { type: Boolean }, // Phim độc quyền
  created: {
    time: { type: Date, default: Date.now },
  },
  showtimes: { type: String }, // Lịch chiếu
  episodes: [
    {
      server_name: { type: String, required: true }, // Server phát phim
      server_data: [
        {
          name: { type: String, required: true }, // Tên tập phim
          slug: { type: String, required: true }, // Slug tập phim
          filename: { type: String }, // Filename nếu có
          link_embed: { type: String, required: true }, // Link nhúng video
          link_m3u8: { type: String }, // Link M3U8 nếu có
        },
      ],
    },
  ],
  modified: {
    time: { type: Date },
  },
});

const DetailMovie = mongoose.model("DetailMovie", detailMovieSchema);

module.exports = DetailMovie;

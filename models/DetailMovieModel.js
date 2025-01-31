const mongoose = require("mongoose");

const detailMovieSchema = new mongoose.Schema({
  name: { type: String, required: true },
  slug: { type: String, required: true, unique: true },
  origin_name: { type: String },
  thumb_url: { type: String },
  poster_url: { type: String },
  year: { type: String },
  category: [{ type: String }], // Danh mục thể loại
  country: [{ type: String }], // Quốc gia
  description: { type: String }, // Mô tả phim
  director: [{ type: String }], // Đạo diễn
  actor: [{ type: String }], // Diễn viên
  status: { type: String }, // Trạng thái (Full, Đang chiếu,...)
  type: { type: String }, // Loại (Phim bộ, Phim lẻ,...)
  total_episodes: { type: String }, // Tổng số tập
  episodes: [
    {
      server_name: { type: String, required: true }, // Server phát phim
      episodes: [
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
    time: { type: Date, default: Date.now },
  },
});

const DetailMovie = mongoose.model("DetailMovie", detailMovieSchema);

module.exports = DetailMovie;

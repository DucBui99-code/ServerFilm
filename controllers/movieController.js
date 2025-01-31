const Movie = require("../models/MovieModel");

exports.getAllMovies = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = 24;
    const skip = (page - 1) * limit;

    // Lấy tổng số lượng phim
    const totalMovies = await Movie.countDocuments();

    // Lấy danh sách phim theo trang
    const movies = await Movie.find().skip(skip).limit(limit);

    return res.json({
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(totalMovies / limit),
        totalMovies,
      },
      items: movies,
      pathImage: "https://img.ophim.live/uploads/movies/",
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const moment = require("moment");
const { PackagePrice } = require("../models/PackageMovieModel");
const { DetailMovie } = require("../models/DetailMovieModel");

const User = require("../models/UserModel");

exports.createPackage = async (req, res) => {
  const { name, duration, price } = req.body;

  //  Kiểm tra duration có phải số nguyên dương không
  if (!Number.isInteger(duration) || duration <= 0) {
    return res.status(400).json({
      message:
        "Duration phải là số nguyên dương và không được là số thập phân.",
      status: false,
    });
  }

  const newPackage = new PackagePrice({ name, price, duration });
  await newPackage.save();

  return res.status(201).json({
    status: true,
    message: "Package created",
  });
};

exports.getPackage = async (req, res) => {
  try {
    const { movieId } = req.query;
    let packageMovieSingle = {};

    if (movieId) {
      const dataDetailMovie = await DetailMovie.findById(movieId).lean();

      if (dataDetailMovie) {
        // Only populate packageMovieSingle if the movie is valid
        if (
          dataDetailMovie.__t === "DetailMovieRent" &&
          dataDetailMovie.isBuyBySingle
        ) {
          packageMovieSingle = {
            name: dataDetailMovie.name,
            price: dataDetailMovie.price,
            _id: dataDetailMovie._id,
          };
        }
      }
    }

    const packages = await PackagePrice.find().lean();

    if (!packages || packages.length === 0) {
      return res.status(404).json({
        status: false,
        message: "No packages available",
      });
    }

    return res.status(200).json({
      status: true,
      message: "Get Package success",
      data: {
        packageMonth: packages,
        packageSingle: packageMovieSingle, // Will be {} if no valid movie found
      },
    });
  } catch (error) {
    return res.status(500).json({
      status: false,
      message: ["Internal server error", error.message],
    });
  }
};

exports.getTotalPackageMonthDuration = async (req, res) => {
  try {
    const { userId } = req.user;
    const user = await User.findById(userId).lean();

    if (!user || user.purchasedMoviesMonth.length === 0) {
      return res.status(400).json({
        status: false,
        message: "There is no active package",
      });
    }

    const now = moment();
    let totalMonths = 0;

    // Lặp qua tất cả các gói và cộng tổng thời gian hợp lệ
    user.purchasedMoviesMonth.forEach((pkg) => {
      const expiration = moment(pkg.exprationDate, "DD/MM/YYYY");
      if (expiration.isAfter(now)) {
        const durationMonths = expiration.diff(now, "months", true);
        totalMonths += durationMonths;
      }
    });

    // Tính ngày hết hạn mới bằng cách cộng tổng số tháng vào ngày hiện tại
    const newExpirationDate = now.add(totalMonths, "months");

    return res.status(200).json({
      status: true,
      message: "Get total package month success",
      data: {
        totalMonths: Math.ceil(totalMonths), // Tổng số tháng còn lại
        expirationDate: newExpirationDate.format("DD/MM/YYYY"), // Ngày hết hạn chính xác
        isExpired: newExpirationDate.isBefore(now),
      },
    });
  } catch (error) {
    return res.status(500).json({
      status: false,
      message: error.message,
    });
  }
};

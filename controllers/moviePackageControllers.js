const moment = require("moment");
const { PackagePrice } = require("../models/PackageMovieModel");
const { DetailMovie } = require("../models/DetailMovieModel");

const User = require("../models/UserModel");
const throwError = require("../utils/throwError");
const cacheService = require("../services/cacheService");

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

exports.getPackage = async (req, res, next) => {
  try {
    const { movieId } = req.query;
    let packageMovieSingle = {};

    // 👉 Tạo cache key dựa trên movieId (nếu có)
    const cacheKey = movieId ? `package:movie:${movieId}` : `package:all`;

    // 🔹 Kiểm tra cache
    const cachedData = await cacheService.getCache(cacheKey);
    if (cachedData) {
      return res.status(200).json(cachedData);
    }

    if (movieId) {
      const dataDetailMovie = await DetailMovie.findById(movieId).lean();

      if (dataDetailMovie) {
        if (
          dataDetailMovie.__t === "DetailMovieRent" &&
          dataDetailMovie.isBuyBySingle
        ) {
          packageMovieSingle = {
            name: dataDetailMovie.name,
            price: dataDetailMovie.price,
            _id: dataDetailMovie._id,
            duration: dataDetailMovie.duration,
          };
        }
      }
    }

    const packages = await PackagePrice.find().lean();

    if (!packages || packages.length === 0) {
      throwError("No packages available");
    }

    const response = {
      status: true,
      message: "Get Package success",
      data: {
        packageMonth: packages,
        packageSingle: packageMovieSingle,
      },
    };

    // 🔹 Lưu cache (6 giờ - 21600 giây)
    await cacheService.setCache(cacheKey, response, 21600);

    return res.status(200).json(response);
  } catch (error) {
    next(error);
  }
};

exports.getTotalPackageMonthDuration = async (req, res, next) => {
  try {
    const { userId } = req.user;
    const user = await User.findById(userId).lean();

    if (!user || user.purchasedMoviesMonth.length === 0) {
      throwError("There is no active package");
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
    next(error);
  }
};

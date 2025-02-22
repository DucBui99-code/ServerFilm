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

    const now = moment();
    let totalDuration = moment.duration(0);
    let maxExpirationDate = null;

    if (user.purchasedMoviesMonth.length === 0) {
      return res.status(400).json({
        status: false,
        message: "There no pack available",
      });
    }

    user.purchasedMoviesMonth.forEach((pkg) => {
      const expiration = moment(pkg.exprationDate, "DD/MM/YYYY");
      if (expiration.isAfter(now)) {
        totalDuration.add(moment.duration(expiration.diff(now)));
      }
      if (!maxExpirationDate || expiration.isAfter(maxExpirationDate)) {
        maxExpirationDate = expiration;
      }
    });

    const isExpired = maxExpirationDate
      ? maxExpirationDate.isBefore(now)
      : true;

    const hours = totalDuration.hours();
    const minutes = totalDuration.minutes();
    const seconds = totalDuration.seconds();

    return res.status(200).json({
      status: true,
      message: "Get total package month success",
      data: {
        timeRemaining: `${String(hours).padStart(2, "0")}:${String(
          minutes
        ).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`,
        expirationDate: maxExpirationDate
          ? maxExpirationDate.format("DD/MM/YYYY")
          : null,
        isExpired,
      },
    });
  } catch (error) {
    return res.status(500).json({
      status: false,
      message: error.message,
    });
  }
};

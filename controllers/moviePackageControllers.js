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
      const dataDetailMovie = await DetailMovie.findById(movieId);

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

    const packages = await PackagePrice.find();

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

exports.buyPackageMonth = async (req, res) => {
  try {
    const { packageId } = req.body;
    const { userId } = req.user;

    const user = await User.findById(userId);

    const packageData = await PackagePrice.findById(packageId);

    if (!packageData) {
      return res
        .status(400)
        .json({ message: "Package not found", status: false });
    }

    const durationInMonths = packageData.duration; // 📌 Lấy duration từ DB
    const namePackage = packageData.name;
    const pricePackage = packageData.price;
    const now = moment();

    const existingPackage = user.purchasedMoviesMonth.find(
      (pkg) => pkg.packageId.toString() === packageId.toString()
    );
    if (existingPackage) {
      // Nếu gói đã tồn tại, cộng dồn thêm thời gian
      const currentExpiration = moment(
        existingPackage.exprationDate,
        "DD/MM/YYYY"
      );
      if (currentExpiration.isAfter(now)) {
        existingPackage.exprationDate = currentExpiration
          .add(durationInMonths, "months")
          .format("DD/MM/YYYY");
      } else {
        // Nếu gói đã hết hạn, đặt lại thời gian từ hiện tại
        existingPackage.exprationDate = now
          .add(durationInMonths, "months")
          .format("DD/MM/YYYY");
      }
    } else {
      // Nếu chưa có gói này, thêm mới
      user.purchasedMoviesMonth.push({
        packageId,
        purchaseDate: now.format("DD/MM/YYYY"),
        exprationDate: now.add(durationInMonths, "months").format("DD/MM/YYYY"),
      });
    }

    // Push history purchase
    user.purchasedHistory.push({
      name: namePackage,
      price: pricePackage,
      purchaseDate: moment().format("DD/MM/YYYY HH:mm:ss"),
    });

    await user.save({ validateModifiedOnly: true });

    return res.status(200).json({
      status: true,
      message: "Buy Package success",
      data: user.purchasedMoviesMonth,
    });
  } catch (error) {
    console.log(error.message);

    return res.status(500).json({
      status: false,
      message: ["Internal server error"],
    });
  }
};

exports.buyMovieSingle = async (req, res) => {
  try {
    const { userId } = req.user;
    const { movieId } = req.body;

    const dataMovie = await DetailMovie.findById(movieId);
    const dataUser = await User.findById(userId);

    if (!dataMovie) {
      return res
        .status(404)
        .json({ message: "Movie not found", status: false });
    }
    if (dataMovie.__t !== "DetailMovieRent" || !dataMovie.isBuyBySingle) {
      return res.status(400).json({
        message: "This movie is not available for rent.",
        status: false,
      });
    }
    if (dataMovie.duration <= 0) {
      return res.status(400).json({
        message: "Duraion must be > 0",
        status: false,
      });
    }
    const isAlreadyPurchased = dataUser.purchasedMoviesRent.some((rent) => {
      const isSameMovie = rent.movieId.toString() == movieId.toString();
      const isNotExpired = moment(rent.exprationDate, "DD/MM/YYYY").isAfter(
        moment()
      );

      return isSameMovie && isNotExpired;
    });

    if (isAlreadyPurchased) {
      return res.status(400).json({
        message: "This movie already rent and not expired",
        status: false,
      });
    }

    const existingRentIndex = dataUser.purchasedMoviesRent.findIndex(
      (rent) => rent.movieId.toString() == movieId.toString()
    );

    const purchaseDate = moment().format("DD/MM/YYYY");
    const expirationDate = moment()
      .add(dataMovie.duration, "days")
      .format("DD/MM/YYYY");

    if (existingRentIndex !== -1) {
      // Gói đã hết hạn -> cập nhật thông tin mới
      dataUser.purchasedMoviesRent[existingRentIndex].purchaseDate =
        purchaseDate;
      dataUser.purchasedMoviesRent[existingRentIndex].exprationDate =
        expirationDate;
    } else {
      // Gói chưa tồn tại -> thêm mới
      dataUser.purchasedMoviesRent.push({
        movieId,
        purchaseDate,
        exprationDate: expirationDate,
      });
    }

    dataUser.purchasedHistory.push({
      name: dataMovie.name,
      price: dataMovie.price,
      purchaseDate: moment().format("DD/MM/YYYY HH:mm:ss"),
    });

    await dataUser.save({ validateModifiedOnly: true });

    return res.status(200).json({
      status: true,
      message: "Rent movie success",
      data: dataUser.purchasedMoviesRent,
    });
  } catch (error) {
    return res.status(500).json({
      status: false,
      message: ["Internal server error"],
    });
  }
};

exports.getTotalPackageMonthDuration = async (req, res) => {
  try {
    const { userId } = req.user;

    const user = await User.findById(userId);

    const now = moment();
    let totalDuration = moment.duration(0);
    let maxExpirationDate = null;

    user.purchasedMoviesMonth.forEach((pkg) => {
      const expiration = moment(pkg.exprationDate, "DD/MM/YYYY");
      if (expiration.isAfter(now)) {
        totalDuration.add(moment.duration(expiration.diff(now)));
      }

      if (!maxExpirationDate || expiration.isAfter(maxExpirationDate)) {
        maxExpirationDate = expiration;
      }
    });

    const hours = totalDuration.hours();
    const minutes = totalDuration.minutes();
    const seconds = totalDuration.seconds();

    return res.status(200).json({
      status: true,
      message: "Get total package month success",
      data: `${String(hours).padStart(2, "0")}:${String(minutes).padStart(
        2,
        "0"
      )}:${String(seconds).padStart(2, "0")} ${maxExpirationDate.format(
        "DD/MM/YYYY"
      )}`,
    });
  } catch (error) {
    return res.status(500).json({
      status: false,
      message: ["Internal server error"],
    });
  }
};

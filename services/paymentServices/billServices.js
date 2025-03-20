const Bill = require("../../models/BillModel");
const { PackagePrice } = require("../../models/PackageMovieModel");
const { DetailMovie } = require("../../models/DetailMovieModel");
const { getIo } = require("../../config/socket");
const moment = require("moment"); // npm install moment
const { removeToList } = require("../redisService");
const throwError = require("../../utils/throwError");
const io = getIo();

exports.UpdateStatusBillService = async (billDb, status, next) => {
  try {
    billDb.paymentStatus = status;
    billDb.paidAt = moment().utcOffset(7).toDate();
    billDb.logs.push({
      status: status,
      message: `Order has ${status}`,
    });

    await billDb.save({ validateModifiedOnly: true });
    // Xóa bill khỏi danh sách Redis
    await removeToList("pending_bills", billDb.transactionId);

    // 🔥 Chỉ gửi thông báo cho đúng user có bill đó
    io.to(`user_${billDb.userId.toString()}`).emit("billUpdated", {
      billId: billDb.transactionId,
      status: 0,
      packageName: billDb.packageName,
    });
  } catch (error) {
    next(error);
  }
};

exports.CancelBillService = async (userId, transactionId, next) => {
  try {
    const billDb = await Bill.findOne({ transactionId, userId });

    if (!billDb) {
      throwError("Bill not found");
    }

    if (
      billDb.paymentStatus === "completed" ||
      billDb.paymentStatus === "failed"
    ) {
      throwError("Bill already completed or failed");
    }

    billDb.paymentStatus = "failed";
    billDb.logs.push({
      status: "cancelled",
      message: "Order cancelled by user",
    });

    await billDb.save({ validateModifiedOnly: true });
    // Xóa bill khỏi danh sách Redis
    await removeToList("pending_bills", billDb.transactionId);

    return { message: "Order canceled successfully" };
  } catch (error) {
    next(error);
  }
};

exports.ApplyPackMonth = async (userDb, packageId, next) => {
  try {
    const packageData = await PackagePrice.findById(packageId).lean();

    if (!packageData) {
      throwError("Package not found");
    }

    const durationInMonths = packageData.duration; // 📌 Lấy duration từ DB
    const namePackage = packageData.name;
    const now = moment();

    const existingPackage = userDb.purchasedMoviesMonth.find(
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
      userDb.purchasedMoviesMonth.push({
        packageId,
        name: namePackage,
        purchaseDate: now.format("DD/MM/YYYY"),
        exprationDate: now.add(durationInMonths, "months").format("DD/MM/YYYY"),
      });
    }

    await userDb.save({ validateModifiedOnly: true });
  } catch (error) {
    next(error);
  }
};

exports.ApplyPackRent = async (userDb, movieId, next) => {
  try {
    const dataMovie = await DetailMovie.findById(movieId).lean();

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

    const isAlreadyPurchased = userDb.purchasedMoviesRent.some((rent) => {
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

    const existingRentIndex = userDb.purchasedMoviesRent.findIndex(
      (rent) => rent.movieId.toString() == movieId.toString()
    );

    const purchaseDate = moment().format("DD/MM/YYYY");
    const exprationDate = moment()
      .add(dataMovie.duration, "days")
      .format("DD/MM/YYYY");

    if (existingRentIndex !== -1) {
      // Gói đã hết hạn -> cập nhật thông tin mới
      userDb.purchasedMoviesRent[existingRentIndex].purchaseDate = purchaseDate;
      userDb.purchasedMoviesRent[existingRentIndex].exprationDate =
        exprationDate;
    } else {
      // Gói chưa tồn tại -> thêm mới
      userDb.purchasedMoviesRent.push({
        movieId,
        purchaseDate,
        exprationDate: exprationDate,
      });
    }

    await userDb.save({ validateModifiedOnly: true });
  } catch (error) {
    next(error);
  }
};

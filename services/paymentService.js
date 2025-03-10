const axios = require("axios").default; // npm install axios
const dotenv = require("dotenv");
const CryptoJS = require("crypto-js"); // npm install crypto-js
const moment = require("moment"); // npm install moment
const qs = require("qs"); // npm install qs
dotenv.config({ path: "./.env" });

const {
  EXPIRED_TIME_ORDER,
  PAYMENT_METHODS,
  URL_CHECK_BILL,
  URL_CREATE_BILL,
} = require("../config/CONSTANT");

const User = require("../models/UserModel");
const Bill = require("../models/BillModel");
const { PackagePrice } = require("../models/PackageMovieModel");
const { DetailMovie } = require("../models/DetailMovieModel");

const throwError = require("../utils/throwError");

const config = {
  app_id: process.env.APP_ID,
  key1: process.env.KEY1,
  key2: process.env.KEY2,
  check_bill: URL_CHECK_BILL,
  create_bill: URL_CREATE_BILL,
};

exports.CreateBillService = async (
  userId,
  namePackage,
  pricePackage,
  transID,
  paymentMethod,
  packageId,
  packageTypeUser,
  transactionId,
  next
) => {
  const userDb = await User.findById(userId);

  // 🚀 2. Tạo đơn hàng ZaloPay
  const embed_data = { redirecturl: "http://localhost:3000" };
  const items = [{}];
  const order = {
    app_id: config.app_id,
    app_trans_id: transactionId,
    app_user: userId.toString(),
    app_time: Date.now(),
    expire_duration_seconds: EXPIRED_TIME_ORDER,
    phone: userDb?.phoneNumber,
    email: userDb.email,
    item: JSON.stringify(items),
    embed_data: JSON.stringify(embed_data),
    amount: pricePackage,
    description: `Payment for ${namePackage} - Order #${transID}`,
    bank_code: "zalopayapp",
    callback_url:
      "https://4036-42-117-129-161.ngrok-free.app/v1/MovieApp/bill/resultBillFromZalo",
  };
  // appid|app_trans_id|appuser|amount|apptime|embeddata|item
  const data =
    config.app_id +
    "|" +
    order.app_trans_id +
    "|" +
    order.app_user +
    "|" +
    order.amount +
    "|" +
    order.app_time +
    "|" +
    order.embed_data +
    "|" +
    order.item;

  order.mac = CryptoJS.HmacSHA256(data, config.key1).toString();

  try {
    const result = await axios.post(config.create_bill, null, {
      params: order,
    });

    // 📌 1. Tạo bill với trạng thái pending
    const newBill = new Bill({
      userId,
      packageName: namePackage,
      quantity: 1,
      packageId,
      totalAmount: pricePackage,
      paymentMethod,
      transactionId: transactionId,
      packageType: packageTypeUser,
      orderStatus: "processing",
    });

    userDb.purchasedHistory.push({
      name: namePackage,
      price: pricePackage,
      purchaseDate: moment().format("DD/MM/YYYY HH:mm:ss"),
      transactionId: transactionId,
      packageType: packageTypeUser,
      paymentMethod: paymentMethod,
    });

    await newBill.save();
    await userDb.save({ validateModifiedOnly: true });

    return result;
  } catch (error) {
    next(error);
  }
};

exports.ResultBillFromZaloService = async (dataStr, reqMac, next) => {
  let mac = CryptoJS.HmacSHA256(dataStr, config.key2).toString();

  if (reqMac !== mac) {
    await this.UpdateStatusBillService(userDb, billDb, "failed", next);
    throwError("mac not equal");
  }

  let dataJson = JSON.parse(dataStr, config.key2);

  const billDb = await Bill.findOne({
    transactionId: dataJson["app_trans_id"],
  });

  const userDb = await User.findById(billDb.userId);

  if (!billDb) {
    throwError("Bill not found");
  }

  if (!userDb) {
    throwError("User not found");
  }

  await this.UpdateStatusBillService(userDb, billDb, "completed", next);

  if (billDb.packageType === "packageMonth") {
    await ApplyPackMonth(userDb, billDb.packageId, next);
  } else if (billDb.packageType === "packageRent") {
    await ApplyPackRent(userDb, billDb.packageId, next);
  }
};

exports.UpdateStatusBillService = async (userDb, billDb, status, next) => {
  try {
    userDb.purchasedHistory.forEach((bill) => {
      if (bill.transactionId?.toString() === billDb?.transactionId.toString()) {
        bill.status = status;
      }
    });

    billDb.paymentStatus = status;
    billDb.paymentTime = Date.now();
    billDb.logs.push({
      status: status,
      message: `Paymemt ${status}`,
    });

    await userDb.save({ validateModifiedOnly: true });
    await billDb.save({ validateModifiedOnly: true });
  } catch (error) {
    next(error);
  }
};

exports.CheckBillService = async (userId, transactionId, next) => {
  let postData = {
    app_id: config.app_id,
    app_trans_id: transactionId, // Mã giao dịch
  };

  let data = postData.app_id + "|" + postData.app_trans_id + "|" + config.key1;
  postData.mac = CryptoJS.HmacSHA256(data, config.key1).toString();

  let postConfig = {
    method: "post",
    url: config.check_bill,
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    data: qs.stringify(postData),
  };

  try {
    const result = await axios(postConfig);
    const userDb = await User.findById(userId);
    const billDb = await Bill.findOne({ transactionId: transactionId });

    if (!billDb) {
      throwError("Bill not found");
    }

    // Nếu gói đã được áp dụng trước đó, không xử lý lại
    if (billDb.isApplied) {
      return {
        message: "Package is already update",
        status: true,
        return_code: result.data.return_code,
        packageName: billDb.packageName,
      };
    }

    switch (result.data.return_code) {
      case 1: // Thanh toán thành công
        await this.UpdateStatusBillService(userDb, billDb, "completed", next);

        if (billDb.packageType === "packageMonth") {
          await ApplyPackMonth(userDb, billDb.packageId, next);
        } else if (billDb.packageType === "packageRent") {
          await ApplyPackRent(userDb, billDb.packageId, next);
        }

        // Đánh dấu đã áp dụng để tránh chạy nhiều lần
        billDb.isApplied = true;
        await billDb.save();
        break;

      case 2: // Thanh toán thất bại
        await this.UpdateStatusBillService(userDb, billDb, "failed", next);
        break;

      case 3: // Đơn hàng chưa thanh toán hoặc đang xử lý
        break;

      default:
        throwError("Không tìm thấy mã return_code", 400);
    }

    return {
      message: result.data.return_message,
      status: true,
      return_code: result.data.return_code,
      packageName: billDb.packageName,
    };
  } catch (error) {
    next(error);
  }
};

exports.CancelBillService = async (userId, transactionId, next) => {
  try {
    const userDb = await User.findById(userId);
    const billDb = await Bill.findOne({ transactionId });

    if (!billDb) {
      throwError("Bill not found");
    }

    const billInUserHistory = userDb.purchasedHistory.find(
      (bill) => bill.transactionId.toString() === transactionId.toString()
    );

    if (!billInUserHistory) {
      throwError("Bill not found in user's history");
    }

    if (
      billDb.paymentStatus === "completed" ||
      billInUserHistory.status === "completed"
    ) {
      throwError("Bill already completed");
    }

    billDb.orderStatus = "cancelled";
    billDb.paymentStatus = "failed";
    billDb.logs.push({
      status: "cancelled",
      message: "Order cancelled by user",
    });

    userDb.purchasedHistory.forEach((bill) => {
      if (bill.transactionId.toString() === transactionId.toString()) {
        bill.status = "failed";
      }
    });

    await userDb.save({ validateModifiedOnly: true });
    await billDb.save({ validateModifiedOnly: true });

    return { message: "Order canceled successfully" };
  } catch (error) {
    next(error);
  }
};

const ApplyPackMonth = async (userDb, packageId, next) => {
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

const ApplyPackRent = async (dataUser, movieId, next) => {
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
    const exprationDate = moment()
      .add(dataMovie.duration, "days")
      .format("DD/MM/YYYY");

    if (existingRentIndex !== -1) {
      // Gói đã hết hạn -> cập nhật thông tin mới
      dataUser.purchasedMoviesRent[existingRentIndex].purchaseDate =
        purchaseDate;
      dataUser.purchasedMoviesRent[existingRentIndex].exprationDate =
        exprationDate;
    } else {
      // Gói chưa tồn tại -> thêm mới
      dataUser.purchasedMoviesRent.push({
        movieId,
        purchaseDate,
        exprationDate: exprationDate,
      });
    }

    await dataUser.save({ validateModifiedOnly: true });
  } catch (error) {
    next(error);
  }
};

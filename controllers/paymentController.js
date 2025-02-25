const dotenv = require("dotenv");
const moment = require("moment"); // npm install moment
dotenv.config({ path: "../config.env" });

const { PackagePrice } = require("../models/PackageMovieModel");
const { DetailMovie } = require("../models/DetailMovieModel");
const User = require("../models/UserModel");
const {
  CreateBillService,
  ResultBillFromZaloService,
  CheckBillService,
  CancelBillService,
} = require("../services/paymentService");
dotenv.config({ path: "../config.env" });
const { PAYMENT_METHODS } = require("../config/CONSTANT");
const throwError = require("../utils/throwError");

const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET;

exports.getPayMent = async (req, res) => {
  try {
    const signature = req.headers["x-sepay-signature"]; // Header chứa chữ ký
    const payload = req.body;

    console.log("Received Webhook:", payload);
    // Xác minh chữ ký webhook (nếu SePay hỗ trợ)
    if (signature !== WEBHOOK_SECRET) {
      return res.status(401).json({ message: "Unauthorized webhook" });
    }

    // Xử lý thông tin giao dịch
    if (payload && payload.transaction_status === "SUCCESS") {
      console.log(
        `🔹 Giao dịch thành công: ${payload.amount} VND từ ${payload.sender_name}`
      );

      // Cập nhật vào cơ sở dữ liệu, gửi thông báo,...
    }

    res.status(200).json({ message: "Webhook received" });
  } catch (error) {
    res.status(500).json({ message: error.message, status: false });
  }
};

exports.createBillPackMonth = async (req, res, next) => {
  try {
    const { userId } = req.user;
    const { packageId, paymentMethod } = req.body;

    const checkMethod = handelCheckPayMethod(paymentMethod);

    if (!checkMethod.valid) {
      throwError(checkMethod.message);
    }

    const packageData = await PackagePrice.findById(packageId).lean();

    if (!packageData) {
      throwError("Package not found");
    }

    const namePackage = packageData.name;
    const pricePackage = packageData.price;
    const transID = Math.floor(Math.random() * 1000000);
    const transactionId = `${moment().format("YYMMDD")}_${transID}`;

    const resBill = await CreateBillService(
      userId,
      namePackage,
      pricePackage,
      transID,
      paymentMethod,
      packageId,
      "packageMonth",
      transactionId,
      next
    );

    return res.status(200).json({
      status: true,
      message: "Created order successfully",
      data: {
        billData: resBill.data,
        transactionId,
      },
    });
  } catch (error) {
    next(error);
  }
};

exports.createBillPackRent = async (req, res, next) => {
  try {
    const { userId } = req.user;
    const { packageId, paymentMethod } = req.body;

    const checkMethod = handelCheckPayMethod(paymentMethod);
    if (!checkMethod.valid) {
      throwError(checkMethod.message);
    }

    const dataMovie = await DetailMovie.findById(packageId).lean();
    const dataUser = await User.findById(userId).lean();

    if (!dataMovie) {
      throwError("Movie not found");
    }
    if (dataMovie.__t !== "DetailMovieRent" || !dataMovie.isBuyBySingle) {
      throwError("This movie is not available for rent.");
    }
    if (dataMovie.duration <= 0) {
      throwError("Duraion must be > 0");
    }

    const isAlreadyPurchased = dataUser.purchasedMoviesRent.some((rent) => {
      const isSameMovie = rent.movieId.toString() == packageId.toString();
      const isNotExpired = moment(rent.exprationDate, "DD/MM/YYYY").isAfter(
        moment()
      );

      return isSameMovie && isNotExpired;
    });

    if (isAlreadyPurchased) {
      throwError("This movie already rent and not expired");
    }

    const namePackage = dataMovie.name;
    const pricePackage = dataMovie.price;
    const transID = Math.floor(Math.random() * 1000000);
    const transactionId = `${moment().format("YYMMDD")}_${transID}`;

    const resBill = await CreateBillService(
      userId,
      namePackage,
      pricePackage,
      transID,
      paymentMethod,
      packageId,
      "packageRent",
      transactionId,
      next
    );

    return res.status(200).json({
      status: true,
      message: "Created order successfully",
      data: {
        billData: resBill.data,
        transactionId,
      },
    });
  } catch (error) {
    next(error);
  }
};

exports.resultBillFromZalo = async (req, res, next) => {
  try {
    const { data, mac } = req.body;
    await ResultBillFromZaloService(data, mac, next);
  } catch (error) {
    next(error);
  }
};

exports.checkBill = async (req, res, next) => {
  try {
    const { userId } = req.user;
    const { transactionId } = req.body;
    const resCheckBill = await CheckBillService(userId, transactionId, next);
    return res.status(200).json({
      status: true,
      message: "Created order successfully",
      data: { ...resCheckBill },
    });
  } catch (error) {
    next(error);
  }
};

exports.cancelBill = async (req, res, next) => {
  const { userId } = req.user;
  const { transactionId } = req.body;
  try {
    const resBill = await CancelBillService(userId, transactionId, next);
    return res.status(200).json({
      status: true,
      message: resBill.message,
    });
  } catch (error) {
    next(error);
  }
};

const handelCheckPayMethod = (paymentMethod) => {
  if (!PAYMENT_METHODS.includes(paymentMethod)) {
    return { valid: false, message: "Payment method is not valid" };
  }
  if (paymentMethod !== "ZaloPay") {
    return {
      valid: false,
      message: "This payment method is not supported yet",
    };
  }
  return { valid: true };
};

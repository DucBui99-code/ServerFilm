const dotenv = require("dotenv");
const moment = require("moment"); // npm install moment

const { PackagePrice } = require("../models/PackageMovieModel");
const { DetailMovie } = require("../models/DetailMovieModel");
const User = require("../models/UserModel");
const {
  CreateBillServiceZalo,
  ResultBillFromZaloService,
} = require("../services/paymentServices/paymentZaloService");
const {
  CreateBillServiceSeapay,
  ResultBillFromSepayService,
} = require("../services/paymentServices/paymentSepayServices");
dotenv.config({ path: "./.env" });

const { PAYMENT_METHODS } = require("../config/CONSTANT");
const throwError = require("../utils/throwError");
const {
  CancelBillService,
} = require("../services/paymentServices/billServices");

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
    const transactionId = `${moment().format("YYMMDD")}${transID}`;

    let resBill = null;
    if (paymentMethod === "ZaloPay") {
      resBill = await CreateBillServiceZalo(
        userId,
        namePackage,
        pricePackage,
        paymentMethod,
        packageId,
        "packageMonth",
        transactionId,
        next
      );
    } else if (paymentMethod === "Bank") {
      resBill = await CreateBillServiceSeapay(
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
    }

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
    const transactionId = `${moment().format("YYMMDD")}${transID}`;

    let resBill = null;

    if (paymentMethod === "ZaloPay") {
      resBill = await CreateBillServiceZalo(
        userId,
        namePackage,
        pricePackage,
        paymentMethod,
        packageId,
        "packageRent",
        transactionId,
        next
      );
    } else if (paymentMethod === "Bank") {
      resBill = await CreateBillServiceSeapay(
        userId,
        namePackage,
        pricePackage,
        paymentMethod,
        packageId,
        "packageRent",
        transactionId,
        next
      );
    }

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

exports.resultBillFromSepay = async (req, res, next) => {
  try {
    const payload = req.body;
    const authorization = req.headers["authorization"];

    if (!authorization || !authorization.startsWith("Apikey ")) {
      return next({ message: "Unauthorized", statusCode: 400 });
    }

    // ✅ Lấy API Key
    const apiKey = authorization.replace("Apikey ", "");

    if (apiKey !== process.env.API_KEY_SEPAY) {
      return next({ message: "API_KEY_SEPAY wrong", statusCode: 400 });
    }

    // ✅ Xử lý logic
    const result = await ResultBillFromSepayService(payload, next);
    return res.status(200).json(result);
  } catch (error) {
    next(error); // 🚀 Chỉ gọi next(error) để middleware `errorHandler` xử lý
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
  if (paymentMethod !== "ZaloPay" && paymentMethod !== "Bank") {
    return {
      valid: false,
      message: "This payment method is not supported yet",
    };
  }
  return { valid: true };
};

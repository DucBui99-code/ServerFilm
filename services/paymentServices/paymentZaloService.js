const axios = require("axios").default; // npm install axios
const dotenv = require("dotenv");
const CryptoJS = require("crypto-js"); // npm install crypto-js
const qs = require("qs"); // npm install qs
dotenv.config({ path: "./.env" });

const isDevelopment = process.env.NODE_ENV === "development";

const {
  EXPIRED_TIME_ORDER,
  URL_CHECK_BILL,
  URL_CREATE_BILL,
} = require("../../config/CONSTANT");

const User = require("../../models/UserModel");
const Bill = require("../../models/BillModel");
const {
  UpdateStatusBillService,
  ApplyPackMonth,
  ApplyPackRent,
} = require("./billServices");

const throwError = require("../../utils/throwError");
const { pushToList } = require("../redisService");

const config = {
  app_id: process.env.APP_ID,
  key1: process.env.KEY1,
  key2: process.env.KEY2,
  check_bill: URL_CHECK_BILL,
  create_bill: URL_CREATE_BILL,
};

exports.CreateBillServiceZalo = async (
  userId,
  namePackage,
  pricePackage,
  paymentMethod,
  packageId,
  packageTypeUser,
  transactionId,
  next
) => {
  const userDb = await User.findById(userId).lean();

  // 🚀 2. Tạo đơn hàng ZaloPay
  const embed_data = {
    redirecturl: isDevelopment
      ? process.env.DEV_ALLOW_URL
      : process.env.PRODUCTION_ALLOW_URL,
  };
  const items = [{}];
  const order = {
    app_id: config.app_id,
    app_trans_id: transactionId,
    app_user: userId.toString(),
    app_time: Date.now(),
    expire_duration_seconds: EXPIRED_TIME_ORDER * 60,
    phone: userDb?.phoneNumber,
    email: userDb.email,
    item: JSON.stringify(items),
    embed_data: JSON.stringify(embed_data),
    amount: pricePackage,
    description: `Payment for ${namePackage} - Order #${transactionId}`,
    bank_code: "zalopayapp",
    callback_url:
      "https://6420-118-70-46-250.ngrok-free.app/v1/MovieApp/bill/resultBillFromZalo",
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
      packageId,
      price: pricePackage,
      paymentMethod,
      transactionId: transactionId,
      packageType: packageTypeUser,
    });

    await newBill.save();
    await pushToList("pending_bills", {
      id: transactionId,
      createdAt: newBill.createdAt,
      userId,
      packageName: newBill.packageName,
    });

    return result;
  } catch (error) {
    next(error);
  }
};

exports.ResultBillFromZaloService = async (dataStr, reqMac, next) => {
  let mac = CryptoJS.HmacSHA256(dataStr, config.key2).toString();

  if (reqMac !== mac) {
    await UpdateStatusBillService(userDb, billDb, "failed", next);
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

  await UpdateStatusBillService(billDb, "completed", next);

  if (billDb.packageType === "packageMonth") {
    await ApplyPackMonth(userDb, billDb.packageId, next);
  } else if (billDb.packageType === "packageRent") {
    await ApplyPackRent(userDb, billDb.packageId, next);
  }
};

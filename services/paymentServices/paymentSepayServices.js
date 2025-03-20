const dotenv = require("dotenv");
dotenv.config({ path: "./.env" });

const User = require("../../models/UserModel");
const Bill = require("../../models/BillModel");
const throwError = require("../../utils/throwError");
const {
  ApplyPackMonth,
  ApplyPackRent,
  UpdateStatusBillService,
} = require("./billServices");
const { pushToList } = require("../redisService");

exports.CreateBillServiceSeapay = async (
  userId,
  namePackage,
  pricePackage,
  paymentMethod,
  packageId,
  packageTypeUser,
  transactionId,
  next
) => {
  try {
    const config = {
      bankAccount: "103867444056",
      bankName: "VietinBank",
      accountHolder: "BUI QUANG DUC",
      qrDescription: `Payment for ${namePackage} - Order #${transactionId}`,
      amount: pricePackage,
    };

    const order_url = `https://qr.sepay.vn/img?acc=${config.bankAccount}&bank=${
      config.bankName
    }&amount=${pricePackage}&des=SEVQR ${encodeURIComponent(
      config.qrDescription
    )}`;

    // 📌 1. Tạo bill với trạng thái pending
    const newBill = new Bill({
      userId,
      packageName: namePackage,
      packageId,
      price: pricePackage,
      paymentMethod,
      transactionId,
      packageType: packageTypeUser,
    });

    await newBill.save();
    await pushToList("pending_bills", {
      id: transactionId,
      createdAt: newBill.createdAt,
      userId,
      packageName: newBill.packageName,
    });

    return {
      data: {
        order_url,
        return_message: "Created bill success",
        data: config,
      },
    };
  } catch (error) {
    next(error);
  }
};

exports.ResultBillFromSepayService = async (payload, next) => {
  try {
    // Xử lý thông tin giao dịch
    console.log(payload);

    if (payload) {
      const transactionId = payload.description.match(/Order (\d+)/)[1];
      const billDb = await Bill.findOne({
        transactionId,
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

      return { message: "Bill transfer successfully" };
    }
  } catch (error) {
    next(error);
  }
};

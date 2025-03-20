const redis = require("../config/redis");
const Bill = require("../models/BillModel");
const { EXPIRED_TIME_ORDER } = require("../config/CONSTANT");

/**
 * ✅ Thêm phần tử vào danh sách Redis (List)
 * @param {string} listKey - Tên danh sách Redis
 * @param {any} value - Giá trị cần thêm
 * @param {number} expire - Giá trị cần thêm
 */
const pushToList = async (listKey, value, expire) => {
  try {
    await redis.lpush(listKey, JSON.stringify(value));
    if (expire) {
      redis.expire(`${listKey}`, expire);
    }
    console.log(`📌 Đã thêm vào danh sách Redis: ${listKey}`);
  } catch (error) {
    console.error("❌ Lỗi khi thêm vào danh sách Redis:", error);
  }
};

/**
 * ✅ Xóa phần tử khỏi danh sách Redis dựa vào `transactionId`
 * @param {string} listKey - Tên danh sách Redis
 * @param {string} id - ID giao dịch cần xóa
 */
const removeToList = async (listKey, id) => {
  try {
    const items = await redis.lrange(listKey, 0, -1);
    let itemToRemove = null;

    for (const itemJSON of items) {
      const item = JSON.parse(itemJSON);
      if (item.id === id) {
        itemToRemove = itemJSON;
        break;
      }
    }

    if (itemToRemove) {
      await redis.lrem(listKey, 1, itemToRemove);
      console.log(`🗑️ Đã xóa bill có id: ${id} khỏi ${listKey}`);
    } else {
      console.log("⚠️ Không tìm thấy bill để xóa");
    }
  } catch (error) {
    console.error("❌ Lỗi khi xóa bill khỏi Redis:", error);
  }
};

/**
 * ✅ Lấy danh sách pending_bills từ Redis và kiểm tra bill hết hạn
 * @returns {Array} Danh sách các bill đã bị xóa khỏi Redis
 */
const getAndRemoveExpiredBills = async () => {
  try {
    const bills = await redis.lrange("pending_bills", 0, 99);
    const expiredBills = [];

    for (const billDataJSON of bills) {
      if (!billDataJSON) continue;

      const billData = JSON.parse(billDataJSON);
      console.log(billData);

      const nowUTC = Date.now();
      const billCreatedAtUTC = new Date(billData.createdAt).getTime();

      // Kiểm tra nếu bill quá hạn (mặc định: 5 phút)
      if (nowUTC - billCreatedAtUTC >= EXPIRED_TIME_ORDER * 60 * 1000) {
        // ✅ Cập nhật trạng thái bill trong DB
        await Bill.updateOne(
          { transactionId: billData.id },
          {
            paymentStatus: "failed",
            logs: {
              status: "failed",
              message: "Order has expired",
            },
          }
        );

        // ✅ Xóa khỏi Redis
        await redis.lrem("pending_bills", 1, billDataJSON);
        expiredBills.push(billData);
      }
    }

    return expiredBills;
  } catch (error) {
    console.error("❌ Lỗi khi kiểm tra & xóa bill hết hạn:", error);
    return [];
  }
};

module.exports = {
  pushToList,
  removeToList,
  getAndRemoveExpiredBills,
};

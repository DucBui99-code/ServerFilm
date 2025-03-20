const cron = require("node-cron");
const { getIo } = require("../config/socket");
const { getAndRemoveExpiredBills } = require("../services/redisService");

// Kiểm tra bill hết hạn và gửi thông báo
const checkExpiredBills = async () => {
  console.log("🔄 Kiểm tra bill hết hạn...");

  try {
    const io = getIo();
    const expiredBills = await getAndRemoveExpiredBills();

    for (const bill of expiredBills) {
      console.log(`❌ Bill ${bill.id} đã hết hạn!`);

      // 🔥 Chỉ gửi thông báo cho đúng user có bill đó
      io.to(`user_${bill.userId.toString()}`).emit("billUpdated", {
        billId: bill.id,
        status: 1,
        packageName: bill.packageName,
      });
    }
  } catch (error) {
    console.error("❌ Lỗi khi xử lý bill hết hạn:", error);
  }
};

// Lên lịch cron job chạy mỗi phút
cron.schedule("* * * * *", checkExpiredBills);

module.exports = checkExpiredBills;

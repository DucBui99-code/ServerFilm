const dotenv = require("dotenv");
dotenv.config({ path: "../config.env" });

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

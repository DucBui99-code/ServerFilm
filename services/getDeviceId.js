const crypto = require("crypto");

exports.getDeviceId = (req) =>
  crypto
    .createHash("sha256")
    .update(req.headers["user-agent"] + req.connection?.remoteAddress)
    .digest("base64")
    .replace(/[/+=]/g, ""); // Loại bỏ ký tự đặc biệt

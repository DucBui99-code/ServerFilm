const crypto = require("crypto");

exports.getDeviceId = (req) => {
  const userAgent = req.headers["user-agent"] || "Unknown";

  // Lấy IP chuẩn (nếu dùng proxy hoặc IPv6, IPv4 fallback)
  const ip =
    req.headers["x-forwarded-for"] || req.connection.remoteAddress || "Unknown";

  const acceptLang = req.headers["accept-language"] || "Unknown";

  return crypto
    .createHash("sha256")
    .update(userAgent + ip + acceptLang)
    .digest("hex");
};

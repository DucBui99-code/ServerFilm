const rateLimit = require("express-rate-limit");

const rateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 phút
  max: 300, // Tối đa 100 request mỗi 15 phút
  message: "Too many requests, please try again later.",
});

module.exports = rateLimiter;

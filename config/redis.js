const Redis = require("ioredis");
require("dotenv").config(); // Load biến môi trường từ .env

const isDevelopment = process.env.NODE_ENV === "development";

const redis = new Redis({
  host: isDevelopment
    ? process.env.DEV_REDIS_HOST
    : process.env.PRODUCTION_REDIS_HOST || "127.0.0.1",
  port: process.env.REDIS_PORT || 6379,
});

redis.on("error", (err) => {
  console.error("Redis error:", err);
});

redis.on("connect", () => {
  console.log("Connected to Redis");
});

module.exports = redis; // Xuất đối tượng Redis để dùng ở file khác

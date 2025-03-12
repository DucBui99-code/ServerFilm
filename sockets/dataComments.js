const Redis = require("ioredis");
const dotenv = require("dotenv");
dotenv.config({ path: "./.env" });

const { TIME_WINDOW, LIMIT_CHAT_LIVE } = require("../config/CONSTANT");

const redis = new Redis({
  host: process.env.REDIS_HOST || "127.0.0.1",
  port: process.env.REDIS_PORT || 6379,
});

redis.on("error", (err) => {
  console.error("Redis error:", err);
});

redis.on("connect", () => {
  console.log("Connected to Redis");
});

const saveCommentToCache = async (movieId, comment) => {
  await redis.lpush(`comments:${movieId}`, JSON.stringify(comment));
  redis.expire(`comments:${movieId}`, 3600); // Comment sẽ tự động xóa sau 1h
};

// Lấy comment từ Redis (không từ DB)
const getCommentsFromCache = async (movieId) => {
  return (await redis.lrange(`comments:${movieId}`, 0, -1))
    .map(JSON.parse)
    .reverse();
};

const canSendComment = async (userId) => {
  const key = `chat_limit:${userId}`;

  // Tăng số lần chat của user
  const count = await redis.incr(key);

  if (count === 1) {
    // Nếu là lần đầu tiên, đặt thời gian hết hạn cho key
    await redis.expire(key, TIME_WINDOW);
  }

  // Kiểm tra nếu vượt quá giới hạn
  if (count > LIMIT_CHAT_LIVE) {
    return false; // Chặn gửi comment
  }

  return true; // Cho phép gửi comment
};

module.exports = { saveCommentToCache, getCommentsFromCache, canSendComment };

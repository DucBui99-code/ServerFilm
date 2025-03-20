const redis = require("../config/redis");
const { TIME_WINDOW, LIMIT_CHAT_LIVE } = require("../config/CONSTANT");

const saveCommentToCache = async (movieId, comment) => {
  await redis.lpush(`comments:${movieId}`, JSON.stringify(comment));
  redis.expire(`comments:${movieId}`, 3600); // Comment sẽ tự động xóa sau 1h
};

const getCommentsFromCache = async (movieId) => {
  return (await redis.lrange(`comments:${movieId}`, 0, -1))
    .map(JSON.parse)
    .reverse();
};

const canSendComment = async (userId) => {
  const key = `chat_limit:${userId}`;

  const count = await redis.incr(key);

  if (count === 1) {
    await redis.expire(key, TIME_WINDOW);
  }

  // Kiểm tra nếu vượt quá giới hạn
  if (count > LIMIT_CHAT_LIVE) {
    return false;
  }

  return true;
};

module.exports = { saveCommentToCache, getCommentsFromCache, canSendComment };

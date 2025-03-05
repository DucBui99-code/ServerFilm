const Redis = require("ioredis");
const redis = new Redis({ host: "localhost", port: 6379 });

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

module.exports = { saveCommentToCache, getCommentsFromCache };

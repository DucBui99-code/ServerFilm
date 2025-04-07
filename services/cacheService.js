const redis = require("../config/redis"); // Import Redis đã cấu hình

const cacheService = {
  async getCache(key) {
    try {
      const data = await redis.get(key);
      return data ? JSON.parse(data) : null;
    } catch (error) {
      console.error("Redis getCache error:", error);
      return null;
    }
  },

  async setCache(key, value, ttl = 86400) {
    try {
      await redis.setex(key, ttl, JSON.stringify(value));
    } catch (error) {
      console.error("Redis setCache error:", error);
    }
  },

  async deleteCache(key) {
    try {
      await redis.del(key);
    } catch (error) {
      console.error("Redis deleteCache error:", error);
    }
  },

  async clearCache() {
    try {
      await redis.flushall(); // Xóa toàn bộ cache Redis
    } catch (error) {
      console.error("Redis clearCache error:", error);
    }
  },
};

module.exports = cacheService;

const Redis = require('ioredis');
const { logger } = require('../utils/logger');

let redisClient = null;

const connectRedis = async () => {
  try {
    const url = process.env.REDIS_URL || 'redis://localhost:6379';
    redisClient = new Redis(url, {
      maxRetriesPerRequest: 1,
      retryStrategy(times) {
        if (times > 1) return null;
        return 1000;
      },
      lazyConnect: true,
      showFriendlyErrorStack: false
    });

    redisClient.on('connect', () => {
      logger.info('Appointment Service connected to Redis');
    });

    redisClient.on('error', () => {
      // Suppress repeated error logs
    });

    await redisClient.connect();
    await redisClient.ping();
  } catch (error) {
    logger.warn('Redis not available for Appointment Service caching. Running without cache.');
    if (redisClient) {
      try { redisClient.disconnect(); } catch (_) {}
    }
    redisClient = null;
  }
};

const getRedisClient = () => redisClient;

const cacheGet = async (key) => {
  try {
    if (!redisClient) return null;
    const data = await redisClient.get(key);
    return data ? JSON.parse(data) : null;
  } catch (error) {
    logger.error('Redis get error:', error);
    return null;
  }
};

const cacheSet = async (key, data, ttl = 3600) => {
  try {
    if (!redisClient) return;
    await redisClient.setex(key, ttl, JSON.stringify(data));
  } catch (error) {
    logger.error('Redis set error:', error);
  }
};

const cacheDelete = async (pattern) => {
  try {
    if (!redisClient) return;
    const keys = await redisClient.keys(pattern);
    if (keys.length > 0) {
      await redisClient.del(...keys);
    }
  } catch (error) {
    logger.error('Redis delete error:', error);
  }
};

module.exports = { connectRedis, getRedisClient, cacheGet, cacheSet, cacheDelete };

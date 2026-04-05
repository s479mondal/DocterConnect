const Redis = require('ioredis');
const { logger } = require('../utils/logger');

let redisClient = null;

const connectRedis = async () => {
  try {
    const url = process.env.REDIS_URL || 'redis://localhost:6379';
    redisClient = new Redis(url, {
      maxRetriesPerRequest: 1,
      retryStrategy(times) {
        // Only retry once, then give up
        if (times > 1) return null;
        return 1000;
      },
      lazyConnect: true,
      showFriendlyErrorStack: false
    });

    redisClient.on('connect', () => {
      logger.info('Doctor Service connected to Redis');
      console.log('🔴 Doctor Service connected to Redis');
    });

    redisClient.on('error', () => {
      // Suppress repeated error logs — handled in catch below
    });

    // Try connecting
    await redisClient.connect();
    await redisClient.ping();
  } catch (error) {
    console.log('⚠️  Redis not available. Running without cache (this is OK).');
    if (redisClient) {
      try { redisClient.disconnect(); } catch (_) {}
    }
    redisClient = null;
  }
};

const getRedisClient = () => redisClient;

// Cache helper functions
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

const cacheSet = async (key, data, ttl = 300) => {
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

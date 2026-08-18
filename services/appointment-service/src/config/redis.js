const Redis = require('ioredis');
const { logger } = require('../utils/logger');

let redisClient = null;

const connectRedis = async () => {
  try {
    const url = process.env.REDIS_URL || 'redis://localhost:6379';
    const isTls = url.startsWith('rediss://');
    redisClient = new Redis(url, {
      tls: isTls ? { rejectUnauthorized: false } : undefined,
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
    if (data) {
      console.log(`\x1b[32m[Redis HIT]\x1b[0m Key: ${key}`);
      return JSON.parse(data);
    }
    console.log(`\x1b[33m[Redis MISS]\x1b[0m Key: ${key}`);
    return null;
  } catch (error) {
    logger.error('Redis get error:', error);
    return null;
  }
};

const cacheSet = async (key, data, ttl = 3600) => {
  try {
    if (!redisClient) return;
    await redisClient.setex(key, ttl, JSON.stringify(data));
    console.log(`\x1b[36m[Redis SET]\x1b[0m Key: ${key} (TTL: ${ttl}s)`);
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
      console.log(`\x1b[31m[Redis DELETE]\x1b[0m Pattern: ${pattern} (Cleared ${keys.length} keys)`);
    }
  } catch (error) {
    logger.error('Redis delete error:', error);
  }
};

module.exports = { connectRedis, getRedisClient, cacheGet, cacheSet, cacheDelete };

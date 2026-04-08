const logger = require('./logger');

let redisClient = null;

function getRedis() {
  if (!redisClient) {
    const Redis = require('ioredis');
    redisClient = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', {
      maxRetriesPerRequest: 3,
      retryStrategy: (times) => Math.min(times * 200, 2000),
    });
    redisClient.on('error', (err) => logger.error({ error: err.message }, 'Redis error'));
    redisClient.on('connect', () => logger.info('Redis connected'));
  }
  return redisClient;
}

async function acquireJobLock(jobId, userId, ttlSeconds = 30) {
  const redis = getRedis();
  const key = `job_lock:${jobId}`;
  const result = await redis.set(key, userId, 'NX', 'EX', ttlSeconds);
  return result === 'OK';
}

async function releaseJobLock(jobId) {
  const redis = getRedis();
  const key = `job_lock:${jobId}`;
  await redis.del(key);
}

async function getJobLock(jobId) {
  const redis = getRedis();
  const key = `job_lock:${jobId}`;
  return redis.get(key);
}

module.exports = { getRedis, acquireJobLock, releaseJobLock, getJobLock };

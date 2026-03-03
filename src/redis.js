import Redis from 'ioredis';

const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', {
  maxRetriesPerRequest: 2,
  enableReadyCheck: true
});

redis.on('error', (err) => {
  console.error('[redis] error:', err.message);
});

redis.on('connect', () => {
  console.log('[redis] connected');
});

export default redis;

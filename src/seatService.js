import { customAlphabet } from 'nanoid';
import redis from './redis.js';

const nanoid = customAlphabet('1234567890abcdefghijklmnopqrstuvwxyz', 12);
const DEFAULT_LOCK_TTL_SECONDS = Number(process.env.LOCK_TTL_SECONDS || 20);

const lockSeatScript = `
local availableKey = KEYS[1]
local bookedKey = KEYS[2]
local lockKey = KEYS[3]
local seatId = ARGV[1]
local userId = ARGV[2]
local ttl = tonumber(ARGV[3])

if redis.call('SISMEMBER', bookedKey, seatId) == 1 then
  return 'BOOKED'
end

if redis.call('SISMEMBER', availableKey, seatId) == 0 then
  return 'NOT_FOUND'
end

if redis.call('EXISTS', lockKey) == 1 then
  return 'LOCKED'
end

local ok = redis.call('SET', lockKey, userId, 'NX', 'EX', ttl)
if not ok then
  return 'LOCKED'
end

return 'LOCK_ACQUIRED'
`;

const confirmSeatScript = `
local availableKey = KEYS[1]
local bookedKey = KEYS[2]
local lockKey = KEYS[3]
local seatId = ARGV[1]
local userId = ARGV[2]

local owner = redis.call('GET', lockKey)
if not owner then
  return 'LOCK_EXPIRED'
end

if owner ~= userId then
  return 'LOCK_NOT_OWNED'
end

if redis.call('SISMEMBER', bookedKey, seatId) == 1 then
  redis.call('DEL', lockKey)
  return 'ALREADY_BOOKED'
end

redis.call('SREM', availableKey, seatId)
redis.call('SADD', bookedKey, seatId)
redis.call('DEL', lockKey)

return 'BOOKED_OK'
`;

const cancelSeatScript = `
local lockKey = KEYS[1]
local userId = ARGV[1]

local owner = redis.call('GET', lockKey)
if not owner then
  return 'NO_LOCK'
end

if owner ~= userId then
  return 'LOCK_NOT_OWNED'
end

redis.call('DEL', lockKey)
return 'LOCK_RELEASED'
`;

const oneStepBookScript = `
local availableKey = KEYS[1]
local bookedKey = KEYS[2]

local seatId = redis.call('SPOP', availableKey)
if not seatId then
  return ''
end

redis.call('SADD', bookedKey, seatId)
return seatId
`;

function keys(eventId, seatId) {
  return {
    available: `event:${eventId}:seats:available`,
    booked: `event:${eventId}:seats:booked`,
    lock: `event:${eventId}:seat:${seatId}:lock`,
    meta: `event:${eventId}:meta`
  };
}

export async function initEvent(eventId, totalSeats = 100) {
  const seatIds = Array.from({ length: totalSeats }, (_, i) => `S${i + 1}`);
  const eventKeys = keys(eventId, 'placeholder');

  const pipeline = redis.pipeline();
  pipeline.del(eventKeys.available, eventKeys.booked);
  pipeline.sadd(eventKeys.available, ...seatIds);
  pipeline.hset(eventKeys.meta, {
    totalSeats,
    updatedAt: new Date().toISOString()
  });
  await pipeline.exec();

  return { eventId, totalSeats };
}

export async function getEventStatus(eventId) {
  const eventKeys = keys(eventId, 'placeholder');
  const [[, totalSeats], [, available], [, booked]] = await redis
    .pipeline()
    .hget(eventKeys.meta, 'totalSeats')
    .scard(eventKeys.available)
    .scard(eventKeys.booked)
    .exec();

  return {
    eventId,
    totalSeats: Number(totalSeats || 0),
    available,
    booked
  };
}

export async function lockSeat({ eventId, seatId, userId, ttlSeconds = DEFAULT_LOCK_TTL_SECONDS }) {
  const eventKeys = keys(eventId, seatId);
  const result = await redis.eval(
    lockSeatScript,
    3,
    eventKeys.available,
    eventKeys.booked,
    eventKeys.lock,
    seatId,
    userId,
    ttlSeconds
  );

  return { status: result, expiresIn: ttlSeconds };
}

export async function confirmSeat({ eventId, seatId, userId }) {
  const eventKeys = keys(eventId, seatId);
  const result = await redis.eval(
    confirmSeatScript,
    3,
    eventKeys.available,
    eventKeys.booked,
    eventKeys.lock,
    seatId,
    userId
  );

  const remaining = await redis.scard(eventKeys.available);
  return { status: result, remaining };
}

export async function cancelLock({ eventId, seatId, userId }) {
  const eventKeys = keys(eventId, seatId);
  const result = await redis.eval(cancelSeatScript, 1, eventKeys.lock, userId);
  return { status: result };
}

export async function oneStepBook(eventId) {
  const eventKeys = keys(eventId, 'placeholder');
  const seatId = await redis.eval(oneStepBookScript, 2, eventKeys.available, eventKeys.booked);

  if (!seatId) {
    return { success: false, message: 'No seats left' };
  }

  const remaining = await redis.scard(eventKeys.available);
  return {
    success: true,
    bookingId: `BK-${Date.now()}-${nanoid()}`,
    seatId,
    remaining
  };
}

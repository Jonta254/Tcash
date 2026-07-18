// Best-effort rate limiting. Prefers the same Upstash Redis instance
// orders.js already uses (a real, shared, cross-instance counter) and
// falls back to an in-memory per-instance counter when Redis isn't
// configured. The in-memory fallback is NOT a complete guarantee on
// serverless — a cold start or a different warm instance resets it —
// it only raises the bar against a naive brute-force script; it is not
// a substitute for configuring Redis in production.
const REDIS_URL = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
const REDIS_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;

const memoryBuckets = new Map();

function redisConfigured() {
  return Boolean(REDIS_URL && REDIS_TOKEN);
}

async function redisCommand(command) {
  const response = await fetch(REDIS_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${REDIS_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(command),
  });
  const payload = await response.json().catch(() => ({}));

  if (!response.ok || payload.error) {
    throw new Error(payload.error || `rate limit store command ${command[0]} failed`);
  }

  return payload.result;
}

function memoryRateLimit(key, limit, windowSeconds) {
  const now = Date.now();
  const bucket = memoryBuckets.get(key);

  if (!bucket || now > bucket.resetAt) {
    memoryBuckets.set(key, { count: 1, resetAt: now + windowSeconds * 1000 });
    return { allowed: true, remaining: limit - 1 };
  }

  bucket.count += 1;
  return { allowed: bucket.count <= limit, remaining: Math.max(0, limit - bucket.count) };
}

/**
 * @param {string} key - a caller-scoped identifier, e.g. `admin-login:203.0.113.4`
 * @param {{limit: number, windowSeconds: number}} options
 */
export async function checkRateLimit(key, { limit, windowSeconds }) {
  if (redisConfigured()) {
    try {
      const redisKey = `ratelimit:${key}`;
      const count = await redisCommand(["INCR", redisKey]);

      if (count === 1) {
        await redisCommand(["EXPIRE", redisKey, String(windowSeconds)]);
      }

      return { allowed: count <= limit, remaining: Math.max(0, limit - count) };
    } catch {
      // Redis unreachable — fall through to the in-memory limiter rather
      // than failing the request outright.
    }
  }

  return memoryRateLimit(key, limit, windowSeconds);
}

export function getClientIp(req) {
  const forwarded = req.headers["x-forwarded-for"];
  if (typeof forwarded === "string" && forwarded.trim()) {
    return forwarded.split(",")[0].trim();
  }
  return req.socket?.remoteAddress || "unknown";
}

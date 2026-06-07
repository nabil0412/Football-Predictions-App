import { Redis } from "@upstash/redis";

let _redis: Redis | null = null;

function getRedis(): Redis {
  if (!_redis) {
    _redis = new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL!,
      token: process.env.UPSTASH_REDIS_REST_TOKEN!,
    });
  }
  return _redis;
}

export const redis = {
  get: <T>(key: string) => getRedis().get<T>(key),
  set: (key: string, value: unknown, opts?: { ex: number }) =>
    getRedis().set(key, value, opts),
  del: (key: string) => getRedis().del(key),
} as const;

export const CACHE_KEYS = {
  globalLeaderboard: "leaderboard:global",
  dailyLeaderboard: (date: string) => `leaderboard:daily:${date}`,
  matchPredictionPct: (matchId: number) => `match:${matchId}:pct`,
} as const;

export const CACHE_TTL = {
  leaderboard: 300,
  predictionPct: 180,
} as const;

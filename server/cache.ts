// Simple in-memory cache for user targets
const targetCache = new Map();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes
const MAX_CACHE_ENTRIES = Number(process.env.TARGET_CACHE_MAX || 5000);

function evictExpired(now: number) {
  // Opportunistic sweep to avoid unbounded growth.
  const entries = Array.from(targetCache.entries());
  for (let i = 0; i < entries.length && i < 5000; i += 1) {
    const [key, value] = entries[i];
    if (!value || typeof value.timestamp !== 'number' || now - value.timestamp >= CACHE_TTL) {
      targetCache.delete(key);
    }
  }
}

export function getCachedTargets(userId: string) {
  const now = Date.now();
  evictExpired(now);
  const cached = targetCache.get(userId);
  if (cached && now - cached.timestamp < CACHE_TTL) {
    return cached.data;
  }
  if (cached) targetCache.delete(userId);
  return null;
}

export function setCachedTargets(userId: string, data: any) {
  const now = Date.now();
  evictExpired(now);

  // Evict oldest entries if over capacity.
  while (targetCache.size >= MAX_CACHE_ENTRIES) {
    const oldestKey = targetCache.keys().next().value;
    if (oldestKey === undefined) break;
    targetCache.delete(oldestKey);
  }

  targetCache.set(userId, {
    data,
    timestamp: now
  });
}

export function clearCachedTargets(userId: string) {
  targetCache.delete(userId);
}
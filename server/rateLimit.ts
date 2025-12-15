type RateLimitOptions = {
  windowMs: number;
  max: number;
  keyPrefix: string;
  skip?: (req: any) => boolean;
};

type Counter = { count: number; resetAt: number };

const buckets = new Map<string, Counter>();

function cleanup(now: number) {
  // Opportunistic cleanup to keep memory bounded
  let scanned = 0;
  for (const [key, counter] of Array.from(buckets)) {
    if (counter.resetAt <= now) buckets.delete(key);
    scanned += 1;
    if (scanned > 5000) break;
  }
}

export function createRateLimiter(opts: RateLimitOptions) {
  return function rateLimiter(req: any, res: any, next: any) {
    // Only enforce in production unless explicitly enabled
    const enabled = process.env.NODE_ENV === 'production' || process.env.RATE_LIMIT_ALWAYS === '1';
    if (!enabled) return next();
    if (process.env.NODE_ENV === 'test') return next();

    if (opts.skip && opts.skip(req)) return next();

    const now = Date.now();
    cleanup(now);

    const userKey = req?.user?.claims?.sub ? String(req.user.claims.sub) : '';
    const ipKey = String(req.ip || req.connection?.remoteAddress || 'unknown');
    const key = `${opts.keyPrefix}:${userKey || ipKey}`;

    const existing = buckets.get(key);
    if (!existing || existing.resetAt <= now) {
      buckets.set(key, { count: 1, resetAt: now + opts.windowMs });
      return next();
    }

    existing.count += 1;
    buckets.set(key, existing);

    res.setHeader('X-RateLimit-Limit', String(opts.max));
    res.setHeader('X-RateLimit-Remaining', String(Math.max(0, opts.max - existing.count)));
    res.setHeader('X-RateLimit-Reset', String(Math.ceil(existing.resetAt / 1000)));

    if (existing.count > opts.max) {
      return res.status(429).json({ message: 'Too many requests' });
    }

    return next();
  };
}

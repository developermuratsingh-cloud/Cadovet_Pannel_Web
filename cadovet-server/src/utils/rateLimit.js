// Small in-memory rate limiting. It is per server process: run behind a shared limiter (nginx, API gateway or Redis)
// if the API is ever scaled to several instances. Enough to stop scripted abuse of a single instance.
const buckets = new Map(); // key -> { count, resetAt }

const hit = (key, windowMs) => {
  const now = Date.now();
  let b = buckets.get(key);
  if (!b || b.resetAt <= now) {
    b = { count: 0, resetAt: now + windowMs };
    buckets.set(key, b);
  }
  b.count += 1;
  return b;
};

setInterval(() => {
  const now = Date.now();
  for (const [k, b] of buckets) if (b.resetAt <= now) buckets.delete(k);
}, 60 * 1000).unref();

// Express middleware: at most `max` requests per `windowMs` for whatever `key(req)` returns.
exports.rateLimit = ({ windowMs, max, key, message = 'Too many requests. Please try again later.' }) => (req, res, next) => {
  const b = hit(`${key(req)}`, windowMs);
  if (b.count > max) {
    res.set('Retry-After', String(Math.ceil((b.resetAt - Date.now()) / 1000)));
    return res.status(429).json({ success: false, message });
  }
  next();
};

// Failed-attempt tracker (e.g. wrong passwords): `fail()` counts, `retryAfter()` says how long a locked key must wait.
exports.failureTracker = ({ windowMs, max }) => ({
  fail: (key) => hit(`fail:${key}`, windowMs),
  retryAfter: (key) => {
    const b = buckets.get(`fail:${key}`);
    return b && b.resetAt > Date.now() && b.count >= max ? Math.ceil((b.resetAt - Date.now()) / 1000) : 0;
  },
  clear: (key) => buckets.delete(`fail:${key}`),
});

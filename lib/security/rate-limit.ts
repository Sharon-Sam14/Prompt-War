/**
 * Fixed-window in-memory rate limiter factory (Design.md §4.9, Phases 4.7).
 *
 * One instance per route so their budgets are independent (/api/plan keeps its
 * own 10/min limiter; /api/ask gets 30/min). Instances are isolated, which is
 * what makes the limiter unit-testable without cross-test module state.
 *
 * Single-instance note: this is process-local by design (no Redis in this
 * deployment). Behind a multi-instance host the limit becomes per-instance —
 * acceptable for a single-container hackathon deploy and documented as an
 * assumption in the README.
 */

export interface RateLimitResult {
  allowed: boolean;
  retryAfterSec: number;
}

export interface RateLimiter {
  check(ip: string): RateLimitResult;
  /** Exposed for tests/metrics. */
  readonly size: number;
}

export function createRateLimit(limit: number, windowMs: number): RateLimiter {
  const hits = new Map<string, { count: number; resetAt: number }>();

  function prune(now: number): void {
    for (const [ip, entry] of hits) {
      if (entry.resetAt < now) hits.delete(ip);
    }
  }

  return {
    check(ip: string): RateLimitResult {
      const now = Date.now();
      prune(now);
      const entry = hits.get(ip);
      if (!entry || entry.resetAt < now) {
        hits.set(ip, { count: 1, resetAt: now + windowMs });
        return { allowed: true, retryAfterSec: 0 };
      }
      entry.count += 1;
      if (entry.count > limit) {
        return { allowed: false, retryAfterSec: Math.ceil((entry.resetAt - now) / 1000) };
      }
      return { allowed: true, retryAfterSec: 0 };
    },
    get size(): number {
      return hits.size;
    },
  };
}

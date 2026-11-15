/**
 * Token bucket: allows bursts of `capacity` actions, refilled at `refillPerSecond`.
 */
export class TokenBucket {
  private tokens: number;
  private last: number;

  constructor(
    private readonly capacity: number,
    private readonly refillPerSecond: number,
    private readonly now: () => number = Date.now
  ) {
    this.tokens = capacity;
    this.last = now();
  }

  take(cost = 1): boolean {
    const now = this.now();
    this.tokens = Math.min(this.capacity, this.tokens + ((now - this.last) / 1000) * this.refillPerSecond);
    this.last = now;
    if (this.tokens < cost) return false;
    this.tokens -= cost;
    return true;
  }
}

/** One bucket per key (e.g. per IP address), with idle buckets evicted. */
export class KeyedRateLimiter {
  private buckets = new Map<string, { bucket: TokenBucket; lastUsed: number }>();

  constructor(
    private readonly capacity: number,
    private readonly refillPerSecond: number,
    private readonly now: () => number = Date.now
  ) {}

  take(key: string, cost = 1): boolean {
    let entry = this.buckets.get(key);
    if (!entry) {
      entry = { bucket: new TokenBucket(this.capacity, this.refillPerSecond, this.now), lastUsed: 0 };
      this.buckets.set(key, entry);
    }
    entry.lastUsed = this.now();
    return entry.bucket.take(cost);
  }

  /** Drops buckets unused for `idleMs` (they would be full again anyway). */
  prune(idleMs: number) {
    const cutoff = this.now() - idleMs;
    for (const [key, entry] of this.buckets) {
      if (entry.lastUsed < cutoff) this.buckets.delete(key);
    }
  }
}

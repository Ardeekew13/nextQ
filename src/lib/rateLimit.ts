/**
 * Request rate limiting, kept separate from the middleware so it can be unit tested.
 *
 * Why two buckets: at a venue everyone shares one Wi-Fi, so every phone and the organiser's
 * tablet reach the server from the SAME IP address. A single per-IP limit (it used to be 100
 * requests a minute) let players refreshing the public page use up the organiser's allowance,
 * and the organiser's app then saw "Too many requests" and went offline. Now:
 *
 * - a signed-in organiser gets their own bucket, keyed by their login cookie;
 * - everyone else shares a per-IP bucket;
 * - every request also counts against a generous per-IP ceiling, so making up login cookies
 *   (the cookie isn't verified here) can't get around the limit;
 * - only API calls count (pages, scripts and images don't).
 */
export const RATE_LIMIT_WINDOW_MS = 60_000;

export interface RateLimitConfig {
  organiserMax: number;
  publicMax: number;
  /** All requests from one IP, signed in or not. */
  ipCeiling: number;
}

export function rateLimitConfig(env: {
  RATE_LIMIT_ORGANISER_MAX?: string;
  RATE_LIMIT_PUBLIC_MAX?: string;
  RATE_LIMIT_IP_CEILING?: string;
}): RateLimitConfig {
  const num = (v: string | undefined, fallback: number) => {
    const n = Number(v);
    return Number.isFinite(n) && n > 0 ? n : fallback;
  };
  return {
    organiserMax: num(env.RATE_LIMIT_ORGANISER_MAX, 600),
    publicMax: num(env.RATE_LIMIT_PUBLIC_MAX, 300),
    ipCeiling: num(env.RATE_LIMIT_IP_CEILING, 2000),
  };
}

/** Only API requests are limited. */
export function isRateLimited(pathname: string): boolean {
  return pathname.startsWith("/api/");
}

type RequestInfo = { authCookie?: string | null; forwardedFor?: string | null; realIp?: string | null };

const clientIp = (input: RequestInfo) => input.forwardedFor?.split(",")[0]?.trim() || input.realIp || "unknown";

/** The bucket a request counts against, and its limit. */
export function rateLimitKey(input: RequestInfo, config: RateLimitConfig): { key: string; max: number } {
  if (input.authCookie) return { key: `org:${input.authCookie.slice(-40)}`, max: config.organiserMax };
  return { key: `ip:${clientIp(input)}`, max: config.publicMax };
}

/** Every bucket a request counts against: its own (organiser or public) and the IP ceiling. */
export function rateLimitBuckets(input: RequestInfo, config: RateLimitConfig): Array<{ key: string; max: number }> {
  return [rateLimitKey(input, config), { key: `all:${clientIp(input)}`, max: config.ipCeiling }];
}

const MAX_BUCKETS = 10_000;

export function createRateLimiter(windowMs = RATE_LIMIT_WINDOW_MS) {
  const store = new Map<string, { count: number; resetAt: number }>();
  return {
    /** Counts one request; false when this bucket is over its limit for the current window. */
    hit(key: string, max: number, now = Date.now()): boolean {
      if (store.size > MAX_BUCKETS) {
        for (const [k, v] of store) if (v.resetAt <= now) store.delete(k);
        // Still too many (a flood of made-up cookies): forget the oldest buckets.
        for (const k of store.keys()) {
          if (store.size <= MAX_BUCKETS) break;
          store.delete(k);
        }
      }
      const entry = store.get(key);
      if (!entry || entry.resetAt <= now) {
        store.set(key, { count: 1, resetAt: now + windowMs });
        return true;
      }
      entry.count += 1;
      // Most recently used last, so a flood evicts idle buckets rather than busy ones.
      store.delete(key);
      store.set(key, entry);
      return entry.count <= max;
    },
  };
}

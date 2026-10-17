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
 * - only API calls count (pages, scripts and images don't).
 */
export const RATE_LIMIT_WINDOW_MS = 60_000;

export interface RateLimitConfig {
  organiserMax: number;
  publicMax: number;
}

export function rateLimitConfig(env: Record<string, string | undefined>): RateLimitConfig {
  const num = (v: string | undefined, fallback: number) => {
    const n = Number(v);
    return Number.isFinite(n) && n > 0 ? n : fallback;
  };
  return {
    organiserMax: num(env.RATE_LIMIT_ORGANISER_MAX, 600),
    publicMax: num(env.RATE_LIMIT_PUBLIC_MAX, 300),
  };
}

/** Only API requests are limited. */
export function isRateLimited(pathname: string): boolean {
  return pathname.startsWith("/api/");
}

/** The bucket a request counts against, and its limit. */
export function rateLimitKey(
  input: { authCookie?: string | null; forwardedFor?: string | null; realIp?: string | null },
  config: RateLimitConfig
): { key: string; max: number } {
  if (input.authCookie) return { key: `org:${input.authCookie.slice(-40)}`, max: config.organiserMax };
  const ip = input.forwardedFor?.split(",")[0]?.trim() || input.realIp || "unknown";
  return { key: `ip:${ip}`, max: config.publicMax };
}

export function createRateLimiter(windowMs = RATE_LIMIT_WINDOW_MS) {
  const store = new Map<string, { count: number; resetAt: number }>();
  return {
    /** Counts one request; false when this bucket is over its limit for the current window. */
    hit(key: string, max: number, now = Date.now()): boolean {
      if (store.size > 10_000) for (const [k, v] of store) if (v.resetAt <= now) store.delete(k);
      const entry = store.get(key);
      if (!entry || entry.resetAt <= now) {
        store.set(key, { count: 1, resetAt: now + windowMs });
        return true;
      }
      entry.count += 1;
      return entry.count <= max;
    },
  };
}

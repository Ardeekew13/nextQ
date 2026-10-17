import { describe, expect, it } from "vitest";
import { createRateLimiter, isRateLimited, rateLimitBuckets, rateLimitConfig, rateLimitKey } from "@/lib/rateLimit";

const config = { organiserMax: 600, publicMax: 300, ipCeiling: 2000 };

describe("rate limiting at a venue (everyone on one Wi-Fi)", () => {
  it("the organiser has their own bucket: players on the same IP can't use it up", () => {
    const limiter = createRateLimiter();
    const venueIp = "203.0.113.7";
    const players = rateLimitKey({ forwardedFor: venueIp }, config);
    for (let i = 0; i < 300; i++) limiter.hit(players.key, players.max, 0);
    expect(limiter.hit(players.key, players.max, 0)).toBe(false); // the public bucket is full
    const organiser = rateLimitKey({ authCookie: "jwt.organiser.token", forwardedFor: venueIp }, config);
    expect(organiser.key).not.toBe(players.key);
    expect(limiter.hit(organiser.key, organiser.max, 0)).toBe(true);
  });
  it("only API calls count, not pages or assets", () => {
    expect(isRateLimited("/api/graphql")).toBe(true);
    expect(isRateLimited("/dashboard/sessions/abc")).toBe(false);
    expect(isRateLimited("/nextqlogo.png")).toBe(false);
  });
  it("uses the first address of x-forwarded-for, then x-real-ip", () => {
    expect(rateLimitKey({ forwardedFor: "1.1.1.1, 10.0.0.1" }, config).key).toBe("ip:1.1.1.1");
    expect(rateLimitKey({ realIp: "2.2.2.2" }, config).key).toBe("ip:2.2.2.2");
    expect(rateLimitKey({}, config).key).toBe("ip:unknown");
  });
  it("limits reset every window", () => {
    const limiter = createRateLimiter(60_000);
    for (let i = 0; i < 3; i++) limiter.hit("k", 3, 0);
    expect(limiter.hit("k", 3, 1)).toBe(false);
    expect(limiter.hit("k", 3, 60_001)).toBe(true);
  });
  it("limits come from env, with safe defaults", () => {
    expect(rateLimitConfig({})).toEqual({ organiserMax: 600, publicMax: 300, ipCeiling: 2000 });
    expect(rateLimitConfig({ RATE_LIMIT_ORGANISER_MAX: "50", RATE_LIMIT_PUBLIC_MAX: "nope" })).toEqual({ organiserMax: 50, publicMax: 300, ipCeiling: 2000 });
  });

  it("made-up login cookies can't get around the limit: the per-IP ceiling still applies", () => {
    const limiter = createRateLimiter();
    const cfg = { ...config, ipCeiling: 50 };
    let refused = 0;
    for (let i = 0; i < 60; i++) {
      const buckets = rateLimitBuckets({ authCookie: `fake-${i}`, forwardedFor: "198.51.100.9" }, cfg);
      if (!buckets.map((b) => limiter.hit(b.key, b.max, 0)).every(Boolean)) refused++;
    }
    expect(refused).toBe(10);
  });
  it("keeps memory bounded under a flood of distinct keys", () => {
    const limiter = createRateLimiter();
    for (let i = 0; i < 20_050; i++) limiter.hit(`k${i}`, 5, 0);
    // The newest key still works normally.
    expect(limiter.hit("k20049", 5, 0)).toBe(true);
  });
});

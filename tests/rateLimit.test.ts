import { describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

async function load() {
  vi.resetModules();
  vi.stubEnv("RATE_LIMIT_PUBLIC_MAX", "5");
  vi.stubEnv("RATE_LIMIT_ORGANISER_MAX", "10");
  vi.stubEnv("AUTH_COOKIE_NAME", "nextq_session");
  return (await import("@/middleware")).middleware;
}
const req = (path: string, ip: string, cookie?: string) =>
  new NextRequest(`http://localhost${path}`, {
    headers: { "x-forwarded-for": ip, ...(cookie ? { cookie: `nextq_session=${cookie}` } : {}) },
  });

describe("rate limit", () => {
  it("a busy venue Wi-Fi (many viewers, one IP) never blocks the logged-in organiser", async () => {
    const middleware = await load();
    for (let i = 0; i < 5; i++) expect(middleware(req("/api/graphql", "1.2.3.4")).status).not.toBe(429);
    expect(middleware(req("/api/graphql", "1.2.3.4")).status).toBe(429); // public viewers over their limit
    expect(middleware(req("/api/graphql", "1.2.3.4", "organiser-token-abc")).status).not.toBe(429);
  });

  it("the organiser has their own, larger allowance", async () => {
    const middleware = await load();
    for (let i = 0; i < 10; i++) expect(middleware(req("/api/graphql", "5.6.7.8", "tok")).status).not.toBe(429);
    expect(middleware(req("/api/graphql", "5.6.7.8", "tok")).status).toBe(429);
  });

  it("page loads don't count", async () => {
    const middleware = await load();
    for (let i = 0; i < 50; i++) expect(middleware(req("/club/x/session/y", "9.9.9.9")).status).not.toBe(429);
    expect(middleware(req("/api/graphql", "9.9.9.9")).status).not.toBe(429);
  });
});

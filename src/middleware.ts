import { NextRequest, NextResponse } from "next/server";
import { createRateLimiter, isRateLimited, rateLimitBuckets, rateLimitConfig } from "@/lib/rateLimit";

const limiter = createRateLimiter();
// Named one by one so they're available wherever the middleware runs (edge included).
const limits = rateLimitConfig({
  RATE_LIMIT_ORGANISER_MAX: process.env.RATE_LIMIT_ORGANISER_MAX,
  RATE_LIMIT_PUBLIC_MAX: process.env.RATE_LIMIT_PUBLIC_MAX,
  RATE_LIMIT_IP_CEILING: process.env.RATE_LIMIT_IP_CEILING,
});
const AUTH_COOKIE = process.env.AUTH_COOKIE_NAME || "nextq_session";

export function middleware(request: NextRequest) {
  if (isRateLimited(request.nextUrl.pathname)) {
    const buckets = rateLimitBuckets(
      {
        authCookie: request.cookies.get(AUTH_COOKIE)?.value,
        forwardedFor: request.headers.get("x-forwarded-for"),
        realIp: request.headers.get("x-real-ip"),
      },
      limits
    );
    // The per-IP ceiling first: once it's over, stop there (no new per-cookie bucket, so
    // made-up cookies can't flood the store), then the request's own bucket.
    const [own, ceiling] = buckets;
    if (!limiter.hit(ceiling.key, ceiling.max) || !limiter.hit(own.key, own.max)) {
      return new NextResponse("Too many requests", { status: 429, headers: { "Retry-After": "60" } });
    }
  }

  const response = NextResponse.next();

  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("X-XSS-Protection", "1; mode=block");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");

  if (process.env.NODE_ENV === "production") {
    response.headers.set("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};

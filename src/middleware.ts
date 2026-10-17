import { NextRequest, NextResponse } from "next/server";
import { createRateLimiter, isRateLimited, rateLimitConfig, rateLimitKey } from "@/lib/rateLimit";

const limiter = createRateLimiter();
const limits = rateLimitConfig(process.env);
const AUTH_COOKIE = process.env.AUTH_COOKIE_NAME || "nextq_session";

export function middleware(request: NextRequest) {
  if (isRateLimited(request.nextUrl.pathname)) {
    const { key, max } = rateLimitKey(
      {
        authCookie: request.cookies.get(AUTH_COOKIE)?.value,
        forwardedFor: request.headers.get("x-forwarded-for"),
        realIp: request.headers.get("x-real-ip"),
      },
      limits
    );
    if (!limiter.hit(key, max)) {
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

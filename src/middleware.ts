import { NextRequest, NextResponse } from "next/server";

interface RateLimitStore {
  [key: string]: { count: number; resetTime: number };
}

const rateLimitStore: RateLimitStore = {};
const RATE_LIMIT_WINDOW = 60 * 1000; // 1 minute
/** Per logged-in organiser (their own bucket, never shared with others on the same Wi-Fi). */
const ORGANISER_MAX_REQUESTS = Number(process.env.RATE_LIMIT_ORGANISER_MAX ?? 600);
/** Per IP for everyone else. Players on the venue Wi-Fi usually share one IP, and the public
 * session page polls every 8 s, so this allows roughly 35 people watching at once. */
const PUBLIC_MAX_REQUESTS = Number(process.env.RATE_LIMIT_PUBLIC_MAX ?? 300);
const AUTH_COOKIE = process.env.AUTH_COOKIE_NAME || "nextq_session";

function cleanupExpiredEntries() {
  const now = Date.now();
  for (const key in rateLimitStore) {
    if (rateLimitStore[key].resetTime < now) {
      delete rateLimitStore[key];
    }
  }
}

function checkRateLimit(key: string, max: number): boolean {
  cleanupExpiredEntries();
  const now = Date.now();

  if (!rateLimitStore[key]) {
    rateLimitStore[key] = { count: 1, resetTime: now + RATE_LIMIT_WINDOW };
    return true;
  }

  const entry = rateLimitStore[key];
  if (entry.resetTime < now) {
    entry.count = 1;
    entry.resetTime = now + RATE_LIMIT_WINDOW;
    return true;
  }

  entry.count += 1;
  return entry.count <= max;
}

export function middleware(request: NextRequest) {
  const ip = request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip") || "unknown";

  // Only data requests count; page loads and assets don't. A 429 makes the organiser's screen
  // treat the server as unreachable (offline mode), so the organiser gets a bucket of their own
  // instead of sharing the venue Wi-Fi's IP with everyone watching the public page.
  if (request.nextUrl.pathname.startsWith("/api/")) {
    const session = request.cookies.get(AUTH_COOKIE)?.value;
    const allowed = session
      ? checkRateLimit(`org:${ip}:${session.slice(-32)}`, ORGANISER_MAX_REQUESTS)
      : checkRateLimit(`ip:${ip}`, PUBLIC_MAX_REQUESTS);
    if (!allowed) return new NextResponse("Too many requests", { status: 429 });
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

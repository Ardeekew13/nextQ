import crypto from "crypto";
import { cookies } from "next/headers";

const CSRF_COOKIE_NAME = "csrf_token";
const CSRF_HEADER_NAME = "x-csrf-token";

export async function generateCSRFToken(): Promise<string> {
  const token = crypto.randomBytes(32).toString("hex");
  const store = await cookies();
  store.set(CSRF_COOKIE_NAME, token, {
    httpOnly: false,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge: 60 * 60 * 24, // 1 day
  });
  return token;
}

export async function verifyCSRFToken(token: string): Promise<boolean> {
  const store = await cookies();
  const cookieToken = store.get(CSRF_COOKIE_NAME)?.value;
  if (!cookieToken) return false;
  return crypto.timingSafeEqual(
    Buffer.from(token),
    Buffer.from(cookieToken)
  );
}

export async function getCSRFToken(): Promise<string> {
  const store = await cookies();
  let token = store.get(CSRF_COOKIE_NAME)?.value;
  if (!token) {
    token = await generateCSRFToken();
  }
  return token;
}

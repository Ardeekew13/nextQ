import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import { cookies } from "next/headers";

const TOKEN_TTL_SECONDS = 60 * 60 * 24; // 1 day

/** How long a password-reset link stays valid after being requested. */
export const PASSWORD_RESET_TTL_MS = 60 * 60 * 1000; // 1 hour

export interface AuthTokenPayload {
  sub: string; // User id
  email: string;
  name: string;
  role: string;
}

function requireJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error("JWT_SECRET environment variable is not set");
  }
  return secret;
}

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, 10);
}

export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

export function signAuthToken(payload: AuthTokenPayload): string {
  return jwt.sign(payload, requireJwtSecret(), { expiresIn: TOKEN_TTL_SECONDS });
}

export function verifyAuthToken(token: string): AuthTokenPayload | null {
  try {
    return jwt.verify(token, requireJwtSecret()) as AuthTokenPayload;
  } catch {
    return null;
  }
}

/**
 * Generates a password-reset token: the raw value is what goes in the emailed link
 * (never stored), while only its SHA-256 hash is saved on the user document. That way
 * a database read alone (a leaked backup, an errant log line) can't be used to reset
 * someone's password — you'd need the raw token, which only ever exists in the email.
 */
export function generatePasswordResetToken(): { token: string; tokenHash: string } {
  const token = crypto.randomBytes(32).toString("hex");
  const tokenHash = hashResetToken(token);
  return { token, tokenHash };
}

export function hashResetToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export const authCookieName = process.env.AUTH_COOKIE_NAME || "nextq_session";
export const authCookieMaxAge = TOKEN_TTL_SECONDS;

/** Reads and verifies the organiser session cookie in a server context (route handler, server component). */
export async function getSessionFromCookies(): Promise<AuthTokenPayload | null> {
  const store = await cookies();
  const token = store.get(authCookieName)?.value;
  if (!token) return null;
  return verifyAuthToken(token);
}

/**
 * Test database for the browser tests. These tests seed (and wipe) data, so they must never
 * point at your real database: the name has to end in "_e2e" or the run is refused.
 *
 * Default is a local MongoDB. To use Atlas instead, set E2E_MONGODB_URI to a URI whose
 * database name ends in _e2e (e.g. .../pickleq_e2e).
 */
export const E2E_PORT = 3100;
export const E2E_BASE_URL = `http://localhost:${E2E_PORT}`;
export const E2E_MONGODB_URI = process.env.E2E_MONGODB_URI ?? "mongodb://127.0.0.1:27017/nextq_e2e";
export const E2E_JWT_SECRET = "e2e-only-secret-not-for-real-use-0123456789abcdef";
export const E2E_PASSWORD = "e2e-password-123";
export const E2E_EMAIL = "organiser@nextq.test";

export function assertSafeDatabase(uri: string): void {
  const name = uri.split("?")[0].split("/").pop() ?? "";
  if (!/_e2e$/.test(name)) {
    throw new Error(
      `Refusing to run browser tests against database "${name}". ` +
        `Use a database whose name ends in _e2e (set E2E_MONGODB_URI).`
    );
  }
}

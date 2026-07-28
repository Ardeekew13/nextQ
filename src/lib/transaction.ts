import type { ClientSession } from "mongoose";
import { connectToDatabase } from "@/lib/db";

function isTransactionsUnsupportedError(error: unknown): boolean {
  const err = error as { code?: number; codeName?: string; message?: string };
  return (
    err?.code === 20 ||
    err?.codeName === "IllegalOperation" ||
    Boolean(err?.message?.includes("Transaction numbers"))
  );
}

/**
 * Runs `fn` inside a MongoDB transaction when the deployment supports one
 * (replica set / mongos). Standalone MongoDB instances - common in local
 * development - don't support transactions, so we transparently fall back
 * to running `fn` without one rather than failing every mutation.
 */
export async function withOptionalTransaction<T>(
  fn: (mongooseSession: ClientSession | undefined) => Promise<T>
): Promise<T> {
  const connection = await connectToDatabase();
  const session = await connection.startSession();
  try {
    let result: T | undefined;
    try {
      await session.withTransaction(async () => {
        result = await fn(session);
      });
      return result as T;
    } catch (error) {
      if (isTransactionsUnsupportedError(error)) {
        return await fn(undefined);
      }
      throw error;
    }
  } finally {
    await session.endSession();
  }
}

import { describe, expect, it } from "vitest";
import { isNetworkFailure } from "@/lib/offlineResults";

describe("isNetworkFailure", () => {
  it("treats a failed fetch / no-response as a network failure (retry later)", () => {
    expect(isNetworkFailure(new TypeError("Failed to fetch"))).toBe(true);
    expect(isNetworkFailure({ networkError: {}, message: "x" })).toBe(true);
    expect(isNetworkFailure({ networkError: { statusCode: 503 } })).toBe(true);
  });
  it("treats a server answer with an error as NOT a network failure", () => {
    expect(isNetworkFailure({ message: "Cannot complete a game that is CANCELLED." })).toBe(false);
    expect(isNetworkFailure({ networkError: { statusCode: 400 } })).toBe(false);
    expect(isNetworkFailure({ networkError: { statusCode: 401 } })).toBe(false);
  });
});

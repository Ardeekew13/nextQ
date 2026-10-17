import { describe, expect, it } from "vitest";
import { makeApolloClient } from "@/apollo/client";

describe("Apollo client", () => {
  it("doesn't deduplicate queries: a refresh after a change always reaches the server", () => {
    // An undone game stayed on court because the refresh joined a request started before the undo.
    const client = makeApolloClient() as unknown as { queryManager: { queryDeduplication: boolean } };
    expect(client.queryManager.queryDeduplication).toBe(false);
  });
});

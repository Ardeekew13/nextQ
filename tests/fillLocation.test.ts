import { describe, expect, it, vi } from "vitest";
import { shouldFillOnDevice } from "@/lib/fillLocation";

describe("where a court fill happens", () => {
  it("the server picks when online and nothing is waiting", async () => {
    const syncNow = vi.fn(async () => {});
    expect(await shouldFillOnDevice({ hasSnapshot: true, online: true, hasUnsynced: () => false, syncNow })).toBe(false);
    expect(syncNow).not.toHaveBeenCalled();
  });

  it("record result then fill court: sends the result first, then the server picks (the Tuesday bug)", async () => {
    let waiting = true;
    const syncNow = vi.fn(async () => { waiting = false; });
    expect(await shouldFillOnDevice({ hasSnapshot: true, online: true, hasUnsynced: () => waiting, syncNow })).toBe(false);
    expect(syncNow).toHaveBeenCalledOnce();
  });

  it("fills on the device when the send fails or the connection is down", async () => {
    const stuck = vi.fn(async () => {});
    expect(await shouldFillOnDevice({ hasSnapshot: true, online: true, hasUnsynced: () => true, syncNow: stuck })).toBe(true);
    const throws = vi.fn(async () => { throw new Error("offline"); });
    expect(await shouldFillOnDevice({ hasSnapshot: true, online: true, hasUnsynced: () => true, syncNow: throws })).toBe(true);
    expect(await shouldFillOnDevice({ hasSnapshot: true, online: false, hasUnsynced: () => false, syncNow: stuck })).toBe(true);
  });

  it("without a snapshot it always tries the server", async () => {
    expect(await shouldFillOnDevice({ hasSnapshot: false, online: false, hasUnsynced: () => true, syncNow: async () => {} })).toBe(false);
  });
});

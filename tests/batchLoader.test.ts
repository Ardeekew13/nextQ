import { describe, expect, it, vi } from "vitest";
import { createBatchLoader } from "@/lib/batchLoader";

type Row = { _id: string; name: string };
const db = (rows: Row[]) => vi.fn(async (ids: string[]) => rows.filter((r) => ids.includes(r._id)));

describe("createBatchLoader: one query for a whole dashboard's players", () => {
  it("collects every load made in the same tick into a single query", async () => {
    const fetch = db([{ _id: "a", name: "A" }, { _id: "b", name: "B" }, { _id: "c", name: "C" }]);
    const loader = createBatchLoader(fetch, (r) => r._id);
    // 3 games x 2 teams, overlapping players — like resolving completedGames.
    const teams = await Promise.all([
      loader.loadMany(["a", "b"]), loader.loadMany(["c", "a"]), loader.loadMany(["b", "c"]),
    ]);
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(fetch.mock.calls[0][0].sort()).toEqual(["a", "b", "c"]);
    expect(teams.map((t) => t.map((r) => r.name))).toEqual([["A", "B"], ["C", "A"], ["B", "C"]]);
  });
  it("serves repeats from cache and leaves out ids that don't exist", async () => {
    const fetch = db([{ _id: "a", name: "A" }]);
    const loader = createBatchLoader(fetch, (r) => r._id);
    expect((await loader.loadMany(["a", "missing"])).map((r) => r.name)).toEqual(["A"]);
    expect(await loader.load("a")).toEqual({ _id: "a", name: "A" });
    expect(fetch).toHaveBeenCalledTimes(1);
  });
  it("accepts ObjectId-like ids (anything with toString)", async () => {
    const fetch = db([{ _id: "a", name: "A" }]);
    const loader = createBatchLoader(fetch, (r) => r._id);
    expect(await loader.loadMany([{ toString: () => "a" }])).toHaveLength(1);
  });
  it("a failed query rejects its loads and doesn't poison the cache", async () => {
    let fail = true;
    const fetch = vi.fn(async (ids: string[]) => {
      if (fail) throw new Error("db down");
      return ids.map((id) => ({ _id: id, name: id }));
    });
    const loader = createBatchLoader(fetch, (r: Row) => r._id);
    await expect(loader.load("a")).rejects.toThrow("db down");
    fail = false;
    expect(await loader.load("a")).toEqual({ _id: "a", name: "a" });
  });
});

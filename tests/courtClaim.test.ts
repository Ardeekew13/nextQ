/** Two fills for the same court at the same moment: only one game gets the court. Before, both
 * were saved, the court showed one and the other's players were stuck as "playing" - not on any
 * court and not in the queue. */
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/graphql/guards", () => ({
  requireOrganiser: vi.fn(() => ({ sub: "organiser-1" })),
  requireSessionOwner: vi.fn(async () => ({ _id: "s1", organiserId: "organiser-1", matchRequests: [] })),
  requireClubOwner: vi.fn(),
}));
// A tiny in-memory court: updateOne only matches while it's free, like MongoDB's atomic update.
const courtState = { status: "AVAILABLE", activeGameId: null as string | null };
vi.mock("@/models/Court", () => ({
  Court: {
    findById: vi.fn(async () => ({ _id: "c1", sessionId: "s1", status: "AVAILABLE", save: vi.fn(async () => undefined) })),
    updateOne: vi.fn(async (filter: { status?: string; activeGameId?: null }, update: { $set: { status: string } }) => {
      if (filter.status && (courtState.status !== filter.status || courtState.activeGameId !== null)) return { modifiedCount: 0 };
      if (!filter.status && courtState.activeGameId !== null) return { modifiedCount: 0 };
      courtState.status = update.$set.status;
      return { modifiedCount: 1 };
    }),
  },
}));
vi.mock("@/models/Session", () => ({ Session: { updateOne: vi.fn(async () => ({})) } }));
vi.mock("@/models/Game", () => ({ Game: { findOne: vi.fn(), create: vi.fn() } }));
vi.mock("@/models/SessionPlayer", () => ({ SessionPlayer: { find: vi.fn(async () => [{}, {}, {}, {}]), updateMany: vi.fn(async () => ({})) } }));

import { Game } from "@/models/Game";
import { gameResolvers } from "@/graphql/resolvers/game";

const ctx = { organiser: { sub: "organiser-1" } } as any;
const sync = (clientGameId: string, ids: string[]) =>
  gameResolvers.Mutation.syncOfflineGame(
    null,
    { sessionId: "s1", courtId: "c1", clientGameId, teamAPlayerIds: ids.slice(0, 2), teamBPlayerIds: ids.slice(2), playersSatOutIds: [] },
    ctx
  );

describe("one court, one game", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    courtState.status = "AVAILABLE";
    courtState.activeGameId = null;
    (Game.findOne as any).mockImplementation((q: { clientId?: string; status?: unknown }) =>
      q && "clientId" in q ? Promise.resolve(null) : q && "status" in q ? Promise.resolve(null) : { sort: async () => ({ gameNumber: 1 }) }
    );
    (Game.create as any).mockImplementation(async (doc: { clientId: string }) => ({ _id: `g-${doc.clientId}` }));
  });

  it("two fills for the same court at once: the second is refused, only one game is saved", async () => {
    const results = await Promise.allSettled([sync("local-a", ["a", "b", "c", "d"]), sync("local-b", ["e", "f", "g", "h"])]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    const refused = results.find((r) => r.status === "rejected") as PromiseRejectedResult;
    expect(String(refused.reason)).toMatch(/just filled/);
    expect(Game.create).toHaveBeenCalledTimes(1);
  });

  it("gives the court back if the game can't be saved", async () => {
    (Game.create as any).mockRejectedValueOnce(new Error("db down"));
    await expect(sync("local-a", ["a", "b", "c", "d"])).rejects.toThrow("db down");
    expect(courtState.status).toBe("AVAILABLE");
  });
});

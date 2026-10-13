/**
 * How a game was made (queue / manual / Match top 4, offline) and every later team edit are
 * recorded, so "why did these two play together again?" can be answered from the data.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/graphql/guards", () => ({
  requireOrganiser: vi.fn(() => ({ sub: "organiser-1" })),
  requireSessionOwner: vi.fn(async () => ({ _id: "s1", organiserId: "organiser-1" })),
  requireClubOwner: vi.fn(),
}));
vi.mock("@/models/Game", () => ({ Game: { findById: vi.fn() } }));
vi.mock("@/models/SessionPlayer", () => ({ SessionPlayer: { find: vi.fn(), updateMany: vi.fn() } }));

import mongoose from "mongoose";
import { Game } from "@/models/Game";
import { SessionPlayer } from "@/models/SessionPlayer";
import { gameResolvers } from "@/graphql/resolvers/game";

function fakeGame() {
  return {
    _id: "g1",
    sessionId: "s1",
    status: "QUEUED",
    teamAPlayerIds: ["a", "b"],
    teamBPlayerIds: ["c", "d"],
    playersSatOutIds: ["e"],
    edits: [] as any[],
    save: vi.fn(async () => undefined),
  };
}
const ctx = { organiser: { sub: "organiser-1" }, playerNameCache: new Map(), csrfToken: "t" } as any;

describe("team edits are logged", () => {
  beforeEach(() => vi.clearAllMocks());

  it("records who was on each team before and after", async () => {
    const game = fakeGame();
    (Game.findById as any).mockResolvedValue(game);
    (SessionPlayer.find as any).mockResolvedValue([{}, {}, {}, {}]);
    await gameResolvers.Mutation.updateGameTeams(null, { id: "g1", teamAPlayerIds: ["a", "e"], teamBPlayerIds: ["c", "d"] }, ctx);
    expect(game.edits).toHaveLength(1);
    expect(game.edits[0]).toMatchObject({
      fromTeamAPlayerIds: ["a", "b"], fromTeamBPlayerIds: ["c", "d"],
      toTeamAPlayerIds: ["a", "e"], toTeamBPlayerIds: ["c", "d"],
    });
    expect(game.edits[0].at).toBeInstanceOf(Date);
  });

  it("keeps every edit, oldest first, and ignores saves that change nobody's team", async () => {
    const game = fakeGame();
    (Game.findById as any).mockResolvedValue(game);
    (SessionPlayer.find as any).mockResolvedValue([{}, {}, {}, {}]);
    await gameResolvers.Mutation.updateGameTeams(null, { id: "g1", teamAPlayerIds: ["a", "e"], teamBPlayerIds: ["c", "d"] }, ctx);
    // same teams, different order: not a change
    await gameResolvers.Mutation.updateGameTeams(null, { id: "g1", teamAPlayerIds: ["e", "a"], teamBPlayerIds: ["d", "c"] }, ctx);
    await gameResolvers.Mutation.updateGameTeams(null, { id: "g1", teamAPlayerIds: ["a", "e"], teamBPlayerIds: ["b", "d"] }, ctx);
    expect(game.edits).toHaveLength(2);
    expect([...game.edits[1].fromTeamBPlayerIds].sort()).toEqual(["c", "d"]);
    expect([...game.edits[1].toTeamBPlayerIds].sort()).toEqual(["b", "d"]);
  });

  it("exposes source, offline and edited on the Game type", () => {
    const G = (gameResolvers as any).Game;
    expect(G.offline({ clientId: "local-1" })).toBe(true);
    expect(G.offline({})).toBe(false);
    expect(G.edited({ edits: [{}] })).toBe(true);
    expect(G.edited({ edits: [] })).toBe(false);
    expect(G.edits({})).toEqual([]);
  });
});

describe("the Game model", () => {
  it("only accepts known sources", async () => {
    const { Game: RealGame } = await vi.importActual<typeof import("@/models/Game")>("@/models/Game");
    const id = () => new mongoose.Types.ObjectId();
    const base = { sessionId: id(), courtId: id(), gameNumber: 1, teamAPlayerIds: [id(), id()], teamBPlayerIds: [id(), id()] };
    for (const source of ["AUTO", "MANUAL", "TOP_FOUR"]) expect(new RealGame({ ...base, source }).validateSync()).toBeUndefined();
    expect(new RealGame({ ...base, source: "BOGUS" }).validateSync()?.errors.source).toBeDefined();
    // older games have no source at all, which is fine
    expect(new RealGame(base).validateSync()).toBeUndefined();
  });
});

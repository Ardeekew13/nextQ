/** The server takes players off the saved manual order once they're put in a game. */
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/graphql/guards", () => ({
  requireOrganiser: vi.fn(() => ({ sub: "organiser-1" })),
  requireSessionOwner: vi.fn(async () => ({ _id: "s1", organiserId: "organiser-1" })),
  requireClubOwner: vi.fn(),
}));
vi.mock("@/models/Session", () => ({ Session: { updateOne: vi.fn(async () => ({})) } }));
vi.mock("@/models/Court", () => ({ Court: { findById: vi.fn() } }));
vi.mock("@/models/Game", () => ({ Game: { findOne: vi.fn(), create: vi.fn() } }));
vi.mock("@/models/SessionPlayer", () => ({ SessionPlayer: { find: vi.fn(), updateMany: vi.fn(async () => ({})) } }));

import { Session } from "@/models/Session";
import { Court } from "@/models/Court";
import { Game } from "@/models/Game";
import { SessionPlayer } from "@/models/SessionPlayer";
import { gameResolvers } from "@/graphql/resolvers/game";

const ctx = { organiser: { sub: "organiser-1" }, playerNameCache: new Map(), csrfToken: "t" } as any;

describe("players leave the manual queue order when they get a game", () => {
  beforeEach(() => vi.clearAllMocks());

  it("a game saved from the device (syncOfflineGame) releases its four players", async () => {
    (Game.findOne as any)
      .mockResolvedValueOnce(null) // not synced before (clientGameId)
      .mockResolvedValueOnce(null) // nobody busy on another court
      .mockReturnValueOnce({ sort: async () => ({ gameNumber: 3 }) }); // last game number
    (Court.findById as any).mockResolvedValue({ _id: "c1", sessionId: "s1", status: "AVAILABLE", save: vi.fn(async () => undefined) });
    (SessionPlayer.find as any).mockResolvedValue([{}, {}, {}, {}, {}]);
    (Game.create as any).mockResolvedValue({ _id: "g4" });
    await gameResolvers.Mutation.syncOfflineGame(
      null,
      { sessionId: "s1", courtId: "c1", clientGameId: "local-1", teamAPlayerIds: ["a", "b"], teamBPlayerIds: ["c", "d"], playersSatOutIds: ["e"] },
      ctx
    );
    expect(Session.updateOne).toHaveBeenCalledWith({ _id: "s1" }, { $pull: { manualQueueOrder: { $in: ["a", "b", "c", "d"] } } });
  });
});

/** requestMatch keeps fixed pairs together and respects keep-apart groups. */
import { beforeEach, describe, expect, it, vi } from "vitest";

const session: any = { _id: "s1", matchRequests: [], separatedGroups: [], save: vi.fn(async () => undefined) };
vi.mock("@/graphql/guards", () => ({
  requireOrganiser: vi.fn(() => ({ sub: "organiser-1" })),
  requireSessionOwner: vi.fn(async () => session),
  requireClubAccess: vi.fn(),
  requireClubOwner: vi.fn(),
}));
vi.mock("@/models/SessionPlayer", () => ({ SessionPlayer: { find: vi.fn(), findById: vi.fn(async () => ({ name: "Bea" })) } }));

import { SessionPlayer } from "@/models/SessionPlayer";
import { sessionResolvers } from "@/graphql/resolvers/session";

const players = (partners: Record<string, string> = {}) =>
  ["a", "b", "c", "d"].map((id) => ({ _id: id, name: id.toUpperCase(), fixedPartnerId: partners[id] }));
const ask = (teamA: string[], teamB: string[]) =>
  (sessionResolvers as any).Mutation.requestMatch(null, { sessionId: "s1", teamAPlayerIds: teamA, teamBPlayerIds: teamB }, {} as any);

describe("requestMatch", () => {
  beforeEach(() => {
    session.matchRequests = [];
    session.separatedGroups = [];
    vi.clearAllMocks();
  });

  it("saves A & B vs C & D", async () => {
    (SessionPlayer.find as any).mockResolvedValue(players());
    await ask(["a", "b"], ["c", "d"]);
    expect(session.matchRequests).toEqual([{ teamAPlayerIds: ["a", "b"], teamBPlayerIds: ["c", "d"] }]);
  });

  it("refuses to split a fixed pair", async () => {
    (SessionPlayer.find as any).mockResolvedValue(players({ a: "c", c: "a" }));
    await expect(ask(["a", "b"], ["c", "d"])).rejects.toThrow(/fixed partner/);
  });

  it("allows a fixed pair on the same team", async () => {
    (SessionPlayer.find as any).mockResolvedValue(players({ a: "b", b: "a" }));
    await expect(ask(["a", "b"], ["c", "d"])).resolves.toBeTruthy();
  });

  it("refuses players set to be kept apart", async () => {
    session.separatedGroups = [{ playerIds: ["a", "d"] }];
    (SessionPlayer.find as any).mockResolvedValue(players());
    await expect(ask(["a", "b"], ["c", "d"])).rejects.toThrow(/kept apart/);
  });

  it("refuses a player who's already in another request", async () => {
    session.matchRequests = [{ teamAPlayerIds: ["a", "x"], teamBPlayerIds: ["y", "z"] }];
    (SessionPlayer.find as any).mockResolvedValue(players());
    await expect(ask(["a", "b"], ["c", "d"])).rejects.toThrow(/already in a requested match/);
  });
});

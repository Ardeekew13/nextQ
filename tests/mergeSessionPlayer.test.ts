/** From a session's Players tab: "this new player is already in the club as X". */
import { beforeEach, describe, expect, it, vi } from "vitest";

type Row = { _id: string; sessionId: string; name: string; memberId: string | null; save?: () => Promise<void> };
const db = {
  members: [] as any[],
  rows: [] as Row[],
  sessions: [] as Array<{ _id: string; status: string; clubId: string }>,
};
const rowMatches = (r: any, q: any) =>
  (!q.sessionId?.$in || q.sessionId.$in.includes(r.sessionId)) &&
  q.$or.some((c: any) => ("$expr" in c ? r.memberId === null && r.name.toLowerCase() === c.$expr.$eq[1] : r.memberId === String(c.memberId)));
const chain = (v: any) => ({ select: () => ({ lean: async () => v }), lean: async () => v, then: (f: any) => Promise.resolve(v).then(f) });

vi.mock("@/models/ClubMember", () => ({
  ClubMember: {
    findById: vi.fn(async (id: string) => db.members.find((m) => m._id === String(id)) ?? null),
    findByIdAndDelete: vi.fn(async (id: string) => { db.members = db.members.filter((m) => m._id !== String(id)); }),
  },
}));
vi.mock("@/models/Session", () => ({
  Session: {
    find: vi.fn(() => chain(db.sessions)),
    findById: vi.fn((id: string) => chain(db.sessions.find((s) => s._id === String(id)) ?? null)),
  },
}));
vi.mock("@/models/SessionPlayer", () => ({
  SessionPlayer: {
    findById: vi.fn((id: string) => chain(db.rows.find((r) => r._id === String(id)) ?? null)),
    findOne: vi.fn((q: any) =>
      chain(db.rows.find((r) => r.sessionId === String(q.sessionId) && r.memberId === String(q.memberId) && r._id !== String(q._id.$ne)) ?? null)
    ),
    find: vi.fn((q: any) => chain(db.rows.filter((r) => rowMatches(r, q)))),
    updateMany: vi.fn(async (q: any, u: any) => { for (const r of db.rows) if (rowMatches(r, q)) r.memberId = String(u.$set.memberId); }),
    deleteMany: vi.fn(async () => undefined),
  },
}));
vi.mock("@/graphql/guards", () => ({ requireOrganiser: vi.fn(), requireClubAccess: vi.fn(async () => ({})) }));

import { clubMemberResolvers } from "@/graphql/resolvers/clubMember";
const mergeRow = (sessionPlayerId: string, memberId: string) =>
  (clubMemberResolvers as any).Mutation.mergeSessionPlayer(null, { sessionPlayerId, memberId }, {} as any);
const member = (m: any) => ({ clubId: "c1", reclubUserId: null, save: vi.fn(async () => undefined), ...m });

beforeEach(() => {
  db.sessions = [{ _id: "old", status: "COMPLETED", clubId: "c1" }, { _id: "tonight", status: "ACTIVE", clubId: "c1" }];
  db.members = [member({ _id: "juan", name: "JUAN DELA CRUZ", sessionsPlayed: 5, totalGames: 30 }), member({ _id: "dup", name: "JUAN", sessionsPlayed: 1, totalGames: 2 })];
  db.rows = [
    { _id: "r-old", sessionId: "old", name: "JUAN DELA CRUZ", memberId: "juan" },
    { _id: "r-tonight", sessionId: "tonight", name: "JUAN", memberId: "dup" },
  ];
});

describe("merge a session player into an existing club player", () => {
  it("links tonight's row to the existing player, even mid-session, and removes the duplicate", async () => {
    await mergeRow("r-tonight", "juan");
    expect(db.rows.find((r) => r._id === "r-tonight")).toMatchObject({ name: "JUAN", memberId: "juan" });
    expect(db.members.map((m) => m._id)).toEqual(["juan"]);
    expect(db.members[0]).toMatchObject({ sessionsPlayed: 6, totalGames: 32 });
  });

  it("refuses when the existing player is already in this session", async () => {
    db.rows.push({ _id: "r-twice", sessionId: "tonight", name: "JUAN DELA CRUZ", memberId: "juan" });
    await expect(mergeRow("r-tonight", "juan")).rejects.toThrow(/already in this session/);
  });

  it("refuses a player from another club", async () => {
    db.members.push(member({ _id: "elsewhere", name: "JUAN", clubId: "c2" }));
    await expect(mergeRow("r-tonight", "elsewhere")).rejects.toThrow(/isn't in this club/);
  });

  it("an old row with no account just gets linked", async () => {
    const row: Row = { _id: "r-legacy", sessionId: "tonight", name: "J", memberId: null, save: vi.fn(async () => undefined) };
    db.rows.push(row);
    await mergeRow("r-legacy", "juan");
    expect(row.memberId).toBe("juan");
    expect(row.save).toHaveBeenCalled();
  });
});

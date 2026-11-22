/** Merging the same person added twice ("JHON" in NextQ, "Pong" from Reclub). */
import { beforeEach, describe, expect, it, vi } from "vitest";

type M = { _id: string; clubId: string; name: string; reclubUserId?: number | null; reclubUsername?: string | null; reclubName?: string | null; sessionsPlayed?: number; totalGames?: number; save: () => Promise<void> };
const db = {
  members: [] as M[],
  rows: [] as Array<{ _id: string; sessionId: string; name: string; memberId: string | null }>,
  sessions: [] as Array<{ _id: string; status: string }>,
};
const member = (m: Partial<M> & { _id: string; name: string }): M => ({ clubId: "c1", reclubUserId: null, save: vi.fn(async () => undefined), ...m });
// The merge's row filter: { sessionId: {$in}, $or: [{memberId}, {memberId: null, $expr name}] }
const rowMatches = (r: any, q: any) =>
  q.$or.some((c: any) => ("$expr" in c ? r.memberId === null && r.name.toLowerCase() === c.$expr.$eq[1] : r.memberId === String(c.memberId)));

vi.mock("@/models/ClubMember", () => ({
  ClubMember: {
    findById: vi.fn(async (id: string) => db.members.find((m) => m._id === id) ?? null),
    findByIdAndDelete: vi.fn(async (id: string) => { db.members = db.members.filter((m) => m._id !== String(id)); }),
  },
}));
vi.mock("@/models/Session", () => ({ Session: { find: vi.fn(() => ({ select: () => ({ lean: async () => db.sessions }) })) } }));
vi.mock("@/models/SessionPlayer", () => ({
  SessionPlayer: {
    find: vi.fn((q: any) => ({ select: () => ({ lean: async () => db.rows.filter((r) => rowMatches(r, q)) }) })),
    updateMany: vi.fn(async (q: any, u: any) => { for (const r of db.rows) if (rowMatches(r, q)) r.memberId = String(u.$set.memberId); }),
    deleteMany: vi.fn(async (q: any) => { db.rows = db.rows.filter((r) => !(rowMatches(r, q) && q.sessionId.$in.includes(r.sessionId))); }),
  },
}));
vi.mock("@/graphql/guards", () => ({ requireOrganiser: vi.fn(), requireClubAccess: vi.fn(async () => ({})) }));

import { clubMemberResolvers } from "@/graphql/resolvers/clubMember";
const merge = (keepId: string, removeId: string) => (clubMemberResolvers as any).Mutation.mergeClubMembers(null, { keepId, removeId }, {} as any);

beforeEach(() => {
  db.sessions = [{ _id: "s1", status: "COMPLETED" }, { _id: "s2", status: "COMPLETED" }];
  db.members = [member({ _id: "jhon", name: "JHON" }), member({ _id: "pong", name: "Pong", reclubUserId: 1299336, reclubUsername: "jhon-382", reclubName: "Pong" })];
  db.rows = [
    { _id: "r1", sessionId: "s1", name: "JHON", memberId: "jhon" },
    { _id: "r2", sessionId: "s2", name: "Pong", memberId: "pong" },
  ];
});

describe("merging two accounts of the same person", () => {
  it("moves the games and the Reclub link to the kept member; each session keeps its name", async () => {
    const kept = await merge("jhon", "pong");
    expect(db.rows.map((r) => [r.name, r.memberId])).toEqual([["JHON", "jhon"], ["Pong", "jhon"]]);
    expect(kept).toMatchObject({ name: "JHON", reclubUserId: 1299336, reclubUsername: "jhon-382" });
    expect(db.members.map((m) => m._id)).toEqual(["jhon"]);
  });

  it("refuses two different Reclub accounts", async () => {
    db.members[0].reclubUserId = 42;
    await expect(merge("jhon", "pong")).rejects.toThrow(/different Reclub accounts/);
  });

  it("refuses two players who played in the same session", async () => {
    db.rows.push({ _id: "r3", sessionId: "s1", name: "Pong", memberId: "pong" });
    await expect(merge("jhon", "pong")).rejects.toThrow(/same session/);
  });

  it("refuses while both are in a running session", async () => {
    db.sessions.push({ _id: "s3", status: "ACTIVE" });
    db.rows.push({ _id: "r4", sessionId: "s3", name: "JHON", memberId: "jhon" }, { _id: "r5", sessionId: "s3", name: "Pong", memberId: "pong" });
    await expect(merge("jhon", "pong")).rejects.toThrow(/running right now/);
  });
});

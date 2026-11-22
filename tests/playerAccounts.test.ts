/**
 * Player accounts: who a player is across sessions is their club member account, not their name.
 * Two people called Christian stay two people; renaming someone for a session keeps their games;
 * a Reclub player stays the same member when they change their name on Reclub.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

// ── tiny in-memory ClubMember / SessionPlayer ──
type M = { _id: string; clubId: string; name: string; nickname?: string; skillLevel?: string; reclubUserId?: number | null; reclubUsername?: string | null; reclubName?: string | null; save?: () => Promise<void>; toObject?: () => M };
const db = { members: [] as M[], players: [] as Array<{ _id: string; sessionId: string; name: string; memberId: string }> };
let seq = 0;
const id = () => `id${++seq}`;
const matches = (doc: any, q: any) =>
  Object.entries(q).every(([k, v]: [string, any]) => (v && typeof v === "object" && "$in" in v ? v.$in.map(String).includes(String(doc[k])) : String(doc[k] ?? null) === String(v)));
const withSave = (m: M) => Object.assign(m, { save: async () => undefined });
const chain = <T,>(value: T) => ({ select: () => chain(value), lean: async () => value, then: (f: (v: T) => unknown) => Promise.resolve(value).then(f) });

vi.mock("@/models/ClubMember", () => ({
  ClubMember: {
    find: vi.fn((q: any) => chain(db.members.filter((m) => matches(m, q)))),
    findOne: vi.fn(async (q: any) => db.members.find((m) => matches(m, q)) ?? null),
    findById: vi.fn(async (i: string) => db.members.find((m) => m._id === i) ?? null),
    create: vi.fn(async (doc: any) => { const m = withSave({ _id: id(), reclubUserId: null, ...doc }); db.members.push(m); return m; }),
    updateOne: vi.fn(async () => ({})),
    updateMany: vi.fn(async () => ({})),
  },
}));
vi.mock("@/models/SessionPlayer", () => ({
  SessionPlayer: {
    find: vi.fn((q: any) => chain(db.players.filter((p) => matches(p, q)))),
    findOne: vi.fn((q: any) => chain(db.players.find((p) => matches(p, q)) ?? null)),
    create: vi.fn(async (doc: any) => { const p = { _id: id(), ...doc }; db.players.push(p); return { ...p, save: async () => undefined }; }),
    insertMany: vi.fn(async (docs: any[]) => docs.map((d) => { const p = { _id: id(), ...d }; db.players.push(p); return p; })),
  },
}));
const session = { _id: "s1", clubId: "club1", organiserId: "o1", playerIds: [] as string[], save: vi.fn(async () => undefined) };
vi.mock("@/graphql/guards", () => ({
  requireOrganiser: vi.fn(() => ({ sub: "o1" })),
  requireSessionOwner: vi.fn(async () => session),
  requireClubAccess: vi.fn(),
  requireClubOwner: vi.fn(),
}));

import { playerResolvers } from "@/graphql/resolvers/player";
import { reclubResolvers, reclubSource } from "@/graphql/resolvers/reclub";
import { playerKey } from "@/lib/playerStrength";

const ctx = {} as any;
const add = (input: any) => (playerResolvers as any).Mutation.addSessionPlayer(null, { sessionId: "s1", input }, ctx);

beforeEach(() => {
  db.members = [];
  db.players = [];
  session.playerIds = [];
});

describe("adding players links them to an account", () => {
  it("a name nobody has makes a new member; the same name next time is that member", async () => {
    const p1 = await add({ name: "CHRISTIAN" });
    expect(db.members).toHaveLength(1);
    expect(p1.memberId).toBe(db.members[0]._id);
    db.players = []; // next session
    const p2 = await add({ name: "christian" });
    expect(db.members).toHaveLength(1);
    expect(p2.memberId).toBe(db.members[0]._id);
  });

  it("a second Christian is a separate account, and stays separate", async () => {
    const a = await add({ name: "CHRISTIAN" });
    // Same night, another Christian: added as "CHRISTIAN L" -> new member.
    const b = await add({ name: "CHRISTIAN L" });
    expect(a.memberId).not.toBe(b.memberId);
    // Next session: "CHRISTIAN" can now be either if both were called that, so the organiser
    // picks; picking "new player" never merges them.
    db.members[1].name = "CHRISTIAN";
    db.players = [];
    await expect(add({ name: "CHRISTIAN" })).rejects.toMatchObject({ extensions: { code: "SAME_NAME" } });
    const picked = await add({ name: "CHRISTIAN", memberId: db.members[1]._id });
    expect(picked.memberId).toBe(db.members[1]._id);
    const fresh = await add({ name: "CHRISTIAN 3", newMember: true });
    expect(new Set([a.memberId, b.memberId, fresh.memberId]).size).toBe(3);
  });

  it("the same member can't be in a session twice, even under another name", async () => {
    const a = await add({ name: "RODEL" });
    await expect(add({ name: "RODEL L", memberId: a.memberId })).rejects.toThrow(/already in this session as RODEL/);
  });

  it("history is keyed by account, so two Christians never share a record", () => {
    expect(playerKey({ name: "Christian", memberId: "m1" })).not.toBe(playerKey({ name: "Christian", memberId: "m2" }));
    expect(playerKey({ name: "Christian L", memberId: "m1" })).toBe(playerKey({ name: "Christian", memberId: "m1" }));
  });
});

describe("Reclub import", () => {
  const meet = (name: string) => ({
    code: "3PA3KP", name: "Rally", startsAt: null, clubName: "Club",
    participants: [
      { key: "u:777", kind: "PLAYER" as const, status: "CONFIRMED" as const, name, userId: 777, username: "jhon-382", guestOfUserId: null, guestOfName: null, isHost: false },
      { key: "g:777:guesty", kind: "GUEST" as const, status: "CONFIRMED" as const, name: "Guesty", userId: null, username: null, guestOfUserId: 777, guestOfName: name, isHost: false },
    ],
  });
  const preview = () => (reclubResolvers as any).Query.reclubImportPreview(null, { sessionId: "s1", link: "3PA3KP" }, ctx);
  const doImport = (picks: any[]) => (reclubResolvers as any).Mutation.importReclubPlayers(null, { sessionId: "s1", link: "3PA3KP", picks }, ctx);

  it("first import makes members and remembers the Reclub account; a renamed Reclub player stays the same member", async () => {
    reclubSource.fetch = async () => meet("Pong");
    await doImport([{ key: "u:777", newMember: true }, { key: "g:777:guesty", newMember: true }]);
    const pong = db.members.find((m) => m.reclubUserId === 777)!;
    expect(pong).toMatchObject({ name: "Pong", reclubUsername: "jhon-382", reclubName: "Pong" });
    expect(db.players.map((p) => p.name).sort()).toEqual(["Guesty", "Pong"]);

    // Next week they've renamed themselves on Reclub. Same id -> same member, NextQ name kept.
    db.players = [];
    reclubSource.fetch = async () => meet("Jhon P");
    const p = await preview();
    expect(p.rows[0].match).toMatchObject({ memberId: pong._id, how: "RECLUB", name: "Pong" });
    await doImport([{ key: "u:777", newMember: true }]); // even "new" can't split a linked account
    expect(db.members.filter((m) => m.reclubUserId === 777)).toHaveLength(1);
    expect(pong.reclubName).toBe("Jhon P");
    expect(db.players[0]).toMatchObject({ memberId: pong._id, name: "Pong" });
  });

  it("an unlinked member with the same name is suggested, not assumed; several are left to pick", async () => {
    db.members.push(withSave({ _id: "m-a", clubId: "club1", name: "Pong" }));
    reclubSource.fetch = async () => meet("Pong");
    let p = await preview();
    expect(p.rows[0].match).toMatchObject({ memberId: "m-a", how: "NAME" });
    db.members.push(withSave({ _id: "m-b", clubId: "club1", name: "PONG" }));
    p = await preview();
    expect(p.rows[0].match).toBeNull();
    expect(p.rows[0].candidates.map((c: any) => c.memberId).sort()).toEqual(["m-a", "m-b"]);
    await doImport([{ key: "u:777", memberId: "m-b" }]);
    expect(db.members.find((m) => m._id === "m-b")!.reclubUserId).toBe(777);
  });

  it("only confirmed players are listed and added - not the waitlist or invites", async () => {
    reclubSource.fetch = async () => {
      const m = meet("Pong");
      return { ...m, participants: [...m.participants, { ...m.participants[0], key: "u:888", userId: 888, name: "Waity", status: "WAITLISTED" as const }] };
    };
    const p = await preview();
    expect(p.rows.map((r: any) => r.name)).toEqual(["Pong", "Guesty"]);
    await doImport([{ key: "u:888", newMember: true }]); // even if asked for
    expect(db.players).toHaveLength(0);
    expect(db.members.some((m) => m.name === "Waity")).toBe(false);
  });

  it("a session name already taken gets a number, so courts stay clear", async () => {
    db.players.push({ _id: "x", sessionId: "s1", name: "Pong", memberId: "someone-else" });
    reclubSource.fetch = async () => meet("Pong");
    await doImport([{ key: "u:777", newMember: true }]);
    expect(db.players.map((p) => p.name)).toContain("Pong 2");
  });
});

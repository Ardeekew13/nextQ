/** "Up next" is a promise: the next fill takes exactly those players, even when another court
 * finishes in between, and anyone the organiser takes out of a game goes to the front. */
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/graphql/guards", () => ({
  requireOrganiser: vi.fn(() => ({ sub: "organiser-1" })),
  requireSessionOwner: vi.fn(async () => ({ _id: "s1", organiserId: "organiser-1" })),
  requireClubOwner: vi.fn(),
}));
vi.mock("@/models/Session", () => ({ Session: { updateOne: vi.fn(async () => ({})) } }));
vi.mock("@/models/Court", () => ({ Court: { findById: vi.fn() } }));
vi.mock("@/models/Game", () => ({ Game: { findById: vi.fn(), findOne: vi.fn(), create: vi.fn() } }));
vi.mock("@/models/SessionPlayer", () => ({ SessionPlayer: { find: vi.fn(), updateMany: vi.fn(async () => ({})) } }));

import { Game } from "@/models/Game";
import { Session } from "@/models/Session";
import { SessionPlayer } from "@/models/SessionPlayer";
import { gameResolvers } from "@/graphql/resolvers/game";
import { deriveLocalState, generateLocalGame, rankLocalQueue, type LocalOp, type QueueSnapshot, type SnapshotPlayer } from "@/lib/offlineQueue";

const T0 = new Date("2026-01-01T10:00:00Z").getTime();
const iso = (min: number) => new Date(T0 + min * 60000).toISOString();
const player = (i: number): SnapshotPlayer => ({
  id: `p${i}`, name: `P${i}`, checkedIn: true, active: true, gamesPlayed: 0, wins: 0, losses: 0,
  currentStreak: 0, longestWinStreak: 0, consecutiveGames: 0, queueEnteredAt: iso(i * 0.1), gamesSatOut: 0,
  partnerHistory: {}, opponentHistory: {},
});
const snapshot = (n: number, courts: number, opts: Partial<QueueSnapshot> = {}): QueueSnapshot => ({
  sessionId: "s1", takenAt: iso(0), queueMode: "HYBRID", maxConsecutiveGames: 2, lastGameNumber: 0,
  players: Array.from({ length: n }, (_, i) => player(i + 1)), activeGames: [],
  courts: Array.from({ length: courts }, (_, i) => ({ id: `c${i + 1}`, courtNumber: i + 1, status: "AVAILABLE" })),
  pastGroups: [], keepApart: [], ...opts,
} as QueueSnapshot);

/** Plays a night with courts finishing in turn; after every fill notes "Up next", then checks the
 * following fill against it. Returns how many fills broke the promise. */
function night(snap: QueueSnapshot, fills: number) {
  const ops: LocalOp[] = [];
  const onCourt: { id: string; court: string }[] = [];
  let promised: string[] | null = null;
  let broken = 0;
  let checked = 0;
  let minute = 1;
  for (let n = 0; n < fills; n++) {
    if (onCourt.length === snap.courts.length) {
      minute += 7;
      const done = onCourt.shift()!;
      ops.push({ kind: "complete", id: `r${n}`, sessionId: "s1", gameId: done.id, winningTeam: n % 3 ? "A" : "B", recordedAt: iso(minute) });
    }
    minute += 0.5;
    const free = snap.courts.find((c) => !onCourt.some((g) => g.court === c.id))!;
    const state = deriveLocalState(snap, ops);
    const r = generateLocalGame(snap, state);
    if (!r.ok) throw new Error(r.reason);
    const picked = [...r.teamA, ...r.teamB].sort();
    if (promised && promised.length === 4) {
      checked += 1;
      if (promised.join() !== picked.join()) broken += 1;
    }
    const id = `local-${n}`;
    ops.push({ kind: "fill", id: `f${n}`, sessionId: "s1", courtId: free.id, localGameId: id,
      teamAPlayerIds: r.teamA, teamBPlayerIds: r.teamB, playersSatOutIds: r.satOut, createdAt: iso(minute) });
    onCourt.push({ id, court: free.id });
    promised = rankLocalQueue(snap, deriveLocalState(snap, ops)).slice(0, 4).map((p) => p.id).sort();
  }
  return { broken, checked };
}

describe("Up next matches the next fill", () => {
  beforeEach(() => vi.clearAllMocks());

  it.each([
    { players: 22, courts: 2, mixEveryone: true },
    { players: 22, courts: 2, mixEveryone: false },
    { players: 16, courts: 3, mixEveryone: true },
    { players: 30, courts: 4, mixEveryone: true },
    { players: 14, courts: 2, mixEveryone: true },
  ])("$players players, $courts courts, mix $mixEveryone: the next fill is always who Up next showed", ({ players, courts, mixEveryone }) => {
    const { broken, checked } = night(snapshot(players, courts, { mixEveryone }), 50);
    expect(checked).toBeGreaterThan(40);
    expect(broken).toBe(0);
  });

  it("someone coming off court never jumps a player who was already waiting", () => {
    // p1-p4 just finished (joined after the last fill); p5-p8 were waiting before it.
    const snap = snapshot(8, 2, { mixEveryone: true, lastFillAt: iso(5) });
    snap.players.forEach((p, i) => { p.queueEnteredAt = i < 4 ? iso(6) : iso(1); p.gamesPlayed = i < 4 ? 1 : 3; });
    const r = generateLocalGame(snap, deriveLocalState(snap, []));
    expect(r.ok && [...r.teamA, ...r.teamB].sort()).toEqual(["p5", "p6", "p7", "p8"]);
  });

  it("players taken out of a game are up next, then leave the front once they play", () => {
    const snap = snapshot(12, 2, { upNextFirst: ["p12", "p11"] });
    const state = deriveLocalState(snap, []);
    expect(rankLocalQueue(snap, state).slice(0, 2).map((p) => p.id).sort()).toEqual(["p11", "p12"]);
    const r = generateLocalGame(snap, state);
    expect(r.ok && [...r.teamA, ...r.teamB]).toEqual(expect.arrayContaining(["p11", "p12"]));
    if (!r.ok) return;
    const after = deriveLocalState(snap, [{ kind: "fill", id: "f1", sessionId: "s1", courtId: "c1", localGameId: "local-1",
      teamAPlayerIds: r.teamA, teamBPlayerIds: r.teamB, playersSatOutIds: r.satOut, createdAt: iso(10) }]);
    expect(after.manualQueueOrder).toEqual([]);
  });

  it("a lineup edit puts the swapped-out player at the front of the queue", async () => {
    const game: any = {
      _id: "g1", sessionId: "s1", status: "QUEUED", edits: [],
      teamAPlayerIds: ["a", "b"], teamBPlayerIds: ["c", "d"], playersSatOutIds: ["e", "f"],
      save: vi.fn(async () => undefined),
    };
    (Game.findById as any).mockResolvedValue(game);
    (SessionPlayer.find as any).mockResolvedValue([{}, {}, {}, {}]);
    await gameResolvers.Mutation.updateGameTeams(null, { id: "g1", teamAPlayerIds: ["a", "e"], teamBPlayerIds: ["c", "d"] }, { organiser: { sub: "organiser-1" } } as any);
    await new Promise((r) => setTimeout(r, 0));
    expect(Session.updateOne).toHaveBeenCalledWith({ _id: "s1" }, { $push: { upNextFirst: { $each: ["b"], $position: 0 } } });
    expect(Session.updateOne).toHaveBeenCalledWith({ _id: "s1" }, { $pull: { manualQueueOrder: { $in: ["a", "e", "c", "d"] }, upNextFirst: { $in: ["a", "e", "c", "d"] } } });
  });
});

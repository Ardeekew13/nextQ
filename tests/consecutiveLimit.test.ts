/** "Max games in a row" really limits back-to-back games: finishing a game is not a rest,
 * only sitting out a fill is, and a lineup edit moves the game to whoever really plays it. */
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
import { SessionPlayer } from "@/models/SessionPlayer";
import { gameResolvers } from "@/graphql/resolvers/game";
import { deriveLocalState, generateLocalGame, type LocalOp, type QueueSnapshot, type SnapshotPlayer } from "@/lib/offlineQueue";

const T0 = new Date("2026-01-01T10:00:00Z").getTime();
const iso = (min: number) => new Date(T0 + min * 60000).toISOString();
const player = (i: number): SnapshotPlayer => ({
  id: `p${i}`, name: `P${i}`, checkedIn: true, active: true, gamesPlayed: 0, wins: 0, losses: 0,
  currentStreak: 0, longestWinStreak: 0, consecutiveGames: 0, queueEnteredAt: iso(i), gamesSatOut: 0,
  partnerHistory: {}, opponentHistory: {},
});
const snapshot = (n: number, courts: number, maxConsecutiveGames: number, mixEveryone = false): QueueSnapshot => ({
  sessionId: "s1", takenAt: iso(0), queueMode: "HYBRID", maxConsecutiveGames, lastGameNumber: 0, mixEveryone,
  players: Array.from({ length: n }, (_, i) => player(i + 1)), activeGames: [],
  courts: Array.from({ length: courts }, (_, i) => ({ id: `c${i + 1}`, courtNumber: i + 1, status: "AVAILABLE" })),
  pastGroups: [], keepApart: [],
} as QueueSnapshot);

/** Plays a night on the device: every free court is filled, then the oldest game finishes. */
function playNight(snap: QueueSnapshot, fills: number) {
  const ops: LocalOp[] = [];
  const streak = new Map<string, number>(); // games in a row without sitting out a fill
  let worst = 0;
  let restedSkipped = 0; // someone under the limit sat out while someone over it played
  let minute = 20;
  const onCourt: { id: string; court: string }[] = [];
  for (let n = 0; n < fills; n++) {
    const free = snap.courts.find((c) => !onCourt.some((g) => g.court === c.id))!;
    const state = deriveLocalState(snap, ops);
    const r = generateLocalGame(snap, state);
    if (!r.ok) throw new Error(r.reason);
    const picked = [...r.teamA, ...r.teamB];
    const under = state.eligible.filter((p) => p.consecutiveGames < snap.maxConsecutiveGames).map((p) => p.id);
    if (under.some((id) => !picked.includes(id)) && picked.some((id) => !under.includes(id))) restedSkipped++;
    const id = `local-${n}`;
    ops.push({ kind: "fill", id: `f${n}`, sessionId: "s1", courtId: free.id, localGameId: id,
      teamAPlayerIds: r.teamA, teamBPlayerIds: r.teamB, playersSatOutIds: r.satOut, createdAt: iso(minute) });
    for (const p of picked) { streak.set(p, (streak.get(p) ?? 0) + 1); worst = Math.max(worst, streak.get(p)!); }
    for (const p of r.satOut) streak.set(p, 0);
    onCourt.push({ id, court: free.id });
    if (onCourt.length === snap.courts.length) {
      minute += 6;
      const done = onCourt.shift()!;
      ops.push({ kind: "complete", id: `r${n}`, sessionId: "s1", gameId: done.id, winningTeam: n % 2 ? "A" : "B", recordedAt: iso(minute) });
    }
  }
  return { worst, restedSkipped };
}

describe("max games in a row", () => {
  beforeEach(() => vi.clearAllMocks());

  it("finishing a game does not reset the count; sitting out does", () => {
    const snap = snapshot(9, 1, 2);
    const fill = (n: number, a: string[], b: string[], out: string[]): LocalOp => ({
      kind: "fill", id: `f${n}`, sessionId: "s1", courtId: "c1", localGameId: `local-${n}`,
      teamAPlayerIds: a, teamBPlayerIds: b, playersSatOutIds: out, createdAt: iso(n * 10),
    });
    const done = (n: number): LocalOp => ({ kind: "complete", id: `r${n}`, sessionId: "s1", gameId: `local-${n}`, winningTeam: "A", recordedAt: iso(n * 10 + 9) });
    const rest = ["p5", "p6", "p7", "p8", "p9"];
    let state = deriveLocalState(snap, [fill(1, ["p1", "p2"], ["p3", "p4"], rest), done(1)]);
    expect(state.players.find((p) => p.id === "p1")!.consecutiveGames).toBe(1);
    state = deriveLocalState(snap, [fill(1, ["p1", "p2"], ["p3", "p4"], rest), done(1), fill(2, ["p5", "p6"], ["p7", "p8"], ["p1", "p2", "p3", "p4", "p9"])]);
    expect(state.players.find((p) => p.id === "p1")!.consecutiveGames).toBe(0);
  });

  it.each([
    { players: 9, courts: 1, limit: 2, mix: false },
    { players: 9, courts: 1, limit: 2, mix: true },
    { players: 12, courts: 2, limit: 2, mix: true },
    { players: 23, courts: 2, limit: 2, mix: true },
    { players: 14, courts: 2, limit: 1, mix: true },
    { players: 23, courts: 2, limit: 1, mix: false },
  ])("$players players, $courts court(s), limit $limit, mix $mix: never over the limit", ({ players, courts, limit, mix }) => {
    const { worst } = playNight(snapshot(players, courts, limit, mix), 40);
    expect(worst).toBeLessThanOrEqual(limit);
  });

  it.each([
    { players: 10, courts: 2, limit: 1 },
    { players: 6, courts: 1, limit: 1 },
    { players: 7, courts: 1, limit: 2 },
  ])("too few rested players ($players players, $courts court(s), limit $limit): everyone rested plays first", ({ players, courts, limit }) => {
    const { restedSkipped } = playNight(snapshot(players, courts, limit, true), 40);
    expect(restedSkipped).toBe(0);
  });

  it("a lineup edit gives the game to the swapped-in player and rests the swapped-out one", async () => {
    const game: any = {
      _id: "g1", sessionId: "s1", status: "QUEUED", edits: [],
      teamAPlayerIds: ["a", "b"], teamBPlayerIds: ["c", "d"], playersSatOutIds: ["e", "f"],
      save: vi.fn(async () => undefined),
    };
    (Game.findById as any).mockResolvedValue(game);
    (SessionPlayer.find as any).mockResolvedValue([{}, {}, {}, {}]);
    await gameResolvers.Mutation.updateGameTeams(null, { id: "g1", teamAPlayerIds: ["a", "e"], teamBPlayerIds: ["c", "d"] }, { organiser: { sub: "organiser-1" } } as any);
    expect(SessionPlayer.updateMany).toHaveBeenCalledWith({ _id: { $in: ["e"] } }, { $inc: { consecutiveGames: 1 } });
    expect(SessionPlayer.updateMany).toHaveBeenCalledWith({ _id: { $in: ["b"] } }, { $set: { consecutiveGames: 0 } });
    expect(game.playersSatOutIds.sort()).toEqual(["b", "f"]);
  });
});

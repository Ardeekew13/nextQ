import { describe, it, expect } from "vitest";
import {
  deriveLocalState,
  generateLocalGame,
  rankLocalQueue,
  type CompleteOp,
  type FillOp,
  type LocalOp,
  type QueueSnapshot,
  type SnapshotPlayer,
} from "@/lib/offlineQueue";
import { computePlayerStatistics } from "@/lib/statsCore";

const T0 = new Date("2026-01-01T10:00:00Z").getTime();
const iso = (min: number) => new Date(T0 + min * 60000).toISOString();

function player(i: number): SnapshotPlayer {
  return {
    id: `p${i}`,
    name: `P${i}`,
    checkedIn: true,
    active: true,
    gamesPlayed: 0,
    wins: 0,
    losses: 0,
    currentStreak: 0,
    longestWinStreak: 0,
    consecutiveGames: 0,
    queueEnteredAt: iso(i),
    gamesSatOut: 0,
    partnerHistory: {},
    opponentHistory: {},
  };
}

function snapshot(n: number, courts = 2): QueueSnapshot {
  return {
    sessionId: "s1",
    takenAt: iso(0),
    queueMode: "HYBRID",
    maxConsecutiveGames: 2,
    lastGameNumber: 0,
    players: Array.from({ length: n }, (_, i) => player(i + 1)),
    activeGames: [],
    courts: Array.from({ length: courts }, (_, i) => ({ id: `c${i + 1}`, courtNumber: i + 1, status: "AVAILABLE" })),
    pastGroups: [],
    keepApart: [],
  };
}

describe("offline queue", () => {
  it("generates a game of 4 distinct players and reports who sat out", () => {
    const snap = snapshot(7);
    const state = deriveLocalState(snap, []);
    const r = generateLocalGame(snap, state);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const all = [...r.teamA, ...r.teamB];
    expect(new Set(all).size).toBe(4);
    expect(r.satOut.length).toBe(3);
    expect(r.satOut.some((id) => all.includes(id))).toBe(false);
  });

  it("refuses with fewer than 4 waiting", () => {
    const snap = snapshot(3);
    expect(generateLocalGame(snap, deriveLocalState(snap, [])).ok).toBe(false);
  });

  it("puts players on court after a fill and frees them after a result", () => {
    const snap = snapshot(8);
    let ops: LocalOp[] = [];
    const g = generateLocalGame(snap, deriveLocalState(snap, []));
    if (!g.ok) throw new Error("no game");
    const fill: FillOp = {
      kind: "fill", id: "o1", sessionId: "s1", courtId: "c1", localGameId: "local-1",
      teamAPlayerIds: g.teamA, teamBPlayerIds: g.teamB, playersSatOutIds: g.satOut, createdAt: iso(10),
    };
    ops = [fill];
    let st = deriveLocalState(snap, ops);
    expect(st.eligible.length).toBe(4);
    expect(st.courts[0].status).toBe("IN_USE");
    expect(st.lastGameNumber).toBe(1);

    const done: CompleteOp = { kind: "complete", id: "o2", sessionId: "s1", gameId: "local-1", winningTeam: "A", recordedAt: iso(25) };
    ops = [fill, done];
    st = deriveLocalState(snap, ops);
    expect(st.eligible.length).toBe(8);
    expect(st.courts[0].status).toBe("AVAILABLE");
    const winner = st.players.find((p) => p.id === g.teamA[0])!;
    expect(winner.wins).toBe(1);
    expect(winner.queueEnteredAt).toBe(iso(25));
    expect(winner.consecutiveGames).toBe(0);
    // the same four can't be picked again as an exact repeat group
    const again = generateLocalGame(snap, st);
    if (again.ok) expect([...again.teamA, ...again.teamB].sort().join()).not.toBe([...g.teamA, ...g.teamB].sort().join());
  });

  it("matches the server's statistics rebuild after many games", () => {
    const snap = snapshot(9, 2);
    const ops: LocalOp[] = [];
    const completed: { teamAPlayerIds: string[]; teamBPlayerIds: string[]; winningTeam: "A" | "B"; playersSatOutIds: string[] }[] = [];
    let clock = 10;
    for (let round = 0; round < 12; round++) {
      const court = round % 2 === 0 ? "c1" : "c2";
      const st = deriveLocalState(snap, ops);
      const g = generateLocalGame(snap, st);
      if (!g.ok) throw new Error(g.reason);
      const id = `local-${round}`;
      ops.push({
        kind: "fill", id: `f${round}`, sessionId: "s1", courtId: court, localGameId: id,
        teamAPlayerIds: g.teamA, teamBPlayerIds: g.teamB, playersSatOutIds: g.satOut, createdAt: iso(clock),
      });
      const winner = round % 3 === 0 ? "B" : "A";
      clock += 15;
      ops.push({ kind: "complete", id: `c${round}`, sessionId: "s1", gameId: id, winningTeam: winner, recordedAt: iso(clock) });
      completed.push({ teamAPlayerIds: g.teamA, teamBPlayerIds: g.teamB, winningTeam: winner, playersSatOutIds: g.satOut });
    }
    const final = deriveLocalState(snap, ops);
    const expected = computePlayerStatistics(snap.players.map((p) => p.id), completed);
    for (const p of final.players) {
      const e = expected.get(p.id)!;
      expect({ g: p.gamesPlayed, w: p.wins, l: p.losses, cs: p.currentStreak, ls: p.longestWinStreak, so: p.gamesSatOut, ph: p.partnerHistory, oh: p.opponentHistory }).toEqual({
        g: e.gamesPlayed, w: e.wins, l: e.losses, cs: e.currentStreak, ls: e.longestWinStreak, so: e.gamesSatOut, ph: e.partnerHistory, oh: e.opponentHistory,
      });
    }
    expect(final.lastGameNumber).toBe(12);
  });

  it("ignores ops from other sessions and results for unknown games", () => {
    const snap = snapshot(5);
    const st = deriveLocalState(snap, [
      { kind: "complete", id: "x", sessionId: "other", gameId: "g", winningTeam: "A", recordedAt: iso(5) },
      { kind: "complete", id: "y", sessionId: "s1", gameId: "missing", winningTeam: "A", recordedAt: iso(5) },
    ]);
    expect(st.eligible.length).toBe(5);
  });

  it("ranks the waiting queue", () => {
    const snap = snapshot(6);
    const ranked = rankLocalQueue(snap, deriveLocalState(snap, []));
    expect(ranked.length).toBe(6);
  });
});

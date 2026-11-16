/** Requested matches: A & B vs C & D play together, on those teams, when the last of the four
 * reaches the front of the queue - and Up next / Fill Court agree on it. */
import { describe, expect, it } from "vitest";
import { generateNextGame, rankQueue, type QueuePlayer } from "@/lib/queueEngine";
import { deriveLocalState, generateLocalGame, rankLocalQueue, type LocalOp, type QueueSnapshot, type SnapshotPlayer } from "@/lib/offlineQueue";
import { fulfilledRequestIds } from "@/lib/upNext";

const T0 = Date.UTC(2026, 0, 1, 10);
const at = (min: number) => new Date(T0 + min * 60000);
const qp = (id: string, min: number, games = 1): QueuePlayer => ({
  id, gamesPlayed: games, consecutiveGames: 0, queueEnteredAt: at(min), gamesSatOut: 0, partnerHistory: {}, opponentHistory: {},
});
// p1 waited longest ... p12 joined last.
const pool = () => Array.from({ length: 12 }, (_, i) => qp(`p${i + 1}`, i * 3));
const request = { id: "r1", teamA: ["p1", "p2"] as [string, string], teamB: ["p6", "p12"] as [string, string] };
const opts = { tiebreakSeed: "s1", matchRequests: [request] };

describe("requested matches", () => {
  it("waits for its last member: A and B are held back, everyone ahead of D plays first", () => {
    const r = generateNextGame(pool(), opts);
    expect(r.ok && r.selected.map((p) => p.id)).not.toEqual(expect.arrayContaining(["p1"]));
    const order = rankQueue(pool(), opts).map((p) => p.id);
    // Others p3,p4,p5,p7 / p8,p9,p10,p11 go first; the requested four play together after them.
    expect(order.slice(8, 12).sort()).toEqual(["p1", "p12", "p2", "p6"]);
  });

  it("plays on the requested teams once it's their turn", () => {
    const four = ["p1", "p2", "p6", "p12"].map((id, i) => qp(id, i));
    const later = ["p20", "p21", "p22", "p23"].map((id) => qp(id, 50));
    const r = generateNextGame([...four, ...later], opts);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.teamA.map((p) => p.id).sort()).toEqual(["p1", "p2"]);
    expect(r.teamB.map((p) => p.id).sort()).toEqual(["p12", "p6"]);
  });

  it("does nothing until all four are free (one is on court)", () => {
    const withoutD = pool().filter((p) => p.id !== "p12");
    const r = generateNextGame(withoutD, opts);
    expect(r.ok && r.selected.map((p) => p.id).sort()).toEqual(["p1", "p2", "p3", "p4"]);
  });

  it("is marked played once those four are in a game", () => {
    expect(fulfilledRequestIds([{ _id: "r1", teamAPlayerIds: ["p1", "p2"], teamBPlayerIds: ["p6", "p12"] }], ["p1", "p2", "p6", "p12"])).toEqual(["r1"]);
    expect(fulfilledRequestIds([{ _id: "r1", teamAPlayerIds: ["p1", "p2"], teamBPlayerIds: ["p6", "p12"] }], ["p1", "p2", "p6", "p9"])).toEqual([]);
  });

  it("on the device: Up next shows it, the fill plays it, then it's gone", () => {
    const sp = (i: number): SnapshotPlayer => ({ id: `p${i}`, name: `P${i}`, checkedIn: true, active: true, gamesPlayed: 1, wins: 0, losses: 0,
      currentStreak: 0, longestWinStreak: 0, consecutiveGames: 0, queueEnteredAt: at(i).toISOString(), gamesSatOut: 0, partnerHistory: {}, opponentHistory: {} });
    const snap = { sessionId: "s1", takenAt: at(0).toISOString(), queueMode: "HYBRID", maxConsecutiveGames: 2, lastGameNumber: 0,
      players: Array.from({ length: 12 }, (_, i) => sp(i + 1)), activeGames: [],
      courts: [{ id: "c1", courtNumber: 1, status: "AVAILABLE" }, { id: "c2", courtNumber: 2, status: "AVAILABLE" }],
      pastGroups: [], keepApart: [], matchRequests: [{ id: "r1", teamA: ["p1", "p2"], teamB: ["p3", "p4"] }] } as QueueSnapshot;
    const state = deriveLocalState(snap, []);
    expect(rankLocalQueue(snap, state).slice(0, 4).map((p) => p.id).sort()).toEqual(["p1", "p2", "p3", "p4"]);
    const g = generateLocalGame(snap, state);
    expect(g.ok && [g.teamA.sort(), g.teamB.sort()]).toEqual([["p1", "p2"], ["p3", "p4"]]);
    if (!g.ok) return;
    const fill: LocalOp = { kind: "fill", id: "f1", sessionId: "s1", courtId: "c1", localGameId: "local-1", teamAPlayerIds: g.teamA, teamBPlayerIds: g.teamB, playersSatOutIds: g.satOut, createdAt: at(20).toISOString() };
    expect(deriveLocalState(snap, [fill]).matchRequests).toEqual([]);
  });
});

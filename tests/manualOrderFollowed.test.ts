/** A saved custom order is followed exactly - four by four - and keeps being followed as
 * results come in; fixed partners sit together at the earlier partner's spot. */
import { describe, expect, it } from "vitest";
import { rankQueue, type QueuePlayer } from "@/lib/queueEngine";
import { deriveLocalState, generateLocalGame, rankLocalQueue, type LocalOp, type QueueSnapshot, type SnapshotPlayer } from "@/lib/offlineQueue";

const NOW = Date.UTC(2026, 0, 1, 12);
const qp = (i: number, extra: Partial<QueuePlayer> = {}): QueuePlayer => ({
  id: `p${i}`, gamesPlayed: i % 4, consecutiveGames: 0, queueEnteredAt: new Date(NOW - (20 - i) * 60000),
  gamesSatOut: 0, partnerHistory: {}, opponentHistory: {}, ...extra,
});
const withOrder = (ps: QueuePlayer[], order: string[]) =>
  ps.map((p) => ({ ...p, manualPriority: order.indexOf(p.id) >= 0 ? order.indexOf(p.id) : undefined }));
// Played-together history so the variety rules would like to reshuffle.
const past = new Set(["p0:p1:p2:p3", "p4:p5:p6:p7", "p1:p10:p11:p8"]);

describe("saved custom order", () => {
  it("is the exact queue, four by four, even when mixing would prefer otherwise", () => {
    const ps = Array.from({ length: 12 }, (_, i) => qp(i));
    const order = ["p11", "p3", "p0", "p7", "p1", "p2", "p9", "p8", "p10", "p4", "p6", "p5"];
    for (const mixEveryone of [false, true]) {
      const shown = rankQueue(withOrder(ps, order), { manualOrderLength: 12, tiebreakSeed: "s", pastGroups: past, mixEveryone }).map((p) => p.id);
      expect(shown).toEqual(order);
    }
  });

  it("a fixed pair goes at the earlier partner's spot, the rest keep their order", () => {
    const ps = Array.from({ length: 8 }, (_, i) => qp(i));
    ps[2].fixedPartnerId = "p6";
    ps[6].fixedPartnerId = "p2";
    const order = ["p2", "p0", "p1", "p3", "p4", "p5", "p6", "p7"];
    const shown = rankQueue(withOrder(ps, order), { manualOrderLength: 8, tiebreakSeed: "s" }).map((p) => p.id);
    expect(shown.slice(0, 4).sort()).toEqual(["p0", "p1", "p2", "p6"]);
    expect(shown.slice(4).sort()).toEqual(["p3", "p4", "p5", "p7"]);
  });

  it("keeps following it as results come in, then the queue carries on normally", () => {
    const sp = (i: number): SnapshotPlayer => ({ id: `p${i}`, name: `P${i}`, checkedIn: true, active: true, gamesPlayed: 2, wins: 1, losses: 1,
      currentStreak: 0, longestWinStreak: 0, consecutiveGames: 0, queueEnteredAt: new Date(NOW - (30 - i) * 60000).toISOString(), gamesSatOut: 0,
      partnerHistory: {}, opponentHistory: {} });
    // p0-p3 on court 1, p4-p15 waiting; the organiser dragged the waiting list into this order.
    const order = ["p15", "p9", "p4", "p12", "p5", "p14", "p6", "p13", "p11", "p7", "p10", "p8"];
    const snap = { sessionId: "s1", takenAt: new Date(NOW).toISOString(), queueMode: "HYBRID", maxConsecutiveGames: 2, lastGameNumber: 1, mixEveryone: true,
      players: Array.from({ length: 16 }, (_, i) => sp(i)),
      activeGames: [{ id: "g1", courtId: "c1", gameNumber: 1, teamA: ["p0", "p1"], teamB: ["p2", "p3"], satOut: [], status: "IN_PROGRESS" }],
      courts: [{ id: "c1", courtNumber: 1, status: "IN_USE" }, { id: "c2", courtNumber: 2, status: "AVAILABLE" }],
      pastGroups: ["p0:p1:p2:p3"], keepApart: [], manualQueueOrder: order, lastFillAt: new Date(NOW - 15 * 60000).toISOString() } as QueueSnapshot;
    const ops: LocalOp[] = [];
    const onCourt = [{ id: "g1", court: "c1" }];
    const games: string[][] = [];
    let minute = 1;
    for (let n = 0; n < 5; n++) {
      if (onCourt.length === 2) {
        const done = onCourt.shift()!;
        ops.push({ kind: "complete", id: `r${n}`, sessionId: "s1", gameId: done.id, winningTeam: "A", recordedAt: new Date(NOW + minute++ * 60000).toISOString() });
      }
      const state = deriveLocalState(snap, ops);
      const upNext = rankLocalQueue(snap, state).slice(0, 4).map((p) => p.id).sort();
      const g = generateLocalGame(snap, state);
      if (!g.ok) throw new Error(g.reason);
      const picked = [...g.teamA, ...g.teamB].sort();
      expect(picked).toEqual(upNext); // Fill Court = Up next, every time
      games.push(picked);
      const court = ["c1", "c2"].find((c) => !onCourt.some((x) => x.court === c))!;
      ops.push({ kind: "fill", id: `f${n}`, sessionId: "s1", courtId: court, localGameId: `local-${n}`, teamAPlayerIds: g.teamA, teamBPlayerIds: g.teamB,
        playersSatOutIds: g.satOut, createdAt: new Date(NOW + minute++ * 60000).toISOString() });
      onCourt.push({ id: `local-${n}`, court });
    }
    // The three saved groups play in order, results in between notwithstanding...
    expect(games.slice(0, 3)).toEqual([order.slice(0, 4).sort(), order.slice(4, 8).sort(), order.slice(8, 12).sort()]);
    // ...and the saved order empties as they play, after which the usual queue takes over.
    expect(deriveLocalState(snap, ops).manualQueueOrder).toEqual([]);
    // Next: those who've waited longest (court 1's first game and the first saved group), mixed;
    // never the group that has only just come off court.
    for (const id of games[3]) expect(["p0", "p1", "p2", "p3", ...order.slice(0, 4)]).toContain(id);
  });

  it("a late arrival or someone back from a break can be dragged straight into the next game", () => {
    const lastFillAt = new Date(NOW - 5 * 60000);
    // p0-p7 waiting since before the last fill; "late" just checked in (no games); "back" returned
    // from a break after the last fill (has games, so normally waits behind those already waiting).
    const ps = [
      ...Array.from({ length: 8 }, (_, i) => qp(i, { queueEnteredAt: new Date(NOW - (30 - i) * 60000), gamesPlayed: 3 })),
      qp(20, { id: "late", gamesPlayed: 0, queueEnteredAt: new Date(NOW - 60000) }),
      qp(21, { id: "back", gamesPlayed: 3, queueEnteredAt: new Date(NOW - 60000) }),
    ];
    const base = { tiebreakSeed: "s", lastFillAt, mixEveryone: true };
    // Without dragging: the new arrival gets the next court, the returning player waits a game.
    const auto = rankQueue(ps, base).map((p) => p.id);
    expect(auto.slice(0, 4)).toContain("late");
    expect(auto.slice(0, 4)).not.toContain("back");
    // Dragged to the top: both play next, in the order saved.
    const order = ["back", "late", ...ps.filter((p) => p.id !== "back" && p.id !== "late").map((p) => p.id)];
    const dragged = rankQueue(withOrder(ps, order), { ...base, manualOrderLength: order.length }).map((p) => p.id);
    expect(dragged).toEqual(order);
  });
});

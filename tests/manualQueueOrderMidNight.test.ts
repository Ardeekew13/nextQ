/**
 * Manual queue order in a real mid-night situation: players have history (they've partnered,
 * shared courts, played in trios), and the variety rules — new faces, mix everyone, no repeated
 * trio, no third game in a row, late-group mixing — would normally rearrange the next game.
 * Before this fix they quietly overrode the saved order on every one of 40 simulated fills, so
 * "Save" succeeded but the queue and the next game looked unchanged.
 */
import { describe, expect, it, vi } from "vitest";
import { generateNextGame, rankQueue, type QueuePlayer } from "@/lib/queueEngine";
import { deriveLocalState, generateLocalGame, rankLocalQueue, type LocalOp, type QueueSnapshot, type SnapshotPlayer } from "@/lib/offlineQueue";
import { QueueMode } from "@/types/enums";
import { seededRandom } from "@/lib/seededRandom";

/** 16 players, 2 courts, 12 games played with the real engine and the server's bookkeeping. */
function midNight(seed: string, mix: boolean) {
  const rnd = seededRandom(seed);
  const T0 = Date.UTC(2026, 0, 1, 10);
  let clock = T0;
  const ps: QueuePlayer[] = Array.from({ length: 16 }, (_, i) => ({
    id: `p${i + 1}`, gamesPlayed: 0, consecutiveGames: 0, queueEnteredAt: new Date(T0 + i * 1000), gamesSatOut: 0,
    partnerHistory: {}, opponentHistory: {}, recentGames: [],
  }));
  const pastGroups = new Set<string>();
  const courts: { ids: string[]; a: string[]; b: string[]; end: number }[] = [];
  const opts = { mode: QueueMode.HYBRID, maxConsecutiveGames: 2, mixEveryone: mix, balanceTeams: true, tiebreakSeed: "s", pastGroups };
  const fill = () => {
    const busy = new Set(courts.flatMap((c) => c.ids));
    const pool = ps.filter((p) => !busy.has(p.id));
    const r = generateNextGame(pool, { ...opts, random: seededRandom("x") });
    if (!r.ok) return;
    const ids = r.selected.map((p) => p.id);
    for (const p of pool) if (ids.includes(p.id)) p.consecutiveGames++; else { p.consecutiveGames = 0; p.gamesSatOut++; }
    pastGroups.add([...ids].sort().join(":"));
    courts.push({ ids, a: r.teamA.map((p) => p.id), b: r.teamB.map((p) => p.id), end: clock + (10 + rnd() * 5) * 60000 });
  };
  fill(); fill();
  for (let n = 0; n < 12; n++) {
    courts.sort((x, y) => x.end - y.end);
    const done = courts.shift()!;
    clock = done.end;
    for (const id of done.ids) {
      const p = ps.find((x) => x.id === id)!;
      const mates = done.a.includes(id) ? done.a : done.b;
      const opp = done.a.includes(id) ? done.b : done.a;
      p.gamesPlayed++;
      for (const m of mates) if (m !== id) p.partnerHistory[m] = (p.partnerHistory[m] ?? 0) + 1;
      for (const o of opp) p.opponentHistory[o] = (p.opponentHistory[o] ?? 0) + 1;
      p.recentGames = [done.ids.filter((x) => x !== id), ...(p.recentGames ?? [])].slice(0, 3);
      p.queueEnteredAt = new Date(clock);
    }
    if (n < 11) fill();
  }
  const busy = new Set(courts.flatMap((c) => c.ids));
  return { pool: ps.filter((p) => !busy.has(p.id)), opts, clock };
}

describe("a saved manual order decides the next game, mid-night", () => {
  for (const mix of [false, true]) {
    it(`the saved top 4 play next and lead the queue (${mix ? "Mix everyone on" : "default settings"})`, () => {
      let checked = 0;
      for (let s = 0; s < 20; s++) {
        const { pool, opts, clock } = midNight(`n${s}`, mix);
        vi.useFakeTimers();
        vi.setSystemTime(clock);
        try {
          const auto = rankQueue(pool, { ...opts, random: seededRandom("y") }).map((p) => p.id);
          const saved = [...auto].reverse(); // the organiser drags the bottom of the queue to the top
          const top4 = saved.slice(0, 4);
          if (top4.some((id) => pool.find((p) => p.id === id)!.consecutiveGames >= 2)) continue; // pacing limit still applies
          const withOrder = pool.map((p) => ({ ...p, manualPriority: saved.indexOf(p.id) }));
          const o = { ...opts, manualOrderLength: saved.length, random: seededRandom("y") };
          const next = generateNextGame(withOrder, o);
          expect(next.ok).toBe(true);
          if (!next.ok) continue;
          expect(next.selected.map((p) => p.id).sort(), `night ${s}: next game`).toEqual([...top4].sort());
          expect(rankQueue(withOrder, o).slice(0, 4).map((p) => p.id).sort(), `night ${s}: queue`).toEqual([...top4].sort());
          checked++;
        } finally {
          vi.useRealTimers();
        }
      }
      expect(checked).toBeGreaterThan(10);
    });
  }

  it("the saved order wins over a keep-apart group (the organiser placed them by hand)", () => {
    const T0 = Date.UTC(2026, 0, 1, 10);
    const p = (id: string, i: number, manualPriority?: number): QueuePlayer => ({
      id, gamesPlayed: 2, consecutiveGames: 0, queueEnteredAt: new Date(T0 + i * 60000), gamesSatOut: 0,
      partnerHistory: {}, opponentHistory: {}, manualPriority,
    });
    const pool = [p("a", 0, 0), p("b", 1, 1), p("c", 2, 2), p("d", 3, 3), p("e", 4), p("f", 5)];
    const r = generateNextGame(pool, { mode: QueueMode.HYBRID, tiebreakSeed: "s", manualOrderLength: 4, keepApart: [["a", "b"]] });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const ids = r.selected.map((x) => x.id);
    expect(ids.sort()).toEqual(["a", "b", "c", "d"]);
  });

  it("the saved order wins over the games-in-a-row limit", () => {
    const T0 = Date.UTC(2026, 0, 1, 10);
    const p = (id: string, i: number, consecutiveGames: number, manualPriority?: number): QueuePlayer => ({
      id, gamesPlayed: 3, consecutiveGames, queueEnteredAt: new Date(T0 + i * 60000), gamesSatOut: 0,
      partnerHistory: {}, opponentHistory: {}, manualPriority,
    });
    // a and b have played 2 in a row; dragged to the top anyway.
    const pool = [p("a", 0, 2, 0), p("b", 1, 2, 1), p("c", 2, 0, 2), p("d", 3, 0, 3), p("e", 4, 0), p("f", 5, 0), p("g", 6, 0), p("h", 7, 0)];
    const r = generateNextGame(pool, { mode: QueueMode.HYBRID, tiebreakSeed: "s", manualOrderLength: 4, maxConsecutiveGames: 2 });
    expect(r.ok && r.selected.map((x) => x.id).sort()).toEqual(["a", "b", "c", "d"]);
  });

  it("never puts the same four straight back on court together, even from a stale custom order", () => {
    const T0 = Date.UTC(2026, 0, 1, 10);
    const four = ["w", "x", "y", "z"];
    const p = (id: string, i: number, manualPriority?: number): QueuePlayer => ({
      id, gamesPlayed: 3, consecutiveGames: 1, gamesSatOut: 0, partnerHistory: {}, opponentHistory: {}, manualPriority,
      // w-z just came off court together (after the last fill); the rest were waiting.
      queueEnteredAt: new Date(T0 + (four.includes(id) ? 30 : i) * 60000),
      lastGameWith: four.includes(id) ? four.filter((o) => o !== id) : [],
    });
    const pool = [p("w", 0, 0), p("x", 1, 1), p("y", 2, 2), p("z", 3, 3), ...["a", "b", "c", "d", "e", "f"].map((id, i) => p(id, i + 4))];
    const r = generateNextGame(pool, {
      mode: QueueMode.HYBRID, tiebreakSeed: "s", manualOrderLength: 4, lastFillAt: new Date(T0 + 20 * 60000),
      pastGroups: new Set([four.join(":")]),
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.selected.map((x) => x.id).sort()).not.toEqual(four);
  });
});

describe("on the device: Next up = Fill Court, and played players leave the saved order", () => {
  const T0 = Date.UTC(2026, 0, 1, 10);
  const sp = (i: number): SnapshotPlayer => ({
    id: `p${i}`, name: `P${i}`, checkedIn: true, active: true, gamesPlayed: 1, wins: 0, losses: 0, currentStreak: 0,
    longestWinStreak: 0, consecutiveGames: 0, queueEnteredAt: new Date(T0 + i * 60000).toISOString(), gamesSatOut: 0,
    partnerHistory: {}, opponentHistory: {},
  });
  const snapshot: QueueSnapshot = {
    sessionId: "s1", takenAt: new Date(T0).toISOString(), queueMode: "HYBRID", maxConsecutiveGames: 2, mixEveryone: true,
    lastGameNumber: 4, players: Array.from({ length: 10 }, (_, i) => sp(i + 1)), activeGames: [],
    courts: [{ id: "c1", courtNumber: 1, status: "AVAILABLE" }, { id: "c2", courtNumber: 2, status: "AVAILABLE" }],
    pastGroups: [], keepApart: [], knownClientIds: [],
    manualQueueOrder: ["p10", "p9", "p8", "p7", "p6", "p5"],
  };

  it("the queue shown and the game Fill Court picks are the saved top 4", () => {
    const state = deriveLocalState(snapshot, []);
    const next = generateLocalGame(snapshot, state);
    expect(next.ok).toBe(true);
    if (!next.ok) return;
    expect([...next.teamA, ...next.teamB].sort()).toEqual(["p10", "p7", "p8", "p9"]);
    expect(rankLocalQueue(snapshot, state).slice(0, 4).map((p) => p.id).sort()).toEqual(["p10", "p7", "p8", "p9"]);
  });

  it("once they're on court, the rest of the saved order is next (they don't jump the queue again)", () => {
    const fill: LocalOp = {
      kind: "fill", id: "f1", sessionId: "s1", courtId: "c1", localGameId: "local-1",
      teamAPlayerIds: ["p10", "p7"], teamBPlayerIds: ["p9", "p8"], playersSatOutIds: [], createdAt: new Date(T0).toISOString(),
    };
    const state = deriveLocalState(snapshot, [fill]);
    expect(state.manualQueueOrder).toEqual(["p6", "p5"]);
    const next = generateLocalGame(snapshot, state);
    expect(next.ok).toBe(true);
    if (!next.ok) return;
    const ids = [...next.teamA, ...next.teamB];
    expect(ids).toContain("p6");
    expect(ids).toContain("p5");
  });
});

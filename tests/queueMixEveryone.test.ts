import { describe, expect, it } from "vitest";
import { generateNextGame, type QueuePlayer } from "@/lib/queueEngine";
import { QueueMode } from "@/types/enums";

function makePlayers(n: number): QueuePlayer[] {
  return Array.from({ length: n }, (_, i) => ({
    id: `p${i + 1}`,
    gamesPlayed: 0,
    consecutiveGames: 0,
    queueEnteredAt: new Date("2026-01-01T00:00:00Z"),
    gamesSatOut: 0,
    partnerHistory: {},
    opponentHistory: {},
  }));
}

function run(n: number, games: number, mixEveryone: boolean) {
  const players = makePlayers(n);
  const byId = new Map(players.map((p) => [p.id, p]));
  const pastGroups = new Set<string>();
  const met = new Set<string>();
  let clock = new Date("2026-01-01T00:00:00Z").getTime();
  let seed = 11;
  const random = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const bump = (m: Record<string, number>, id: string) => {
    m[id] = (m[id] ?? 0) + 1;
  };

  for (let g = 0; g < games; g++) {
    const r = generateNextGame(players, { mode: QueueMode.HYBRID, pastGroups, random, mixEveryone });
    if (!r.ok) throw new Error(r.reason);
    const ids = r.selected.map((p) => p.id);
    clock += 5 * 60_000;
    for (const p of players) {
      if (ids.includes(p.id)) {
        p.gamesPlayed++;
        p.consecutiveGames++;
        p.gamesSatOut = 0;
        p.queueEnteredAt = new Date(clock);
      } else {
        p.consecutiveGames = 0;
        p.gamesSatOut++;
      }
    }
    for (const [x, y] of [r.teamA, r.teamB]) {
      bump(byId.get(x.id)!.partnerHistory, y.id);
      bump(byId.get(y.id)!.partnerHistory, x.id);
    }
    for (const a of r.teamA)
      for (const b of r.teamB) {
        bump(byId.get(a.id)!.opponentHistory, b.id);
        bump(byId.get(b.id)!.opponentHistory, a.id);
      }
    pastGroups.add([...ids].sort().join(":"));
    for (let i = 0; i < 4; i++) for (let j = i + 1; j < 4; j++) met.add([ids[i], ids[j]].sort().join(":"));
  }
  const counts = players.map((p) => p.gamesPlayed);
  return { met: met.size, spread: Math.max(...counts) - Math.min(...counts) };
}

describe("queue engine - mix everyone", () => {
  it("10 players / 1 court: everyone meets everyone sooner than without it", () => {
    const base = run(10, 14, false);
    const mixed = run(10, 14, true);
    expect(mixed.met).toBeGreaterThanOrEqual(base.met);
    expect(mixed.met).toBe(45); // all 45 pairs
  });

  it("keeps games played fair (spread of at most 1)", () => {
    expect(run(10, 14, true).spread).toBeLessThanOrEqual(1);
    expect(run(14, 20, true).spread).toBeLessThanOrEqual(1);
  });
});

describe("queue engine - match by standings", () => {
  function pool() {
    // p1..p8 all equally fair (0 games), but with distinct win rates: p1 best ... p8 worst.
    return makePlayers(8).map((p, i) => ({ ...p, winRate: 100 - i * 10 }));
  }

  it("puts ranks 1-4 together in one game", () => {
    const r = generateNextGame(pool(), { mode: QueueMode.HYBRID, rankMatchups: true, random: () => 0.5 });
    if (!r.ok) throw new Error(r.reason);
    expect(r.selected.map((p) => p.id).sort()).toEqual(["p1", "p2", "p3", "p4"]);
  });

  it("splits best + weakest vs the two middle players", () => {
    const r = generateNextGame(pool(), { mode: QueueMode.HYBRID, rankMatchups: true, random: () => 0.5 });
    if (!r.ok) throw new Error(r.reason);
    const teams = [r.teamA, r.teamB].map((t) => t.map((p) => p.id).sort().join("+")).sort();
    expect(teams).toEqual(["p1+p4", "p2+p3"]);
  });
});

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

/** Plays `games` sequential games the way the app does, returning each foursome's ids. */
function simulate(players: QueuePlayer[], games: number, mode: QueueMode, keepApart?: string[][]): string[][] {
  const pastGroups = new Set<string>();
  const played: string[][] = [];
  let clock = new Date("2026-01-01T00:00:00Z").getTime();
  let seed = 7;
  const random = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);

  for (let g = 0; g < games; g++) {
    const result = generateNextGame(players, { mode, pastGroups, random, keepApart });
    if (!result.ok) throw new Error(result.reason);
    const ids = result.selected.map((p) => p.id);
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
    pastGroups.add([...ids].sort().join(":"));
    played.push(ids);
  }
  return played;
}

function repeatedTrios(games: string[][]): number {
  const seen = new Set<string>();
  let repeats = 0;
  for (const g of games) {
    const s = [...g].sort();
    for (let i = 0; i < 4; i++) {
      const trio = s.filter((_, idx) => idx !== i).join(":");
      if (seen.has(trio)) repeats++;
      seen.add(trio);
    }
  }
  return repeats;
}

describe("queue engine - no trio shares a game twice", () => {
  it.each([QueueMode.HYBRID, QueueMode.BALANCED])("%s: 20 players, 28 games, never repeats a trio", (mode) => {
    const games = simulate(makePlayers(20), 28, mode);
    expect(repeatedTrios(games)).toBe(0);
  });

  it("small pool still produces games (best effort, never blocks)", () => {
    const games = simulate(makePlayers(6), 12, QueueMode.HYBRID);
    expect(games).toHaveLength(12);
  });

  it.each([QueueMode.HYBRID, QueueMode.BALANCED, QueueMode.SMART])(
    "%s: a keep-apart group never shares a game",
    (mode) => {
      const apart = ["p1", "p2", "p3"];
      const games = simulate(makePlayers(12), 20, mode, [apart]);
      for (const g of games) expect(g.filter((id) => apart.includes(id)).length).toBeLessThanOrEqual(1);
    }
  );
});

describe("team split is stable for the same four", () => {
  it("gives the same partners whatever else is in the pool or the random stream", async () => {
    const { generateNextGame } = await import("@/lib/queueEngine");
    const mk = (id: string, min: number) => ({
      id, gamesPlayed: 1, consecutiveGames: 0, queueEnteredAt: new Date(Date.UTC(2026, 0, 1, 10, min)),
      gamesSatOut: 0, partnerHistory: {}, opponentHistory: {},
    });
    const four = ["a", "b", "c", "d"].map((id, i) => mk(id, i));
    const extras = ["e", "f", "g", "h"].map((id, i) => mk(id, 30 + i));
    const split = (pool: ReturnType<typeof mk>[], seed: number) => {
      let s = seed;
      const r = generateNextGame(pool, { random: () => ((s = (s * 9301 + 49297) % 233280) / 233280) });
      if (!r.ok) throw new Error("no game");
      const key = (t: { id: string }[]) => t.map((p) => p.id).sort().join("");
      return [key(r.teamA), key(r.teamB)].sort().join("|");
    };
    const base = split(four, 1);
    expect(split([...four, ...extras], 7)).toBe(base);
    expect(split([...extras.slice(0, 2), ...four], 99)).toBe(base);
  });
});

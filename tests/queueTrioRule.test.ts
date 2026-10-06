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
function simulate(players: QueuePlayer[], games: number, mode: QueueMode): string[][] {
  const pastGroups = new Set<string>();
  const played: string[][] = [];
  let clock = new Date("2026-01-01T00:00:00Z").getTime();
  let seed = 7;
  const random = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);

  for (let g = 0; g < games; g++) {
    const result = generateNextGame(players, { mode, pastGroups, random });
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
});

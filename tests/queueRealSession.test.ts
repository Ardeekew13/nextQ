import { describe, expect, it } from "vitest";
import { generateNextGame, type QueuePlayer } from "@/lib/queueEngine";
import { computePlayerStatistics } from "@/lib/statsCore";
import { seededRandom, poolSeed } from "@/lib/seededRandom";
import { QueueMode } from "@/types/enums";

// A real 9-player, 1-court session ("Thursdink"): after 18 finished games the old engine put
// KARL/CARLO together again straight after they had won together. Times are minutes since 11:00.
const GAMES: [number, string[], string[], "A" | "B"][] = [
  [57, ["RD", "LUBIANO"], ["KARL", "HENREY"], "A"],
  [72, ["KEN", "MIO"], ["CARLO", "JEDDAN"], "A"],
  [86, ["GERALD", "JM"], ["AYESHA", "RD"], "B"],
  [100, ["LUBIANO", "KEN"], ["HENREY", "MIO"], "B"],
  [113, ["KARL", "JEDDAN"], ["AYESHA", "CARLO"], "B"],
  [125, ["GERALD", "LUBIANO"], ["JM", "MIO"], "A"],
  [139, ["RD", "HENREY"], ["KEN", "CARLO"], "A"],
  [151, ["KARL", "GERALD"], ["JEDDAN", "JM"], "B"],
  [159, ["AYESHA", "LUBIANO"], ["MIO", "RD"], "B"],
  [172, ["HENREY", "GERALD"], ["CARLO", "JEDDAN"], "A"],
  [189, ["KEN", "JM"], ["KARL", "RD"], "B"],
  [203, ["KEN", "JM"], ["CARLO", "MIO"], "A"],
  [212, ["HENREY", "KARL"], ["GERALD", "MIO"], "A"],
  [253, ["JEDDAN", "RD"], ["CARLO", "JM"], "A"],
  [254, ["KARL", "KEN"], ["HENREY", "JEDDAN"], "B"],
  [254.4, ["RD", "KEN"], ["GERALD", "JM"], "A"],
  [254.6, ["RD", "HENREY"], ["MIO", "JEDDAN"], "A"],
  [255.5, ["KARL", "CARLO"], ["KEN", "MIO"], "A"],
];
const ACTIVE = ["RD", "KARL", "KEN", "HENREY", "CARLO", "MIO", "GERALD", "JEDDAN", "JM"];
const T0 = Date.UTC(2026, 9, 8, 11, 0, 0);

function pool(): { players: QueuePlayer[]; pastGroups: Set<string> } {
  const all = [...new Set(GAMES.flatMap(([, a, b]) => [...a, ...b]))];
  const stats = computePlayerStatistics(all, GAMES.map(([, a, b, w]) => ({ teamAPlayerIds: a, teamBPlayerIds: b, winningTeam: w })));
  const last = new Map<string, number>();
  for (const [t, a, b] of GAMES) for (const id of [...a, ...b]) last.set(id, t);
  const players = ACTIVE.map((id) => {
    const s = stats.get(id)!;
    return {
      id, gamesPlayed: s.gamesPlayed, consecutiveGames: id === "GERALD" ? 1 : 0,
      queueEnteredAt: new Date(T0 + last.get(id)! * 60_000), gamesSatOut: 0,
      partnerHistory: s.partnerHistory, opponentHistory: s.opponentHistory,
      winRate: (s.wins / s.gamesPlayed) * 100,
    };
  });
  const pastGroups = new Set(GAMES.map(([, a, b]) => [...a, ...b].sort().join(":")));
  return { players, pastGroups };
}

describe("real session replay", () => {
  it.each([QueueMode.BALANCED, QueueMode.HYBRID])("%s: next game repeats no partner pair and no trio", (mode) => {
    const { players, pastGroups } = pool();
    const now = T0 + 256 * 60_000;
    const realNow = Date.now;
    Date.now = () => now;
    try {
      const r = generateNextGame(players, { mode, maxConsecutiveGames: 2, pastGroups, random: seededRandom(poolSeed(ACTIVE)) });
      expect(r.ok).toBe(true);
      if (!r.ok) return;
      const byId = new Map(players.map((p) => [p.id, p]));
      const partnered = (t: { id: string }[]) => byId.get(t[0].id)!.partnerHistory[t[1].id] ?? 0;
      expect(partnered(r.teamA)).toBe(0);
      expect(partnered(r.teamB)).toBe(0);
      const ids = r.selected.map((p) => p.id);
      const trios = (xs: string[]) => xs.map((_, i) => xs.filter((_, j) => j !== i).sort().join(":"));
      const past = new Set([...pastGroups].flatMap((g) => trios(g.split(":")).flatMap((q) => q)));
      void past;
      const pastTriples = new Set<string>();
      for (const g of pastGroups) {
        const m = g.split(":");
        for (let a = 0; a < 4; a++) for (let b = a + 1; b < 4; b++) for (let c = b + 1; c < 4; c++) pastTriples.add([m[a], m[b], m[c]].sort().join(":"));
      }
      for (const t of trios(ids)) expect(pastTriples.has(t)).toBe(false);
      console.log(mode, r.teamA.map((p) => p.id).join("/"), "vs", r.teamB.map((p) => p.id).join("/"));
    } finally {
      Date.now = realNow;
    }
  });
});

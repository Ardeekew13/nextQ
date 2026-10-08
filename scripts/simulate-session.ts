/**
 * Read-only simulation of the queue engine: N players, C courts, games recorded G seconds
 * after they start. Prints how repetitive the generated games are.
 *   npx tsx scripts/simulate-session.ts [players=11] [courts=1] [games=18] [gameSeconds=20] [mode=BALANCED]
 */
import { generateNextGame, type QueuePlayer } from "../src/lib/queueEngine";
import { seededRandom, poolSeed } from "../src/lib/seededRandom";
import { QueueMode } from "../src/types/enums";

const [nP, nC, nG, gameSec, mode] = [
  Number(process.argv[2] ?? 11), Number(process.argv[3] ?? 1), Number(process.argv[4] ?? 18),
  Number(process.argv[5] ?? 20), (process.argv[6] ?? "BALANCED") as QueueMode,
];
const T0 = Date.UTC(2026, 0, 1, 14, 0, 0);
const players: (QueuePlayer & { wins: number })[] = Array.from({ length: nP }, (_, i) => ({
  id: `p${String(i + 1).padStart(2, "0")}`, gamesPlayed: 0, wins: 0, consecutiveGames: 0,
  queueEnteredAt: new Date(T0 + i * 1000), gamesSatOut: 0, partnerHistory: {}, opponentHistory: {}, winRate: 0,
}));
const byId = new Map(players.map((p) => [p.id, p]));
const pastGroups = new Set<string>();
const games: { a: string[]; b: string[] }[] = [];
let now = T0 + 60_000;
const onCourt: { ids: string[]; a: string[]; b: string[]; endsAt: number }[] = [];
let rng = 12345;
const coin = () => ((rng = (rng * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff) < 0.5;

while (games.length < nG) {
  for (let i = onCourt.length - 1; i >= 0; i--) {
    if (onCourt[i].endsAt <= now) {
      const g = onCourt.splice(i, 1)[0];
      const aWon = coin();
      const apply = (team: string[], opp: string[], won: boolean) => team.forEach((id) => {
        const p = byId.get(id)!;
        p.gamesPlayed++; if (won) p.wins++; p.winRate = (p.wins / p.gamesPlayed) * 100;
        team.filter((t) => t !== id).forEach((t) => (p.partnerHistory[t] = (p.partnerHistory[t] ?? 0) + 1));
        opp.forEach((o) => (p.opponentHistory[o] = (p.opponentHistory[o] ?? 0) + 1));
        p.queueEnteredAt = new Date(g.endsAt); p.consecutiveGames = 0;
      });
      apply(g.a, g.b, aWon); apply(g.b, g.a, !aWon);
    }
  }
  if (onCourt.length < nC) {
    const busy = new Set(onCourt.flatMap((g) => g.ids));
    const pool = players.filter((p) => !busy.has(p.id)).sort((x, y) => +x.queueEnteredAt - +y.queueEnteredAt);
    const r = generateNextGame(pool, { mode, maxConsecutiveGames: 2, pastGroups, random: seededRandom(poolSeed(pool.map((p) => p.id))) });
    if (r.ok) {
      const ids = r.selected.map((p) => p.id);
      const sel = new Set(ids);
      pool.forEach((p) => (sel.has(p.id) ? p.consecutiveGames++ : ((p.consecutiveGames = 0), p.gamesSatOut++)));
      pastGroups.add([...ids].sort().join(":"));
      const a = r.teamA.map((p) => p.id), b = r.teamB.map((p) => p.id);
      games.push({ a, b });
      onCourt.push({ ids, a, b, endsAt: now + gameSec * 1000 });
    }
  }
  now += 1000;
}

const count = (m: Map<string, number>, k: string) => m.set(k, (m.get(k) ?? 0) + 1);
const partner = new Map<string, number>(), together = new Map<string, number>(), trio = new Map<string, number>();
let backToBackPartners = 0;
games.forEach((g, i) => {
  const ids = [...g.a, ...g.b].sort();
  for (let x = 0; x < 4; x++) for (let y = x + 1; y < 4; y++) count(together, ids[x] + ids[y]);
  for (const t of [g.a, g.b]) count(partner, [...t].sort().join(""));
  for (let x = 0; x < 4; x++) count(trio, ids.filter((_, k) => k !== x).join(""));
  if (i > 0) for (const t of [g.a, g.b]) {
    const prev = [games[i - 1].a, games[i - 1].b].map((p) => [...p].sort().join(""));
    if (prev.includes([...t].sort().join(""))) backToBackPartners++;
  }
});
const gp = players.map((p) => p.gamesPlayed);
const repeats = (m: Map<string, number>) => [...m.values()].filter((v) => v > 1).length;
console.log(`${nP} players, ${nC} court(s), ${games.length} games, mode ${mode}, ${gameSec}s per game`);
console.log(`games per player: min ${Math.min(...gp)} max ${Math.max(...gp)}  (${players.map((p) => p.gamesPlayed).join(",")})`);
console.log(`partner pairs repeated: ${repeats(partner)}  (max ${Math.max(...partner.values())}x)`);
console.log(`partners again in the very next game: ${backToBackPartners}`);
console.log(`pairs sharing a game 3+ times: ${[...together.values()].filter((v) => v >= 3).length}  (max ${Math.max(...together.values())}x)`);
console.log(`trios repeated: ${repeats(trio)}`);
games.slice(-6).forEach((g, i) => console.log(`  game ${games.length - 5 + i}: ${g.a.join("/")} vs ${g.b.join("/")}`));

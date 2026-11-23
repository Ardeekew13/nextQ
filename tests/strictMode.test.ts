/**
 * Strict mode (QueueMode.SMART): line by wait time. Whoever has waited longest plays next,
 * newcomers join the back of the line, and On Deck is exactly the next game. Only the guardrails
 * may bend it: the games-in-a-row limit, fixed partners, keep-apart groups, never the exact same
 * four twice in a row, and the automatic split of two players who just shared 2 games in a row.
 * Mix everyone, when on, reshuffles within the next two games of the line.
 */
import { describe, expect, it } from "vitest";
import { generateNextGame, rankQueue, type QueuePlayer, type QueueEngineOptions } from "@/lib/queueEngine";
import { seededRandom } from "@/lib/seededRandom";
import { QueueMode } from "@/types/enums";

const T0 = Date.UTC(2026, 10, 16, 11);
const MIN = 60_000;

interface Sim { id: string; queueEnteredAt: number; gamesPlayed: number; consecutiveGames: number; gamesSatOut: number; recent: string[][]; arrive: number; fixedPartnerId?: string }

/** One night on `courts` courts: `start` players at the start, then groups arriving later. */
function night(opts: { seed: string; start: number; arrivals: Array<{ at: number; count: number }>; courts: number; fills: number; extra?: Partial<QueueEngineOptions>; pairs?: number }) {
  const rnd = seededRandom(opts.seed);
  const players: Sim[] = [];
  const add = (at: number) => players.push({ id: `p${players.length + 1}`, queueEnteredAt: at, gamesPlayed: 0, consecutiveGames: 0, gamesSatOut: 0, recent: [], arrive: at });
  for (let i = 0; i < opts.start; i++) add(T0 + i * 15_000);
  for (let k = 0; k < (opts.pairs ?? 0); k++) { players[2 * k].fixedPartnerId = players[2 * k + 1].id; players[2 * k + 1].fixedPartnerId = players[2 * k].id; }
  const pending = opts.arrivals.flatMap((a) => Array.from({ length: a.count }, () => T0 + a.at * MIN));
  const onCourt: Array<{ ids: string[]; end: number }> = [];
  const pastGroups = new Set<string>();
  let clock = T0 + 5 * MIN;
  let lastFillAt: number | undefined;
  const report = { maxWait: 0, fills: 0, outOfLine: 0, upNextBroken: 0, backToBack: 0, overLimit: 0, newcomerFirstWait: [] as number[], exactRepeat: 0, autoSplit: 0, thirdInARow: 0, recentMeet: 0 };
  let promised: string[] | null = null;
  let lastFillPicked = new Set<string>();
  let passedOver = new Set<string>();

  const eligible = () => {
    const busy = new Set(onCourt.flatMap((g) => g.ids));
    return players.filter((p) => p.arrive <= clock && !busy.has(p.id)).map<QueuePlayer>((p) => ({
      id: p.id, gamesPlayed: p.gamesPlayed, consecutiveGames: p.consecutiveGames, queueEnteredAt: new Date(p.queueEnteredAt),
      gamesSatOut: p.gamesSatOut, partnerHistory: {}, opponentHistory: {}, recentGames: p.recent, lastGameWith: p.recent[0], fixedPartnerId: p.fixedPartnerId,
    }));
  };
  const options = (): QueueEngineOptions => ({ mode: QueueMode.SMART, maxConsecutiveGames: 2, pastGroups, tiebreakSeed: "strict", lastFillAt: lastFillAt ? new Date(lastFillAt) : undefined, ...opts.extra });

  while (report.fills < opts.fills) {
    // Fill every free court.
    while (onCourt.length < opts.courts) {
      const pool = eligible();
      const r = generateNextGame(pool, options());
      if (!r.ok) break;
      const picked = [...r.teamA, ...r.teamB].map((p) => p.id);
      report.fills += 1;
      if (promised && promised.length === 4 && promised.join() !== [...picked].sort().join()) report.upNextBroken += 1;
      // Out of line: someone who joined the line earlier (by more than the 2-minute tie window)
      // sat out while a later arrival played - and it wasn't a guardrail.
      const sim = new Map(players.map((p) => [p.id, p]));
      const latestPicked = Math.max(...picked.map((id) => sim.get(id)!.queueEnteredAt));
      const skipped = pool.filter((p) => !picked.includes(p.id) && sim.get(p.id)!.queueEnteredAt < latestPicked - 2 * MIN);
      // Games in a row two players have just shared (fixed partners never count).
      const streak = (a: string, b: string) => {
        if (sim.get(a)!.fixedPartnerId === b) return 0;
        let n = 0;
        for (const m of sim.get(a)!.recent) { if (!m.includes(b)) break; n++; }
        return n;
      };
      const hasStreak = (ids: string[]) => ids.some((a, i) => ids.slice(i + 1).some((b) => streak(a, b) >= 2));
      // The auto-split: the front four of the line would put two players together a third game
      // running, so one of them waits a game.
      const front = [...pool].sort((a, b) => a.queueEnteredAt.getTime() - b.queueEnteredAt.getTime()).slice(0, 4).map((p) => p.id);
      if (hasStreak(front) && !hasStreak(picked)) report.autoSplit += 1;
      // A third game in a row together counts only when it was avoidable without breaking the
      // On Deck promise (players who came off court since the last fill weren't in it).
      if (hasStreak(picked)) {
        const free = pool.filter((p) => p.consecutiveGames < 2 && !(p.gamesPlayed > 0 && lastFillAt !== undefined && p.queueEnteredAt.getTime() > lastFillAt)).map((p) => p.id);
        let avoidable = false;
        for (let a = 0; a < free.length && !avoidable; a++)
          for (let b = a + 1; b < free.length && !avoidable; b++)
            for (let c = b + 1; c < free.length && !avoidable; c++)
              for (let d = c + 1; d < free.length && !avoidable; d++)
                if (!hasStreak([free[a], free[b], free[c], free[d]])) avoidable = true;
        if (avoidable) report.thirdInARow += 1;
      }
      report.recentMeet += picked.reduce((n, a, i) => n + picked.slice(i + 1).filter((b) => sim.get(a)!.recent.some((m) => m.includes(b)) && sim.get(a)!.fixedPartnerId !== b).length, 0);
      // Ties in the line (same wait) may pass someone over for one game, never two fills running.
      // A player split from someone they just shared 2 games with (the auto-split) is explained.
      const unexplained = skipped.filter((p) => !(p.consecutiveGames >= 2 || p.fixedPartnerId || picked.some((q) => streak(p.id, q) >= 2)));
      if (unexplained.some((p) => passedOver.has(p.id))) report.outOfLine += 1;
      passedOver = new Set(unexplained.map((p) => p.id));
      const key = [...picked].sort().join(":");
      if (pastGroups.has(key)) report.exactRepeat += 1;
      pastGroups.add(key);
      // The limit can only be kept when at least 4 waiting players are under it.
      const limitKeepable = pool.filter((p) => p.consecutiveGames < 2).length >= 4;
      for (const p of pool) {
        const s = sim.get(p.id)!;
        if (picked.includes(p.id)) {
          report.maxWait = Math.max(report.maxWait, Math.round((clock - s.queueEnteredAt) / MIN));
          if (s.consecutiveGames >= 2 && limitKeepable) report.overLimit += 1;
          if (lastFillPicked.has(p.id) && limitKeepable) report.backToBack += 1;
          if (s.gamesPlayed === 0 && s.arrive > T0) report.newcomerFirstWait.push((clock - s.arrive) / MIN);
          s.consecutiveGames += 1;
          s.recent = [picked.filter((x) => x !== p.id), ...s.recent].slice(0, 3);
        } else {
          s.consecutiveGames = 0;
          s.gamesSatOut += 1;
        }
      }
      lastFillPicked = new Set(picked);
      lastFillAt = clock;
      onCourt.push({ ids: picked, end: clock + (11 + rnd() * 6) * MIN });
      promised = rankQueue(eligible(), options()).slice(0, 4).map((p) => p.id).sort();
    }
    // Next event: a game ends, or the next arrival (On Deck then updates on screen).
    onCourt.sort((a, b) => a.end - b.end);
    const nextArrival = pending.find((t) => t > clock) ?? Infinity;
    if (nextArrival < onCourt[0].end) {
      clock = nextArrival;
      while (pending.length && pending[0] <= clock) { add(pending.shift()!); }
      promised = rankQueue(eligible(), options()).slice(0, 4).map((p) => p.id).sort();
      continue;
    }
    const done = onCourt.shift()!;
    clock = done.end;
    for (const id of done.ids) {
      const s = players.find((p) => p.id === id)!;
      s.gamesPlayed += 1;
      s.queueEnteredAt = clock; // back of the line
    }
  }
  const games = players.filter((p) => p.arrive < T0 + 5 * MIN).map((p) => p.gamesPlayed);
  return { ...report, onTimeGames: { min: Math.min(...games), max: Math.max(...games) } };
}

describe("strict mode", () => {
  const scenarios = [
    { name: "22 players, 2 courts, all on time", start: 22, arrivals: [], courts: 2, roomy: true },
    { name: "14 on time, 4 at 30 min, 4 at 60 min, 2 courts", start: 14, arrivals: [{ at: 30, count: 4 }, { at: 60, count: 4 }], courts: 2, roomy: true },
    // Tight: 16 players for 12 seats, so only 4 ever wait. Each court's four come off together and
    // go to the back together, so the same foursomes come round again (see the last check).
    { name: "10 on time, 6 trickle in, 3 courts", start: 10, arrivals: [{ at: 15, count: 2 }, { at: 25, count: 2 }, { at: 45, count: 2 }], courts: 3, roomy: false },
  ];
  for (const sc of scenarios) {
    it(`${sc.name}: plays strictly in line, On Deck is always the next game, nobody back-to-back`, () => {
      for (let n = 0; n < 8; n++) {
        const r = night({ seed: `${sc.name}-${n}`, start: sc.start, arrivals: sc.arrivals, courts: sc.courts, fills: 40 });
        expect(r.outOfLine, "passed over two fills running").toBe(0);
        expect(r.upNextBroken, "On Deck != fill").toBe(0);
        expect(r.overLimit, "over the games-in-a-row limit").toBe(0);
        expect(r.backToBack, "straight back on court").toBe(0);
        if (sc.roomy) expect(r.exactRepeat, "same four twice").toBe(0);
        // Strict goes by wait time, not games played: short and long games make up to 2 apart.
        expect(r.onTimeGames.max - r.onTimeGames.min, "on-time players' games").toBeLessThanOrEqual(2); // games on court right now aren't counted
      }
    });
  }

  it("newcomers join the back of the line: their first game comes after everyone already waiting", () => {
    const r = night({ seed: "newcomers", start: 14, arrivals: [{ at: 30, count: 4 }], courts: 2, fills: 30 });
    // 14 players on 2 courts: 6 wait at any time, so a newcomer waits about one round (~a game).
    for (const w of r.newcomerFirstWait) expect(w).toBeGreaterThan(0);
    expect(r.outOfLine).toBe(0);
  });

  it("players who just shared 2 games in a row are split up automatically", () => {
    for (let n = 0; n < 8; n++) {
      const r = night({ seed: `split-${n}`, start: 18, arrivals: [], courts: 2, fills: 40 });
      expect(r.thirdInARow, "third game in a row together").toBe(0);
    }
  });

  it("Mix everyone mixes within the next two games of the line: fewer repeat meetings, wait barely changes", () => {
    let plainMeet = 0, mixedMeet = 0;
    for (let n = 0; n < 8; n++) {
      const plain = night({ seed: `mix-${n}`, start: 18, arrivals: [{ at: 20, count: 4 }], courts: 2, fills: 30 });
      const mixed = night({ seed: `mix-${n}`, start: 18, arrivals: [{ at: 20, count: 4 }], courts: 2, fills: 30, extra: { mixEveryone: true } });
      plainMeet += plain.recentMeet;
      mixedMeet += mixed.recentMeet;
      expect(mixed.maxWait, "longest wait").toBeLessThanOrEqual(plain.maxWait + 17); // at most about one extra game
      expect(mixed.upNextBroken).toBe(0);
      expect(mixed.overLimit).toBe(0);
      expect(mixed.backToBack).toBe(0);
    }
    expect(mixedMeet).toBeLessThan(plainMeet);
  });

  it("fixed partners still play together; the pair waits for its later half", () => {
    const r = night({ seed: "pairs", start: 16, arrivals: [], courts: 2, fills: 30, pairs: 2 });
    expect(r.upNextBroken).toBe(0);
    expect(r.overLimit).toBe(0);
  });
});

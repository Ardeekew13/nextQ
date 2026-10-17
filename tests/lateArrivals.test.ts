/**
 * Late check-ins in the middle of a session: 16 players on 2 courts play until most have
 * 2-3 games, then 2 players check in together, 1 more ~10 minutes later and 1 more ~10
 * minutes after that. Runs the real queue engine fill by fill, with the same bookkeeping
 * the server does (consecutive games, sat-out resets, histories, recent games).
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { generateNextGame, type QueuePlayer, type QueueEngineOptions } from "@/lib/queueEngine";
import { blendedStrength } from "@/lib/playerStrength";
import { seededRandom } from "@/lib/seededRandom";
import { QueueMode } from "@/types/enums";

const T0 = Date.UTC(2026, 9, 13, 1, 0); // 09:00 Manila
const MIN = 60_000;
afterEach(() => vi.useRealTimers());

interface P {
  id: string;
  checkInAt: number;
  queueEnteredAt: number;
  gamesPlayed: number;
  wins: number;
  consecutiveGames: number;
  gamesSatOut: number;
  partnerHistory: Record<string, number>;
  opponentHistory: Record<string, number>;
  recentGames: string[][];
  fixedPartnerId?: string;
  /** game numbers this player played */
  games: number[];
  firstGameAt?: number;
}

export interface LateResult {
  late: Array<{ id: string; checkIn: string; minutesToFirstGame: number; gamesAtEnd: number; gamesSinceArrival: number }>;
  /** games per original player during the same window as the late arrivals were present */
  originalsGamesSinceFirstLate: { min: number; max: number };
  originalsAtEnd: { min: number; max: number };
  /** games in which two or more late arrivals played together */
  latePairedGames: number;
  /** most games any two late arrivals shared */
  maxSharedByTwoLate: number;
  /** games with 3 or more late arrivals in them, not counting their very first game (where
   * 3 newcomers who have never played each other may start together) */
  lateBunchedGames: number;
  /** games where some pair is together for a 3rd game in a row (fixed partners excluded) */
  threeInARow: number;
  /** longest any checked-in player waited between games (minutes), originals only, after the first late check-in */
  longestOriginalWait: number;
  log: string[];
}

/** Late groups: minutes after "most have N games" and how many check in together. */
export type LateGroups = Array<{ afterMin: number; count: number }>;
const DEFAULT_GROUPS: LateGroups = [{ afterMin: 1, count: 2 }, { afterMin: 11, count: 1 }, { afterMin: 21, count: 1 }];

export function runLateScenario(
  opts: Partial<QueueEngineOptions>,
  seed = "late",
  totalGames = 32,
  groups: LateGroups = DEFAULT_GROUPS,
  /** Late groups are scheduled once 12 of the 16 have played at least this many games. */
  arriveWhenGames = 2
): LateResult {
  vi.useFakeTimers();
  const rnd = seededRandom(seed);
  let clock = T0;
  vi.setSystemTime(clock);
  const mk = (id: string, at: number): P => ({
    id, checkInAt: at, queueEnteredAt: at, gamesPlayed: 0, wins: 0, consecutiveGames: 0, gamesSatOut: 0,
    partnerHistory: {}, opponentHistory: {}, recentGames: [], games: [],
  });
  const players: P[] = Array.from({ length: 16 }, (_, i) => mk(`p${i + 1}`, T0 + i * 20_000));
  const pending: Array<{ at: number; ids: string[] }> = [];
  const lateIds = Array.from({ length: groups.reduce((n, g) => n + g.count, 0) }, (_, i) => `late${i + 1}`);
  let lateScheduled = false;
  let firstLateAt = Infinity;
  const pastGroups = new Set<string>();
  const onCourt: Array<{ num: number; a: string[]; b: string[]; end: number }> = [];
  const log: string[] = [];
  let gameNo = 0;
  const lastEnd = new Map<string, number>();
  let longestOriginalWait = 0;
  let threeInARow = 0;

  const byId = () => new Map(players.map((p) => [p.id, p]));
  const fill = () => {
    const busy = new Set(onCourt.flatMap((g) => [...g.a, ...g.b]));
    const waiting = players.filter((p) => !busy.has(p.id));
    const eligible: QueuePlayer[] = waiting.map((p) => ({
      id: p.id, gamesPlayed: p.gamesPlayed, consecutiveGames: p.consecutiveGames, queueEnteredAt: new Date(p.queueEnteredAt),
      gamesSatOut: p.gamesSatOut, partnerHistory: { ...p.partnerHistory }, opponentHistory: { ...p.opponentHistory },
      winRate: blendedStrength({ wins: p.wins, games: p.gamesPlayed }), fixedPartnerId: p.fixedPartnerId,
      recentGames: p.recentGames.map((g) => [...g]), lastGameWith: p.recentGames[0],
    }));
    const r = generateNextGame(eligible, { pastGroups, tiebreakSeed: "sess", maxConsecutiveGames: 2, ...opts });
    if (!r.ok) return false;
    gameNo++;
    const a = r.teamA.map((p) => p.id), b = r.teamB.map((p) => p.id);
    const picked = new Set([...a, ...b]);
    const m = byId();
    for (const p of waiting) {
      if (picked.has(p.id)) {
        p.consecutiveGames++;
        if (p.firstGameAt === undefined) p.firstGameAt = clock;
        if (clock >= firstLateAt && !p.id.startsWith("late")) {
          longestOriginalWait = Math.max(longestOriginalWait, (clock - p.queueEnteredAt) / MIN);
        }
      } else {
        p.consecutiveGames = 0;
        p.gamesSatOut++;
      }
    }
    const ids = [...picked];
    let third = false;
    for (let i = 0; i < 4; i++) for (let j = i + 1; j < 4; j++) {
      const pi = m.get(ids[i])!;
      let run = 0;
      for (const g of pi.recentGames) { if (!g.includes(ids[j])) break; run++; }
      if (run >= 2) third = true;
    }
    if (third) threeInARow++;
    pastGroups.add([...picked].sort().join(":"));
    const fmt = (ids: string[]) => ids.map((id) => `${id}(${m.get(id)!.gamesPlayed})`).join("+");
    log.push(`#${gameNo} ${new Date(clock + 8 * 3600e3).toISOString().slice(11, 16)} ${fmt(a)} vs ${fmt(b)}`);
    onCourt.push({ num: gameNo, a, b, end: clock + (10 + rnd() * 5) * MIN });
    return true;
  };

  fill(); fill();
  while (gameNo < totalGames) {
    onCourt.sort((x, y) => x.end - y.end);
    const nextEnd = onCourt[0]?.end ?? Infinity;
    const nextCheckIn = pending[0]?.at ?? Infinity;
    if (nextCheckIn <= nextEnd) {
      // a late player checks in while courts are busy
      clock = nextCheckIn; vi.setSystemTime(clock);
      const c = pending.shift()!;
      for (const id of c.ids) players.push(mk(id, clock));
      log.push(`   ${new Date(clock + 8 * 3600e3).toISOString().slice(11, 16)} CHECK-IN ${c.ids.join(", ")}`);
      continue;
    }
    const done = onCourt.shift()!;
    clock = done.end; vi.setSystemTime(clock);
    const winA = rnd() < 0.5;
    const m = byId();
    for (const id of [...done.a, ...done.b]) {
      const p = m.get(id)!;
      const inA = done.a.includes(id);
      const mates = (inA ? done.a : done.b).filter((x) => x !== id);
      const opps = inA ? done.b : done.a;
      p.gamesPlayed++;
      if (winA === inA) p.wins++;
      p.games.push(done.num);
      for (const x of mates) p.partnerHistory[x] = (p.partnerHistory[x] ?? 0) + 1;
      for (const x of opps) p.opponentHistory[x] = (p.opponentHistory[x] ?? 0) + 1;
      p.recentGames = [[...done.a, ...done.b].filter((x) => x !== id), ...p.recentGames].slice(0, 3);
      p.queueEnteredAt = clock;
      lastEnd.set(id, clock);
    }
    // Once most have 2-3 games, schedule the late arrivals: 2 now, 1 in ~10 min, 1 in ~20 min.
    if (!lateScheduled && players.filter((p) => p.gamesPlayed >= arriveWhenGames).length >= 12) {
      lateScheduled = true;
      firstLateAt = clock + Math.min(...groups.map((g) => g.afterMin)) * MIN;
      let next = 0;
      for (const g of groups) {
        pending.push({ at: clock + g.afterMin * MIN, ids: lateIds.slice(next, next + g.count) });
        next += g.count;
      }
      pending.sort((a, b) => a.at - b.at);
    }
    fill();
  }

  const late = lateIds.map((id) => players.find((p) => p.id === id)!).filter(Boolean).map((p) => ({
    id: p.id,
    checkIn: new Date(p.checkInAt + 8 * 3600e3).toISOString().slice(11, 16),
    minutesToFirstGame: p.firstGameAt === undefined ? Infinity : Math.round((p.firstGameAt - p.checkInAt) / MIN),
    gamesAtEnd: p.gamesPlayed + (onCourt.some((g) => [...g.a, ...g.b].includes(p.id)) ? 1 : 0),
    gamesSinceArrival: p.gamesPlayed + (onCourt.some((g) => [...g.a, ...g.b].includes(p.id)) ? 1 : 0),
  }));
  const originals = players.filter((p) => !p.id.startsWith("late"));
  const onNow = (id: string) => (onCourt.some((g) => [...g.a, ...g.b].includes(id)) ? 1 : 0);
  const sinceFirst = originals.map((p) => {
    const gamesBefore = players.length && p.games.filter((n) => {
      const line = log.find((l) => l.startsWith(`#${n} `))!;
      const hhmm = line.split(" ")[1];
      const t = Date.parse(`2026-10-13T${hhmm}:00Z`) - 8 * 3600e3;
      return t < firstLateAt;
    }).length;
    return p.gamesPlayed + onNow(p.id) - gamesBefore;
  });
  const lateGames = log.filter((l) => l.startsWith("#")).map((l) => (l.match(/late\d+/g) ?? []));
  let latePairedGames = 0;
  const shared = new Map<string, number>();
  for (const ids of lateGames) {
    if (ids.length >= 2) latePairedGames++;
    for (let i = 0; i < ids.length; i++) for (let j = i + 1; j < ids.length; j++) {
      const k = [ids[i], ids[j]].sort().join("+"); shared.set(k, (shared.get(k) ?? 0) + 1);
    }
  }
  return {
    late,
    originalsGamesSinceFirstLate: { min: Math.min(...sinceFirst), max: Math.max(...sinceFirst) },
    originalsAtEnd: { min: Math.min(...originals.map((p) => p.gamesPlayed + onNow(p.id))), max: Math.max(...originals.map((p) => p.gamesPlayed + onNow(p.id))) },
    latePairedGames,
    maxSharedByTwoLate: Math.max(0, ...shared.values()),
    longestOriginalWait: Math.round(longestOriginalWait),
    threeInARow,
    lateBunchedGames: log
      .filter((l) => l.startsWith("#"))
      .map((l) => [...l.matchAll(/late\d+\((\d+)\)/g)].map((m) => Number(m[1])))
      .filter((counts) => counts.length >= 3 && counts.some((n) => n > 0)).length,
    log,
  };
}

describe("late check-ins: 2 together, then 1, then 1 more, while most have 2-3 games", () => {
  const nights = (o: Partial<QueueEngineOptions>) => Array.from({ length: 12 }, (_, i) => runLateScenario(o, `night-${i}`));

  for (const [label, o] of [
    ["Hybrid + Mix everyone (the club's setup)", { mode: QueueMode.HYBRID, mixEveryone: true, balanceTeams: true }],
    ["Hybrid", { mode: QueueMode.HYBRID, balanceTeams: true }],
  ] as const) {
    it(`${label}: late players start at the next free court and catch up, nobody else falls behind`, () => {
      for (const r of nights(o)) {
        for (const l of r.late) {
          expect(l.minutesToFirstGame, `${l.id} first game`).toBeLessThanOrEqual(15);
          expect(l.gamesAtEnd, `${l.id} games`).toBeGreaterThanOrEqual(5); // arrived when others had ~2.5
        }
        expect(r.originalsAtEnd.max - r.originalsAtEnd.min).toBeLessThanOrEqual(1);
        expect(r.longestOriginalWait).toBeLessThanOrEqual(40);
      }
    });

    it(`${label}: no pair is put together for a 3rd game in a row (late players included)`, () => {
      const runs = nights(o);
      expect(runs.reduce((n, r) => n + r.threeInARow, 0)).toBe(0); // was 12-13 over these nights
      for (const r of runs) expect(r.maxSharedByTwoLate).toBeLessThanOrEqual(3);
    });
  }

  it("Balanced (fewest games first): late players catch up fastest, others stay level", () => {
    for (const r of nights({ mode: QueueMode.BALANCED, balanceTeams: true })) {
      for (const l of r.late) expect(l.gamesAtEnd).toBeGreaterThanOrEqual(6);
      expect(r.originalsAtEnd.max - r.originalsAtEnd.min).toBeLessThanOrEqual(1);
    }
  });
});

// ── A late GROUP is mixed in with everyone while it catches up, not played as its own group ──
const clubSetup = { mode: QueueMode.HYBRID, mixEveryone: true, balanceTeams: true };

describe("a late group catches up mixed in with everyone (Hybrid + Mix everyone)", () => {
  // Measured before this rule (same nights): 7 late -> 15 games with 3+ of them, two late
  // players sharing up to 4 games, and pairs put together for a 3rd game in a row.
  for (const [count, maxBunched, maxFirstWait] of [[2, 0, 15], [3, 2, 15], [7, 8, 30]] as const) {
    it(`${count} checking in together when most have 2 games`, () => {
      const runs = Array.from({ length: 10 }, (_, i) => runLateScenario(clubSetup, `grp-${i}`, 36, [{ afterMin: 1, count }], 2));
      expect(runs.reduce((n, r) => n + r.lateBunchedGames, 0), "games with 3+ late players").toBeLessThanOrEqual(maxBunched);
      expect(Math.max(...runs.map((r) => r.maxSharedByTwoLate)), "games two late players share").toBeLessThanOrEqual(3);
      expect(runs.reduce((n, r) => n + r.threeInARow, 0), "3 in a row").toBe(0);
      for (const r of runs) {
        for (const l of r.late) {
          // Catching up: since arriving, every late player played at least as many games as
          // any regular did in the same time.
          expect(l.gamesSinceArrival, `${l.id} caught up`).toBeGreaterThanOrEqual(r.originalsGamesSinceFirstLate.max);
          expect(l.minutesToFirstGame, `${l.id} first game`).toBeLessThanOrEqual(maxFirstWait);
        }
        expect(r.originalsAtEnd.max - r.originalsAtEnd.min, "regulars stay level").toBeLessThanOrEqual(2);
      }
    });
  }
});

describe("a late group that checks in early (others have 1 game)", () => {
  const runs = Array.from({ length: 30 }, (_, i) => runLateScenario(clubSetup, `early-${i}`, 36, [{ afterMin: 1, count: 6 }], 1));
  it("is spread across games, not played as its own group", () => {
    // Before the rule: 70 games over these 30 nights had 3+ of the group (first games aside).
    expect(runs.reduce((a, r) => a + r.lateBunchedGames, 0)).toBeLessThanOrEqual(25);
    expect(Math.max(...runs.map((r) => r.maxSharedByTwoLate))).toBeLessThanOrEqual(3);
  });
  it("never puts a pair together three games in a row (was 27 times)", () => {
    expect(runs.reduce((a, r) => a + r.threeInARow, 0)).toBe(0);
  });
  it("gets all 6 on court within two games (3 newcomers may share their first game)", () => {
    for (const r of runs) {
      expect(Math.max(...r.late.map((l) => l.minutesToFirstGame))).toBeLessThanOrEqual(16);
      expect(Math.min(...r.late.map((l) => l.gamesAtEnd))).toBeGreaterThanOrEqual(6);
      expect(r.originalsAtEnd.max - r.originalsAtEnd.min).toBeLessThanOrEqual(1);
    }
  });
  it("a group of 5: no third game in a row either", () => {
    const five = Array.from({ length: 30 }, (_, i) => runLateScenario(clubSetup, `early-${i}`, 36, [{ afterMin: 1, count: 5 }], 1));
    expect(five.reduce((a, r) => a + r.threeInARow, 0)).toBe(0);
    expect(Math.max(...five.map((r) => r.maxSharedByTwoLate))).toBeLessThanOrEqual(4);
  });
});

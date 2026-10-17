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
  /** games where some pair is together for a 3rd game in a row (fixed partners excluded) */
  threeInARow: number;
  /** longest any checked-in player waited between games (minutes), originals only, after the first late check-in */
  longestOriginalWait: number;
  log: string[];
}

export function runLateScenario(opts: Partial<QueueEngineOptions>, seed = "late", totalGames = 32): LateResult {
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
  const lateIds = ["late1", "late2", "late3", "late4"];
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
    if (!lateScheduled && players.filter((p) => p.gamesPlayed >= 2).length >= 12) {
      lateScheduled = true;
      firstLateAt = clock + 1 * MIN;
      pending.push({ at: clock + 1 * MIN, ids: ["late1", "late2"] }, { at: clock + 11 * MIN, ids: ["late3"] }, { at: clock + 21 * MIN, ids: ["late4"] });
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
  const lateGames = log.filter((l) => l.startsWith("#")).map((l) => (l.match(/late\d/g) ?? []));
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

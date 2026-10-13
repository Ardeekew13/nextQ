/**
 * "New faces whenever possible": players who just shared a court shouldn't be put on the
 * same court again (as partners OR opponents) when the queue can avoid it — without
 * breaking equal court time.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { generateNextGame, type QueuePlayer, type QueueEngineOptions } from "@/lib/queueEngine";
import { QueueMode } from "@/types/enums";
import { seededRandom } from "@/lib/seededRandom";

const T0 = new Date("2026-01-01T10:00:00Z").getTime();
afterEach(() => vi.useRealTimers());

export interface SimResult {
  games: number;
  /** Games containing at least one pair who were on the same court in either player's previous game. */
  backToBackGames: number;
  /** Total pairs (per game) who had already shared a court earlier in the night. */
  repeatPairs: number;
  /** Pairs per game who were on the same court in their previous game (lower = fresher). */
  lastGamePairs: number;
  /** Largest gap in games played between any two players at the end. */
  gamesGap: number;
  /** Games where some pair is together for a 2nd game in a row. */
  pairTwiceInARow: number;
  /** Games where some pair is together for a 3rd game in a row (the A-and-D pattern). */
  pairThreeInARow: number;
  /** Game number of the first game in which any two players meet for a second time. */
  firstRepeatGame: number;
  /** Largest games-played gap between any two players at any moment of the night. */
  worstGapDuringNight: number;
  /** Times someone was skipped by a player who had already played more games. */
  fairnessViolations: number;
}

export function simulate(
  nPlayers: number,
  courts: number,
  totalGames: number,
  opts: Partial<QueueEngineOptions>,
  seed = "night"
): SimResult {
  vi.useFakeTimers();
  const rnd = seededRandom(seed);
  let clock = T0;
  vi.setSystemTime(clock);
  const players: QueuePlayer[] = Array.from({ length: nPlayers }, (_, i) => ({
    id: `p${i + 1}`,
    gamesPlayed: 0,
    consecutiveGames: 0,
    queueEnteredAt: new Date(T0 + i * 1000),
    gamesSatOut: 0,
    partnerHistory: {},
    opponentHistory: {},
  }));
  const byId = new Map(players.map((p) => [p.id, p]));
  const pastGroups = new Set<string>();
  const lastMates = new Map<string, Set<string>>();
  const everMet = new Set<string>();
  const pk = (a: string, b: string) => (a < b ? `${a}|${b}` : `${b}|${a}`);
  const onCourt: Array<{ ids: string[]; teamA: string[]; teamB: string[]; endsAt: number }> = [];
  const res: SimResult = { games: 0, backToBackGames: 0, lastGamePairs: 0, repeatPairs: 0, gamesGap: 0, worstGapDuringNight: 0, fairnessViolations: 0, pairTwiceInARow: 0, pairThreeInARow: 0, firstRepeatGame: Infinity };
  const recent = new Map<string, string[][]>();
  const streak = (a: string, b: string) => {
    let n = 0;
    for (const mates of recent.get(a) ?? []) {
      if (!mates.includes(b)) break;
      n++;
    }
    return n;
  };

  const fill = () => {
    const busy = new Set(onCourt.flatMap((g) => g.ids));
    const eligible = players
      .filter((p) => !busy.has(p.id))
      .map((p) => ({ ...p, lastGameWith: [...(lastMates.get(p.id) ?? [])], recentGames: (recent.get(p.id) ?? []).map((g) => [...g]) }));
    const r = generateNextGame(eligible, { pastGroups, tiebreakSeed: "sim", ...opts });
    if (!r.ok) throw new Error(r.reason);
    const ids = r.selected.map((p) => p.id);
    // fairness: did anyone waiting with FEWER games get skipped for someone with more?
    const minPicked = Math.min(...r.selected.map((p) => p.gamesPlayed));
    const maxPicked = Math.max(...r.selected.map((p) => p.gamesPlayed));
    const skipped = eligible.filter((p) => !ids.includes(p.id) && p.consecutiveGames < 2);
    if (skipped.some((p) => p.gamesPlayed < maxPicked && p.gamesPlayed < minPicked + 1 && maxPicked > p.gamesPlayed)) {
      // someone with fewer games than a picked player sat out
      if (skipped.some((p) => p.gamesPlayed + 1 < maxPicked)) res.fairnessViolations++;
    }
    let b2b = false;
    let twice = false;
    let thrice = false;
    for (let i = 0; i < 4; i++)
      for (let j = i + 1; j < 4; j++) {
        const [a, b] = [ids[i], ids[j]];
        if (lastMates.get(a)?.has(b)) {
          b2b = true;
          res.lastGamePairs++;
        }
        if (everMet.has(pk(a, b))) {
          res.repeatPairs++;
          res.firstRepeatGame = Math.min(res.firstRepeatGame, res.games + 1);
        }
        const st = streak(a, b);
        if (st >= 1) twice = true;
        if (st >= 2) thrice = true;
      }
    if (b2b) res.backToBackGames++;
    if (twice) res.pairTwiceInARow++;
    if (thrice) res.pairThreeInARow++;
    res.games++;
    for (const p of players) {
      if (ids.includes(p.id)) p.consecutiveGames++;
      else if (!busy.has(p.id)) {
        p.consecutiveGames = 0;
        p.gamesSatOut++;
      }
    }
    pastGroups.add([...ids].sort().join(":"));
    onCourt.push({ ids, teamA: r.teamA.map((p) => p.id), teamB: r.teamB.map((p) => p.id), endsAt: clock + (9 + rnd() * 6) * 60_000 });
  };

  for (let c = 0; c < courts; c++) fill();
  while (res.games < totalGames) {
    onCourt.sort((a, b) => a.endsAt - b.endsAt);
    const done = onCourt.shift()!;
    clock = done.endsAt;
    vi.setSystemTime(clock);
    const winA = rnd() < 0.5;
    for (const id of done.ids) {
      const p = byId.get(id)!;
      p.gamesPlayed++;
      p.queueEnteredAt = new Date(clock);
      const mates = done.teamA.includes(id) ? done.teamA : done.teamB;
      const opps = done.teamA.includes(id) ? done.teamB : done.teamA;
      for (const m of mates) if (m !== id) p.partnerHistory[m] = (p.partnerHistory[m] ?? 0) + 1;
      for (const o of opps) p.opponentHistory[o] = (p.opponentHistory[o] ?? 0) + 1;
      lastMates.set(id, new Set(done.ids.filter((x) => x !== id)));
      recent.set(id, [done.ids.filter((x) => x !== id), ...(recent.get(id) ?? [])].slice(0, 3));
      for (const other of done.ids) if (other !== id) everMet.add(pk(id, other));
      void winA;
    }
    fill();
    const now = players.map((p) => p.gamesPlayed + (onCourt.some((g) => g.ids.includes(p.id)) ? 1 : 0));
    res.worstGapDuringNight = Math.max(res.worstGapDuringNight, Math.max(...now) - Math.min(...now));
  }
  const gp = players.map((p) => p.gamesPlayed + (onCourt.some((g) => g.ids.includes(p.id)) ? 1 : 0));
  res.gamesGap = Math.max(...gp) - Math.min(...gp);
  return res;
}

export const SIZES: Array<[number, number]> = [[8, 1], [10, 2], [12, 2], [14, 2], [16, 2], [16, 3], [20, 2], [24, 3]];
export function aggregate(opts: Partial<QueueEngineOptions>, seeds = 12) {
  return SIZES.map(([n, c]) => {
    const runs = Array.from({ length: seeds }, (_, i) => simulate(n, c, 40, opts, `seed-${i}`));
    const sum = (k: keyof SimResult) => runs.reduce((a, r) => a + (r[k] as number), 0);
    return {
      size: `${n}p/${c}c`,
      backToBackGames: +(sum("backToBackGames") / seeds).toFixed(1),
      lastGamePairs: +(sum("lastGamePairs") / seeds).toFixed(1),
      twiceInARow: +(sum("pairTwiceInARow") / seeds).toFixed(1),
      threeInARow: +(sum("pairThreeInARow") / seeds).toFixed(1),
      repeatPairs: +(sum("repeatPairs") / seeds).toFixed(1),
      worstGap: Math.max(...runs.map((r) => r.worstGapDuringNight)),
      fairnessViolations: sum("fairnessViolations"),
    };
  });
}

import { lastGameMates, recentGameMates } from "@/lib/lastGame";
import { deriveLocalState, generateLocalGame, type QueueSnapshot } from "@/lib/offlineQueue";

function qp(id: string, sec: number, extra: Partial<QueuePlayer> = {}): QueuePlayer {
  return {
    id,
    gamesPlayed: 2,
    consecutiveGames: 0,
    queueEnteredAt: new Date(T0 + sec * 1000),
    gamesSatOut: 0,
    partnerHistory: {},
    opponentHistory: {},
    ...extra,
  };
}

/** Three earlier games' foursomes are waiting: G1 = a b c d, G2 = e f g h, G3 = i j k l. */
function threeGroups(): QueuePlayer[] {
  const groups = [["a", "b", "c", "d"], ["e", "f", "g", "h"], ["i", "j", "k", "l"]];
  const out: QueuePlayer[] = [];
  groups.forEach((g, gi) =>
    g.forEach((id) =>
      out.push(qp(id, gi * 200, {
        lastGameWith: g.filter((x) => x !== id),
        partnerHistory: {},
        opponentHistory: Object.fromEntries(g.filter((x) => x !== id).map((x) => [x, 1])),
      }))
    )
  );
  return out;
}

const lastPairsIn = (ids: string[], pool: QueuePlayer[]) => {
  let n = 0;
  for (let i = 0; i < ids.length; i++)
    for (let j = i + 1; j < ids.length; j++)
      if (pool.find((p) => p.id === ids[i])!.lastGameWith?.includes(ids[j])) n++;
  return n;
};

describe("new faces — rules", () => {
  it("spreads the next game across earlier games instead of putting last-game mates together", () => {
    vi.useFakeTimers();
    vi.setSystemTime(T0 + 3600_000);
    const pool = threeGroups();
    const r = generateNextGame(pool, { mode: QueueMode.HYBRID, tiebreakSeed: "s" });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const ids = r.selected.map((p) => p.id);
    // Without the rule this is a,b,c,d's group split 2+2 at best. 12 waiting from 3 games
    // means at least one pair must repeat (4 players, 3 groups) — but no more than one.
    expect(lastPairsIn(ids, pool)).toBe(1);
  });

  it("gets to zero repeats when four different earlier games are within reach", () => {
    vi.useFakeTimers();
    vi.setSystemTime(T0 + 3600_000);
    // Four earlier games, three of each still waiting (the 4th is on another court): 12 players,
    // all inside the look-ahead window, so a foursome with no last-game mates exists.
    const groups = [["a", "b", "c"], ["e", "f", "g"], ["i", "j", "k"], ["m", "n", "o"]];
    const pool = groups.flatMap((g, gi) => g.map((id) => qp(id, gi * 150, { lastGameWith: g.filter((x) => x !== id) })));
    const r = generateNextGame(pool, { mode: QueueMode.HYBRID, tiebreakSeed: "s" });
    expect(r.ok).toBe(true);
    if (r.ok) expect(lastPairsIn(r.selected.map((p) => p.id), pool)).toBe(0);
  });

  it("doesn't reach past the look-ahead window just for fresh faces", () => {
    vi.useFakeTimers();
    vi.setSystemTime(T0 + 3600_000);
    // The only fully fresh option needs the 4th group, who are 13th-16th in line: too far back.
    const pool = [...threeGroups(), ...["m", "n", "o", "p"].map((id, _i, g) =>
      qp(id, 600, { lastGameWith: g.filter((x) => x !== id) }))];
    const r = generateNextGame(pool, { mode: QueueMode.HYBRID, tiebreakSeed: "s" });
    expect(r.ok).toBe(true);
    if (r.ok) for (const id of ["m", "n", "o", "p"]) expect(r.selected.map((p) => p.id)).not.toContain(id);
  });

  it("never pushes back the person at the front of the queue, even for a fresher four", () => {
    vi.useFakeTimers();
    vi.setSystemTime(T0 + 3600_000);
    for (const mode of [QueueMode.HYBRID, QueueMode.BALANCED]) {
      // X waited longest but has already met a, b, c and h; the four-with-no-history (a, b, c, h)
      // would be the "freshest" game. X must still play: the front of the queue is never bumped.
      const pool = [
        qp("x", -600, { lastGameWith: ["e", "f", "g"], opponentHistory: { a: 1, b: 1, c: 1, h: 1 } }),
        ...["e", "f", "g"].map((id) => qp(id, 0, { lastGameWith: ["x", ...["e", "f", "g"].filter((o) => o !== id)] })),
        qp("a", 100, { opponentHistory: { x: 1 } }), qp("b", 100, { opponentHistory: { x: 1 } }),
        qp("c", 100, { opponentHistory: { x: 1 } }), qp("h", 100, { opponentHistory: { x: 1 } }),
      ];
      const r = generateNextGame(pool, { mode, tiebreakSeed: "s" });
      expect(r.ok && r.selected.map((p) => p.id), mode).toContain("x");
    }
  });

  it("never swaps out a player for someone who has played more games, even for fresher faces", () => {
    vi.useFakeTimers();
    vi.setSystemTime(T0 + 3600_000);
    // a and b (2 games) played together last game; c, d, e have 4 games and no history.
    // Dropping b for e would give a game with no repeats — but e has played 2 more games than b.
    const pool = [
      qp("a", 0, { gamesPlayed: 2, lastGameWith: ["b"] }),
      qp("b", 0, { gamesPlayed: 2, lastGameWith: ["a"] }),
      qp("c", 0, { gamesPlayed: 4 }), qp("d", 0, { gamesPlayed: 4 }),
      qp("e", 100, { gamesPlayed: 4 }), qp("f", 100, { gamesPlayed: 4 }),
    ];
    const r = generateNextGame(pool, { mode: QueueMode.HYBRID, tiebreakSeed: "s" });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.selected.map((p) => p.id)).toEqual(expect.arrayContaining(["a", "b"]));
  });

  it("avoiding a repeat partnership never pulls in a player who is games ahead", () => {
    vi.useFakeTimers();
    vi.setSystemTime(T0 + 3600_000);
    // a has partnered b, c and d before, so every split of a-b-c-d repeats a partnership.
    // Swapping a out for e would fix that — but e has played 2 more games than a.
    const pool = [
      qp("a", 0, { gamesPlayed: 2, partnerHistory: { b: 1, c: 1, d: 1 } }),
      qp("b", 0, { gamesPlayed: 2, partnerHistory: { a: 1 } }),
      qp("c", 0, { gamesPlayed: 2, partnerHistory: { a: 1 } }),
      qp("d", 0, { gamesPlayed: 2, partnerHistory: { a: 1 } }),
      qp("e", 100, { gamesPlayed: 4 }), qp("f", 100, { gamesPlayed: 4 }),
    ];
    const r = generateNextGame(pool, { mode: QueueMode.HYBRID, tiebreakSeed: "s" });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.selected.map((p) => p.id).sort()).toEqual(["a", "b", "c", "d"]);
  });

  it("leaves strict first-come-first-served (SMART) alone", () => {
    vi.useFakeTimers();
    vi.setSystemTime(T0 + 3600_000);
    const pool = threeGroups();
    const r = generateNextGame(pool, { mode: QueueMode.SMART, tiebreakSeed: "s" });
    expect(r.ok).toBe(true);
    // SMART also skips the trio rule, so the longest-waiting four (a-d) play, repeats and all.
    if (r.ok) expect(r.selected.map((p) => p.id).sort()).toEqual(["a", "b", "c", "d"]);
  });

  it("doesn't treat fixed partners as a repeat — they're meant to play together", () => {
    vi.useFakeTimers();
    vi.setSystemTime(T0 + 3600_000);
    // The pair and a, b are next in line; c, d arrived later. If the pair's last game together
    // counted as a repeat, the fresher-looking a, b, c, d would be picked over them.
    const pool = [
      qp("f1", 0, { fixedPartnerId: "f2", lastGameWith: ["f2"] }),
      qp("f2", 0, { fixedPartnerId: "f1", lastGameWith: ["f1"] }),
      qp("a", 0), qp("b", 0),
      qp("c", 300), qp("d", 300),
    ];
    const r = generateNextGame(pool, { mode: QueueMode.HYBRID, tiebreakSeed: "s" });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.selected.map((p) => p.id).sort()).toEqual(["a", "b", "f1", "f2"]);
  });

  it("still fills the court when repeats can't be avoided (8 players, 1 court)", () => {
    vi.useFakeTimers();
    vi.setSystemTime(T0 + 3600_000);
    const pool = threeGroups().slice(0, 8);
    const r = generateNextGame(pool, { mode: QueueMode.HYBRID, tiebreakSeed: "s" });
    expect(r.ok).toBe(true);
    if (r.ok) expect(lastPairsIn(r.selected.map((p) => p.id), pool)).toBe(2); // best possible: 2 + 2
  });

  it("up next preview and the real fill agree", () => {
    vi.useFakeTimers();
    vi.setSystemTime(T0 + 3600_000);
    const pool = threeGroups();
    const preview = rankQueueFirstFour(pool);
    const real = generateNextGame(pool, { mode: QueueMode.HYBRID, tiebreakSeed: "s" });
    expect(real.ok && real.selected.map((p) => p.id).sort()).toEqual(preview.sort());
  });
});

import { rankQueue } from "@/lib/queueEngine";
function rankQueueFirstFour(pool: QueuePlayer[]) {
  return rankQueue(pool, { mode: QueueMode.HYBRID, tiebreakSeed: "s" }).slice(0, 4).map((p) => p.id);
}

describe("same pair game after game (the A-and-D pattern)", () => {
  it("won't put a pair on court for a 3rd game running when another pair can repeat instead", () => {
    vi.useFakeTimers();
    vi.setSystemTime(T0 + 3600_000);
    // Waiting: a, d, x, y (just finished together) and e, f, g, h (finished earlier together).
    // a and d were also together in the game before that — so a+d again would be 3 in a row.
    // Some pair from each group has to repeat (8 waiting from 2 games), but it shouldn't be a+d.
    const pool = [
      qp("a", 300, { recentGames: [["d", "x", "y"], ["d", "b", "c"]] }),
      qp("d", 300, { recentGames: [["a", "x", "y"], ["a", "b", "c"]] }),
      qp("x", 300, { recentGames: [["a", "d", "y"]] }),
      qp("y", 300, { recentGames: [["a", "d", "x"]] }),
      ...["e", "f", "g", "h"].map((id, _i, g) => qp(id, 0, { recentGames: [g.filter((o) => o !== id)] })),
    ];
    for (const mode of [QueueMode.HYBRID, QueueMode.BALANCED]) {
      for (const extra of [{}, { mixEveryone: true }, { rankMatchups: true }, { balanceTeams: true }]) {
        const r = generateNextGame(pool, { mode, tiebreakSeed: "s", ...extra });
        expect(r.ok).toBe(true);
        if (!r.ok) continue;
        const ids = r.selected.map((p) => p.id);
        expect(ids.includes("a") && ids.includes("d"), `${mode} ${JSON.stringify(extra)}: ${ids}`).toBe(false);
      }
    }
  });

  it("prefers a pair that has met once over a pair that has been together two games running", () => {
    vi.useFakeTimers();
    vi.setSystemTime(T0 + 3600_000);
    // Front of the queue is e. To fill the game someone must repeat; a+d have shared their last
    // TWO games, x+y only their last one.
    const pool = [
      qp("e", -600),
      qp("a", 0, { recentGames: [["d"], ["d"]] }), qp("d", 0, { recentGames: [["a"], ["a"]] }),
      qp("x", 0, { recentGames: [["y"]] }), qp("y", 0, { recentGames: [["x"]] }),
    ];
    const r = generateNextGame(pool, { mode: QueueMode.HYBRID, tiebreakSeed: "s" });
    expect(r.ok).toBe(true);
    if (r.ok) {
      const ids = r.selected.map((p) => p.id);
      expect(ids.includes("a") && ids.includes("d")).toBe(false);
    }
  });

  it("still fills the court when the only possible game keeps a pair together", () => {
    vi.useFakeTimers();
    vi.setSystemTime(T0 + 3600_000);
    const pool = [
      qp("a", 0, { recentGames: [["d", "b", "c"], ["d", "b", "c"]] }),
      qp("d", 0, { recentGames: [["a", "b", "c"], ["a", "b", "c"]] }),
      qp("e", 0), qp("f", 0),
    ];
    expect(generateNextGame(pool, { mode: QueueMode.HYBRID, tiebreakSeed: "s" }).ok).toBe(true);
  });
});

describe("early in the session (the John & Angelica report)", () => {
  it("splits up the four who just came off the same court, not just three of them", () => {
    vi.useFakeTimers();
    vi.setSystemTime(T0 + 3600_000);
    // Everyone has played once. a-d just finished together so they're at the top of the queue;
    // e-h, i-l, m-p finished earlier games. A game with four different previous courts exists.
    const groups = [["a", "b", "c", "d"], ["e", "f", "g", "h"], ["i", "j", "k", "l"], ["m", "n", "o", "p"]];
    const pool = groups.flatMap((g, gi) =>
      g.map((id) => qp(id, gi === 0 ? 0 : 60 + gi * 10, {
        gamesPlayed: 1,
        lastGameWith: g.filter((x) => x !== id),
        recentGames: [g.filter((x) => x !== id)],
        opponentHistory: Object.fromEntries(g.filter((x) => x !== id).map((x) => [x, 1])),
      }))
    );
    const r = generateNextGame(pool, { mode: QueueMode.HYBRID, tiebreakSeed: "s", pastGroups: new Set(groups.map((g) => [...g].sort().join(":"))) });
    expect(r.ok).toBe(true);
    if (r.ok) expect(lastPairsIn(r.selected.map((p) => p.id), pool)).toBe(0);
  });

  it("with 18+ players nobody meets anyone twice until it can't be avoided", () => {
    // Measured before the fix: first repeat at game 6 (18 players) and game 7 (22 players).
    for (const [n, earliest] of [[18, 9], [22, 11]] as const) {
      for (let i = 0; i < 6; i++) {
        const r = simulate(n, 2, 20, { mode: QueueMode.HYBRID, balanceTeams: true }, `early-${i}`);
        expect(r.firstRepeatGame, `${n} players, night ${i}`).toBeGreaterThanOrEqual(earliest);
      }
    }
  });
});

describe("fairness with Mix everyone / Rank matchups on (the Joie & Primie report)", () => {
  // Joie, Primie, Aldrin and X (1 game each) came off the same court and have waited longest;
  // Leo, Gio and friends have 2 games; RD has 1 game but only just rejoined.
  function reportPool(): { pool: QueuePlayer[]; past: Set<string> } {
    vi.useFakeTimers();
    const NOW = T0 + 3 * 3600_000;
    vi.setSystemTime(NOW);
    const ago = (m: number) => (NOW - m * 60_000 - T0) / 1000;
    const p = (id: string, g: number, m: number, mates: string[]) =>
      qp(id, ago(m), { gamesPlayed: g, opponentHistory: Object.fromEntries(mates.map((x) => [x, 1])), recentGames: [mates], lastGameWith: mates });
    const groups: Array<[string[], number, number]> = [
      [["joie", "primie", "x1", "aldrin"], 1, 38],
      [["leo", "buns", "l3", "l4"], 2, 22],
      [["gio", "neil", "g3", "g4"], 2, 18],
      [["rd", "ryan", "r3", "r4"], 0, 9],
    ];
    const pool: QueuePlayer[] = [];
    for (const [ids, games, mins] of groups)
      for (const id of ids) {
        if (id === "r4") continue; // still on court
        pool.push(p(id, games || (id === "rd" ? 1 : 2), mins, ids.filter((x) => x !== id)));
      }
    return { pool, past: new Set(groups.map(([ids]) => [...ids].sort().join(":"))) };
  }

  for (const opts of [{}, { mixEveryone: true }, { rankMatchups: true }, { mixEveryone: true, rankMatchups: true }]) {
    it(`every 1-game player plays within the next two games ${JSON.stringify(opts)}`, () => {
      const { pool, past } = reportPool();
      const order = rankQueue(pool, { mode: QueueMode.HYBRID, balanceTeams: true, tiebreakSeed: "s", pastGroups: past, ...opts });
      const nextTwoGames = order.slice(0, 8).map((p) => p.id);
      for (const id of ["joie", "primie", "x1", "aldrin", "rd"]) expect(nextTwoGames, id).toContain(id);
      // Only one 2-game player may play before them (forced: 4 of the 5 shared a court).
      expect(order.slice(0, 4).filter((p) => p.gamesPlayed === 2).length).toBeLessThanOrEqual(1);
    });
  }
});

describe("recentGameMates", () => {
  it("keeps each player's last 3 games, newest first", () => {
    const games = [
      { teamAPlayerIds: ["a", "b"], teamBPlayerIds: ["c", "d"] }, // newest
      { teamAPlayerIds: ["a", "e"], teamBPlayerIds: ["f", "g"] },
      { teamAPlayerIds: ["a", "h"], teamBPlayerIds: ["i", "j"] },
      { teamAPlayerIds: ["a", "k"], teamBPlayerIds: ["l", "m"] }, // 4th game back: forgotten
    ];
    const m = recentGameMates(games);
    expect(m.get("a")!.map((g) => g.sort().join(""))).toEqual(["bcd", "efg", "hij"]);
    expect(m.get("e")!.length).toBe(1);
  });
});

describe("lastGameMates", () => {
  it("uses each player's newest game only", () => {
    const m = lastGameMates([
      { teamAPlayerIds: ["a", "b"], teamBPlayerIds: ["c", "d"] }, // newest
      { teamAPlayerIds: ["a", "e"], teamBPlayerIds: ["f", "g"] },
    ]);
    expect(m.get("a")!.sort()).toEqual(["b", "c", "d"]);
    expect(m.get("e")!.sort()).toEqual(["a", "f", "g"]);
    expect(m.get("zzz")).toBeUndefined();
  });

  it("handles no games and ObjectId-like values", () => {
    expect(lastGameMates([]).size).toBe(0);
    const oid = (s: string) => ({ toString: () => s });
    const m = lastGameMates([{ teamAPlayerIds: [oid("a"), oid("b")], teamBPlayerIds: [oid("c"), oid("d")] }]);
    expect(m.get("a")!.sort()).toEqual(["b", "c", "d"]);
  });
});

describe("offline mode", () => {
  it("remembers who just played together after an offline court fill", () => {
    const players = ["a", "b", "c", "d", "e", "f", "g", "h", "i", "j", "k", "l"].map((id, i) => ({
      id, name: id.toUpperCase(), checkedIn: true, active: true, gamesPlayed: 1, wins: 0, losses: 1,
      currentStreak: 0, longestWinStreak: 0, consecutiveGames: 0,
      queueEnteredAt: new Date(T0 + i * 1000).toISOString(), gamesSatOut: 0, partnerHistory: {}, opponentHistory: {},
    }));
    const snap: QueueSnapshot = {
      sessionId: "s", takenAt: new Date(T0).toISOString(), queueMode: "HYBRID", maxConsecutiveGames: 2,
      lastGameNumber: 0, players, activeGames: [], pastGroups: [], keepApart: [],
      courts: [{ id: "c1", courtNumber: 1, status: "AVAILABLE" }, { id: "c2", courtNumber: 2, status: "AVAILABLE" }],
    };
    const state = deriveLocalState(snap, [{
      kind: "fill", id: "op1", sessionId: "s", courtId: "c1", localGameId: "local-1",
      teamAPlayerIds: ["a", "b"], teamBPlayerIds: ["c", "d"], playersSatOutIds: [], createdAt: new Date(T0).toISOString(),
    }]);
    expect(state.players.find((p) => p.id === "a")!.lastGameWith!.sort()).toEqual(["b", "c", "d"]);
    expect(state.players.find((p) => p.id === "a")!.recentGames!.length).toBe(1);
    // and the next offline game can still be generated
    expect(generateLocalGame(snap, state).ok).toBe(true);
  });
});

describe("new faces — whole-night simulation (regression guard)", () => {
  const rows = () => aggregate({ mode: QueueMode.HYBRID, balanceTeams: true }, 8);
  it("cuts back-to-back court mates where it's possible, without hurting fairness", () => {
    const byRow = Object.fromEntries(rows().map((r) => [r.size, r]));
    // Measured before this change (8 nights each): 16p/2c ≈ 58 and 24p/3c ≈ 64 pairs per night.
    expect(byRow["16p/2c"].lastGamePairs).toBeLessThan(45);
    expect(byRow["24p/3c"].lastGamePairs).toBeLessThan(35);
    // Same pair on court a 3rd game running, per 40 games. Before: 12p ≈ 15.5, 14p ≈ 15.9,
    // 16p/3c ≈ 14.3, 20p ≈ 23.3, 24p ≈ 15.6.
    expect(byRow["12p/2c"].threeInARow).toBeLessThan(7);
    for (const size of ["14p/2c", "16p/2c", "16p/3c", "20p/2c", "24p/3c"]) {
      expect(byRow[size].threeInARow, size).toBeLessThan(3);
    }
    for (const size of ["14p/2c", "16p/2c", "16p/3c", "20p/2c", "24p/3c"]) {
      expect(byRow[size].worstGap, size).toBeLessThanOrEqual(2);
      expect(byRow[size].fairnessViolations, size).toBe(0);
    }
  });
});

/**
 * QueueEngine — mode-aware player selection for next game generation.
 *
 * Three modes:
 *   BALANCED — equal games for everyone; late arrivals catch up fast.
 *   SMART    — strict queue order by wait time; no catch-up.
 *   HYBRID   — default; wait-time first, with one override: anyone who hasn't played a
 *              single game yet always goes ahead of anyone who has, however long the
 *              others have waited. Once that's settled, ordering falls back to wait-time
 *              first with gentle catch-up (secondary factor), plus consecutive game
 *              protection.
 *
 * Pure functions with no DB dependency so they can be unit-tested in isolation.
 */

import { QueueMode } from "@/types/enums";

import { seededRandom } from "@/lib/seededRandom";

/**
 * Bump whenever the queue's picking rules change. The server puts it in the offline snapshot;
 * a browser still running an older copy sees a mismatch, warns "refresh this page", and lets
 * the server pick games instead of its out-of-date local copy.
 */
export const QUEUE_ENGINE_VERSION = "2026-10-16b";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface QueuePlayer {
  id: string;
  gamesPlayed: number;
  consecutiveGames: number;
  queueEnteredAt: Date;
  gamesSatOut: number;
  partnerHistory: Record<string, number>;
  opponentHistory: Record<string, number>;
  /** Estimated strength 0-100 (see playerStrength.ts). Never affects who gets the next spot;
   * only used by "rank matchups" to group similar players and balance the two teams. */
  winRate?: number;
  /** Optional mutual "fixed partner" request. When both players in a pair are eligible,
   * the engine always selects and teams them together instead of treating them individually.
   * The pair's turn is decided by whichever partner has the WORSE individual priority —
   * i.e. the pair waits as a unit for its slower half, rather than the faster half dragging
   * the other one forward. This keeps the "always together" guarantee without letting a
   * pair jump ahead of players who'd otherwise be next. */
  fixedPartnerId?: string;
  /** Ids of the other three players in this player's most recent game. Used to avoid putting
   * people who just shared a court straight back on one together (partners or opponents). */
  lastGameWith?: string[];
  /** The other three players in each of this player's last few games, newest first
   * (recentGames[0] is the same as lastGameWith). Used to spot a pair stuck together
   * game after game. */
  recentGames?: string[][];
}

export type PlayerQuad = [QueuePlayer, QueuePlayer, QueuePlayer, QueuePlayer];
export type PlayerPair = [QueuePlayer, QueuePlayer];

export interface TeamAssignment {
  teamA: PlayerPair;
  teamB: PlayerPair;
  score: number;
}

export interface GenerateResult {
  ok: true;
  selected: PlayerQuad;
  teamA: PlayerPair;
  teamB: PlayerPair;
}

export interface FailResult {
  ok: false;
  reason: string;
}

export type QueueResult = GenerateResult | FailResult;

// ---------------------------------------------------------------------------
// Scoring helpers
// ---------------------------------------------------------------------------

function historyCount(history: Record<string, number>, id: string): number {
  return history[id] ?? 0;
}

function pairKey(a: QueuePlayer, b: QueuePlayer): string {
  return a.id < b.id ? `${a.id}:${b.id}` : `${b.id}:${a.id}`;
}

function groupKey(players: QueuePlayer[]): string {
  return [...players.map((p) => p.id)].sort().join(":");
}

/**
 * Players who've waited within this many minutes of each other are treated as having
 * "waited a similar amount of time": wait time rules the queue at this bucketed
 * granularity, and the secondary factors (games played, games sat out) decide within it.
 */
const WAIT_TIE_WINDOW_MINUTES = 2;

/**
 * HYBRID only: flat priority boost for a player who hasn't played a single game yet
 * this session, so "hasn't played" always wins over "has played" regardless of who's
 * waited longer. Sized to outlast the wait-bucket term (weighted at 2,000/bucket) for
 * over 8 hours of continuous queueing — comfortably past any real session's length —
 * while staying below the consecutive-game limit penalty (1,000,000), so someone who
 * must sit out for pacing reasons is still deprioritised first (moot in practice: a
 * player with zero games played can never also be at the consecutive-game limit).
 * Once the never-played/has-played split is decided, ordering within each group falls
 * back to the normal wait-time-first, gentle-catch-up scoring below.
 */
const NEVER_PLAYED_PRIORITY_BOOST = 500_000;

/** A player's strength for matchmaking; missing or corrupt values count as an average 50. */
function strengthOf(p: QueuePlayer): number {
  return typeof p.winRate === "number" && Number.isFinite(p.winRate) ? p.winRate : 50;
}

/** Fixed origin for the wait-time slots (only differences between players matter). */
const WAIT_BUCKET_EPOCH_MS = Date.UTC(2024, 0, 1);

/** Per-player tiebreak that doesn't depend on who else is in the pool. With a shared random
 * sequence, any player joining or leaving re-rolled EVERY tiebreak, so players tied on wait
 * slot and games (e.g. the four who just came off the same court) swapped places in "up next"
 * whenever another court finished. Seeded by session + player id it stays put instead. */
export function stableTiebreak(seed: string, playerId: string): number {
  return seededRandom(`${seed}:${playerId}`)();
}

/**
 * Score a player for selection — lower is higher priority (will be selected first).
 * Each mode produces different weights.
 */
function playerScore(
  player: QueuePlayer,
  mode: QueueMode,
  maxConsecutiveGames: number,
  now: number,
  tiebreak: number
): number {
  // Bucket by WHEN the player joined the queue, not by how long ago that was. Counting
  // elapsed time ("waited 3m59s → bucket 1, 4m01s → bucket 2") lets two players' buckets
  // drift in and out of a tie as the clock ticks, so the "up next" preview reshuffled on
  // every poll with nothing actually happening. Fixed slots keep each player's bucket — and
  // so the whole order — constant until the pool itself changes. Larger = joined earlier.
  void now;
  const waitBucket = -Math.floor(
    (player.queueEnteredAt.getTime() - WAIT_BUCKET_EPOCH_MS) / (WAIT_TIE_WINDOW_MINUTES * 60_000)
  );

  // Consecutive game penalty: deprioritise if at/over limit (unless no alternatives)
  const consecutivePenalty = player.consecutiveGames >= maxConsecutiveGames ? 1_000_000 : 0;

  // Strength is deliberately NOT part of a player's queue score: who plays next depends
  // only on fairness (wait, games played, sat out), never on how good someone is.

  switch (mode) {
    case QueueMode.BALANCED:
      // Primary: fewest games; secondary: longest wait (bucketed); tertiary: most sat out; then random tiebreak
      return (
        consecutivePenalty +
        player.gamesPlayed * 10_000 +
        (-waitBucket) * 10 * WAIT_TIE_WINDOW_MINUTES +
        (-player.gamesSatOut) * 5 +
        tiebreak
      );

    case QueueMode.SMART:
      // Primary: longest wait (bucketed, no games-played factor); then most sat out
      return (
        consecutivePenalty +
        (-waitBucket) * 10_000 * WAIT_TIE_WINDOW_MINUTES +
        (-player.gamesSatOut) * 5 +
        tiebreak
      );

    case QueueMode.HYBRID:
    default: {
      // First-time priority: anyone with zero games played always outranks anyone who's
      // played at least once, no matter how long either has waited.
      const neverPlayedBoost = player.gamesPlayed === 0 ? -NEVER_PLAYED_PRIORITY_BOOST : 0;
      // Then: longest wait (bucketed); secondary: fewest games (gentle catch-up); tertiary: most sat out
      return (
        consecutivePenalty +
        neverPlayedBoost +
        (-waitBucket) * 1_000 * WAIT_TIE_WINDOW_MINUTES +
        player.gamesPlayed * 100 +
        (-player.gamesSatOut) * 10 +
        tiebreak
      );
    }
  }
}

// ---------------------------------------------------------------------------
// Player selection
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Shared-trio avoidance
// ---------------------------------------------------------------------------

type ScoredEntry =
  | { kind: "single"; player: QueuePlayer; score: number }
  | { kind: "pair"; players: [QueuePlayer, QueuePlayer]; score: number };

/** How many of the highest-priority entries (singles or fixed pairs) are considered when
 * looking for a foursome that avoids repeating a trio. Wide enough to find an alternative in
 * a real session, narrow enough that the search stays instant and fairness is barely touched. */
const TRIO_SEARCH_WIDTH = 14;

function tripleKey(a: string, b: string, c: string): string {
  return [a, b, c].sort().join(":");
}

function triplesOf(ids: string[]): string[] {
  const out: string[] = [];
  for (let i = 0; i < ids.length; i++)
    for (let j = i + 1; j < ids.length; j++)
      for (let k = j + 1; k < ids.length; k++) out.push(tripleKey(ids[i], ids[j], ids[k]));
  return out;
}

/** Every trio of players that has already shared a game, taken from the session's past
 * foursomes (pastGroups holds each one as sorted ids joined by ":"). */
function buildPastTriples(pastGroups: ReadonlySet<string> | undefined): Set<string> {
  const triples = new Set<string>();
  if (!pastGroups) return triples;
  for (const key of pastGroups) for (const t of triplesOf(key.split(":"))) triples.add(t);
  return triples;
}

/** How many of this foursome's four trios have already played together in an earlier game. */
function countRepeatedTriples(players: QueuePlayer[], pastTriples: ReadonlySet<string>): number {
  let n = 0;
  for (const t of triplesOf(players.map((p) => p.id))) if (pastTriples.has(t)) n++;
  return n;
}

/** How many "keep apart" groups this foursome breaks (two or more members of one group). */
function countKeepApartBreaches(
  players: QueuePlayer[],
  keepApart: ReadonlyArray<ReadonlyArray<string>> | undefined
): number {
  if (!keepApart || keepApart.length === 0) return 0;
  const ids = new Set(players.map((p) => p.id));
  let breaches = 0;
  for (const group of keepApart) {
    let inQuad = 0;
    for (const id of group) if (ids.has(id)) inQuad++;
    if (inQuad >= 2) breaches++;
  }
  return breaches;
}

/**
 * Finds the best foursome among the top-priority entries that doesn't reuse a trio from any
 * earlier game. Fixed pairs stay intact. Among foursomes with the fewest repeated trios (zero
 * whenever one exists) it picks the one closest to the normal priority order (lowest total
 * score). If no clean foursome exists (e.g. a small pool late in a long session) it returns
 * the least-repetitive option rather than blocking the game.
 */
function findFoursomeAvoidingRepeatedTrios(
  entries: ScoredEntry[],
  violationsOf: (players: QueuePlayer[]) => number,
  /** Optional second criterion, compared after violations and before the priority score
   * (used by "mix everyone" to prefer foursomes whose members have met the least). */
  secondaryOf: (players: QueuePlayer[]) => number = () => 0,
  /** Keep the first (highest-priority) entry in every candidate foursome, so a preference
   * can never push the person at the front of the queue back. */
  anchorFirst: boolean = false
): QueuePlayer[] | null {
  const candidates = entries.slice(0, TRIO_SEARCH_WIDTH);
  let best: { players: QueuePlayer[]; violations: number; secondary: number; score: number } | null = null;
  const chosen: ScoredEntry[] = [];

  function dfs(start: number, size: number, score: number) {
    if (size === 4) {
      const players = chosen.flatMap((e) => (e.kind === "pair" ? [...e.players] : [e.player]));
      const violations = violationsOf(players);
      const secondary = secondaryOf(players);
      const b = best as { violations: number; secondary: number; score: number } | null;
      if (
        !b ||
        violations < b.violations ||
        (violations === b.violations && secondary < b.secondary) ||
        (violations === b.violations && secondary === b.secondary && score < b.score)
      ) {
        best = { players, violations, secondary, score };
      }
      return;
    }
    for (let i = start; i < candidates.length; i++) {
      const e = candidates[i];
      const sz = e.kind === "pair" ? 2 : 1;
      if (size + sz > 4) continue;
      chosen.push(e);
      dfs(i + 1, size + sz, score + e.score);
      chosen.pop();
    }
  }
  if (anchorFirst && candidates.length > 0) {
    const first = candidates[0];
    chosen.push(first);
    dfs(1, first.kind === "pair" ? 2 : 1, first.score);
  } else {
    dfs(0, 0, 0);
  }

  return best ? (best as { players: QueuePlayer[] }).players : null;
}

/** How many games two players have already shared, as partners or opponents. */
function sharedGames(a: QueuePlayer, b: QueuePlayer): number {
  return historyCount(a.partnerHistory, b.id) + historyCount(a.opponentHistory, b.id);
}

/** Total shared games across the six pairings in a foursome — lower means fresher faces. */
function coPlayTotal(players: QueuePlayer[]): number {
  let total = 0;
  for (let i = 0; i < players.length; i++)
    for (let j = i + 1; j < players.length; j++) total += sharedGames(players[i], players[j]);
  return total;
}

function recentGamesOf(p: QueuePlayer): string[][] {
  return p.recentGames ?? (p.lastGameWith ? [p.lastGameWith] : []);
}

/** How many games in a row (counting back from their latest) these two have shared a court:
 * 0 = not in their last game, 1 = last game only, 2 = last two games, 3 = last three.
 * Fixed partners always count as 0 — they're meant to play together. */
function pairStreak(a: QueuePlayer, b: QueuePlayer): number {
  if (a.fixedPartnerId === b.id) return 0;
  const run = (from: QueuePlayer, other: string) => {
    let n = 0;
    for (const mates of recentGamesOf(from)) {
      if (!mates.includes(other)) break;
      n++;
    }
    return n;
  };
  return Math.max(run(a, b.id), run(b, a.id));
}

/** Cost of putting a pair together again, rising steeply with how long they've been stuck
 * together: once more after one game is mild, a third game running is almost never allowed. */
function streakCost(streak: number): number {
  if (streak <= 0) return 0;
  if (streak === 1) return 1_000;
  if (streak === 2) return 1_000_000;
  return 1_000_000_000;
}

/** Total streak cost over the foursome's six pairs. */
function pairStreakCost(players: QueuePlayer[]): number {
  let cost = 0;
  for (let i = 0; i < players.length; i++)
    for (let j = i + 1; j < players.length; j++) cost += streakCost(pairStreak(players[i], players[j]));
  return cost;
}

/** Only the pairs who'd be together for a THIRD game or more running. */
function longRunCost(players: QueuePlayer[]): number {
  let cost = 0;
  for (let i = 0; i < players.length; i++)
    for (let j = i + 1; j < players.length; j++) {
      const s = pairStreak(players[i], players[j]);
      if (s >= 2) cost += streakCost(s);
    }
  return cost;
}

/** How many of the foursome's pairs would be together for a THIRD game in a row (or more). */
function thirdInARowPairs(players: QueuePlayer[]): number {
  let n = 0;
  for (let i = 0; i < players.length; i++)
    for (let j = i + 1; j < players.length; j++) if (pairStreak(players[i], players[j]) >= 2) n++;
  return n;
}

/** Shared games across the foursome's pairs, ignoring fixed partners (they always play together). */
function coPlayExcludingFixed(players: QueuePlayer[]): number {
  let total = 0;
  for (let i = 0; i < players.length; i++)
    for (let j = i + 1; j < players.length; j++) {
      if (players[i].fixedPartnerId === players[j].id) continue;
      total += sharedGames(players[i], players[j]);
    }
  return total;
}

/**
 * "New faces" cost of a foursome — lower is fresher. A pair who'd be together for a third
 * game running is avoided above all, then a second game running, then the foursome whose
 * members have met least overall is preferred.
 */
function freshFacesCost(players: QueuePlayer[]): number {
  return pairStreakCost(players) + coPlayExcludingFixed(players);
}

/** How unfair it is to play `candidate` instead of the default `top` four: for every player
 * pushed out and every player brought in, the number of games the newcomer is ahead by (0 when
 * the newcomer hasn't played more). 0 = a fair swap (or no swap). Graded rather than yes/no, so
 * when the rules force SOME unfairness the queue still picks the least unfair option — e.g. one
 * 2-game player instead of three. */
function unfairSwapAgainst(top: QueuePlayer[], candidate: QueuePlayer[]): number {
  const topIds = new Set(top.map((p) => p.id));
  const ids = new Set(candidate.map((p) => p.id));
  const added = candidate.filter((p) => !topIds.has(p.id));
  const dropped = top.filter((p) => !ids.has(p.id));
  let games = 0;
  let wait = 0;
  for (const a of added)
    for (const d of dropped) {
      games += Math.max(0, a.gamesPlayed - d.gamesPlayed);
      // Waiting time: someone who joined the queue WAIT_JUMP_LIMIT_MINUTES or more after a
      // player may not push that player back — not for new faces, not for rank matching.
      const joinedLaterBy = (a.queueEnteredAt.getTime() - d.queueEnteredAt.getTime()) / 60_000;
      if (joinedLaterBy >= WAIT_JUMP_LIMIT_MINUTES) wait += 1;
    }
  // Games always outweigh waiting time: one game of unfairness (1000) beats any amount of
  // wait unfairness (at most 16 pairs).
  return games * 1000 + wait;
}

/** A player who joined the queue this many minutes (roughly one game) after someone else can
 * never take that person's spot, whatever new-faces or rank matching would prefer. */
const WAIT_JUMP_LIMIT_MINUTES = 8;

/** At most this many "catching-up" players (well behind on games, e.g. late arrivals) share a game,
 * so a group that arrives late is mixed in with everyone else instead of playing each other. */
const MAX_CATCH_UP_PER_GAME = 2;

/** A late group's very first game may hold 3 of them (with 1 regular): they've never played each
 * other yet, and it gets e.g. 6 newcomers on court in two games instead of three. From their
 * second game on, the cap of 2 applies. */
const NEWCOMER_FIRST_GAME_CAP = 3;

/** How many catching-up players this game may hold: 3 if none of them has played yet, else 2. */
function catchUpCap(catchingUp: QueuePlayer[]): number {
  return catchingUp.length > 0 && catchingUp.every((p) => p.gamesPlayed === 0)
    ? NEWCOMER_FIRST_GAME_CAP
    : MAX_CATCH_UP_PER_GAME;
}

/**
 * Players who are catching up: 2+ games behind most of the waiting pool (measured against the
 * 75th percentile, so a big late group can't drag the reference down), or with no games yet
 * while most others have played. Only in HYBRID — BALANCED
 * is strict "fewest games first", SMART is strict arrival order. Empty when there aren't enough
 * other players to mix them with.
 */
function catchingUpIds(pool: QueuePlayer[], mode: QueueMode): Set<string> {
  if (mode !== QueueMode.HYBRID || pool.length < 4) return new Set();
  const games = pool.map((p) => p.gamesPlayed).sort((a, b) => a - b);
  const reference = games[Math.floor(0.75 * (games.length - 1))];
  // 2+ games behind, or not played at all yet once others have: a group that checks in together
  // early in the night (when everyone else has 1 game) is mixed in from its very first game.
  // Newcomers: no games yet and checked in after someone else already finished a game, so the
  // players still waiting for their first game at the start of the night don't count. They're
  // only capped when there are more of them than one game can mix in.
  const firstBackAt = Math.min(
    ...pool.filter((p) => p.gamesPlayed > 0).map((p) => p.queueEnteredAt.getTime())
  );
  const isNewcomer = (p: QueuePlayer) => p.gamesPlayed === 0 && p.queueEnteredAt.getTime() > firstBackAt;
  const newcomerGroup = pool.filter(isNewcomer).length > MAX_CATCH_UP_PER_GAME;
  const behind = new Set(
    pool.filter((p) => p.gamesPlayed <= reference - 2 || (newcomerGroup && isNewcomer(p))).map((p) => p.id)
  );
  if (pool.length - behind.size < 4 - MAX_CATCH_UP_PER_GAME) return new Set();
  return behind;
}

/** Going over the catch-up cap outranks everything but the hard rules (keep-apart, trio). */
const CATCH_UP_OVER_CAP_WEIGHT = 1e10;
/** Two catching-up players meeting again weighs the same: a late group keeps meeting new faces. */
const CATCH_UP_REPLAY_WEIGHT = 1e10;

/** How badly a foursome bunches catching-up players: each one over the per-game cap, plus each
 * pair of them who have already played together (fixed partners excepted). 0 = well mixed. */
function catchUpBunching(players: QueuePlayer[], behind: ReadonlySet<string>): number {
  if (behind.size === 0) return 0;
  const inGame = players.filter((p) => behind.has(p.id));
  const overCap = Math.max(0, inGame.length - catchUpCap(inGame));
  let replays = 0;
  for (let i = 0; i < inGame.length; i++)
    for (let j = i + 1; j < inGame.length; j++) {
      if (inGame[i].fixedPartnerId === inGame[j].id) continue;
      if (sharedGames(inGame[i], inGame[j]) > 0) replays++;
    }
  return overCap * CATCH_UP_OVER_CAP_WEIGHT + replays * CATCH_UP_REPLAY_WEIGHT;
}

/** How far down the queue the new-faces preference may look: about the next three games' worth. */
const FRESH_FACES_SEARCH_WIDTH = 12;

/** The splits of a foursome into two pairs that keep every intact fixed pair together. */
function legalSplits(players: QueuePlayer[]): Array<{ teamA: PlayerPair; teamB: PlayerPair }> {
  const [p1, p2, p3, p4] = players;
  const allSplits: Array<{ teamA: PlayerPair; teamB: PlayerPair }> = [
    { teamA: [p1, p2], teamB: [p3, p4] },
    { teamA: [p1, p3], teamB: [p2, p4] },
    { teamA: [p1, p4], teamB: [p2, p3] },
  ];
  const ids = new Set(players.map((p) => p.id));
  const keepsFixedPairsTogether = (split: { teamA: PlayerPair; teamB: PlayerPair }) =>
    players.every((p) => {
      if (!p.fixedPartnerId || !ids.has(p.fixedPartnerId)) return true;
      const onTeamA = split.teamA.some((t) => t.id === p.id);
      const partnerOnTeamA = split.teamA.some((t) => t.id === p.fixedPartnerId);
      return onTeamA === partnerOnTeamA;
    });
  const constrained = allSplits.filter(keepsFixedPairsTogether);
  return constrained.length > 0 ? constrained : allSplits;
}

/** Fewest repeat partnerships any legal split of this foursome can manage (0, 1 or 2).
 * Fixed pairs are ignored: they're meant to partner every game. */
function minPartnerRepeats(players: QueuePlayer[]): number {
  let best = Infinity;
  for (const { teamA, teamB } of legalSplits(players)) {
    const repeats = (pair: PlayerPair) =>
      pair[0].fixedPartnerId === pair[1].id ? 0 : historyCount(pair[0].partnerHistory, pair[1].id);
    best = Math.min(best, repeats(teamA) + repeats(teamB));
  }
  return best;
}

function selectPlayers(
  eligible: QueuePlayer[],
  mode: QueueMode,
  maxConsecutiveGames: number,
  random: () => number,
  pastGroups?: ReadonlySet<string>,
  keepApart?: ReadonlyArray<ReadonlyArray<string>>,
  mixEveryone: boolean = false,
  rankMatchups: boolean = false,
  tiebreakSeed?: string
): { ok: true; selected: PlayerQuad } | { ok: false; reason: string } {
  if (eligible.length < 4) {
    return {
      ok: false,
      reason: `Need at least 4 eligible players (${eligible.length} available).`,
    };
  }

  const now = Date.now();

  // Score every eligible player individually first.
  const scoreById = new Map<string, number>();
  for (const p of eligible) {
    const tiebreak = tiebreakSeed !== undefined ? stableTiebreak(tiebreakSeed, p.id) : random();
    scoreById.set(p.id, playerScore(p, mode, maxConsecutiveGames, now, tiebreak));
  }

  // If everyone is at consecutive limit, ignore the penalty (not enough alts)
  const belowLimitIds = new Set(eligible.filter((p) => p.consecutiveGames < maxConsecutiveGames).map((p) => p.id));
  const pool = belowLimitIds.size >= 4 ? eligible.filter((p) => belowLimitIds.has(p.id)) : eligible;
  const poolIds = new Set(pool.map((p) => p.id));
  const byId = new Map(pool.map((p) => [p.id, p]));

  // Merge intact fixed pairs (both halves present in the pool) into single units, scored by
  // the WORSE of the two individual scores — so the pair's turn is set by whichever partner
  // is furthest from being due, and the pool is otherwise unaffected. A player whose fixed
  // partner isn't currently eligible is treated as an ordinary single.
  type Entry =
    | { kind: "single"; player: QueuePlayer; score: number }
    | { kind: "pair"; players: [QueuePlayer, QueuePlayer]; score: number };
  const entries: Entry[] = [];
  const consumed = new Set<string>();
  for (const player of pool) {
    if (consumed.has(player.id)) continue;
    const partnerId = player.fixedPartnerId;
    const partner = partnerId && poolIds.has(partnerId) && !consumed.has(partnerId) ? byId.get(partnerId) : undefined;
    if (partner) {
      const score = Math.max(scoreById.get(player.id)!, scoreById.get(partner.id)!);
      entries.push({ kind: "pair", players: [player, partner], score });
      consumed.add(player.id);
      consumed.add(partner.id);
    } else {
      entries.push({ kind: "single", player, score: scoreById.get(player.id)! });
      consumed.add(player.id);
    }
  }

  entries.sort((a, b) => a.score - b.score);

  const behind = catchingUpIds(pool, mode);
  const selectedList: QueuePlayer[] = [];
  const skipped: Entry[] = [];
  for (const entry of entries) {
    if (selectedList.length >= 4) break;
    const members = entry.kind === "pair" ? entry.players : [entry.player];
    // Catching-up players are mixed in, at most 2 per game (3 in a late group's first game).
    const behindHere = members.filter((p) => behind.has(p.id));
    const behindAfter = [...selectedList, ...members].filter((p) => behind.has(p.id));
    if (behindHere.length > 0 && behindAfter.length > catchUpCap(behindAfter)) {
      skipped.push(entry);
      continue;
    }
    if (entry.kind === "pair") {
      if (selectedList.length > 2) continue; // no room for both — leave the pair for next round
      selectedList.push(entry.players[0], entry.players[1]);
    } else {
      selectedList.push(entry.player);
    }
  }
  // Not enough others to mix with: fill up with the skipped catching-up players after all.
  for (const entry of skipped) {
    if (selectedList.length >= 4) break;
    if (entry.kind === "pair") {
      if (selectedList.length > 2) continue;
      selectedList.push(entry.players[0], entry.players[1]);
    } else selectedList.push(entry.player);
  }

  // Variety rules, applied when the priority order would break one:
  //  - Keep apart: groups the organiser asked to separate never share a game (any mode).
  //  - Trio rule: no three players may share a game twice, ever, in this session. Skipped
  //    for SMART (strict first-come-first-served), whose whole promise is a pure queue order.
  // Breaking a keep-apart group outweighs repeating a trio. If the pool is too small to
  // avoid everything, the least-bad foursome is used rather than blocking the game.
  if (selectedList.length >= 4) {
    const pastTriples = mode === QueueMode.SMART ? new Set<string>() : buildPastTriples(pastGroups);
    // Ranked: keep-apart breaches, then repeated trios, then partnerships that must repeat
    // (the foursome's best split still pairs two people who've already partnered). The last
    // one is skipped for SMART, whose promise is a pure queue order.
    const violationsOf = (players: QueuePlayer[]) =>
      countKeepApartBreaches(players, keepApart) * 1000 +
      countRepeatedTriples(players, pastTriples) * 10 +
      (mode === QueueMode.SMART ? 0 : minPartnerRepeats(players));
    if ((mixEveryone || rankMatchups) && mode !== QueueMode.SMART) {
      // Mix everyone: among players who aren't more than one game ahead of whoever has played
      // least (so nobody is starved or favoured), pick the foursome whose members have shared
      // the fewest games with each other, then the split with the fewest repeat partners.
      // Keep-apart and repeated trios still come first; the queue score breaks remaining ties.
      const minGames = Math.min(...pool.map((p) => p.gamesPlayed));
      let window = minGames + 1;
      let windowed = entries.filter((e) =>
        (e.kind === "pair" ? e.players : [e.player]).every((p) => p.gamesPlayed <= window)
      );
      const playersIn = (list: Entry[]) => list.reduce((n, e) => n + (e.kind === "pair" ? 2 : 1), 0);
      while (playersIn(windowed) < 8 && window < minGames + 50) {
        window += 1;
        windowed = entries.filter((e) =>
          (e.kind === "pair" ? e.players : [e.player]).every((p) => p.gamesPlayed <= window)
        );
      }
      // Same rule order as the default path: keep-apart, no repeated trio, then FAIRNESS against
      // the plain priority-order four (nobody may replace someone who has played fewer games),
      // then repeat partners. Without the fairness step, mixing let a fresh 2-game player jump a
      // 1-game player who'd waited far longer just because the latter had met the others.
      const mixDefaultTop = selectedList.slice(0, 4);
      const mixViolations = (players: QueuePlayer[]) =>
        countKeepApartBreaches(players, keepApart) * 1e15 +
        countRepeatedTriples(players, pastTriples) * 1e13 +
        unfairSwapAgainst(mixDefaultTop, players) * 100_000 +
        // Late arrivals catching up are mixed in, not grouped: above fair game counts (they're 2+
        // games behind by definition, so splitting them always "costs" games), below the trio rule.
        catchUpBunching(players, behind) +
        // Never a third game in a row for the same pair: worth giving up at most ONE game of
        // fairness (one game unit is 1e8), never more; above the 8-minute waiting rule.
        thirdInARowPairs(players) * 1.5e8 +
        minPartnerRepeats(players);
      // Standings rank among everyone eligible (1 = best): win rate, then games played.
      const rankOf = new Map<string, number>();
      [...eligible]
        .sort(
          (a, b) =>
            strengthOf(b) - strengthOf(a) ||
            b.gamesPlayed - a.gamesPlayed ||
            (a.id < b.id ? -1 : 1)
        )
        .forEach((p, i) => rankOf.set(p.id, i + 1));
      // Rank spread of a foursome: ranks 1-4 together = 3, the smallest possible.
      const rankSpread = (players: QueuePlayer[]) => {
        const r = players.map((p) => rankOf.get(p.id) ?? 0);
        return Math.max(...r) - Math.min(...r);
      };
      const mixSecondary = (players: QueuePlayer[]) =>
        pairStreakCost(players) * 1_000 +
        (mixEveryone ? coPlayTotal(players) * 100 : 0) +
        (rankMatchups ? rankSpread(players) : 0);
      // The front of the queue always keeps their spot, as in the default path.
      let mixed = findFoursomeAvoidingRepeatedTrios(windowed, mixViolations, mixSecondary, windowed[0] === entries[0]);
      if (mixed && countKeepApartBreaches(mixed, keepApart) > 0 && pool.length < eligible.length) {
        const inPool = new Set(pool.map((p) => p.id));
        const extras: ScoredEntry[] = eligible
          .filter((p) => !inPool.has(p.id) && !p.fixedPartnerId)
          .map((player) => ({ kind: "single" as const, player, score: scoreById.get(player.id)! }));
        const widened = [...windowed, ...extras].sort((a, b) => a.score - b.score);
        mixed = findFoursomeAvoidingRepeatedTrios(widened, mixViolations, mixSecondary) ?? mixed;
      }
      if (mixed) selectedList.splice(0, selectedList.length, ...mixed);
    } else {
      // The plain priority-order four — fairness is always judged against this.
      const defaultTop = selectedList.slice(0, 4);
      const pastTriplesForOrder = mode === QueueMode.SMART ? new Set<string>() : buildPastTriples(pastGroups);
      // Rule order: keep-apart groups, then no repeated trio, then FAIRNESS (nobody may replace
      // someone who has played fewer games than they have), then avoiding a repeat partnership.
      const orderedViolations = (players: QueuePlayer[]) =>
        countKeepApartBreaches(players, keepApart) * 1e15 +
        countRepeatedTriples(players, pastTriplesForOrder) * 1e13 +
        unfairSwapAgainst(defaultTop, players) * 100_000 +
        // Late arrivals catching up are mixed in, not grouped: above fair game counts (they're 2+
        // games behind by definition, so splitting them always "costs" games), below the trio rule.
        catchUpBunching(players, behind) +
        // Never a third game in a row for the same pair: worth giving up at most ONE game of
        // fairness (one game unit is 1e8), never more; above the 8-minute waiting rule. Not in strict SMART.
        (mode === QueueMode.SMART ? 0 : thirdInARowPairs(players) * 1.5e8) +
        (mode === QueueMode.SMART ? 0 : minPartnerRepeats(players));
      if (violationsOf(defaultTop) > 0) {
      // Without the fairness step, dodging a repeat partner could pull in a player two games
      // ahead of someone who'd waited longest.
      // Among equally good options, never keep a pair together for a third game running.
      let alternative = findFoursomeAvoidingRepeatedTrios(entries, orderedViolations, longRunCost);
      // A keep-apart group outranks the consecutive-game pacing limit: if the below-limit
      // pool can't avoid breaking one, widen the search to players who are over the limit.
      if (alternative && countKeepApartBreaches(alternative, keepApart) > 0 && pool.length < eligible.length) {
        const inPool = new Set(pool.map((p) => p.id));
        const extras: ScoredEntry[] = eligible
          .filter((p) => !inPool.has(p.id) && !p.fixedPartnerId)
          .map((player) => ({ kind: "single" as const, player, score: scoreById.get(player.id)! }));
        const widened = [...entries, ...extras].sort((a, b) => a.score - b.score);
        alternative = findFoursomeAvoidingRepeatedTrios(widened, orderedViolations, longRunCost) ?? alternative;
      }
      if (alternative) selectedList.splice(0, selectedList.length, ...alternative);
      }
      // Runs after the rule fix above too. Players who finish a game rejoin the queue at the
      // same moment, so the default four is often three or four people off the same court —
      // the trio rule splits them up, but that alone happily leaves two of them together.
      if (mode !== QueueMode.SMART && freshFacesCost(selectedList.slice(0, 4)) > 0) {
      // New faces: some of the four have already shared a court — maybe in their very last
      // game. Look a little further down the queue for a
      // fresher four, with three fairness guards:
      //   - only the next two games' worth of players (FRESH_FACES_SEARCH_WIDTH) are considered;
      //   - nobody may replace someone who has played fewer games than they have;
      //   - the person at the front of the queue always keeps their spot.
      // If nothing fresher exists (small groups), the default four play as normal.
      const top = selectedList.slice(0, 4);
      const maxGames = Math.max(...top.map((p) => p.gamesPlayed));
      const membersOf = (e: Entry) => (e.kind === "pair" ? e.players : [e.player]);
      const candidates = entries
        .filter((e) => membersOf(e).every((p) => p.gamesPlayed <= maxGames))
        .slice(0, FRESH_FACES_SEARCH_WIDTH);
      // Same rule order as above, fairness judged against the ORIGINAL priority-order four —
      // so new faces can never make the game less fair than the rules already forced.
      const fresher = findFoursomeAvoidingRepeatedTrios(candidates, orderedViolations, freshFacesCost, true);
      const better =
        fresher &&
        (orderedViolations(fresher) < orderedViolations(top) ||
          (orderedViolations(fresher) === orderedViolations(top) && freshFacesCost(fresher) < freshFacesCost(top)));
      if (fresher && better) {
        selectedList.splice(0, selectedList.length, ...fresher);
      }
      }
    }
  }

  // Order the final foursome by individual priority for a sensible "up next" display —
  // this is cosmetic only and doesn't affect who was selected or how teams get assigned.
  let selected = selectedList
    .slice(0, 4)
    .sort((a, b) => (scoreById.get(a.id) ?? 0) - (scoreById.get(b.id) ?? 0)) as PlayerQuad;

  // HARD RULE: Don't allow the same exact group of 4 to be drawn consecutively
  if (pastGroups && pastGroups.has(groupKey(selected)) && eligible.length >= 5) {
    const selectedIds = new Set(selected.map((p) => p.id));
    // Only swap out a player who isn't half of an intact fixed pair in this selection —
    // breaking up a fixed partnership to dodge a repeat group would defeat the point of it.
    let swapIndex = -1;
    for (let i = selected.length - 1; i >= 0; i--) {
      const candidate = selected[i];
      const paired = Boolean(candidate.fixedPartnerId && selectedIds.has(candidate.fixedPartnerId));
      if (!paired) {
        swapIndex = i;
        break;
      }
    }
    if (swapIndex !== -1) {
      for (const entry of entries) {
        if (entry.kind !== "single") continue; // keep it simple: don't swap in a pair here
        if (selectedIds.has(entry.player.id)) continue;
        const newGroup = [...selected] as PlayerQuad;
        newGroup[swapIndex] = entry.player;
        if (
          !pastGroups.has(groupKey(newGroup)) &&
          countKeepApartBreaches(newGroup, keepApart) <= countKeepApartBreaches(selected, keepApart)
        ) {
          selected = newGroup;
          break;
        }
      }
    }
  }

  return { ok: true, selected };
}

/**
 * Returns the FULL eligible pool in the order players would actually be picked,
 * by repeatedly simulating `selectPlayers` in groups of 4 (mirroring the
 * consecutive-game and sat-out resets a real sequence of court fills would apply)
 * and appending any remainder (fewer than 4 left) in plain score order.
 *
 * This is the single source of truth for "who's up next" — used both to preview
 * the queue for organisers and, indirectly, by `generateNextGame` — so the
 * preview can never drift from what a real court fill would actually select.
 */
export function rankQueue(
  eligible: QueuePlayer[],
  options: QueueEngineOptions = {}
): QueuePlayer[] {
  const {
    mode = QueueMode.HYBRID,
    maxConsecutiveGames = 2,
    pastGroups = new Set(),
    keepApart,
    mixEveryone = false,
    rankMatchups = false,
    random = Math.random,
    tiebreakSeed,
  } = options;

  let pool = [...eligible];
  const groups = new Set(pastGroups);
  const ordered: QueuePlayer[] = [];

  while (pool.length >= 4) {
    const selection = selectPlayers(pool, mode, maxConsecutiveGames, random, groups, keepApart, mixEveryone, rankMatchups, tiebreakSeed);
    if (!selection.ok) break;

    const selectedIds = new Set(selection.selected.map((p) => p.id));
    groups.add(groupKey(selection.selected));
    ordered.push(...selection.selected);

    // Simulate the sat-out reset `generateNextGame` applies to everyone else
    // eligible for that round, so the next simulated round scores them fairly.
    pool = pool
      .filter((p) => !selectedIds.has(p.id))
      .map((p) => ({ ...p, consecutiveGames: 0 }));
  }

  if (pool.length > 0) {
    const now = Date.now();
    const scored = pool.map((p) => ({
      player: p,
      score: playerScore(
        p,
        mode,
        maxConsecutiveGames,
        now,
        tiebreakSeed !== undefined ? stableTiebreak(tiebreakSeed, p.id) : random()
      ),
    }));
    scored.sort((a, b) => a.score - b.score);
    ordered.push(...scored.map((s) => s.player));
  }

  return ordered;
}

// ---------------------------------------------------------------------------
// Team assignment
// ---------------------------------------------------------------------------

function assignTeams(
  selected: PlayerQuad,
  pastGroups: ReadonlySet<string>,
  random: () => number,
  randomizeTeams: boolean = false,
  balanceTeams: boolean = false
): TeamAssignment {
  // The split depends only on WHO the four are, never on the rest of the pool or the order
  // they were picked in. Otherwise the "up next" preview (made while the court is still busy)
  // and the real fill (made once finished players are back in the pool) can disagree on
  // partners even for the very same four. Ties are broken by a PRNG seeded from the four ids.
  const players = [...selected].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)) as PlayerQuad;
  if (!randomizeTeams) random = seededRandom(players.map((p) => p.id).join(","));
  const splits = legalSplits(players);

  // If randomizeTeams is true, just pick a random split
  if (randomizeTeams) {
    const randomSplit = splits[Math.floor(random() * splits.length)];
    return { teamA: randomSplit.teamA, teamB: randomSplit.teamB, score: 0 };
  }

  // Otherwise, use smart matching to minimize repeats
  const scored = splits.map((split) => {
    const [a1, a2] = split.teamA;
    const [b1, b2] = split.teamB;

    const partnerRepeats =
      historyCount(a1.partnerHistory, a2.id) +
      historyCount(b1.partnerHistory, b2.id);

    const opponentRepeats =
      historyCount(a1.opponentHistory, b1.id) +
      historyCount(a1.opponentHistory, b2.id) +
      historyCount(a2.opponentHistory, b1.id) +
      historyCount(a2.opponentHistory, b2.id);

    const groupRepeat = pastGroups.has(groupKey(players)) ? 1 : 0;

    // Balanced teams (and rank matchups): make the two teams' combined strength as even as
    // possible — usually best + weakest vs the two middle players. Weighted so a clearly
    // lopsided split (every 5 points of combined-strength gap = 1) outweighs a few repeat
    // opponents, while avoiding a repeat partnership still comes first.
    const strength = (t: QueuePlayer[]) => t.reduce((n, p) => n + strengthOf(p), 0);
    const imbalance = balanceTeams ? Math.abs(strength(split.teamA) - strength(split.teamB)) / 5 : 0;

    const score = partnerRepeats * 100 + groupRepeat * 25 + imbalance + opponentRepeats;

    return { split, score, tiebreak: random() };
  });

  scored.sort((a, b) => (a.score !== b.score ? a.score - b.score : a.tiebreak - b.tiebreak));
  const best = scored[0];

  return { teamA: best.split.teamA, teamB: best.split.teamB, score: best.score };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export interface QueueEngineOptions {
  mode?: QueueMode;
  maxConsecutiveGames?: number;
  pastGroups?: ReadonlySet<string>;
  /** Groups of player ids the organiser asked to keep out of the same game. */
  keepApart?: ReadonlyArray<ReadonlyArray<string>>;
  /** Prefer foursomes whose players have shared the fewest games (within a fairness window). */
  mixEveryone?: boolean;
  /** Put players with similar standings in the same game, as opponents. */
  rankMatchups?: boolean;
  /** Split each foursome into the two most evenly matched teams by strength. Implied by rankMatchups. */
  balanceTeams?: boolean;
  /** When set, each player's tiebreak is fixed per (seed, player) instead of drawn from
   * `random`, so the queue order doesn't reshuffle whenever someone joins or leaves. */
  tiebreakSeed?: string;
  random?: () => number;
  randomizeTeams?: boolean;
}

export function generateNextGame(
  eligible: QueuePlayer[],
  options: QueueEngineOptions = {}
): QueueResult {
  const {
    mode = QueueMode.HYBRID,
    maxConsecutiveGames = 2,
    pastGroups = new Set(),
    keepApart,
    mixEveryone = false,
    rankMatchups = false,
    balanceTeams = false,
    tiebreakSeed,
    random = Math.random,
    // Team splits always minimize repeat partners/opponents by default, in every mode
    // (including HYBRID) — the queue-selection logic above already varies who gets picked
    // next, so there's no need to also randomize who partners whom once a foursome is
    // chosen. A caller can still opt into pure-random splits by passing randomizeTeams: true
    // explicitly, but nothing does that today.
    randomizeTeams = false,
  } = options;

  const selection = selectPlayers(eligible, mode, maxConsecutiveGames, random, pastGroups, keepApart, mixEveryone, rankMatchups, tiebreakSeed);
  if (!selection.ok) return selection;

  const { teamA, teamB } = assignTeams(
    selection.selected,
    pastGroups,
    random,
    randomizeTeams,
    balanceTeams || rankMatchups
  );

  return { ok: true, selected: selection.selected, teamA, teamB };
}

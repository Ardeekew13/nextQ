/**
 * QueueEngine — mode-aware player selection for next game generation.
 *
 * Three modes:
 *   BALANCED — equal games for everyone; late arrivals catch up fast.
 *   SMART    — strict queue order by wait time; no catch-up.
 *   HYBRID   — default; wait-time first, gentle catch-up, consecutive game protection.
 *
 * Pure functions with no DB dependency so they can be unit-tested in isolation.
 */

import { QueueMode } from "@/types/enums";

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
  /** Win rate 0-100. Used only as a tiebreak among players who've waited a similar amount of time. */
  winRate?: number;
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
 * "waited a similar amount of time" for the win-rate tiebreak below. Wait time still
 * rules the queue at a coarser (bucketed) granularity — this window only decides who
 * wins among players who are roughly equally deserving of the next spot.
 */
const WAIT_TIE_WINDOW_MINUTES = 2;

/**
 * Weight applied to win rate (0-100) as a tiebreak. Kept smaller than every mode's
 * per-wait-bucket step so it can never override a genuine wait-time advantage, but
 * larger than the gamesSatOut nudge so a clear win-rate edge still wins ties.
 */
const WIN_RATE_TIEBREAK_WEIGHT = 0.15;

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
  const waitMs = now - player.queueEnteredAt.getTime();
  const waitMinutes = waitMs / 60_000;
  const waitBucket = Math.floor(waitMinutes / WAIT_TIE_WINDOW_MINUTES);

  // Consecutive game penalty: deprioritise if at/over limit (unless no alternatives)
  const consecutivePenalty = player.consecutiveGames >= maxConsecutiveGames ? 1_000_000 : 0;

  // Among players who've waited a similar amount of time, prefer the higher win rate.
  const winRateTiebreak = -(player.winRate ?? 0) * WIN_RATE_TIEBREAK_WEIGHT;

  switch (mode) {
    case QueueMode.BALANCED:
      // Primary: fewest games; secondary: longest wait (bucketed); then win rate; tertiary: most sat out; then tiebreak
      return (
        consecutivePenalty +
        player.gamesPlayed * 10_000 +
        (-waitBucket) * 10 * WAIT_TIE_WINDOW_MINUTES +
        winRateTiebreak +
        (-player.gamesSatOut) * 5 +
        tiebreak
      );

    case QueueMode.SMART:
      // Primary: longest wait (bucketed, no games-played factor); then win rate
      return (
        consecutivePenalty +
        (-waitBucket) * 10_000 * WAIT_TIE_WINDOW_MINUTES +
        winRateTiebreak +
        (-player.gamesSatOut) * 5 +
        tiebreak
      );

    case QueueMode.HYBRID:
    default:
      // Primary: longest wait (bucketed); secondary: fewest games (gentle catch-up); then win rate; tertiary: most sat out
      return (
        consecutivePenalty +
        (-waitBucket) * 1_000 * WAIT_TIE_WINDOW_MINUTES +
        player.gamesPlayed * 100 +
        winRateTiebreak +
        (-player.gamesSatOut) * 10 +
        tiebreak
      );
  }
}

// ---------------------------------------------------------------------------
// Player selection
// ---------------------------------------------------------------------------

function selectPlayers(
  eligible: QueuePlayer[],
  mode: QueueMode,
  maxConsecutiveGames: number,
  random: () => number,
  pastGroups?: ReadonlySet<string>
): { ok: true; selected: PlayerQuad } | { ok: false; reason: string } {
  if (eligible.length < 4) {
    return {
      ok: false,
      reason: `Need at least 4 eligible players (${eligible.length} available).`,
    };
  }

  const now = Date.now();

  // Score all players
  const scored = eligible.map((p) => ({
    player: p,
    score: playerScore(p, mode, maxConsecutiveGames, now, random()),
  }));

  // If everyone is at consecutive limit, ignore the penalty (not enough alts)
  const belowLimit = scored.filter((s) => s.player.consecutiveGames < maxConsecutiveGames);
  const pool = belowLimit.length >= 4 ? belowLimit : scored;

  pool.sort((a, b) => a.score - b.score);
  let selected = pool.slice(0, 4).map((s) => s.player) as PlayerQuad;

  // HARD RULE: Don't allow the same exact group of 4 to be drawn consecutively
  if (pastGroups && pastGroups.has(groupKey(selected)) && eligible.length >= 5) {
    // Try to swap one player to break the group
    for (let i = 4; i < pool.length; i++) {
      const candidate = pool[i].player;
      const newGroup = [selected[0], selected[1], selected[2], candidate] as PlayerQuad;
      if (!pastGroups.has(groupKey(newGroup))) {
        selected = newGroup;
        break;
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
    random = Math.random,
  } = options;

  let pool = [...eligible];
  const groups = new Set(pastGroups);
  const ordered: QueuePlayer[] = [];

  while (pool.length >= 4) {
    const selection = selectPlayers(pool, mode, maxConsecutiveGames, random, groups);
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
      score: playerScore(p, mode, maxConsecutiveGames, now, random()),
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
  players: PlayerQuad,
  pastGroups: ReadonlySet<string>,
  random: () => number,
  randomizeTeams: boolean = false
): TeamAssignment {
  const [p1, p2, p3, p4] = players;

  const splits: Array<{ teamA: PlayerPair; teamB: PlayerPair }> = [
    { teamA: [p1, p2], teamB: [p3, p4] },
    { teamA: [p1, p3], teamB: [p2, p4] },
    { teamA: [p1, p4], teamB: [p2, p3] },
  ];

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

    const score = partnerRepeats * 100 + groupRepeat * 25 + opponentRepeats;

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
    random = Math.random,
    randomizeTeams = mode === QueueMode.HYBRID,
  } = options;

  const selection = selectPlayers(eligible, mode, maxConsecutiveGames, random, pastGroups);
  if (!selection.ok) return selection;

  const { teamA, teamB } = assignTeams(selection.selected, pastGroups, random, randomizeTeams);

  return { ok: true, selected: selection.selected, teamA, teamB };
}

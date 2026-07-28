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

  // Consecutive game penalty: deprioritise if at/over limit (unless no alternatives)
  const consecutivePenalty = player.consecutiveGames >= maxConsecutiveGames ? 1_000_000 : 0;

  switch (mode) {
    case QueueMode.BALANCED:
      // Primary: fewest games; secondary: longest wait; tertiary: most sat out; then tiebreak
      return (
        consecutivePenalty +
        player.gamesPlayed * 10_000 +
        (-waitMinutes) * 10 +
        (-player.gamesSatOut) * 5 +
        tiebreak
      );

    case QueueMode.SMART:
      // Primary: longest wait (no games-played factor)
      return (
        consecutivePenalty +
        (-waitMinutes) * 10_000 +
        (-player.gamesSatOut) * 5 +
        tiebreak
      );

    case QueueMode.HYBRID:
    default:
      // Primary: longest wait; secondary: fewest games (gentle catch-up); tertiary: most sat out
      return (
        consecutivePenalty +
        (-waitMinutes) * 1_000 +
        player.gamesPlayed * 100 +
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
  random: () => number
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
  const selected = pool.slice(0, 4).map((s) => s.player) as PlayerQuad;

  return { ok: true, selected };
}

// ---------------------------------------------------------------------------
// Team assignment
// ---------------------------------------------------------------------------

function assignTeams(
  players: PlayerQuad,
  pastGroups: ReadonlySet<string>,
  random: () => number
): TeamAssignment {
  const [p1, p2, p3, p4] = players;

  const splits: Array<{ teamA: PlayerPair; teamB: PlayerPair }> = [
    { teamA: [p1, p2], teamB: [p3, p4] },
    { teamA: [p1, p3], teamB: [p2, p4] },
    { teamA: [p1, p4], teamB: [p2, p3] },
  ];

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
  } = options;

  const selection = selectPlayers(eligible, mode, maxConsecutiveGames, random);
  if (!selection.ok) return selection;

  const { teamA, teamB } = assignTeams(selection.selected, pastGroups, random);

  return { ok: true, selected: selection.selected, teamA, teamB };
}

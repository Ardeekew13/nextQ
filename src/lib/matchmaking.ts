/**
 * Core random queueing / match generation algorithm.
 *
 * Pure functions with no DB or GraphQL dependency, so they can be unit
 * tested in isolation and reused by the `generateNextGame` resolver.
 */

export interface MatchPlayer {
  id: string;
  gamesPlayed: number;
  queueEnteredAt: Date;
  gamesSatOut: number;
  /** playerId (string) -> number of times partnered together */
  partnerHistory: Record<string, number>;
  /** playerId (string) -> number of times faced as opponents */
  opponentHistory: Record<string, number>;
}

export type PlayerQuad = [MatchPlayer, MatchPlayer, MatchPlayer, MatchPlayer];
export type PlayerPair = [MatchPlayer, MatchPlayer];

export type SelectionResult =
  | { ok: true; selected: PlayerQuad }
  | { ok: false; reason: string };

export interface TeamAssignment {
  teamA: PlayerPair;
  teamB: PlayerPair;
  /** Lower is better; combines partner-repeat, group-repeat and opponent-repeat penalties. */
  score: number;
}

/**
 * Selects four players from the eligible pool, prioritising (in order):
 *  1. Fewest games played
 *  2. Longest wait (earliest queueEnteredAt)
 *  3. Most games sat out
 *  4. Random tiebreak
 *
 * Callers are expected to have already filtered the pool down to players who
 * are checked in, active, and not currently assigned to a court.
 */
export function selectEligiblePlayers(
  eligible: MatchPlayer[],
  random: () => number = Math.random
): SelectionResult {
  if (eligible.length < 4) {
    return {
      ok: false,
      reason: `Need at least 4 eligible players to start a game (${eligible.length} available).`,
    };
  }

  const withTiebreak = eligible.map((player) => ({ player, tiebreak: random() }));

  withTiebreak.sort((a, b) => {
    if (a.player.gamesPlayed !== b.player.gamesPlayed) {
      return a.player.gamesPlayed - b.player.gamesPlayed;
    }
    const waitDiff = a.player.queueEnteredAt.getTime() - b.player.queueEnteredAt.getTime();
    if (waitDiff !== 0) return waitDiff;
    if (a.player.gamesSatOut !== b.player.gamesSatOut) {
      return b.player.gamesSatOut - a.player.gamesSatOut;
    }
    return a.tiebreak - b.tiebreak;
  });

  const selected = withTiebreak.slice(0, 4).map((entry) => entry.player) as PlayerQuad;
  return { ok: true, selected };
}

function pairKey(a: MatchPlayer, b: MatchPlayer): [string, string] {
  return a.id < b.id ? [a.id, b.id] : [b.id, a.id];
}

function historyCount(history: Record<string, number>, otherId: string): number {
  return history[otherId] ?? 0;
}

function groupKey(players: PlayerQuad): string {
  return [...players.map((p) => p.id)].sort().join(":");
}

/**
 * Given four selected players, choose which two face which two so that
 * repeated partnerships/opponents/groups are avoided as much as possible.
 *
 * Tries all three ways to split four players into two teams of two, scores
 * each option, and picks the lowest-scoring option (ties broken randomly).
 * Falls back gracefully - if every option repeats a prior pairing, the
 * least-bad (lowest score) option is still returned so a game can always be
 * generated.
 */
export function assignTeams(
  players: PlayerQuad,
  pastGroups: ReadonlySet<string> = new Set(),
  random: () => number = Math.random
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

    const [pa1, pa2] = pairKey(a1, a2);
    const [pb1, pb2] = pairKey(b1, b2);

    const partnerRepeats =
      historyCount(a1.partnerHistory, pa1 === a1.id ? pa2 : pa1) +
      historyCount(b1.partnerHistory, pb1 === b1.id ? pb2 : pb1);

    const opponentRepeats =
      historyCount(a1.opponentHistory, b1.id) +
      historyCount(a1.opponentHistory, b2.id) +
      historyCount(a2.opponentHistory, b1.id) +
      historyCount(a2.opponentHistory, b2.id);

    const groupRepeat = pastGroups.has(groupKey(players)) ? 1 : 0;

    // Weighted so avoiding a repeat partner matters most, then repeat group,
    // then repeat opponents, matching the priority order in the spec.
    const score = partnerRepeats * 100 + groupRepeat * 25 + opponentRepeats * 1;

    return { split, score, tiebreak: random() };
  });

  scored.sort((a, b) => (a.score !== b.score ? a.score - b.score : a.tiebreak - b.tiebreak));

  const best = scored[0];
  return { teamA: best.split.teamA, teamB: best.split.teamB, score: best.score };
}

export interface GenerateGameResult {
  ok: boolean;
  reason?: string;
  selected?: PlayerQuad;
  teamA?: PlayerPair;
  teamB?: PlayerPair;
}

/** Convenience wrapper combining selection + team assignment for the resolver layer. */
export function generateGame(
  eligible: MatchPlayer[],
  pastGroups: ReadonlySet<string> = new Set(),
  random: () => number = Math.random,
  pairingMode: "SMART" | "RANDOM" = "SMART"
): GenerateGameResult {
  if (pairingMode === "RANDOM") {
    // Pure random: shuffle then pick first 4, assign teams randomly
    if (eligible.length < 4) {
      return { ok: false, reason: `Need at least 4 eligible players (${eligible.length} available).` };
    }
    const shuffled = [...eligible].sort(() => random() - 0.5) as MatchPlayer[];
    const selected = shuffled.slice(0, 4) as PlayerQuad;
    const { teamA, teamB } = assignTeams(selected, new Set(), random); // ignore history for random
    return { ok: true, selected, teamA, teamB };
  }

  const selection = selectEligiblePlayers(eligible, random);
  if (!selection.ok) return { ok: false, reason: selection.reason };

  const { teamA, teamB } = assignTeams(selection.selected, pastGroups, random);
  return { ok: true, selected: selection.selected, teamA, teamB };
}

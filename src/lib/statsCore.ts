/**
 * Pure statistics accumulation core, with no DB dependency.
 *
 * Kept separate from stats.ts (which handles fetching from and writing back
 * to MongoDB) so the actual win/loss/streak/history math can be unit tested
 * directly, and so `rebuildSessionStatistics` and any future recalculation
 * entry point share exactly one implementation.
 */

export interface CompletedGameLike {
  teamAPlayerIds: string[];
  teamBPlayerIds: string[];
  winningTeam: "A" | "B";
  playersSatOutIds?: string[];
}

export interface PlayerStatsResult {
  gamesPlayed: number;
  wins: number;
  losses: number;
  currentStreak: number;
  longestWinStreak: number;
  gamesSatOut: number;
  partnerHistory: Record<string, number>;
  opponentHistory: Record<string, number>;
}

function emptyResult(): PlayerStatsResult & {
  partnerHistoryMap: Map<string, number>;
  opponentHistoryMap: Map<string, number>;
} {
  return {
    gamesPlayed: 0,
    wins: 0,
    losses: 0,
    currentStreak: 0,
    longestWinStreak: 0,
    gamesSatOut: 0,
    partnerHistory: {},
    opponentHistory: {},
    partnerHistoryMap: new Map(),
    opponentHistoryMap: new Map(),
  };
}

function bump(map: Map<string, number>, key: string) {
  map.set(key, (map.get(key) ?? 0) + 1);
}

/**
 * Computes fresh statistics for every player id in `playerIds` from
 * `completedGames`, which must already be in chronological order (oldest
 * first) - streaks and history are order-dependent.
 */
export function computePlayerStatistics(
  playerIds: string[],
  completedGames: CompletedGameLike[]
): Map<string, PlayerStatsResult> {
  const accumulators = new Map(playerIds.map((id) => [id, emptyResult()]));

  for (const game of completedGames) {
    const teamAWon = game.winningTeam === "A";

    const applyTeam = (teamIds: string[], opponentIds: string[], won: boolean) => {
      for (const playerId of teamIds) {
        const acc = accumulators.get(playerId);
        if (!acc) continue;

        acc.gamesPlayed += 1;

        if (won) {
          acc.wins += 1;
          acc.currentStreak = acc.currentStreak >= 0 ? acc.currentStreak + 1 : 1;
          acc.longestWinStreak = Math.max(acc.longestWinStreak, acc.currentStreak);
        } else {
          acc.losses += 1;
          acc.currentStreak = acc.currentStreak <= 0 ? acc.currentStreak - 1 : -1;
        }

        for (const teammateId of teamIds) {
          if (teammateId !== playerId) bump(acc.partnerHistoryMap, teammateId);
        }
        for (const opponentId of opponentIds) {
          bump(acc.opponentHistoryMap, opponentId);
        }
      }
    };

    applyTeam(game.teamAPlayerIds, game.teamBPlayerIds, teamAWon);
    applyTeam(game.teamBPlayerIds, game.teamAPlayerIds, !teamAWon);

    for (const satOutId of game.playersSatOutIds ?? []) {
      const acc = accumulators.get(satOutId);
      if (acc) acc.gamesSatOut += 1;
    }
  }

  const results = new Map<string, PlayerStatsResult>();
  for (const [id, acc] of accumulators) {
    results.set(id, {
      gamesPlayed: acc.gamesPlayed,
      wins: acc.wins,
      losses: acc.losses,
      currentStreak: acc.currentStreak,
      longestWinStreak: acc.longestWinStreak,
      gamesSatOut: acc.gamesSatOut,
      partnerHistory: Object.fromEntries(acc.partnerHistoryMap),
      opponentHistory: Object.fromEntries(acc.opponentHistoryMap),
    });
  }
  return results;
}

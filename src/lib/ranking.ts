import type { RankingCriterion } from "@/types/enums";

export interface StandingsInput {
  id: string;
  name: string;
  gamesPlayed: number;
  wins: number;
  losses: number;
  currentStreak: number;
  longestWinStreak: number;
  gamesSatOut: number;
  checkedInAt: Date | null;
}

export interface StandingsEntry extends StandingsInput {
  winRate: number;
  rank: number;
}

function winRateOf(player: StandingsInput): number {
  return player.gamesPlayed === 0 ? 0 : (player.wins / player.gamesPlayed) * 100;
}

/** Returns a comparator that sorts "best first" according to the configured ranking order. */
function compareByCriteria(order: RankingCriterion[]) {
  return (a: StandingsInput, b: StandingsInput): number => {
    for (const criterion of order) {
      let diff = 0;
      switch (criterion) {
        case "WINS":
          diff = b.wins - a.wins;
          break;
        case "WIN_RATE":
          diff = winRateOf(b) - winRateOf(a);
          break;
        case "POINT_DIFFERENTIAL":
          diff = 0; // no longer tracked
          break;
        case "POINTS_SCORED":
          diff = 0; // no longer tracked
          break;
        case "FEWEST_LOSSES":
          diff = a.losses - b.losses;
          break;
        case "EARLIEST_CHECK_IN": {
          const aTime = a.checkedInAt ? a.checkedInAt.getTime() : Number.POSITIVE_INFINITY;
          const bTime = b.checkedInAt ? b.checkedInAt.getTime() : Number.POSITIVE_INFINITY;
          diff = aTime - bTime;
          break;
        }
      }
      if (Math.abs(diff) > 1e-9) return diff;
    }
    return 0;
  };
}

/**
 * Ranks players using the session's configured ranking order.
 * Uses standard competition ranking: tied players share a rank, and the next
 * rank skips (e.g. 1, 1, 3, 4).
 */
export function computeStandings(
  players: StandingsInput[],
  rankingOrder: RankingCriterion[]
): StandingsEntry[] {
  const compare = compareByCriteria(rankingOrder);
  const sorted = [...players].sort(compare);

  const entries: StandingsEntry[] = [];
  sorted.forEach((player, index) => {
    const winRate = winRateOf(player);
    let rank: number;
    if (index === 0) {
      rank = 1;
    } else {
      const previous = sorted[index - 1];
      rank = compare(player, previous) === 0 ? entries[index - 1].rank : index + 1;
    }
    entries.push({ ...player, winRate, rank });
  });

  return entries;
}

export interface PodiumEntry extends StandingsEntry {
  position: 1 | 2 | 3;
}

/**
 * Returns the podium: every player whose rank is 1, 2 or 3.
 * Ties can mean more than three players are returned (e.g. two players tied
 * for first plus one for third).
 * Players who haven't completed a game are excluded.
 */
export function computePodium(standings: StandingsEntry[]): PodiumEntry[] {
  return standings
    .filter((entry) => entry.gamesPlayed > 0 && entry.rank <= 3)
    .map((entry) => ({ ...entry, position: entry.rank as 1 | 2 | 3 }));
}

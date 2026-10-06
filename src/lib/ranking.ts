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

/**
 * Compares two players using only the session's actual configured criteria —
 * no arbitrary fallback. Returns 0 when every real criterion is genuinely tied.
 * This is what tie-detection (findFirstPlaceTie) uses, since it needs to know
 * about real ties before the id-based safety net below papers over them.
 */
function realCompare(order: RankingCriterion[]) {
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

/** Returns a comparator that sorts "best first" according to the configured ranking order. */
function compareByCriteria(order: RankingCriterion[]) {
  const real = realCompare(order);
  return (a: StandingsInput, b: StandingsInput): number => {
    const diff = real(a, b);
    if (diff !== 0) return diff;
    // Every configured criterion tied (including the astronomically-rare case of
    // identical check-in timestamps). Fall back to the player's id so standings
    // NEVER share a rank — there's always exactly one player in 1st place, which
    // matters when a prize is on the line. This is an arbitrary last resort, not
    // a meaningful tiebreak, so it only kicks in once every real criterion agrees.
    if (a.id === b.id) return 0;
    return a.id < b.id ? -1 : 1;
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

/**
 * Players who are genuinely tied for 1st place using the session's real
 * ranking criteria (ignoring the arbitrary id-based tiebreak that
 * computeStandings applies just to keep ranks unique). Returns an empty
 * array when there's a clear, uncontested #1. When it returns 2+ players,
 * the organiser should have them play each other to decide who actually
 * takes 1st — useful when a prize is riding on the outcome.
 */
export function findFirstPlaceTie(
  players: StandingsInput[],
  rankingOrder: RankingCriterion[]
): StandingsEntry[] {
  const real = realCompare(rankingOrder);
  const eligible = players.filter((p) => p.gamesPlayed > 0);
  if (eligible.length < 2) return [];

  const sorted = [...eligible].sort(real);
  const top = sorted[0];
  const tied = sorted.filter((p) => real(p, top) === 0);
  if (tied.length < 2) return [];

  return tied.map((p) => ({ ...p, winRate: winRateOf(p), rank: 1 }));
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

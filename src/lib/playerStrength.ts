/**
 * Player strength estimate used by the queue engine (rank matchups, team balancing and the
 * same-wait tiebreak). Replaces raw session win rate, which is too noisy over a handful of
 * games and puts every new player at 0%.
 *
 * Three layers, each one the starting guess for the next:
 *   1. Skill level (Unrated = 50%).
 *   2. Club history — the player's record over their last few completed sessions in this
 *      club, pulled toward the skill-level guess with SKILL_WEIGHT imaginary games.
 *   3. Tonight's games, pulled toward the layer above with HISTORY_WEIGHT imaginary games
 *      (or SKILL_WEIGHT when there's no history to lean on).
 *
 * The pure part (`blendedStrength`) has no DB dependency so the offline queue in the
 * browser can use it too.
 */

/** Expected win rate (0-1) for each skill level. */
export const SKILL_PRIOR: Readonly<Record<string, number>> = {
  NOVICE: 0.3,
  BEGINNER_LOW: 0.4,
  BEGINNER_HIGH: 0.5,
  INTERMEDIATE: 0.6,
  ADVANCED: 0.7,
};
export const UNRATED_PRIOR = 0.5;

/** How many imaginary games the skill level counts for. */
export const SKILL_WEIGHT = 4;
/** How many imaginary games the club history counts for, once there is some. */
export const HISTORY_WEIGHT = 8;
/** Only the player's most recent sessions count, so people who've improved aren't held back. */
export const HISTORY_SESSIONS = 10;

export interface ClubRecord {
  wins: number;
  games: number;
}

export function normaliseName(name: string): string {
  return name.trim().toLowerCase();
}

export type StrengthTier = "STRONG" | "MID" | "DEVELOPING";

/** Above this estimated win rate a player is shown as Strong. */
export const STRONG_ABOVE = 60;
/** Below this estimated win rate a player is shown as Developing. */
export const DEVELOPING_BELOW = 40;

/** Coarse label for a strength estimate, shown to organisers next to each player. */
export function strengthTier(strength: number): StrengthTier {
  if (!Number.isFinite(strength)) return "MID";
  if (strength > STRONG_ABOVE) return "STRONG";
  if (strength < DEVELOPING_BELOW) return "DEVELOPING";
  return "MID";
}

export interface StrengthInput {
  skillLevel?: string | null;
  club?: ClubRecord | null;
  /** Tonight's wins and games. */
  wins: number;
  games: number;
}

/** A non-negative finite count; anything else (missing, NaN, Infinity, negative) counts as 0. */
function count(v: unknown): number {
  return typeof v === "number" && Number.isFinite(v) && v > 0 ? v : 0;
}

/** A sane wins/games record: wins can never exceed games played. */
function record(wins: unknown, games: unknown): { wins: number; games: number } {
  const g = count(games);
  return { wins: Math.min(count(wins), g), games: g };
}

/** Estimated win rate on a 0-100 scale. Always finite and within 0-100, whatever the data. */
export function blendedStrength({ skillLevel, club, wins, games }: StrengthInput): number {
  const skillPrior = (skillLevel ? SKILL_PRIOR[skillLevel] : undefined) ?? UNRATED_PRIOR;
  const history = record(club?.wins, club?.games);
  const tonight = record(wins, games);
  const hasHistory = history.games > 0;
  const clubStrength = hasHistory
    ? (history.wins + SKILL_WEIGHT * skillPrior) / (history.games + SKILL_WEIGHT)
    : skillPrior;
  const weight = hasHistory ? HISTORY_WEIGHT : SKILL_WEIGHT;
  return ((tonight.wins + weight * clubStrength) / (tonight.games + weight)) * 100;
}

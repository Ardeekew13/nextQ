/**
 * Who each player shared a court with in their most recent games, so the queue can avoid
 * putting the same people back on a court together game after game. Pure — shared by the
 * server and the offline queue.
 */
export interface GameTeamsLike {
  teamAPlayerIds: unknown[];
  teamBPlayerIds: unknown[];
}

/** How many recent games per player the queue remembers. Enough to spot a pair stuck
 * together three games running. */
export const RECENT_GAMES_REMEMBERED = 3;

/**
 * For each player, the other three players in each of their last few games, newest first.
 * `games` must be newest first (cancelled games already excluded).
 */
export function recentGameMates(
  games: GameTeamsLike[],
  depth: number = RECENT_GAMES_REMEMBERED
): Map<string, string[][]> {
  const recent = new Map<string, string[][]>();
  for (const game of games) {
    const ids = [...game.teamAPlayerIds, ...game.teamBPlayerIds].map(String);
    for (const id of ids) {
      const list = recent.get(id) ?? [];
      if (list.length >= depth) continue;
      list.push(ids.filter((other) => other !== id));
      recent.set(id, list);
    }
  }
  return recent;
}

/** Just each player's most recent game. `games` must be newest first. */
export function lastGameMates(games: GameTeamsLike[]): Map<string, string[]> {
  const out = new Map<string, string[]>();
  for (const [id, list] of recentGameMates(games, 1)) out.set(id, list[0]);
  return out;
}

export interface RankedPlayer {
  id: string;
  name?: string;
}

export interface TopFourMatch {
  players: RankedPlayer[];
  teamA: RankedPlayer[];
  teamB: RankedPlayer[];
}

/**
 * The four best-ranked players who are waiting in the queue, split rank 1 + 4 vs rank 2 + 3.
 * `standings` is any list with a `rank` (1 = best); players not waiting are skipped.
 * Returns null when fewer than four ranked players are waiting.
 */
export function pickTopFour(
  standings: { rank: number; player: RankedPlayer }[],
  waitingIds: Iterable<string>
): TopFourMatch | null {
  const waiting = new Set(waitingIds);
  const ranked = [...standings]
    .sort((a, b) => a.rank - b.rank)
    .map((s) => s.player)
    .filter((p) => waiting.has(p.id));
  if (ranked.length < 4) return null;
  const [r1, r2, r3, r4] = ranked;
  return { players: [r1, r2, r3, r4], teamA: [r1, r4], teamB: [r2, r3] };
}

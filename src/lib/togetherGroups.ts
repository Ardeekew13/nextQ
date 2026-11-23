/**
 * Finds groups of players who keep landing in the same games, so the organiser can be
 * prompted to break them up. Pure and DB-free.
 *
 * A "group" is any 2-4 players who have shared at least `minGames` games. Only the
 * most informative groups are kept: a group is dropped when a larger group containing it
 * has been together just as often (e.g. if A, B and C shared 3 games, the pairs inside
 * that trio are not reported separately).
 */

export interface TogetherGameInput {
  id: string;
  gameNumber: number;
  playerIds: string[];
}

export interface TogetherGroup {
  /** Stable key: the member ids, sorted and joined. */
  key: string;
  playerIds: string[];
  gameIds: string[];
  gamesTogether: number;
  /** Games in a row the whole group has shared, counting back from each member's latest game. */
  inARow: number;
}

function subsetsOf(ids: string[]): string[][] {
  const out: string[][] = [];
  const n = ids.length;
  for (let mask = 1; mask < 1 << n; mask++) {
    const subset: string[] = [];
    for (let i = 0; i < n; i++) if (mask & (1 << i)) subset.push(ids[i]);
    if (subset.length >= 2) out.push(subset);
  }
  return out;
}

export function findTogetherGroups(
  games: TogetherGameInput[],
  options: {
    minGames?: number;
    maxGroups?: number;
    /** Groups the organiser already separated; anything fully inside one is not reported. */
    separated?: ReadonlyArray<ReadonlyArray<string>>;
    /** Fixed partners: they play together every game by design, so the pair on its own is never
     * reported. Someone else who keeps landing with them still is. */
    fixedPairs?: ReadonlyArray<readonly [string, string]>;
  } = {}
): TogetherGroup[] {
  const { minGames = 2, maxGroups = 3, separated = [], fixedPairs = [] } = options;
  const fixedKeys = new Set(fixedPairs.map(([a, b]) => [a, b].sort().join(":")));

  const byKey = new Map<string, TogetherGroup>();
  for (const game of [...games].sort((a, b) => a.gameNumber - b.gameNumber)) {
    const ids = [...new Set(game.playerIds)].sort();
    for (const subset of subsetsOf(ids)) {
      const key = subset.join(":");
      const existing = byKey.get(key);
      if (existing) {
        existing.gameIds.push(game.id);
        existing.gamesTogether++;
      } else {
        byKey.set(key, { key, playerIds: subset, gameIds: [game.id], gamesTogether: 1, inARow: 0 });
      }
    }
  }

  const frequent = [...byKey.values()].filter((g) => g.gamesTogether >= minGames);

  // Each player's games, latest first, to work out how many games in a row a group has shared.
  const gamesOf = new Map<string, string[][]>();
  for (const game of [...games].sort((a, b) => b.gameNumber - a.gameNumber))
    for (const id of new Set(game.playerIds)) {
      if (!gamesOf.has(id)) gamesOf.set(id, []);
      gamesOf.get(id)!.push(game.playerIds);
    }
  for (const g of frequent) {
    g.inARow = Math.min(
      ...g.playerIds.map((id) => {
        let n = 0;
        for (const ids of gamesOf.get(id) ?? []) {
          if (!g.playerIds.every((m) => ids.includes(m))) break;
          n++;
        }
        return n;
      })
    );
  }

  // Fixed partners count as one person: they're together on purpose. A group is only worth
  // breaking up when it holds at least two "people" once each pair is counted once.
  const partnerOf = new Map<string, string>();
  for (const [a, b] of fixedPairs) {
    partnerOf.set(a, b);
    partnerOf.set(b, a);
  }
  const people = (ids: string[]) =>
    new Set(ids.map((id) => (partnerOf.has(id) && ids.includes(partnerOf.get(id)!) ? [id, partnerOf.get(id)!].sort().join(":") : id))).size;
  void fixedKeys;
  const notSeparated = frequent.filter(
    (g) => !separated.some((sep) => g.playerIds.every((id) => sep.includes(id))) && people(g.playerIds) >= 2
  );

  const maximal = notSeparated.filter(
    (g) =>
      !notSeparated.some(
        (other) =>
          other.playerIds.length > g.playerIds.length &&
          other.gamesTogether === g.gamesTogether &&
          g.playerIds.every((id) => other.playerIds.includes(id))
      )
  );

  maximal.sort(
    (a, b) =>
      b.gamesTogether - a.gamesTogether ||
      b.playerIds.length - a.playerIds.length ||
      a.key.localeCompare(b.key)
  );

  // Don't flood the organiser: skip a group that is wholly contained in one already shown.
  const shown: TogetherGroup[] = [];
  for (const g of maximal) {
    if (shown.some((s) => g.playerIds.every((id) => s.playerIds.includes(id)))) continue;
    shown.push(g);
    if (shown.length >= maxGroups) break;
  }
  return shown;
}

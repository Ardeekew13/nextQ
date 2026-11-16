/**
 * Players the organiser took out of a game (a lineup edit, or a manual fill that skipped
 * whoever was "up next") go straight to the front of the queue: Session.upNextFirst. The queue
 * engine sees them as the top of the manual order, ahead of any saved custom order, and they
 * leave the list as soon as they're put in a game.
 */
export function queuePriorityOrder(session: {
  upNextFirst?: unknown[] | null;
  manualQueueOrder?: unknown[] | null;
} | null | undefined): string[] {
  const first = (session?.upNextFirst ?? []).map(String);
  const rest = (session?.manualQueueOrder ?? []).map(String).filter((id) => !first.includes(id));
  return [...new Set(first)].concat(rest);
}

type StoredRequest = { _id?: unknown; id?: unknown; teamAPlayerIds?: unknown[]; teamBPlayerIds?: unknown[]; teamA?: unknown[]; teamB?: unknown[] };

/** Requested matches in the shape the queue engine takes (see MatchRequest in queueEngine). */
export function engineMatchRequests(requests: StoredRequest[] | null | undefined): {
  id: string;
  teamA: [string, string];
  teamB: [string, string];
}[] {
  return (requests ?? [])
    .map((r) => ({
      id: String(r.id ?? r._id),
      teamA: (r.teamA ?? r.teamAPlayerIds ?? []).map(String) as [string, string],
      teamB: (r.teamB ?? r.teamBPlayerIds ?? []).map(String) as [string, string],
    }))
    .filter((r) => r.teamA.length === 2 && r.teamB.length === 2);
}

/** Requests whose four players are all in this game - they've been played. */
export function fulfilledRequestIds(requests: StoredRequest[] | null | undefined, playerIds: unknown[]): string[] {
  const inGame = new Set(playerIds.map(String));
  return engineMatchRequests(requests)
    .filter((r) => [...r.teamA, ...r.teamB].every((id) => inGame.has(id)))
    .map((r) => r.id);
}

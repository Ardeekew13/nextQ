import type { ApolloCache, Reference } from "@apollo/client";

/**
 * Whether the dashboard should show the on-device copy of the session (last server snapshot +
 * the organiser's actions replayed on top) instead of the server's data.
 *
 * - Anything not yet on the server: the device copy.
 * - Actions that reached the server but are still kept: the device copy too. They are only
 *   dropped after the dashboard has been refreshed with the server's new state (see
 *   pruneSynced), including when that refresh failed and is retried later. Switching the moment
 *   an action is marked synced would briefly show the server's OLD data — a game whose result
 *   was just recorded popping back onto its court with "Saving result… Almost done."
 * - Failed actions (the server refused them) never count: they're shown with Retry / Discard.
 */
export function shouldShowDeviceCopy(input: {
  hasSnapshot: boolean;
  ops: ReadonlyArray<{ synced?: boolean; error?: string }>;
}): boolean {
  return input.hasSnapshot && input.ops.some((p) => !p.error);
}

/** Online, an action normally reaches the server within a second, so "Syncing…" is only worth
 * showing for one that has been waiting longer than this. */
export const SLOW_SYNC_MS = 5_000;

/** Unsent (not failed) actions that have been waiting longer than SLOW_SYNC_MS. */
export function slowToSync(
  ops: ReadonlyArray<{ synced?: boolean; error?: string; kind: string; createdAt?: string; recordedAt?: string }>,
  now: number
): number {
  return ops.filter((p) => {
    if (p.synced || p.error) return false;
    const at = Date.parse((p.kind === "fill" ? p.createdAt : p.recordedAt) ?? "");
    return !Number.isFinite(at) || now - at > SLOW_SYNC_MS;
  }).length;
}

/**
 * Puts a game the server just created on its court in the Apollo cache, so the court shows the
 * line-up the moment the mutation returns (when the announcement is spoken) instead of after
 * the full dashboard refetch, which can take several seconds on venue Wi-Fi. The four players
 * leave the queue and the "up next" preview is cleared until the refetch brings the real one.
 */
export function placeGameOnCourt(
  cache: ApolloCache<unknown>,
  sessionId: string,
  courtId: string,
  game: { __typename?: string; id: string; teamA?: { players: Array<{ id: string }> }; teamB?: { players: Array<{ id: string }> } } | null | undefined
): void {
  if (!game?.id) return;
  const gameRef = cache.identify({ __typename: "Game", id: game.id });
  if (!gameRef) return;
  const courtRef = cache.identify({ __typename: "Court", id: courtId });
  if (courtRef) {
    cache.modify({
      id: courtRef,
      fields: {
        currentGame: () => ({ __ref: gameRef }),
        status: () => "IN_USE",
      },
    });
  }
  const onCourt = new Set([...(game.teamA?.players ?? []), ...(game.teamB?.players ?? [])].map((p) => p.id));
  const sessionRef = cache.identify({ __typename: "Session", id: sessionId });
  if (sessionRef) {
    cache.modify({
      id: sessionRef,
      fields: {
        queuedPlayers: (value, { readField }) =>
          ((value ?? []) as readonly Reference[]).filter((p) => !onCourt.has(String(readField("id", p)))),
        nextGamePreview: () => null,
        activeGames: (value, { readField }) => {
          const list = (value ?? []) as readonly Reference[];
          return list.some((g) => readField("id", g) === game.id) ? list : [...list, { __ref: gameRef }];
        },
      },
    });
  }
}

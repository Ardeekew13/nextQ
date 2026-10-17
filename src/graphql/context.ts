import { connectToDatabase } from "@/lib/db";
import { getSessionFromCookies, type AuthTokenPayload } from "@/lib/auth";
import { getCSRFToken } from "@/lib/csrf";
import { SessionPlayer } from "@/models/SessionPlayer";
import { Session } from "@/models/Session";
import { loadClubHistory } from "@/lib/clubHistory";
import type { ClubRecord } from "@/lib/playerStrength";
import { Court } from "@/models/Court";
import { createBatchLoader, type BatchLoader } from "@/lib/batchLoader";

export interface GraphQLContext {
  organiser: AuthTokenPayload | null;
  playerNameCache: Map<string, Promise<Map<string, string>>>;
  csrfToken: string;
  /** Per-request cache of each session's players' recent club records (keyed by session id). */
  clubHistoryCache?: Map<string, Promise<Map<string, ClubRecord>>>;
  /** Per-request batched lookups (one query for all the games' players / courts). */
  loaders?: RequestLoaders;
}

export interface RequestLoaders {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  player: BatchLoader<any>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  court: BatchLoader<any>;
}

export function createLoaders(): RequestLoaders {
  return {
    player: createBatchLoader((ids) => SessionPlayer.find({ _id: { $in: ids } }), (p) => String(p._id)),
    court: createBatchLoader((ids) => Court.find({ _id: { $in: ids } }), (c) => String(c._id)),
  };
}

/** Players by id, in that order, batched per request when a context with loaders is given. */
export async function loadPlayers(context: GraphQLContext | undefined, ids: readonly unknown[] | undefined) {
  if (!ids?.length) return [];
  if (context?.loaders) return context.loaders.player.loadMany(ids);
  return SessionPlayer.find({ _id: { $in: ids } });
}

export async function loadCourt(context: GraphQLContext | undefined, id: unknown) {
  if (!id) return null;
  if (context?.loaders) return (await context.loaders.court.load(String(id))) ?? null;
  return Court.findById(id);
}

export async function createContext(): Promise<GraphQLContext> {
  await connectToDatabase();
  const organiser = await getSessionFromCookies();
  const csrfToken = await getCSRFToken();
  return { organiser, playerNameCache: new Map(), csrfToken, clubHistoryCache: new Map(), loaders: createLoaders() };
}

/** Per-request cached club history for every player in a session, used for strength tags. */
export async function getClubHistoryForSession(
  context: GraphQLContext,
  sessionId: string
): Promise<Map<string, ClubRecord>> {
  context.clubHistoryCache ??= new Map();
  let cached = context.clubHistoryCache.get(sessionId);
  if (!cached) {
    cached = Promise.all([
      Session.findById(sessionId).select("clubId").lean(),
      SessionPlayer.find({ sessionId }, { name: 1 }).lean(),
    ]).then(([session, players]) =>
      loadClubHistory(session?.clubId, sessionId, players.map((p) => p.name))
    );
    context.clubHistoryCache.set(sessionId, cached);
  }
  return cached;
}

/** Per-request cached lookup of playerId -> name for a session, used to resolve history entries. */
export async function getPlayerNamesForSession(
  context: GraphQLContext,
  sessionId: string
): Promise<Map<string, string>> {
  let cached = context.playerNameCache.get(sessionId);
  if (!cached) {
    cached = SessionPlayer.find({ sessionId }, { name: 1 }).then(
      (players) => new Map(players.map((p) => [String(p._id), p.name]))
    );
    context.playerNameCache.set(sessionId, cached);
  }
  return cached;
}

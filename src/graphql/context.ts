import { connectToDatabase } from "@/lib/db";
import { getSessionFromCookies, type AuthTokenPayload } from "@/lib/auth";
import { getCSRFToken } from "@/lib/csrf";
import { SessionPlayer } from "@/models/SessionPlayer";
import { Session } from "@/models/Session";
import { loadClubHistory } from "@/lib/clubHistory";
import type { ClubRecord } from "@/lib/playerStrength";

export interface GraphQLContext {
  organiser: AuthTokenPayload | null;
  playerNameCache: Map<string, Promise<Map<string, string>>>;
  csrfToken: string;
  /** Per-request cache of each session's players' recent club records (keyed by session id). */
  clubHistoryCache?: Map<string, Promise<Map<string, ClubRecord>>>;
}

export async function createContext(): Promise<GraphQLContext> {
  await connectToDatabase();
  const organiser = await getSessionFromCookies();
  const csrfToken = await getCSRFToken();
  return { organiser, playerNameCache: new Map(), csrfToken, clubHistoryCache: new Map() };
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

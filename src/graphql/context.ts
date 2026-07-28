import { connectToDatabase } from "@/lib/db";
import { getSessionFromCookies, type AuthTokenPayload } from "@/lib/auth";
import { getCSRFToken } from "@/lib/csrf";
import { SessionPlayer } from "@/models/SessionPlayer";

export interface GraphQLContext {
  organiser: AuthTokenPayload | null;
  playerNameCache: Map<string, Promise<Map<string, string>>>;
  csrfToken: string;
}

export async function createContext(): Promise<GraphQLContext> {
  await connectToDatabase();
  const organiser = await getSessionFromCookies();
  const csrfToken = await getCSRFToken();
  return { organiser, playerNameCache: new Map(), csrfToken };
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

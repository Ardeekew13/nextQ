import { Game } from "@/models/Game";
import { Session } from "@/models/Session";
import { SessionPlayer, type SessionPlayerDoc } from "@/models/SessionPlayer";
import { GameStatus, QueueMode, type SessionSettings } from "@/types/enums";
import { rankQueue, generateNextGame as queueEngineGenerateNextGame, type QueuePlayer } from "@/lib/queueEngine";
import type { HydratedDocument } from "mongoose";

/** Players currently locked to a court because they're mid-game (queued or in progress). */
export async function getBusyPlayerIds(sessionId: string): Promise<Set<string>> {
  const games = await Game.find(
    { sessionId, status: { $in: [GameStatus.QUEUED, GameStatus.IN_PROGRESS] } },
    { teamAPlayerIds: 1, teamBPlayerIds: 1 }
  );
  const ids = new Set<string>();
  for (const game of games) {
    for (const id of [...game.teamAPlayerIds, ...game.teamBPlayerIds]) {
      ids.add(String(id));
    }
  }
  return ids;
}

/**
 * Players who are checked in, active, and not currently assigned to a
 * court - i.e. eligible for the next generated game or shown as "waiting".
 * Sorted by longest-waiting first.
 */
export async function getEligiblePlayers(
  sessionId: string
): Promise<HydratedDocument<SessionPlayerDoc>[]> {
  const busy = await getBusyPlayerIds(sessionId);
  const players = await SessionPlayer.find({ sessionId, checkedIn: true, active: true });
  return players
    .filter((player) => !busy.has(String(player._id)))
    .sort((a, b) => a.queueEnteredAt.getTime() - b.queueEnteredAt.getTime());
}

/** Maps a SessionPlayer doc into the shape the queue engine scores on, including win rate. */
export function toQueuePlayer(doc: HydratedDocument<SessionPlayerDoc>): QueuePlayer {
  const partnerHistory: Record<string, number> =
    doc.partnerHistory instanceof Map
      ? Object.fromEntries(doc.partnerHistory)
      : Object.fromEntries(Object.entries(doc.partnerHistory ?? {}));
  const opponentHistory: Record<string, number> =
    doc.opponentHistory instanceof Map
      ? Object.fromEntries(doc.opponentHistory)
      : Object.fromEntries(Object.entries(doc.opponentHistory ?? {}));

  return {
    id: String(doc._id),
    gamesPlayed: doc.gamesPlayed,
    consecutiveGames: doc.consecutiveGames ?? 0,
    queueEnteredAt: doc.queueEnteredAt,
    gamesSatOut: doc.gamesSatOut,
    partnerHistory,
    opponentHistory,
    winRate: doc.gamesPlayed > 0 ? (doc.wins / doc.gamesPlayed) * 100 : 0,
  };
}

/** Deterministic PRNG (mulberry32-style) seeded from a string — stable across repeated calls with the same input. */
export function seededRandom(seed: string): () => number {
  let h = 1779033703 ^ seed.length;
  for (let i = 0; i < seed.length; i++) {
    h = Math.imul(h ^ seed.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return function next() {
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
  };
}

/** Stable seed for a given eligible pool — same pool always yields the same seed. */
export function queuePoolSeed(docs: HydratedDocument<SessionPlayerDoc>[]): string {
  return docs.map((d) => String(d._id)).sort().join(",");
}

interface QueueContext {
  eligibleDocs: HydratedDocument<SessionPlayerDoc>[];
  byId: Map<string, HydratedDocument<SessionPlayerDoc>>;
  mode: QueueMode;
  maxConsecutiveGames: number;
  pastGroups: Set<string>;
  /** Stable per-pool seed. Passing a fresh `seededRandom(seed)` to both the flat
   * queue preview and the next-game preview keeps their first-round selection
   * (including tiebreaks and the anti-repeat swap) identical to each other. */
  seed: string;
}

async function loadQueueContext(sessionId: string): Promise<QueueContext> {
  const [session, eligibleDocs, priorGames] = await Promise.all([
    Session.findById(sessionId).select("settings"),
    getEligiblePlayers(sessionId),
    Game.find(
      { sessionId, status: { $ne: GameStatus.CANCELLED } },
      { teamAPlayerIds: 1, teamBPlayerIds: 1 }
    )
      .sort({ gameNumber: -1 })
      .limit(200),
  ]);

  const settings = session?.settings as SessionSettings | undefined;
  const pastGroups = new Set(
    priorGames.map((g) => [...g.teamAPlayerIds, ...g.teamBPlayerIds].map(String).sort().join(":"))
  );

  return {
    eligibleDocs,
    byId: new Map(eligibleDocs.map((doc) => [String(doc._id), doc])),
    mode: (settings?.queueMode ?? QueueMode.HYBRID) as QueueMode,
    maxConsecutiveGames: settings?.maxConsecutiveGames ?? 2,
    pastGroups,
    seed: queuePoolSeed(eligibleDocs),
  };
}

/**
 * The eligible pool in the order players would actually be picked next — runs the
 * exact same scoring `generateNextGame` uses, so the "on deck" preview shown to
 * organisers can never drift from what a real court fill selects.
 */
export async function getQueuePreview(
  sessionId: string
): Promise<HydratedDocument<SessionPlayerDoc>[]> {
  const ctx = await loadQueueContext(sessionId);
  if (ctx.eligibleDocs.length === 0) return [];

  const ranked = rankQueue(ctx.eligibleDocs.map(toQueuePlayer), {
    mode: ctx.mode,
    maxConsecutiveGames: ctx.maxConsecutiveGames,
    pastGroups: ctx.pastGroups,
    random: seededRandom(ctx.seed),
  });

  return ranked
    .map((p) => ctx.byId.get(p.id))
    .filter((doc): doc is HydratedDocument<SessionPlayerDoc> => Boolean(doc));
}

/**
 * Predicted teams for the very next game — the exact quad + split `generateNextGame`
 * would produce right now, so players can see their partner before the court opens.
 * Team-split randomness (for modes that shuffle teams) is seeded from the current
 * eligible pool so repeated queries stay stable instead of flickering between polls;
 * the actual split at fill time may still differ if the eligible pool changes first
 * or the mode intentionally reshuffles teams.
 */
export async function getNextGamePreview(
  sessionId: string
): Promise<{
  teamA: { players: HydratedDocument<SessionPlayerDoc>[] };
  teamB: { players: HydratedDocument<SessionPlayerDoc>[] };
} | null> {
  const ctx = await loadQueueContext(sessionId);
  if (ctx.eligibleDocs.length < 4) return null;

  const result = queueEngineGenerateNextGame(ctx.eligibleDocs.map(toQueuePlayer), {
    mode: ctx.mode,
    maxConsecutiveGames: ctx.maxConsecutiveGames,
    pastGroups: ctx.pastGroups,
    random: seededRandom(ctx.seed),
  });
  if (!result.ok) return null;

  const resolve = (p: QueuePlayer) => ctx.byId.get(p.id);
  const players = (team: QueuePlayer[]) =>
    team.map(resolve).filter((d): d is HydratedDocument<SessionPlayerDoc> => Boolean(d));

  return {
    teamA: { players: players(result.teamA) },
    teamB: { players: players(result.teamB) },
  };
}

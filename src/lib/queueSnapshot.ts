import { Game } from "@/models/Game";
import { Session } from "@/models/Session";
import { Court } from "@/models/Court";
import { SessionPlayer } from "@/models/SessionPlayer";
import { GameStatus, QueueMode, type SessionSettings } from "@/types/enums";
import type { QueueSnapshot } from "@/lib/offlineQueue";

function plain(map: unknown): Record<string, number> {
  if (map instanceof Map) return Object.fromEntries(map as Map<string, number>);
  return { ...((map as Record<string, number>) ?? {}) };
}

/**
 * Everything the browser needs to run the queue engine without the server: players with
 * their counters and history, the games on court, courts, earlier groups and keep-apart
 * groups. Taken while online; the offline overlay replays the organiser's actions on it.
 */
export async function buildQueueSnapshot(sessionId: string): Promise<QueueSnapshot> {
  const [session, players, courts, games] = await Promise.all([
    Session.findById(sessionId).select("settings separatedGroups"),
    SessionPlayer.find({ sessionId }),
    Court.find({ sessionId }).sort({ courtNumber: 1 }),
    Game.find({ sessionId }, { teamAPlayerIds: 1, teamBPlayerIds: 1, playersSatOutIds: 1, courtId: 1, gameNumber: 1, status: 1, startedAt: 1 }).sort({ gameNumber: -1 }),
  ]);

  const settings = session?.settings as SessionSettings | undefined;
  const ids = (list: unknown[]) => list.map(String);
  const live = games.filter((g) => g.status === GameStatus.QUEUED || g.status === GameStatus.IN_PROGRESS);
  const past = games.filter((g) => g.status !== GameStatus.CANCELLED).slice(0, 200);

  return {
    sessionId,
    takenAt: new Date().toISOString(),
    queueMode: (settings?.queueMode ?? QueueMode.HYBRID) as string,
    maxConsecutiveGames: settings?.maxConsecutiveGames ?? 2,
    lastGameNumber: games[0]?.gameNumber ?? 0,
    players: players.map((p) => ({
      id: String(p._id),
      name: p.name,
      checkedIn: p.checkedIn,
      active: p.active,
      gamesPlayed: p.gamesPlayed,
      wins: p.wins,
      losses: p.losses,
      currentStreak: p.currentStreak ?? 0,
      longestWinStreak: p.longestWinStreak ?? 0,
      consecutiveGames: p.consecutiveGames ?? 0,
      queueEnteredAt: p.queueEnteredAt.toISOString(),
      gamesSatOut: p.gamesSatOut,
      partnerHistory: plain(p.partnerHistory),
      opponentHistory: plain(p.opponentHistory),
      fixedPartnerId: p.fixedPartnerId ? String(p.fixedPartnerId) : null,
    })),
    activeGames: live.map((g) => ({
      id: String(g._id),
      courtId: String(g.courtId),
      gameNumber: g.gameNumber,
      teamA: ids(g.teamAPlayerIds),
      teamB: ids(g.teamBPlayerIds),
      satOut: ids(g.playersSatOutIds ?? []),
      status: g.status,
      startedAt: g.startedAt ? g.startedAt.toISOString() : null,
    })),
    courts: courts.map((c) => ({ id: String(c._id), courtNumber: c.courtNumber, name: c.name ?? null, status: c.status })),
    pastGroups: past.map((g) => [...g.teamAPlayerIds, ...g.teamBPlayerIds].map(String).sort().join(":")),
    keepApart: (session?.separatedGroups ?? []).map((g) => g.playerIds.map(String)),
  };
}

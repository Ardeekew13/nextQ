import type { ClientSession } from "mongoose";
import { Game } from "@/models/Game";
import { SessionPlayer } from "@/models/SessionPlayer";
import { Session } from "@/models/Session";
import { GameStatus, type RankingCriterion } from "@/types/enums";
import { computePodium, computeStandings, type StandingsInput } from "@/lib/ranking";
import { computePlayerStatistics } from "@/lib/statsCore";

/**
 * Rebuilds every SessionPlayer's statistics from scratch using only completed
 * games for the session, in chronological order. This is the single source
 * of truth for player stats - used after a game completes, and again
 * whenever a result is edited, cancelled, or deleted, so stats never drift
 * out of sync with the underlying game log.
 */
export async function rebuildSessionStatistics(
  sessionId: string,
  mongooseSession?: ClientSession
): Promise<void> {
  const [players, completedGames] = await Promise.all([
    SessionPlayer.find({ sessionId }).session(mongooseSession ?? null),
    Game.find({ sessionId, status: GameStatus.COMPLETED })
      .sort({ completedAt: 1, gameNumber: 1 })
      .session(mongooseSession ?? null),
  ]);

  const results = computePlayerStatistics(
    players.map((p) => String(p._id)),
    completedGames.map((game) => ({
      teamAPlayerIds: game.teamAPlayerIds.map(String),
      teamBPlayerIds: game.teamBPlayerIds.map(String),
      winningTeam: game.winningTeam as "A" | "B",
      playersSatOutIds: (game.playersSatOutIds ?? []).map(String),
    }))
  );

  const bulkOps = players.map((player) => {
    const stats = results.get(String(player._id))!;
    return {
      updateOne: {
        filter: { _id: player._id },
        // Mongoose coerces plain objects into the schema's Map fields at
        // runtime; the imprecise cast is just to satisfy bulkWrite's typing.
        update: { $set: stats as unknown as Record<string, unknown> },
      },
    };
  });

  if (bulkOps.length > 0) {
    await SessionPlayer.bulkWrite(bulkOps, { session: mongooseSession ?? undefined });
  }
}

function toStandingsInput(player: {
  _id: unknown;
  name: string;
  gamesPlayed: number;
  wins: number;
  losses: number;
  currentStreak: number;
  longestWinStreak: number;
  gamesSatOut: number;
  checkedInAt?: Date | null;
}): StandingsInput {
  return {
    id: String(player._id),
    name: player.name,
    gamesPlayed: player.gamesPlayed,
    wins: player.wins,
    losses: player.losses,
    currentStreak: player.currentStreak,
    longestWinStreak: player.longestWinStreak,
    gamesSatOut: player.gamesSatOut,
    checkedInAt: player.checkedInAt ?? null,
  };
}

export async function getSessionStandings(sessionId: string) {
  const [session, players] = await Promise.all([
    Session.findById(sessionId),
    SessionPlayer.find({ sessionId }),
  ]);
  if (!session) throw new Error("Session not found");

  return computeStandings(players.map(toStandingsInput), session.settings.rankingOrder as RankingCriterion[]);
}

export async function getSessionPodium(sessionId: string) {
  const standings = await getSessionStandings(sessionId);
  return computePodium(standings);
}

/** Standings entries with the full SessionPlayer document attached as `player`, for GraphQL resolution. */
export async function getSessionStandingsWithPlayers(sessionId: string) {
  const [standings, players] = await Promise.all([
    getSessionStandings(sessionId),
    SessionPlayer.find({ sessionId }),
  ]);
  const byId = new Map(players.map((p) => [String(p._id), p]));
  return standings.map((entry) => ({ ...entry, player: byId.get(entry.id) }));
}

export async function getSessionPodiumWithPlayers(sessionId: string) {
  const standings = await getSessionStandingsWithPlayers(sessionId);
  return standings
    .filter((entry) => entry.gamesPlayed > 0 && entry.rank <= 3)
    .map((entry) => ({ ...entry, position: entry.rank }));
}

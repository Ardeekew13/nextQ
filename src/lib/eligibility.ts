import { Game } from "@/models/Game";
import { SessionPlayer, type SessionPlayerDoc } from "@/models/SessionPlayer";
import { GameStatus } from "@/types/enums";
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

import { Session } from "@/models/Session";
import { SessionPlayer } from "@/models/SessionPlayer";
import { SessionStatus } from "@/types/enums";
import { HISTORY_SESSIONS, normaliseName, playerKey, type ClubRecord } from "@/lib/playerStrength";

/** How many of the club's most recent completed sessions are searched for players' records. */
export const CLUB_HISTORY_SCAN_SESSIONS = 60;

/**
 * Each player's record over their last HISTORY_SESSIONS completed sessions in the club,
 * excluding the current session, keyed by playerKey. A player linked to a club member account
 * gets that account's games (plus any unlinked games under the same name from before accounts),
 * so two people who share a name never share a record. Unlinked players match by name.
 */
export async function loadClubHistory(
  clubId: unknown,
  currentSessionId: unknown,
  players: Array<string | { name: string; memberId?: unknown }>
): Promise<Map<string, ClubRecord>> {
  const history = new Map<string, ClubRecord>();
  const wanted = [...new Set(players.map((p) => normaliseName(typeof p === "string" ? p : p.name)))];
  const memberIds = [...new Set(players.flatMap((p) => (typeof p !== "string" && p.memberId ? [String(p.memberId)] : [])))];
  if (!clubId || wanted.length === 0) return history;

  const sessions = await Session.find({
    clubId,
    status: SessionStatus.COMPLETED,
    _id: { $ne: currentSessionId },
  })
    .select("_id sessionDate")
    // Only the club's most recent sessions: anyone's last few sessions are almost always among
    // them, and it keeps this lookup (run on every fill and refresh) from growing forever.
    .sort({ sessionDate: -1 })
    .limit(CLUB_HISTORY_SCAN_SESSIONS)
    .lean();
  if (sessions.length === 0) return history;
  const dateOf = new Map(sessions.map((s) => [String(s._id), new Date(s.sessionDate).getTime()]));

  const rows: Array<{ name: string; memberId?: unknown; sessionId: unknown; wins: number; gamesPlayed: number }> =
    await SessionPlayer.aggregate([
      { $match: { sessionId: { $in: sessions.map((s) => s._id) }, gamesPlayed: { $gt: 0 } } },
      {
        $match: {
          $or: [
            { $expr: { $in: [{ $toLower: { $trim: { input: "$name" } } }, wanted] } },
            ...(memberIds.length > 0 ? [{ $expr: { $in: [{ $toString: "$memberId" }, memberIds] } }] : []),
          ],
        },
      },
      { $project: { name: 1, memberId: 1, sessionId: 1, wins: 1, gamesPlayed: 1 } },
    ]);

  const newestFirst = (list: typeof rows) =>
    [...list].sort((a, b) => (dateOf.get(String(b.sessionId)) ?? 0) - (dateOf.get(String(a.sessionId)) ?? 0));
  for (const p of players) {
    const name = normaliseName(typeof p === "string" ? p : p.name);
    const memberId = typeof p !== "string" && p.memberId ? String(p.memberId) : null;
    const mine = rows.filter((r) =>
      memberId
        ? String(r.memberId ?? "") === memberId || (!r.memberId && normaliseName(r.name) === name)
        : normaliseName(r.name) === name
    );
    if (mine.length === 0) continue;
    const recent = newestFirst(mine).slice(0, HISTORY_SESSIONS);
    history.set(playerKey(p), {
      wins: recent.reduce((n, r) => n + (r.wins ?? 0), 0),
      games: recent.reduce((n, r) => n + (r.gamesPlayed ?? 0), 0),
    });
  }
  return history;
}

import { Session } from "@/models/Session";
import { SessionPlayer } from "@/models/SessionPlayer";
import { SessionStatus } from "@/types/enums";
import { HISTORY_SESSIONS, normaliseName, type ClubRecord } from "@/lib/playerStrength";

/** How many of the club's most recent completed sessions are searched for players' records. */
export const CLUB_HISTORY_SCAN_SESSIONS = 60;

/**
 * Each named player's record over their last HISTORY_SESSIONS completed sessions in the
 * club, excluding the current session. Players are matched by name (trimmed, case-
 * insensitive) — the same way club standings join them. Keyed by normalised name.
 */
export async function loadClubHistory(
  clubId: unknown,
  currentSessionId: unknown,
  names: string[]
): Promise<Map<string, ClubRecord>> {
  const history = new Map<string, ClubRecord>();
  const wanted = [...new Set(names.map(normaliseName))];
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

  const rows: Array<{ name: string; sessionId: unknown; wins: number; gamesPlayed: number }> =
    await SessionPlayer.aggregate([
      { $match: { sessionId: { $in: sessions.map((s) => s._id) }, gamesPlayed: { $gt: 0 } } },
      { $match: { $expr: { $in: [{ $toLower: { $trim: { input: "$name" } } }, wanted] } } },
      { $project: { name: 1, sessionId: 1, wins: 1, gamesPlayed: 1 } },
    ]);

  const byName = new Map<string, typeof rows>();
  for (const row of rows) {
    const key = normaliseName(row.name);
    const list = byName.get(key) ?? [];
    list.push(row);
    byName.set(key, list);
  }
  for (const [key, list] of byName) {
    list.sort((a, b) => (dateOf.get(String(b.sessionId)) ?? 0) - (dateOf.get(String(a.sessionId)) ?? 0));
    const recent = list.slice(0, HISTORY_SESSIONS);
    history.set(key, {
      wins: recent.reduce((n, r) => n + (r.wins ?? 0), 0),
      games: recent.reduce((n, r) => n + (r.gamesPlayed ?? 0), 0),
    });
  }
  return history;
}

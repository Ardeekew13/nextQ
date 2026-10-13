/**
 * READ-ONLY. Saves everything the queue engine sees for one session to
 * dump/queue-<sessionId>.json, so a "why is X ahead of Y?" report can be replayed exactly.
 *
 *   npx tsx scripts/dump-session-queue.ts <sessionId>
 *
 * Uses MONGODB_URI from .env.local like the other scripts. Writes nothing to the database.
 */
import fs from "node:fs";
import path from "node:path";

for (const file of [".env.local", ".env"]) {
  const filePath = path.resolve(process.cwd(), file);
  if (!fs.existsSync(filePath)) continue;
  for (const line of fs.readFileSync(filePath, "utf-8").split("\n")) {
    const m = /^\s*([\w.-]+)\s*=\s*(.*)?\s*$/.exec(line);
    if (!m) continue;
    let v = m[2] ?? "";
    if (v.startsWith('"') && v.endsWith('"')) v = v.slice(1, -1);
    if (!(m[1] in process.env)) process.env[m[1]] = v;
  }
}

async function main() {
  const sid = process.argv[2];
  if (!sid) throw new Error("Pass the session id, e.g. npx tsx scripts/dump-session-queue.ts 6accf2e4e336bc9c8af26a64");
  const { connectToDatabase } = await import("../src/lib/db");
  const { Session } = await import("../src/models/Session");
  const { Game } = await import("../src/models/Game");
  const { SessionPlayer } = await import("../src/models/SessionPlayer");
  const { getQueuePreview } = await import("../src/lib/eligibility");
  await connectToDatabase();

  const session = await Session.findById(sid).lean();
  if (!session) throw new Error(`No session ${sid}`);
  const players = await SessionPlayer.find({ sessionId: sid }).lean();
  const games = await Game.find({ sessionId: sid }).sort({ gameNumber: 1 }).lean();
  const preview = await getQueuePreview(sid);

  const out = {
    takenAt: new Date().toISOString(),
    session: { id: sid, name: session.name, clubId: String(session.clubId), settings: session.settings, separatedGroups: session.separatedGroups },
    players: players.map((p) => ({
      id: String(p._id), name: p.name, skillLevel: p.skillLevel ?? null, checkedIn: p.checkedIn, active: p.active,
      gamesPlayed: p.gamesPlayed, wins: p.wins, losses: p.losses, consecutiveGames: p.consecutiveGames ?? 0,
      gamesSatOut: p.gamesSatOut, queueEnteredAt: p.queueEnteredAt, checkedInAt: p.checkedInAt ?? null,
      fixedPartnerId: p.fixedPartnerId ? String(p.fixedPartnerId) : null,
      partnerHistory: p.partnerHistory, opponentHistory: p.opponentHistory,
    })),
    games: games.map((g) => ({
      number: g.gameNumber, status: g.status, createdAt: g.createdAt, completedAt: g.completedAt ?? null,
      teamA: g.teamAPlayerIds.map(String), teamB: g.teamBPlayerIds.map(String),
      satOut: (g.playersSatOutIds ?? []).map(String), winningTeam: g.winningTeam ?? null,
      offline: Boolean((g as { clientId?: string }).clientId),
      source: g.source ?? null,
      edits: (g.edits ?? []).map((e) => ({
        at: e.at,
        fromTeamA: e.fromTeamAPlayerIds.map(String),
        fromTeamB: e.fromTeamBPlayerIds.map(String),
        toTeamA: e.toTeamAPlayerIds.map(String),
        toTeamB: e.toTeamBPlayerIds.map(String),
      })),
    })),
    previewOrder: preview.map((d) => ({ id: String(d._id), name: d.name })),
  };
  fs.mkdirSync("dump", { recursive: true });
  const file = path.join("dump", `queue-${sid}.json`);
  fs.writeFileSync(file, JSON.stringify(out, null, 2));
  console.log(`Saved ${file}: ${out.players.length} players, ${out.games.length} games, settings ${JSON.stringify(session.settings)}`);
  process.exit(0);
}
main().catch((e) => { console.error(e); process.exit(1); });

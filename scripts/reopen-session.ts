/**
 * Reopens a finished session so it's Live again, exactly as it was before "Finish":
 * every game, player, result and stat is kept. Only undoes what finishSession sets —
 * status, final standings, end time and finalised time. Finishing it again later
 * recalculates the final standings as normal.
 *
 *   npx tsx scripts/reopen-session.ts <sessionId>
 *
 * Uses MONGODB_URI from .env.local like the other scripts.
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
  if (!sid) throw new Error("Pass the session id, e.g. npx tsx scripts/reopen-session.ts 6accf2e4e336bc9c8af26a64");
  const { connectToDatabase } = await import("../src/lib/db");
  const { Session } = await import("../src/models/Session");
  const { Game } = await import("../src/models/Game");
  const { SessionPlayer } = await import("../src/models/SessionPlayer");
  await connectToDatabase();

  const session = await Session.findById(sid);
  if (!session) throw new Error(`No session ${sid}`);
  const [games, players] = await Promise.all([
    Game.countDocuments({ sessionId: sid }),
    SessionPlayer.countDocuments({ sessionId: sid }),
  ]);
  console.log(`"${session.name}": status ${session.status}, ${games} games, ${players} players`);

  if (session.status !== "COMPLETED") {
    console.log("It isn't finished, so there's nothing to reopen. No changes made.");
    process.exit(0);
  }

  session.status = "ACTIVE" as typeof session.status;
  session.finalStandings = [] as unknown as typeof session.finalStandings;
  session.endTime = undefined;
  session.finalisedAt = undefined;
  await session.save();

  const after = await Game.countDocuments({ sessionId: sid });
  console.log(`Reopened: status is now ACTIVE (Live). Games kept: ${after} of ${games}. Players kept: ${players}.`);
  process.exit(0);
}
main().catch((e) => { console.error(e); process.exit(1); });

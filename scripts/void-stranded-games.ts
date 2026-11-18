/**
 * Finds games in a session that are running (queued / in progress) but not on any court -
 * left behind when two fills landed on one court at once - and voids them, exactly like the
 * "Void it" button: status CANCELLED, and the four get their games-in-a-row count back.
 * Courts are not touched. Dry run by default; add --apply to write.
 *
 *   npx tsx scripts/void-stranded-games.ts <sessionId>          # shows what it would do
 *   npx tsx scripts/void-stranded-games.ts <sessionId> --apply  # does it
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
  const apply = process.argv.includes("--apply");
  if (!sid) throw new Error("Pass the session id, e.g. npx tsx scripts/void-stranded-games.ts 6afba5a1d4ff4f44990bd4cc");
  const { connectToDatabase } = await import("../src/lib/db");
  const { Game } = await import("../src/models/Game");
  const { Court } = await import("../src/models/Court");
  const { SessionPlayer } = await import("../src/models/SessionPlayer");
  const { GameStatus } = await import("../src/types/enums");
  await connectToDatabase();

  const courts = await Court.find({ sessionId: sid });
  const onCourt = new Set(courts.map((c) => String(c.activeGameId ?? "")).filter(Boolean));
  const running = await Game.find({ sessionId: sid, status: { $in: [GameStatus.QUEUED, GameStatus.IN_PROGRESS] } }).sort({ gameNumber: 1 });
  const stranded = running.filter((g) => !onCourt.has(String(g._id)));
  const names = new Map((await SessionPlayer.find({ sessionId: sid })).map((p) => [String(p._id), p.name]));
  const team = (ids: unknown[]) => ids.map((id) => names.get(String(id)) ?? "?").join(" & ");

  console.log(`${running.length} running game(s), ${courts.length} court(s) showing ${onCourt.size}.`);
  if (stranded.length === 0) {
    console.log("Nothing stranded - every running game is on a court.");
    process.exit(0);
  }
  for (const g of stranded) {
    console.log(`${apply ? "Voiding" : "Would void"} game #${g.gameNumber}: ${team(g.teamAPlayerIds)} vs ${team(g.teamBPlayerIds)} (${g.status})`);
    if (!apply) continue;
    g.status = GameStatus.CANCELLED;
    await g.save();
    await SessionPlayer.updateMany(
      { _id: { $in: [...g.teamAPlayerIds, ...g.teamBPlayerIds] }, consecutiveGames: { $gt: 0 } },
      { $inc: { consecutiveGames: -1 } }
    );
  }
  if (!apply) console.log("Dry run. Add --apply to void them.");
  process.exit(0);
}
main().catch((e) => { console.error(e); process.exit(1); });

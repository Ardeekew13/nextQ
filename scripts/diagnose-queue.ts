/**
 * READ-ONLY diagnostic for "why is it picking/pairing these players?".
 * Finds a session by name (newest match) and prints its games, whether each player's stored
 * stats match what the finished games say, and what the queue engine would do right now.
 *
 *   npx tsx scripts/diagnose-queue.ts Thursdink
 *
 * It only reads. Uses MONGODB_URI from .env.local like the seed script does.
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
  const { connectToDatabase } = await import("../src/lib/db");
  const { Session } = await import("../src/models/Session");
  const { Game } = await import("../src/models/Game");
  const { SessionPlayer } = await import("../src/models/SessionPlayer");
  const { computePlayerStatistics } = await import("../src/lib/statsCore");
  const { getQueuePreview, getNextGamePreview } = await import("../src/lib/eligibility");

  const name = process.argv[2];
  if (!name) throw new Error("Pass part of the session name, e.g. Thursdink");
  await connectToDatabase();
  const session = await Session.findOne({ name: new RegExp(name, "i") }).sort({ createdAt: -1 });
  if (!session) throw new Error(`No session matching "${name}"`);
  const sid = String(session._id);
  const settings = session.settings as { queueMode?: string; maxConsecutiveGames?: number };
  console.log(`Session "${session.name}" (${sid}) mode=${settings.queueMode} maxConsecutive=${settings.maxConsecutiveGames}`);
  console.log(`separatedGroups: ${JSON.stringify((session.separatedGroups ?? []).map((g) => g.playerIds.map(String)))}`);

  const players = await SessionPlayer.find({ sessionId: session._id });
  const nameOf = new Map(players.map((p) => [String(p._id), p.name]));
  const n = (id: unknown) => nameOf.get(String(id)) ?? String(id);
  const games = await Game.find({ sessionId: session._id }).sort({ gameNumber: 1 });

  console.log(`\n== Games (${games.length}) ==`);
  for (const g of games) {
    const t = (g.completedAt ?? g.createdAt)?.toISOString().slice(11, 19);
    console.log(
      `#${g.gameNumber} ${t} ${g.status.padEnd(11)} ${g.teamAPlayerIds.map(n).join("/")} vs ${g.teamBPlayerIds.map(n).join("/")}` +
        `${g.winningTeam ? ` -> ${g.winningTeam}` : ""}${(g as { clientId?: string }).clientId ? " [offline]" : ""}`
    );
  }

  const completed = games.filter((g) => g.status === "COMPLETED" && g.winningTeam);
  const fresh = computePlayerStatistics(
    players.map((p) => String(p._id)),
    completed.map((g) => ({
      teamAPlayerIds: g.teamAPlayerIds.map(String),
      teamBPlayerIds: g.teamBPlayerIds.map(String),
      winningTeam: g.winningTeam as "A" | "B",
      playersSatOutIds: (g.playersSatOutIds ?? []).map(String),
    }))
  );

  const toObj = (m: unknown): Record<string, number> =>
    m instanceof Map ? Object.fromEntries(m) : { ...((m as Record<string, number>) ?? {}) };
  console.log(`\n== Players: stored stats vs recomputed from finished games ==`);
  let drift = 0;
  for (const p of players) {
    const f = fresh.get(String(p._id))!;
    const sp = toObj(p.partnerHistory);
    const same = JSON.stringify(Object.entries(sp).filter(([, v]) => v).sort()) === JSON.stringify(Object.entries(f.partnerHistory).sort());
    const ok = p.gamesPlayed === f.gamesPlayed && p.wins === f.wins && same;
    if (!ok) drift++;
    console.log(
      `${p.name.padEnd(10)} in:${p.checkedIn ? "Y" : "n"} act:${p.active ? "Y" : "n"} games stored ${p.gamesPlayed} / real ${f.gamesPlayed}  ` +
        `wins ${p.wins}/${f.wins}  consec ${p.consecutiveGames ?? 0}  partners ${same ? "ok" : "MISMATCH"}  ${ok ? "" : "<-- STORED STATS ARE WRONG"}`
    );
  }
  console.log(drift === 0 ? "All stored stats match the finished games." : `${drift} player(s) have stored stats that disagree with the games.`);

  console.log(`\n== Partner counts from finished games ==`);
  const pairs = new Map<string, number>();
  for (const g of completed) for (const team of [g.teamAPlayerIds, g.teamBPlayerIds]) {
    const k = team.map(n).sort().join(" + ");
    pairs.set(k, (pairs.get(k) ?? 0) + 1);
  }
  [...pairs.entries()].filter(([, v]) => v > 1).sort((a, b) => b[1] - a[1]).forEach(([k, v]) => console.log(`${v}x partners: ${k}`));

  console.log(`\n== What the engine says right now ==`);
  const queue = await getQueuePreview(sid);
  console.log(`waiting order: ${queue.map((p) => `${p.name}(${p.gamesPlayed})`).join(", ")}`);
  const next = await getNextGamePreview(sid);
  if (next) console.log(`next game: ${next.teamA.players.map((p) => p.name).join("/")} vs ${next.teamB.players.map((p) => p.name).join("/")}`);
  process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });

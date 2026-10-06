#!/usr/bin/env node
// Diagnostic: why did two players end up partnered repeatedly in a session,
// when neither is listed as the other's fixed partner?
//
// Run this from your own Mac Terminal (not inside the Cowork sandbox) so it can
// actually reach your MongoDB Atlas cluster — the sandbox can't reach Atlas directly.
//
// Usage:
//   MONGODB_URI="<your Atlas connection string>" node scripts/investigate-fixed-partners.mjs <sessionId> <nameA> <nameB>
//
// Example:
//   MONGODB_URI="..." node scripts/investigate-fixed-partners.mjs 6abbbe3a9280aab5ea74c991 leo kix
//
// (Grab the Atlas URI from the commented-out line in .env.local if you still have it there.)

import mongoose from "mongoose";

const [, , sessionId, nameA, nameB] = process.argv;

if (!sessionId || !nameA || !nameB) {
  console.error("Usage: node scripts/investigate-fixed-partners.mjs <sessionId> <nameA> <nameB>");
  process.exit(1);
}

const uri = process.env.MONGODB_URI;
if (!uri) {
  console.error("Set MONGODB_URI in the environment first.");
  process.exit(1);
}

await mongoose.connect(uri);

const { Schema, model } = mongoose;
const SessionPlayer = model("SessionPlayer", new Schema({}, { strict: false }), "sessionplayers");
const Game = model("Game", new Schema({}, { strict: false }), "games");
const Session = model("Session", new Schema({}, { strict: false }), "sessions");

const session = await Session.findById(sessionId).lean();
if (!session) {
  console.error(`No session found with id ${sessionId}`);
  process.exit(1);
}

console.log("=== SESSION ===");
console.log(JSON.stringify({ id: session._id, name: session.name, status: session.status, settings: session.settings }, null, 2));

const players = await SessionPlayer.find({ sessionId }).lean();
console.log("\n=== ALL PLAYERS (name | id | fixedPartnerId) ===");
for (const p of players) {
  console.log(`${p.name} | ${p._id} | fixedPartnerId: ${p.fixedPartnerId ? p.fixedPartnerId : "null"}`);
}

const findByName = (n) => players.find((p) => p.name?.toUpperCase().includes(n.toUpperCase()));
const a = findByName(nameA);
const b = findByName(nameB);

console.log(`\n=== "${nameA}" match ===`, a ? { id: String(a._id), name: a.name, fixedPartnerId: a.fixedPartnerId ? String(a.fixedPartnerId) : null } : "NOT FOUND");
console.log(`=== "${nameB}" match ===`, b ? { id: String(b._id), name: b.name, fixedPartnerId: b.fixedPartnerId ? String(b.fixedPartnerId) : null } : "NOT FOUND");

if (a && b) {
  const linked = String(a.fixedPartnerId || "") === String(b._id) && String(b.fixedPartnerId || "") === String(a._id);
  console.log(`\nAre they actually linked as fixed partners in the database? ${linked ? "YES" : "NO"}`);
}

const games = await Game.find({ sessionId }).sort({ gameNumber: 1 }).lean();
const idToName = new Map(players.map((p) => [String(p._id), p.name]));

console.log(`\n=== GAMES (${games.length} total) ===`);
let sameTeamCount = 0;
for (const g of games) {
  const teamA = (g.teamAPlayerIds || []).map((id) => idToName.get(String(id)) || String(id));
  const teamB = (g.teamBPlayerIds || []).map((id) => idToName.get(String(id)) || String(id));
  const satOut = (g.playersSatOutIds || []).map((id) => idToName.get(String(id)) || String(id));

  const bothIn = (list) =>
    a && b && list.some((id) => String(id) === String(a._id)) && list.some((id) => String(id) === String(b._id));
  const sameTeam = bothIn(g.teamAPlayerIds || []) || bothIn(g.teamBPlayerIds || []);
  if (sameTeam) sameTeamCount++;

  console.log(
    `Game ${g.gameNumber} [${g.status}] A:[${teamA.join(", ")}] vs B:[${teamB.join(", ")}]` +
      (satOut.length ? ` satOut:[${satOut.join(", ")}]` : "") +
      (sameTeam ? "  <<< SAME TEAM" : "")
  );
}

console.log(`\n${nameA} and ${nameB} were on the same team in ${sameTeamCount} of ${games.length} games.`);

await mongoose.disconnect();

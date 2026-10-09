import mongoose from "mongoose";

const uri = process.env.MONGODB_URI;
await mongoose.connect(uri);

const { Schema, model } = mongoose;
const SessionPlayer = model("SessionPlayer", new Schema({}, { strict: false }), "sessionplayers");
const Game = model("Game", new Schema({}, { strict: false }), "games");
const Session = model("Session", new Schema({}, { strict: false }), "sessions");

const sessionId = "6abbbe3a9280aab5ea74c991";

const session = await Session.findById(sessionId).lean();
console.log("=== SESSION ===");
console.log(JSON.stringify({ id: session?._id, name: session?.name, status: session?.status, settings: session?.settings }, null, 2));

const players = await SessionPlayer.find({ sessionId }).lean();
console.log("\n=== PLAYERS (name, id, fixedPartnerId) ===");
for (const p of players) {
  console.log(String(p._id), "|", p.name, "| fixedPartnerId:", p.fixedPartnerId ? String(p.fixedPartnerId) : null);
}

const leo = players.find(p => p.name?.toUpperCase().includes("LEO"));
const kix = players.find(p => p.name?.toUpperCase().includes("KIX"));
console.log("\nLeo match:", leo ? { id: String(leo._id), name: leo.name, fixedPartnerId: leo.fixedPartnerId ? String(leo.fixedPartnerId) : null } : "NOT FOUND");
console.log("Kix match:", kix ? { id: String(kix._id), name: kix.name, fixedPartnerId: kix.fixedPartnerId ? String(kix.fixedPartnerId) : null } : "NOT FOUND");

const games = await Game.find({ sessionId }).sort({ gameNumber: 1 }).lean();
console.log("\n=== GAMES (" + games.length + " total) ===");
const idToName = new Map(players.map(p => [String(p._id), p.name]));
for (const g of games) {
  const a = (g.teamAPlayerIds || []).map(id => idToName.get(String(id)) || String(id));
  const b = (g.teamBPlayerIds || []).map(id => idToName.get(String(id)) || String(id));
  const satOut = (g.playersSatOutIds || []).map(id => idToName.get(String(id)) || String(id));
  const leoIn = leo && [...(g.teamAPlayerIds||[]), ...(g.teamBPlayerIds||[])].some(id => String(id) === String(leo._id));
  const kixIn = kix && [...(g.teamAPlayerIds||[]), ...(g.teamBPlayerIds||[])].some(id => String(id) === String(kix._id));
  const sameTeam = leo && kix && (
    (g.teamAPlayerIds||[]).some(id=>String(id)===String(leo._id)) && (g.teamAPlayerIds||[]).some(id=>String(id)===String(kix._id))
    || (g.teamBPlayerIds||[]).some(id=>String(id)===String(leo._id)) && (g.teamBPlayerIds||[]).some(id=>String(id)===String(kix._id))
  );
  console.log(`Game ${g.gameNumber} [${g.status}] A:[${a.join(", ")}] vs B:[${b.join(", ")}] satOut:[${satOut.join(", ")}] ${sameTeam ? "<<< LEO+KIX SAME TEAM" : ""}`);
}

await mongoose.disconnect();

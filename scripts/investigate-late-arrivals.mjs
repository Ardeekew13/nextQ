#!/usr/bin/env node
// Read-only diagnostic: why did late arrivals get several games together?
// Run from your Mac Terminal (the Cowork sandbox can't reach Atlas).
//
//   node scripts/investigate-late-arrivals.mjs <sessionId> jessa rodel roldan
//
// Reads MONGODB_URI from .env.local. Prints the session settings, every player's
// check-in time + games, and every game in order (flagging games where 2+ of the
// named players appear), plus how many of the named players shared each game.
import mongoose from "mongoose";
import fs from "fs";

const [, , sessionId, ...names] = process.argv;
if (!sessionId || names.length === 0) {
  console.error("Usage: node scripts/investigate-late-arrivals.mjs <sessionId> <name> [name...]");
  process.exit(1);
}
const env = fs.readFileSync(".env.local", "utf8").split("\n").find((l) => l.startsWith("MONGODB_URI="));
await mongoose.connect(process.env.MONGODB_URI || env.slice(12).trim());

const { Schema, model } = mongoose;
const open = (n, c) => model(n, new Schema({}, { strict: false }), c);
const Session = open("Session", "sessions");
const SP = open("SessionPlayer", "sessionplayers");
const Game = open("Game", "games");

const sid = new mongoose.Types.ObjectId(sessionId);
const session = await Session.findById(sid).lean();
if (!session) { console.error("Session not found"); process.exit(1); }
console.log("Session:", session.name, "| queueMode:", session.settings?.queueMode,
  "| maxConsecutive:", session.settings?.maxConsecutiveGames, "| courts:", session.courtIds?.length);

const players = await SP.find({ sessionId: sid }).lean();
const nameOf = new Map(players.map((p) => [String(p._id), p.name]));
const targets = new Set(players.filter((p) => names.some((n) => p.name.toLowerCase().includes(n.toLowerCase()))).map((p) => String(p._id)));

console.log("\nPlayers (by check-in):");
for (const p of [...players].sort((a, b) => new Date(a.checkedInAt || 0) - new Date(b.checkedInAt || 0)))
  console.log(` ${targets.has(String(p._id)) ? "*" : " "} ${p.name.padEnd(14)} in:${p.checkedInAt ? new Date(p.checkedInAt).toISOString().slice(11, 19) : "-"} games:${p.gamesPlayed} sat:${p.gamesSatOut} active:${p.active} fixedPartner:${p.fixedPartnerId ? nameOf.get(String(p.fixedPartnerId)) : "-"}`);

const games = await Game.find({ sessionId: sid }).sort({ gameNumber: 1 }).lean();
console.log("\nGames (* = tracked player):");
for (const g of games) {
  const a = g.teamAPlayerIds.map(String), b = g.teamBPlayerIds.map(String);
  const hits = [...a, ...b].filter((id) => targets.has(id)).length;
  const fmt = (ids) => ids.map((id) => (targets.has(id) ? "*" : "") + nameOf.get(id)).join(" & ");
  console.log(` #${String(g.gameNumber).padStart(2)} ${new Date(g.createdAt).toISOString().slice(11, 19)}  ${fmt(a)}  vs  ${fmt(b)}${hits >= 2 ? `   <-- ${hits} tracked together` : ""}`);
}
await mongoose.disconnect();

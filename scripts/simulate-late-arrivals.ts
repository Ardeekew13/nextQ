/**
 * Simulates a 3.5-hour open-play session with 12 players: 8 check in at the
 * start, 2 check in 2 hours late, and 2 check in 3 hours late. Runs the
 * scenario once per QueueMode (BALANCED, SMART, HYBRID) using the exact
 * production queue engine, then prints how many games each player got so
 * you can compare how well each mode lets latecomers catch up.
 *
 * Run with: yarn tsx scripts/simulate-late-arrivals.ts
 */
import fs from "node:fs";
import path from "node:path";

function loadDotEnv() {
  for (const file of [".env.local", ".env"]) {
    const filePath = path.resolve(process.cwd(), file);
    if (!fs.existsSync(filePath)) continue;
    for (const line of fs.readFileSync(filePath, "utf-8").split("\n")) {
      const match = /^\s*([\w.-]+)\s*=\s*(.*)?\s*$/.exec(line);
      if (!match) continue;
      const key = match[1];
      let value = match[2] ?? "";
      if (value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1);
      if (!(key in process.env)) process.env[key] = value;
    }
  }
}
loadDotEnv();

import { connectToDatabase } from "../src/lib/db";
import { hashPassword } from "../src/lib/auth";
import { User } from "../src/models/User";
import { Club } from "../src/models/Club";
import { Session } from "../src/models/Session";
import { SessionPlayer, type SessionPlayerDoc } from "../src/models/SessionPlayer";
import { Court } from "../src/models/Court";
import { Game } from "../src/models/Game";
import { getEligiblePlayers } from "../src/lib/eligibility";
import { generateNextGame, type QueuePlayer } from "../src/lib/queueEngine";
import { rebuildSessionStatistics } from "../src/lib/stats";
import { SessionStatus, CourtStatus, GameStatus, QueueMode, DEFAULT_SESSION_SETTINGS } from "../src/types/enums";
import type { HydratedDocument } from "mongoose";

const ORGANISER_EMAIL = "organiser@nextq.test";
const ORGANISER_PASSWORD = process.env.SEED_PASSWORD ?? "dev-seed-only-123";
const CLUB_NAME = "Late Arrival Test Club";
const CLUB_SLUG = "late-arrival-test-club";

const ROUND_MINUTES = 15;
const SESSION_MINUTES = 210; // 3.5 hours
const NUM_COURTS = 2;

// 8 on time, 2 arrive at +120min, 2 arrive at +180min
const PLAYERS = [
  { name: "Player 01 (on time)", arrivalMinute: 0 },
  { name: "Player 02 (on time)", arrivalMinute: 0 },
  { name: "Player 03 (on time)", arrivalMinute: 0 },
  { name: "Player 04 (on time)", arrivalMinute: 0 },
  { name: "Player 05 (on time)", arrivalMinute: 0 },
  { name: "Player 06 (on time)", arrivalMinute: 0 },
  { name: "Player 07 (on time)", arrivalMinute: 0 },
  { name: "Player 08 (on time)", arrivalMinute: 0 },
  { name: "Player 09 (+2h late)", arrivalMinute: 120 },
  { name: "Player 10 (+2h late)", arrivalMinute: 120 },
  { name: "Player 11 (+3h late)", arrivalMinute: 180 },
  { name: "Player 12 (+3h late)", arrivalMinute: 180 },
];

function toQueuePlayer(doc: HydratedDocument<SessionPlayerDoc>, waitMinutes: number): QueuePlayer {
  const partnerHistory =
    doc.partnerHistory instanceof Map ? Object.fromEntries(doc.partnerHistory) : {};
  const opponentHistory =
    doc.opponentHistory instanceof Map ? Object.fromEntries(doc.opponentHistory) : {};
  return {
    id: String(doc._id),
    gamesPlayed: doc.gamesPlayed,
    consecutiveGames: doc.consecutiveGames,
    queueEnteredAt: new Date(Date.now() - waitMinutes * 60_000),
    gamesSatOut: doc.gamesSatOut,
    partnerHistory,
    opponentHistory,
  };
}

async function runScenario(mode: QueueMode) {
  const slug = `${CLUB_SLUG}-${mode.toLowerCase()}-session`;

  // --- Reset any previous run of this scenario ---
  const club = await getOrCreateClub();
  const existingSession = await Session.findOne({ clubId: club._id, slug });
  if (existingSession) {
    await Game.deleteMany({ sessionId: existingSession._id });
    await Court.deleteMany({ sessionId: existingSession._id });
    await SessionPlayer.deleteMany({ sessionId: existingSession._id });
    await existingSession.deleteOne();
  }

  const session = await Session.create({
    clubId: club._id,
    organiserId: club.organiserId,
    name: `Late Arrival Test — ${mode}`,
    slug,
    sessionDate: new Date(),
    startTime: "18:00",
    endTime: "21:30",
    status: SessionStatus.ACTIVE,
    settings: { ...DEFAULT_SESSION_SETTINGS, queueMode: mode },
    publicPublished: false,
  });

  const courts = await Court.insertMany([
    { sessionId: session._id, courtNumber: 1, name: "Court 1" },
    { sessionId: session._id, courtNumber: 2, name: "Court 2" },
  ]);
  session.courtIds = courts.map((c) => c._id);

  const playerDocs = await SessionPlayer.insertMany(
    PLAYERS.map((p) => ({
      sessionId: session._id,
      name: p.name,
      checkedIn: false,
      active: true,
    }))
  );
  session.playerIds = playerDocs.map((p) => p._id);
  await session.save();

  const arrivalById = new Map(playerDocs.map((doc, i) => [String(doc._id), PLAYERS[i].arrivalMinute]));
  // waitedMinutes tracks each player's simulated time-since-last-queue-entry
  const waitedMinutes = new Map<string, number>(playerDocs.map((doc) => [String(doc._id), 0]));
  const checkedIn = new Set<string>();

  for (let t = 0; t <= SESSION_MINUTES; t += ROUND_MINUTES) {
    // Check in anyone who has just arrived
    for (const doc of playerDocs) {
      const id = String(doc._id);
      const arrival = arrivalById.get(id)!;
      if (arrival <= t && !checkedIn.has(id)) {
        checkedIn.add(id);
        waitedMinutes.set(id, 0);
        await SessionPlayer.updateOne(
          { _id: id },
          { $set: { checkedIn: true, checkedInAt: new Date(Date.now() - (SESSION_MINUTES - t) * 60_000) } }
        );
      }
    }

    const playedThisRound = new Set<string>();

    for (const court of courts) {
      const freshCourt = await Court.findById(court._id);
      if (!freshCourt || freshCourt.status !== CourtStatus.AVAILABLE) continue;

      const eligibleDocs = await getEligiblePlayers(String(session._id));
      if (eligibleDocs.length < 4) continue;

      const eligible = eligibleDocs.map((doc) => toQueuePlayer(doc, waitedMinutes.get(String(doc._id)) ?? 0));

      const priorGames = await Game.find(
        { sessionId: session._id, status: { $ne: GameStatus.CANCELLED } },
        { teamAPlayerIds: 1, teamBPlayerIds: 1 }
      );
      const pastGroups = new Set(
        priorGames.map((g) => [...g.teamAPlayerIds, ...g.teamBPlayerIds].map(String).sort().join(":"))
      );

      const result = generateNextGame(eligible, {
        mode,
        maxConsecutiveGames: session.settings.maxConsecutiveGames ?? 2,
        pastGroups,
      });
      if (!result.ok) continue;

      const selectedIds = new Set(result.selected.map((p) => p.id));
      const playersSatOutIds = eligible.filter((p) => !selectedIds.has(p.id)).map((p) => p.id);

      const lastGame = await Game.findOne({ sessionId: session._id }).sort({ gameNumber: -1 });
      const gameNumber = (lastGame?.gameNumber ?? 0) + 1;

      const winnerIsA = Math.random() > 0.5;
      const startedAt = new Date(Date.now() - (SESSION_MINUTES - t) * 60_000);
      const completedAt = new Date(startedAt.getTime() + ROUND_MINUTES * 60_000);

      const game = await Game.create({
        sessionId: session._id,
        courtId: freshCourt._id,
        gameNumber,
        teamAPlayerIds: result.teamA.map((p) => p.id),
        teamBPlayerIds: result.teamB.map((p) => p.id),
        status: GameStatus.COMPLETED,
        teamAScore: winnerIsA ? 11 : Math.floor(Math.random() * 6) + 3,
        teamBScore: winnerIsA ? Math.floor(Math.random() * 6) + 3 : 11,
        winningTeam: winnerIsA ? "A" : "B",
        startedAt,
        completedAt,
        playersSatOutIds,
      });

      await SessionPlayer.updateMany({ _id: { $in: [...selectedIds] } }, { $inc: { consecutiveGames: 1 } });
      if (playersSatOutIds.length > 0) {
        await SessionPlayer.updateMany({ _id: { $in: playersSatOutIds } }, { $set: { consecutiveGames: 0 } });
      }
      // completeGame resets consecutiveGames + queueEnteredAt for the 4 who just played
      await SessionPlayer.updateMany({ _id: { $in: [...selectedIds] } }, { $set: { consecutiveGames: 0 } });
      for (const id of selectedIds) playedThisRound.add(id);

      freshCourt.status = CourtStatus.AVAILABLE;
      freshCourt.previousGameIds.push(game._id);
      await freshCourt.save();
    }

    // Advance each checked-in player's wait clock: reset to 0 if they just
    // played this round, otherwise they keep waiting another round.
    for (const id of checkedIn) {
      waitedMinutes.set(id, playedThisRound.has(id) ? 0 : (waitedMinutes.get(id) ?? 0) + ROUND_MINUTES);
    }
  }

  await rebuildSessionStatistics(String(session._id));

  const finalPlayers = await SessionPlayer.find({ sessionId: session._id });
  const totalGames = await Game.countDocuments({ sessionId: session._id });

  return { session, club, finalPlayers, totalGames };
}

async function getOrCreateClub() {
  let organiser = await User.findOne({ email: ORGANISER_EMAIL });
  if (!organiser) {
    const passwordHash = await hashPassword(ORGANISER_PASSWORD);
    organiser = await User.create({
      email: ORGANISER_EMAIL,
      passwordHash,
      name: "Pat Organiser",
    });
  }

  let club = await Club.findOne({ slug: CLUB_SLUG });
  if (!club) {
    club = await Club.create({
      organiserId: organiser._id,
      name: CLUB_NAME,
      slug: CLUB_SLUG,
      location: "Test Facility",
      description: "Generated by scripts/simulate-late-arrivals.ts",
    });
  }
  return club;
}

function printReport(mode: QueueMode, finalPlayers: HydratedDocument<SessionPlayerDoc>[], totalGames: number) {
  console.log(`\n=== ${mode} ===`);
  console.log(`Total games generated: ${totalGames}`);
  const rows = finalPlayers
    .map((doc) => {
      const meta = PLAYERS.find((p) => p.name === doc.name)!;
      return {
        name: doc.name,
        arrivalMinute: meta.arrivalMinute,
        gamesPlayed: doc.gamesPlayed,
        wins: doc.wins,
        losses: doc.losses,
        gamesSatOut: doc.gamesSatOut,
      };
    })
    .sort((a, b) => a.arrivalMinute - b.arrivalMinute || a.name.localeCompare(b.name));

  console.log(
    "Name".padEnd(24) + "Arrival".padEnd(12) + "Games".padEnd(8) + "W-L".padEnd(8) + "Sat Out"
  );
  for (const r of rows) {
    const arrivalLabel = r.arrivalMinute === 0 ? "on time" : `+${r.arrivalMinute / 60}h`;
    console.log(
      r.name.padEnd(24) +
        arrivalLabel.padEnd(12) +
        String(r.gamesPlayed).padEnd(8) +
        `${r.wins}-${r.losses}`.padEnd(8) +
        String(r.gamesSatOut)
    );
  }

  const onTimeAvg =
    rows.filter((r) => r.arrivalMinute === 0).reduce((s, r) => s + r.gamesPlayed, 0) /
    rows.filter((r) => r.arrivalMinute === 0).length;
  const late2hAvg =
    rows.filter((r) => r.arrivalMinute === 120).reduce((s, r) => s + r.gamesPlayed, 0) /
    rows.filter((r) => r.arrivalMinute === 120).length;
  const late3hAvg =
    rows.filter((r) => r.arrivalMinute === 180).reduce((s, r) => s + r.gamesPlayed, 0) /
    rows.filter((r) => r.arrivalMinute === 180).length;

  console.log(
    `\nAvg games — on time: ${onTimeAvg.toFixed(1)}, +2h late: ${late2hAvg.toFixed(1)}, +3h late: ${late3hAvg.toFixed(1)}`
  );
}

async function main() {
  await connectToDatabase();

  const results: Array<{ mode: QueueMode; session: any; club: any }> = [];

  for (const mode of [QueueMode.BALANCED, QueueMode.SMART, QueueMode.HYBRID]) {
    const { session, club, finalPlayers, totalGames } = await runScenario(mode);
    printReport(mode, finalPlayers, totalGames);
    results.push({ mode, session, club });
  }

  console.log(`\nOrganiser login: ${ORGANISER_EMAIL} / ${ORGANISER_PASSWORD}`);
  console.log(`(Your ADMIN account can also see this club since it lists all clubs.)`);
  for (const r of results) {
    console.log(`${r.mode} session dashboard: /dashboard/clubs/${r.club._id}`);
  }

  process.exit(0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

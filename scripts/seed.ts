/**
 * Seeds the database with one organiser, one club, one active session,
 * two courts, twelve players, several completed games, and one active game.
 *
 * Run with: npm run seed
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
import { SessionPlayer } from "../src/models/SessionPlayer";
import { Court } from "../src/models/Court";
import { Game } from "../src/models/Game";
import { getEligiblePlayers } from "../src/lib/eligibility";
import { generateGame, type MatchPlayer } from "../src/lib/matchmaking";
import { rebuildSessionStatistics } from "../src/lib/stats";
import { SessionStatus, CourtStatus, GameStatus, DEFAULT_SESSION_SETTINGS } from "../src/types/enums";

const ORGANISER_EMAIL = "organiser@nextq.test";
const ORGANISER_PASSWORD = "password123";
const CLUB_NAME = "Pickle Ann";
const CLUB_SLUG = "pickle-ann";
const SESSION_NAME = "Friday Open Play";
const SESSION_SLUG = "friday-open-play-july-24";

const PLAYER_NAMES = [
  "Alex Rivera",
  "Jordan Lee",
  "Sam Patel",
  "Casey Nguyen",
  "Morgan Diaz",
  "Taylor Kim",
  "Riley Cooper",
  "Jamie Torres",
  "Drew Bennett",
  "Reese Campbell",
  "Quinn Foster",
  "Avery Brooks",
];

function toMatchPlayer(doc: {
  _id: unknown;
  gamesPlayed: number;
  queueEnteredAt: Date;
  gamesSatOut: number;
  partnerHistory?: Map<string, number>;
  opponentHistory?: Map<string, number>;
}): MatchPlayer {
  return {
    id: String(doc._id),
    gamesPlayed: doc.gamesPlayed,
    queueEnteredAt: doc.queueEnteredAt,
    gamesSatOut: doc.gamesSatOut,
    partnerHistory: Object.fromEntries(doc.partnerHistory ?? new Map()),
    opponentHistory: Object.fromEntries(doc.opponentHistory ?? new Map()),
  };
}

async function main() {
  await connectToDatabase();

  console.log("Clearing previous seed data...");
  const existingClub = await Club.findOne({ slug: CLUB_SLUG });
  if (existingClub) {
    const sessions = await Session.find({ clubId: existingClub._id });
    for (const session of sessions) {
      await Game.deleteMany({ sessionId: session._id });
      await Court.deleteMany({ sessionId: session._id });
      await SessionPlayer.deleteMany({ sessionId: session._id });
    }
    await Session.deleteMany({ clubId: existingClub._id });
    await existingClub.deleteOne();
  }
  await User.deleteOne({ email: ORGANISER_EMAIL });

  console.log("Creating organiser...");
  const passwordHash = await hashPassword(ORGANISER_PASSWORD);
  const organiser = await User.create({
    email: ORGANISER_EMAIL,
    passwordHash,
    name: "Pat Organiser",
  });

  console.log("Creating club...");
  const club = await Club.create({
    organiserId: organiser._id,
    name: CLUB_NAME,
    slug: CLUB_SLUG,
    location: "Riverside Recreation Center",
    description: "Friendly weekly open-play pickleball sessions with random partners.",
  });

  console.log("Creating session...");
  const session = await Session.create({
    clubId: club._id,
    organiserId: organiser._id,
    name: SESSION_NAME,
    slug: SESSION_SLUG,
    sessionDate: new Date(),
    startTime: "18:00",
    endTime: "20:00",
    status: SessionStatus.ACTIVE,
    settings: DEFAULT_SESSION_SETTINGS,
    publicPublished: true,
  });

  console.log("Creating courts...");
  const courts = await Court.insertMany([
    { sessionId: session._id, courtNumber: 1, name: "Court A" },
    { sessionId: session._id, courtNumber: 2, name: "Court B" },
  ]);
  session.courtIds = courts.map((c) => c._id);

  console.log("Creating players...");
  const players = await SessionPlayer.insertMany(
    PLAYER_NAMES.map((name, index) => ({
      sessionId: session._id,
      name,
      checkedIn: true,
      active: true,
      checkedInAt: new Date(Date.now() - (PLAYER_NAMES.length - index) * 60_000),
      queueEnteredAt: new Date(Date.now() - (PLAYER_NAMES.length - index) * 60_000),
    }))
  );
  session.playerIds = players.map((p) => p._id);
  await session.save();

  async function startGameOnCourt(courtDoc: (typeof courts)[number]) {
    const eligibleDocs = await getEligiblePlayers(String(session._id));
    if (eligibleDocs.length < 4) return null;

    const eligible = eligibleDocs.map(toMatchPlayer);
    const priorGames = await Game.find(
      { sessionId: session._id, status: { $ne: GameStatus.CANCELLED } },
      { teamAPlayerIds: 1, teamBPlayerIds: 1 }
    );
    const pastGroups = new Set(
      priorGames.map((g) => [...g.teamAPlayerIds, ...g.teamBPlayerIds].map(String).sort().join(":"))
    );

    const result = generateGame(eligible, pastGroups);
    if (!result.ok || !result.selected || !result.teamA || !result.teamB) return null;

    const selectedIds = new Set(result.selected.map((p) => p.id));
    const playersSatOutIds = eligible.filter((p) => !selectedIds.has(p.id)).map((p) => p.id);

    const lastGame = await Game.findOne({ sessionId: session._id }).sort({ gameNumber: -1 });
    const gameNumber = (lastGame?.gameNumber ?? 0) + 1;

    const game = await Game.create({
      sessionId: session._id,
      courtId: courtDoc._id,
      gameNumber,
      teamAPlayerIds: result.teamA.map((p) => p.id),
      teamBPlayerIds: result.teamB.map((p) => p.id),
      status: GameStatus.IN_PROGRESS,
      startedAt: new Date(),
      playersSatOutIds,
    });

    const freshCourt = await Court.findById(courtDoc._id);
    if (!freshCourt) return null;
    freshCourt.activeGameId = game._id;
    freshCourt.status = CourtStatus.IN_USE;
    await freshCourt.save();

    return game;
  }

  async function finishGame(game: NonNullable<Awaited<ReturnType<typeof startGameOnCourt>>>) {
    const winnerIsA = Math.random() > 0.5;
    const winnerScore = 11;
    const loserScore = Math.floor(Math.random() * 6) + 3;

    game.status = GameStatus.COMPLETED;
    game.teamAScore = winnerIsA ? winnerScore : loserScore;
    game.teamBScore = winnerIsA ? loserScore : winnerScore;
    game.winningTeam = winnerIsA ? "A" : "B";
    game.completedAt = new Date();
    game.recordedBy = organiser._id;
    await game.save();

    const freshCourt = await Court.findById(game.courtId);
    if (freshCourt) {
      freshCourt.activeGameId = null;
      freshCourt.status = CourtStatus.AVAILABLE;
      freshCourt.previousGameIds.push(game._id);
      await freshCourt.save();
    }

    await SessionPlayer.updateMany(
      { _id: { $in: [...game.teamAPlayerIds, ...game.teamBPlayerIds] } },
      { $set: { queueEnteredAt: new Date() } }
    );

    await rebuildSessionStatistics(String(session._id));
  }

  console.log("Simulating completed games across both courts concurrently...");
  for (let round = 0; round < 3; round++) {
    // Start both courts' games before finishing either, so each court's
    // eligibility check correctly excludes the other court's active players -
    // matching how two real courts run concurrently during a session.
    const gameA = await startGameOnCourt(courts[0]);
    const gameB = await startGameOnCourt(courts[1]);
    if (gameA) await finishGame(gameA);
    if (gameB) await finishGame(gameB);
  }

  console.log("Starting one active (in-progress) game...");
  await startGameOnCourt(courts[0]);

  console.log("\nSeed complete.");
  console.log(`Organiser login: ${ORGANISER_EMAIL} / ${ORGANISER_PASSWORD}`);
  console.log(`Club dashboard: /dashboard/clubs/${club._id}`);
  console.log(`Public session page: /club/${CLUB_SLUG}/session/${SESSION_SLUG}`);

  process.exit(0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

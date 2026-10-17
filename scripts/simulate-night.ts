/**
 * Creates a NEW session and plays a whole simulated night in it with the real server code
 * (the same generateNextGame / completeGame the app calls), so you can open it in the app and
 * look at the queue, games, standings and warnings. Nothing else in the database is touched.
 *
 *   npx tsx scripts/simulate-night.ts [players=22] [courts=2] [hours=4] [--mix] [--rank] [--seed=1]
 *
 * Players check in over the first 15 minutes; every game lasts 11-15 minutes; each result is
 * recorded the moment a game ends and the court is filled again straight away (like auto-fill).
 * The night is placed so it ENDS NOW: the last games are still on court when you open it.
 *
 * Safety: only runs against a database whose name ends in "_e2e" or "_sim" (use the
 * E2E_MONGODB_URI / MONGODB_URI you test with), unless you add --any-database.
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
      let value = (match[2] ?? "").trim();
      if (value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1);
      if (!(match[1] in process.env)) process.env[match[1]] = value;
    }
  }
}
loadDotEnv();
if (process.env.E2E_MONGODB_URI) process.env.MONGODB_URI = process.env.E2E_MONGODB_URI;

const args = process.argv.slice(2);
const flags = new Set(args.filter((a) => a.startsWith("--")).map((a) => a.split("=")[0]));
const flagValue = (name: string) => args.find((a) => a.startsWith(`${name}=`))?.split("=")[1];
const [nPlayers, nCourts, hours] = args.filter((a) => !a.startsWith("--")).map(Number);
const PLAYERS = nPlayers || 22;
const COURTS = nCourts || 2;
const HOURS = hours || 4;
const SEED = Number(flagValue("--seed") ?? 1);

const dbName = (process.env.MONGODB_URI ?? "").split("?")[0].split("/").pop() ?? "";
if (!flags.has("--any-database") && !/_(e2e|sim)$/.test(dbName)) {
  console.error(`Refusing to write a simulated night into database "${dbName || "(none)"}".`);
  console.error(`Point E2E_MONGODB_URI (or MONGODB_URI) at a database ending in _e2e or _sim, or add --any-database.`);
  process.exit(1);
}

// ── Simulated clock ──
// Once the app code is loaded (its schemas must see the real Date), every `new Date()` /
// Date.now() in this process (the resolvers, mongoose timestamps) reads the simulated time, so
// waiting times, wait buckets and timestamps behave like a real night.
const RealDate = Date;
const MIN = 60_000;
const END = RealDate.now();
let clock = END - HOURS * 60 * MIN;
class SimDate extends RealDate {
  constructor(...a: unknown[]) {
    if (a.length === 0) super(clock);
    else super(...(a as [string | number | Date]));
  }
  static now() {
    return clock;
  }
}

let rng = SEED * 2654435761;
const random = () => ((rng = (rng * 1103515245 + 12345) % 2147483648) / 2147483648);

const NAMES = [
  "Ana", "Ben", "Carla", "Dan", "Ella", "Felix", "Gia", "Hugo", "Ivy", "Jon", "Kat", "Leo", "Mia", "Noel",
  "Olga", "Paolo", "Quinn", "Rae", "Sid", "Tess", "Uma", "Vic", "Wes", "Xena", "Yuri", "Zoe", "Ari", "Bea",
  "Cy", "Dee", "Eli", "Fay",
];

async function main() {
  const { connectToDatabase } = await import("../src/lib/db");
  const { User } = await import("../src/models/User");
  const { Club } = await import("../src/models/Club");
  const { Session } = await import("../src/models/Session");
  const { SessionPlayer } = await import("../src/models/SessionPlayer");
  const { Court } = await import("../src/models/Court");
  const { Game } = await import("../src/models/Game");
  const { gameResolvers } = await import("../src/graphql/resolvers/game");
  const { createLoaders } = await import("../src/graphql/context");
  const { SessionStatus, GameStatus, DEFAULT_SESSION_SETTINGS } = await import("../src/types/enums");
  const { findTogetherGroups } = await import("../src/lib/togetherGroups");

  await connectToDatabase(); // connect on the real clock, then switch to the simulated one
  globalThis.Date = SimDate as DateConstructor;

  const organiser = await User.findOne({ email: "organiser@nextq.test" });
  if (!organiser) throw new Error('No organiser@nextq.test in this database. Run the browser tests (or "npm run seed") once first.');
  const club = await Club.findOne({ organiserId: organiser._id });
  if (!club) throw new Error("That organiser has no club. Run the browser tests (or npm run seed) once first.");

  const startLabel = new RealDate(clock).toISOString().slice(11, 16);
  const mode = `${flags.has("--mix") ? " +mix" : ""}${flags.has("--rank") ? " +rank" : ""}`;
  const session = await Session.create({
    clubId: club._id,
    organiserId: organiser._id,
    name: `Simulated night: ${PLAYERS} players, ${COURTS} courts, ${HOURS}h${mode}`,
    slug: `simulated-${RealDate.now().toString(36)}`,
    sessionDate: new Date(),
    startTime: startLabel,
    status: SessionStatus.ACTIVE,
    settings: {
      ...DEFAULT_SESSION_SETTINGS,
      mixEveryone: flags.has("--mix"),
      rankMatchups: flags.has("--rank"),
    },
    publicPublished: false,
  });
  const courts = await Court.insertMany(
    Array.from({ length: COURTS }, (_, i) => ({ sessionId: session._id, courtNumber: i + 1, name: `Court ${String.fromCharCode(65 + i)}` }))
  );
  session.courtIds = courts.map((c) => c._id);
  await session.save();

  const context = {
    organiser: { sub: String(organiser._id), email: organiser.email, name: organiser.name ?? "Organiser", role: organiser.role ?? "ORGANISER" },
    playerNameCache: new Map(),
    csrfToken: "",
    clubHistoryCache: new Map(),
    loaders: createLoaders(),
  };
  const fresh = () => ({ ...context, loaders: createLoaders(), playerNameCache: new Map(), clubHistoryCache: new Map() });
  const M = gameResolvers.Mutation as unknown as Record<string, (p: unknown, a: unknown, c: unknown) => Promise<{ _id: unknown }>>;

  // Arrivals: spread over the first 15 minutes.
  const arrivals = Array.from({ length: PLAYERS }, (_, i) => ({ at: clock + Math.round((i / PLAYERS) * 15 * MIN), name: NAMES[i % NAMES.length] + (i >= NAMES.length ? ` ${Math.floor(i / NAMES.length) + 1}` : "") }));
  const onCourt = new Map<string, { gameId: string; endsAt: number }>(); // courtId -> game

  const tryFill = async (courtId: string) => {
    if (onCourt.has(courtId)) return;
    try {
      const game = await M.generateNextGame(null, { sessionId: String(session._id), courtId }, fresh());
      onCourt.set(courtId, { gameId: String(game._id), endsAt: clock + (11 + random() * 4) * MIN });
    } catch {
      /* not enough players waiting yet */
    }
  };

  while (clock < END) {
    const nextArrival = arrivals[0]?.at ?? Infinity;
    const nextEnd = Math.min(...[...onCourt.values()].map((g) => g.endsAt), Infinity);
    const next = Math.min(nextArrival, nextEnd);
    if (next >= END) break;
    clock = next;
    if (next === nextArrival) {
      const a = arrivals.shift()!;
      const p = await SessionPlayer.create({ sessionId: session._id, name: a.name, checkedIn: true, active: true, checkedInAt: new Date(), queueEnteredAt: new Date() });
      session.playerIds.push(p._id);
      await session.save();
    } else {
      const [courtId, g] = [...onCourt.entries()].find(([, x]) => x.endsAt === next)!;
      onCourt.delete(courtId);
      await M.completeGame(null, { id: g.gameId, input: { winningTeam: random() < 0.5 ? "A" : "B", recordedAt: new Date().toISOString() } }, fresh());
    }
    for (const c of courts) await tryFill(String(c._id)); // auto-fill every open court
  }

  // ── Summary ──
  const games = await Game.find({ sessionId: session._id, status: { $ne: GameStatus.CANCELLED } }).sort({ gameNumber: 1 });
  const players = await SessionPlayer.find({ sessionId: session._id });
  const name = new Map(players.map((p) => [String(p._id), p.name]));
  const done = games.filter((g) => g.status === GameStatus.COMPLETED);
  const perPlayer = new Map<string, number>();
  for (const g of done) for (const id of [...g.teamAPlayerIds, ...g.teamBPlayerIds]) perPlayer.set(String(id), (perPlayer.get(String(id)) ?? 0) + 1);
  const counts = players.map((p) => perPlayer.get(String(p._id)) ?? 0);
  const shared = new Map<string, number>();
  let thirdInARow = 0;
  const lastMates = new Map<string, string[][]>();
  for (const g of games) {
    const ids = [...g.teamAPlayerIds, ...g.teamBPlayerIds].map(String);
    for (let i = 0; i < 4; i++) {
      const prev = lastMates.get(ids[i]) ?? [];
      for (let j = i + 1; j < 4; j++) {
        const k = [ids[i], ids[j]].sort().join("|");
        shared.set(k, (shared.get(k) ?? 0) + 1);
        if (prev.length >= 2 && prev[0].includes(ids[j]) && prev[1].includes(ids[j])) thirdInARow++;
      }
    }
    for (const id of ids) lastMates.set(id, [ids.filter((x) => x !== id), ...(lastMates.get(id) ?? [])].slice(0, 2));
  }
  const maxShared = Math.max(...shared.values());
  const warnings = findTogetherGroups(games.map((g) => ({ id: String(g._id), gameNumber: g.gameNumber, playerIds: [...g.teamAPlayerIds, ...g.teamBPlayerIds].map(String) })), {});

  globalThis.Date = RealDate;
  console.log(`\nCreated "${session.name}" — open it from the club dashboard (log in as organiser@nextq.test).`);
  console.log(`Session page: /dashboard/sessions/${session._id}`);
  console.log(`\n${done.length} games finished, ${onCourt.size} still on court.`);
  console.log(`Games per player: ${Math.min(...counts)}–${Math.max(...counts)}`);
  console.log(`Most games any two players shared: ${maxShared} (pairs at that: ${[...shared.values()].filter((v) => v === maxShared).length} of ${(PLAYERS * (PLAYERS - 1)) / 2})`);
  console.log(`Same pair 3 games in a row: ${thirdInARow}`);
  console.log(`"Same game X times" warnings the app shows: ${warnings.length}`);
  for (const w of warnings.slice(0, 5)) console.log(`  ${w.playerIds.map((id) => name.get(id)).join(" & ")}: ${w.gamesTogether} games`);
  process.exit(0);
}

main().catch((err) => {
  globalThis.Date = RealDate;
  console.error(err);
  process.exit(1);
});

/**
 * Measures where the time goes when the session page loads and refreshes: the database round
 * trip, the full dashboard query, each part of it, and the queue snapshot. READ-ONLY.
 *
 *   npx tsx scripts/profile-session.ts [sessionId]
 *
 * Uses MONGODB_URI (or E2E_MONGODB_URI when set). Without a session id it takes the most
 * recently created active session of organiser@nextq.test.
 */
import fs from "node:fs";
import path from "node:path";

for (const file of [".env.local", ".env"]) {
  const filePath = path.resolve(process.cwd(), file);
  if (!fs.existsSync(filePath)) continue;
  for (const line of fs.readFileSync(filePath, "utf-8").split("\n")) {
    const m = /^\s*([\w.-]+)\s*=\s*(.*)?\s*$/.exec(line);
    if (!m) continue;
    let v = (m[2] ?? "").trim();
    if (v.startsWith('"') && v.endsWith('"')) v = v.slice(1, -1);
    if (!(m[1] in process.env)) process.env[m[1]] = v;
  }
}
if (process.env.E2E_MONGODB_URI) process.env.MONGODB_URI = process.env.E2E_MONGODB_URI;

const ms = (t: number) => `${Math.round(performance.now() - t)} ms`;

async function main() {
  const mongoose = (await import("mongoose")).default;
  const { print } = await import("graphql");
  const { connectToDatabase } = await import("../src/lib/db");
  const { apolloServer } = await import("../src/graphql/server");
  const { createLoaders } = await import("../src/graphql/context");
  const { User } = await import("../src/models/User");
  const { Session } = await import("../src/models/Session");
  // The app's own query documents (loaded as CommonJS: @apollo/client's gql has no ESM named export here).
  const { createRequire } = await import("node:module");
  const docs = createRequire(import.meta.url)("../src/graphql/documents/organiser.ts") as typeof import("../src/graphql/documents/organiser");
  const { SESSION_DASHBOARD_QUERY, SESSION_QUEUE_SNAPSHOT } = docs;

  let t = performance.now();
  await connectToDatabase();
  console.log(`Connect: ${ms(t)}`);

  // Database round trip (each query the server makes pays this at least once).
  const pings: number[] = [];
  for (let i = 0; i < 5; i++) {
    const s = performance.now();
    await mongoose.connection.db!.admin().ping();
    pings.push(performance.now() - s);
  }
  pings.sort((a, b) => a - b);
  console.log(`Database round trip: ~${Math.round(pings[2])} ms (min ${Math.round(pings[0])})`);

  let sessionId = process.argv[2];
  const organiser = await User.findOne(sessionId ? {} : { email: "organiser@nextq.test" });
  if (!sessionId) {
    const s = await Session.findOne({ organiserId: organiser?._id, status: "ACTIVE" }).sort({ createdAt: -1 });
    if (!s) throw new Error("No active session found; pass a session id.");
    sessionId = String(s._id);
  }
  const session = await Session.findById(sessionId);
  if (!session) throw new Error(`Session ${sessionId} not found.`);
  const owner = await User.findById(session.organiserId);
  console.log(`Session: "${session.name}" (${sessionId}), ${session.playerIds?.length ?? "?"} players`);

  let queries = 0;
  mongoose.set("debug", () => {
    queries++;
  });
  const context = () => ({
    organiser: { sub: String(owner!._id), email: owner!.email, name: owner!.name ?? "", role: owner!.role ?? "ORGANISER" },
    playerNameCache: new Map(),
    csrfToken: "",
    clubHistoryCache: new Map(),
    loaders: createLoaders(),
  });
  const run = async (label: string, query: string, variables: Record<string, unknown>) => {
    queries = 0;
    const s = performance.now();
    const res = await apolloServer.executeOperation({ query, variables }, { contextValue: context() });
    const took = Math.round(performance.now() - s);
    const body = res.body as { kind: string; singleResult?: { errors?: unknown[] } };
    const errors = body.kind === "single" ? body.singleResult?.errors : undefined;
    console.log(`${label.padEnd(28)} ${String(took).padStart(6)} ms  ${String(queries).padStart(4)} DB queries${errors ? `  ERRORS: ${JSON.stringify(errors).slice(0, 200)}` : ""}`);
    return took;
  };

  const dashboard = print(SESSION_DASHBOARD_QUERY);
  console.log("\nWhole page data (what each refresh loads):");
  await run("SessionDashboard (cold)", dashboard, { id: sessionId });
  await run("SessionDashboard", dashboard, { id: sessionId });
  await run("SessionQueueSnapshot", print(SESSION_QUEUE_SNAPSHOT), { sessionId });

  console.log("\nEach part on its own:");
  const parts: Record<string, string> = {
    courts: "courts { id currentGame { id teamA { players { id name } } teamB { players { id name } } } }",
    players: "players { id name gamesPlayed checkedIn active strength strengthTier }",
    queuedPlayers: "queuedPlayers { id name gamesPlayed queueEnteredAt }",
    nextGamePreview: "nextGamePreview { teamA { players { id } } teamB { players { id } } }",
    activeGames: "activeGames { id teamA { players { id name } } teamB { players { id name } } }",
    completedGames: "completedGames { id gameNumber teamA { players { id name } } teamB { players { id name } } court { id } edits { at } }",
    togetherGroups: "togetherGroups { id gamesTogether players { id name } games { id } }",
    standings: "standings { rank player { id name } }",
  };
  for (const [name, selection] of Object.entries(parts)) {
    await run(name, `query($id: ID!){ session(id: $id){ id ${selection} } }`, { id: sessionId });
  }
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

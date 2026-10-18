/**
 * Watchable simulation of a club night: 22 players, 2 courts, players arriving apart.
 * Drives the real UI (Fill Court / Record Result) so you can see the queue at work.
 *
 * Only runs when asked (it's long):
 *   SIM=1 npx playwright test e2e/simulate-night.spec.ts --headed
 * Slower, to follow every click:  SIM=1 SIM_STEP_MS=1500 npx playwright test e2e/simulate-night.spec.ts --headed
 * Without Mix everyone:           SIM=1 SIM_MIX=0 ...
 *
 * Uses the separate test database (nextq_e2e), never your real one. Games here last seconds,
 * not minutes, so this shows WHO gets picked and repeats; real waiting times are covered by
 * the automated simulations in tests/.
 */
import { expect, test, type Page } from "@playwright/test";
import { login, seededClubId } from "./helpers";

test.skip(!process.env.SIM, "Simulation only runs with SIM=1");
test.setTimeout(45 * 60_000);

const STEP_MS = Number(process.env.SIM_STEP_MS ?? 700);
const TOTAL_GAMES = Number(process.env.SIM_GAMES ?? 26);
const MIX = process.env.SIM_MIX !== "0";

const NAMES = [
  "Ana", "Ben", "Carlo", "Dina", "Eli", "Fe", "Gio", "Hana", // arrive first
  "Ivan", "Jessa", "Kyn", "Leo", "Mav", "Nina", "Oscar", "Pia",
  "Quino", "Rica", "Sam", "Tess", "Ulysses", "Vince",
];
/** After how many court fills each group checks in: 8 at the start, then apart. */
const ARRIVALS: Array<{ afterFills: number; names: string[] }> = [
  { afterFills: 0, names: NAMES.slice(0, 8) },
  { afterFills: 1, names: ["Ivan", "Jessa"] },
  { afterFills: 2, names: ["Kyn", "Leo", "Mav"] },
  { afterFills: 4, names: ["Nina", "Oscar"] },
  { afterFills: 5, names: ["Pia"] },
  { afterFills: 7, names: ["Quino", "Rica", "Sam"] },
  { afterFills: 9, names: ["Tess"] },
  { afterFills: 11, names: ["Ulysses", "Vince"] },
];

async function gql<T = any>(page: Page, query: string, variables: Record<string, unknown> = {}): Promise<T> {
  const res = await page.request.post("/api/graphql", { data: { query, variables } });
  const body = await res.json();
  if (body.errors?.length) throw new Error(body.errors.map((e: any) => e.message).join("; "));
  return body.data as T;
}

/** A small banner in the corner so arrivals are visible while watching. */
async function announce(page: Page, text: string) {
  await page.evaluate((t) => {
    let el = document.getElementById("sim-banner");
    if (!el) {
      el = document.createElement("div");
      el.id = "sim-banner";
      el.style.cssText =
        "position:fixed;top:12px;right:12px;z-index:99999;background:#111827;color:#fff;padding:10px 14px;border-radius:8px;font:600 14px system-ui;box-shadow:0 4px 16px rgba(0,0,0,.25);max-width:360px";
      document.body.appendChild(el);
    }
    el.textContent = t;
  }, text);
}

test("simulate a night: 22 players, 2 courts, arriving apart", async ({ page }) => {
  let seed = 7;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const pause = () => page.waitForTimeout(STEP_MS);

  await login(page);
  const clubId = seededClubId();

  // Fresh session in the test database (finish the seeded one first).
  const active = await gql(page, "query($c:ID!){ activeSession(clubId:$c){ id } }", { c: clubId });
  if (active.activeSession?.id) await gql(page, "mutation($id:ID!){ finishSession(id:$id){ id } }", { id: active.activeSession.id });
  const created = await gql(page,
    "mutation($i:CreateSessionInput!){ createSession(input:$i){ id } }",
    { i: { clubId, name: `Sim night ${new Date().toISOString().slice(11, 16)}`, sessionDate: new Date().toISOString(), numberOfCourts: 2, settings: { mixEveryone: MIX, balanceTeams: true } } });
  const sessionId: string = created.createSession.id;
  const added = await gql(page,
    "mutation($s:ID!,$in:[AddPlayerInput!]!){ addSessionPlayers(sessionId:$s, inputs:$in){ id name } }",
    { s: sessionId, in: NAMES.map((name) => ({ name })) });
  const idOf = new Map<string, string>(added.addSessionPlayers.map((p: any) => [p.name, p.id]));
  await gql(page, "mutation($id:ID!){ startSession(id:$id){ id } }", { id: sessionId });

  await page.goto(`/dashboard/sessions/${sessionId}`);
  const fillBtn = page.getByRole("button", { name: "Fill Court" });
  const recordBtn = page.getByRole("button", { name: "Record Result" });
  const arrivedAtFill = new Map<string, number>();

  let fills = 0;
  const checkInDue = async () => {
    const due = ARRIVALS.filter((a) => a.afterFills === fills && !a.names.every((n) => arrivedAtFill.has(n)));
    for (const group of due) {
      for (const n of group.names) {
        await gql(page, "mutation($id:ID!){ checkInPlayer(id:$id, checkedIn:true){ id } }", { id: idOf.get(n) });
        arrivedAtFill.set(n, fills);
      }
      await page.reload();
      await expect.poll(async () => (await recordBtn.count()) + (await fillBtn.count()), { timeout: 15_000 }).toBeGreaterThan(0);
      await announce(page, `Checked in: ${group.names.join(", ")}`);
      console.log(`  -- after ${fills} fills: ${group.names.join(", ")} check in`);
      await pause();
    }
  };

  await checkInDue();
  while (fills < TOTAL_GAMES) {
    // Fill an open court if there is one and enough people are waiting.
    if ((await fillBtn.count()) > 0 && (await fillBtn.first().isEnabled())) {
      const before = await recordBtn.count();
      await fillBtn.first().click();
      const filled = await expect(recordBtn).toHaveCount(before + 1, { timeout: 8_000 }).then(() => true, () => false);
      if (filled) {
        fills++;
        await announce(page, `Court filled (game ${fills})`);
        await pause();
        await checkInDue();
        continue;
      }
    }
    // Otherwise finish one of the running games with a random winner. (Give the courts a moment
    // to load first, e.g. right after a reload for a check-in.)
    await expect.poll(async () => (await recordBtn.count()) + (await fillBtn.count()), { timeout: 15_000 }).toBeGreaterThan(0);
    const running = await recordBtn.count();
    if (running === 0) throw new Error("No games running and no court could be filled");
    await recordBtn.nth(Math.floor(rnd() * running)).click();
    await page.getByRole("dialog").getByText(rnd() < 0.5 ? "Team A" : "Team B").first().click();
    await expect(recordBtn).toHaveCount(running - 1);
    await announce(page, "Result recorded");
    await pause();
  }

  // ── Summary from the server ──
  const data = await gql(page, `query($id:ID!){ session(id:$id){
      players { id name }
      completedGames { gameNumber teamA { players { id } } teamB { players { id } } }
      activeGames { gameNumber teamA { players { id } } teamB { players { id } } } } }`, { id: sessionId });
  const name = new Map<string, string>(data.session.players.map((p: any) => [p.id, p.name]));
  const games = [...data.session.completedGames, ...data.session.activeGames]
    .sort((a: any, b: any) => a.gameNumber - b.gameNumber)
    .map((g: any) => ({ n: g.gameNumber, ids: [...g.teamA.players, ...g.teamB.players].map((p: any) => p.id) as string[] }));

  const perPlayer = new Map<string, number[]>();
  for (const g of games) for (const id of g.ids) perPlayer.set(id, [...(perPlayer.get(id) ?? []), g.n]);
  const pairCount = new Map<string, number>();
  let backToBack = 0, threeInARow = 0;
  for (const g of games) for (let i = 0; i < 4; i++) for (let j = i + 1; j < 4; j++) {
    const k = [name.get(g.ids[i]), name.get(g.ids[j])].sort().join(" & ");
    pairCount.set(k, (pairCount.get(k) ?? 0) + 1);
    const seq = perPlayer.get(g.ids[i])!; const idx = seq.indexOf(g.n);
    const other = perPlayer.get(g.ids[j])!;
    const prev = seq[idx - 1], prev2 = seq[idx - 2];
    if (prev !== undefined && other.includes(prev)) {
      backToBack++;
      if (prev2 !== undefined && other.includes(prev2)) threeInARow++;
    }
  }

  console.log(`\n===== Sim night: ${games.length} games, ${MIX ? "Hybrid + Mix everyone" : "Hybrid"} =====`);
  console.log("Game log:");
  for (const g of games) console.log(`  #${String(g.n).padStart(2)} ${g.ids.slice(0, 2).map((i) => name.get(i)).join(" + ")}  vs  ${g.ids.slice(2).map((i) => name.get(i)).join(" + ")}`);
  console.log("\nPlayer        arrived after   games   first game");
  for (const n of NAMES) {
    const id = idOf.get(n)!; const seq = perPlayer.get(id) ?? [];
    console.log(`  ${n.padEnd(10)}  ${String(arrivedAtFill.get(n) ?? "-").padStart(4)} fills    ${String(seq.length).padStart(3)}     ${seq[0] ? `#${seq[0]}` : "never"}`);
  }
  const counts = NAMES.map((n) => (perPlayer.get(idOf.get(n)!) ?? []).length);
  console.log(`\nGames per player: min ${Math.min(...counts)}, max ${Math.max(...counts)}`);
  console.log(`Pairs together 3+ times: ${[...pairCount].filter(([, c]) => c >= 3).map(([k, c]) => `${k} (${c})`).join(", ") || "none"}`);
  console.log(`Pairs back-to-back (in each other's previous game): ${backToBack}   |   3 games in a row: ${threeInARow}`);
  await announce(page, `Done: ${games.length} games. See the terminal for the summary.`);
  await page.waitForTimeout(3_000);
});

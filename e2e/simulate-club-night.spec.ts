/**
 * A full, watchable club night with the things that really happen:
 *   - 22 players, 2 courts, arriving apart — including a group of 6 at once
 *   - two pairs ask to be fixed partners part-way through
 *   - someone who's up next is in the CR: they sit out, the organiser edits that court to swap
 *     in the next person waiting, and they come back a few games later (happens twice)
 *   - near the end, 4 players leave
 *
 *   SIM=1 npx playwright test e2e/simulate-club-night.spec.ts --headed
 *   Slower:  SIM=1 SIM_STEP_MS=1500 ...     Longer: SIM_GAMES=40 ...     Without Mix everyone: SIM_MIX=0 ...
 *
 * Uses the separate test database (nextq_e2e), never your real one. Games last seconds here,
 * so this shows who gets picked, catch-up, repeats and the manual steps — not real wait times.
 */
import { expect, test, type Page } from "@playwright/test";
import { login, seededClubId } from "./helpers";

test.skip(!process.env.SIM, "Simulation only runs with SIM=1");
test.setTimeout(60 * 60_000);

const STEP_MS = Number(process.env.SIM_STEP_MS ?? 700);
const TOTAL_GAMES = Number(process.env.SIM_GAMES ?? 32);
const MIX = process.env.SIM_MIX !== "0";

const NAMES = [
  "Ana", "Ben", "Carlo", "Dina", "Eli", "Fe", "Gio", "Hana",
  "Ivan", "Jessa", "Kyn", "Leo",
  "Mav", "Nina", "Oscar", "Pia", "Quino", "Rica", // the late group of 6
  "Sam", "Tess", "Ulysses", "Vince",
];
const LATE_GROUP = ["Mav", "Nina", "Oscar", "Pia", "Quino", "Rica"];

type Event =
  | { kind: "arrive"; names: string[] }
  | { kind: "partners"; pairs: Array<[string, string]> }
  | { kind: "cr" }
  | { kind: "leave"; names: string[] };
/** What happens after a given number of court fills. */
const TIMELINE: Record<number, Event[]> = {
  0: [{ kind: "arrive", names: NAMES.slice(0, 8) }],
  1: [{ kind: "arrive", names: ["Ivan", "Jessa"] }],
  3: [{ kind: "arrive", names: ["Kyn", "Leo"] }],
  5: [{ kind: "arrive", names: LATE_GROUP }],
  7: [{ kind: "arrive", names: ["Sam", "Tess"] }],
  9: [{ kind: "partners", pairs: [["Ana", "Ben"], ["Kyn", "Leo"]] }],
  10: [{ kind: "arrive", names: ["Ulysses", "Vince"] }],
  13: [{ kind: "cr" }],
  19: [{ kind: "cr" }],
  25: [{ kind: "leave", names: ["Carlo", "Dina", "Gio", "Tess"] }],
};
const CR_AWAY_FILLS = 3;

async function gql<T = any>(page: Page, query: string, variables: Record<string, unknown> = {}): Promise<T> {
  const res = await page.request.post("/api/graphql", { data: { query, variables } });
  const body = await res.json();
  if (body.errors?.length) throw new Error(body.errors.map((e: any) => e.message).join("; "));
  return body.data as T;
}

async function announce(page: Page, text: string) {
  await page.evaluate((t) => {
    let el = document.getElementById("sim-banner");
    if (!el) {
      el = document.createElement("div");
      el.id = "sim-banner";
      el.style.cssText =
        "position:fixed;top:12px;right:12px;z-index:99999;background:#111827;color:#fff;padding:10px 14px;border-radius:8px;font:600 14px system-ui;box-shadow:0 4px 16px rgba(0,0,0,.25);max-width:380px";
      document.body.appendChild(el);
    }
    el.textContent = t;
  }, text);
}

test("simulate a club night: late group, partner requests, CR swaps, early leavers", async ({ page }) => {
  let seed = 11;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const pause = (ms = STEP_MS) => page.waitForTimeout(ms);
  const story: string[] = [];
  const say = async (text: string) => {
    story.push(`after ${fills} fills: ${text}`);
    console.log(`  -- after ${fills} fills: ${text}`);
    await announce(page, text);
    await pause(STEP_MS * 2);
  };

  await login(page);
  const clubId = seededClubId();
  const active = await gql(page, "query($c:ID!){ activeSession(clubId:$c){ id } }", { c: clubId });
  if (active.activeSession?.id) await gql(page, "mutation($id:ID!){ finishSession(id:$id){ id } }", { id: active.activeSession.id });
  const created = await gql(page, "mutation($i:CreateSessionInput!){ createSession(input:$i){ id } }", {
    i: { clubId, name: `Club night ${new Date().toISOString().slice(11, 16)}`, sessionDate: new Date().toISOString(), numberOfCourts: 2, settings: { mixEveryone: MIX, balanceTeams: true } },
  });
  const sessionId: string = created.createSession.id;
  const added = await gql(page, "mutation($s:ID!,$in:[AddPlayerInput!]!){ addSessionPlayers(sessionId:$s, inputs:$in){ id name } }", {
    s: sessionId, in: NAMES.map((name) => ({ name })),
  });
  const idOf = new Map<string, string>(added.addSessionPlayers.map((p: any) => [p.name, p.id]));
  const nameOf = new Map<string, string>([...idOf].map(([n, id]) => [id, n]));
  await gql(page, "mutation($id:ID!){ startSession(id:$id){ id } }", { id: sessionId });

  await page.goto(`/dashboard/sessions/${sessionId}`);
  const fillBtn = page.getByRole("button", { name: "Fill Court" });
  const recordBtn = page.getByRole("button", { name: "Record Result" });
  const courtsLoaded = () => expect.poll(async () => (await recordBtn.count()) + (await fillBtn.count()), { timeout: 15_000 }).toBeGreaterThan(0);
  const refresh = async () => { await page.reload(); await courtsLoaded(); };

  let fills = 0;
  const arrivedAt = new Map<string, number>();
  const leftAt = new Map<string, number>();
  const crReturns: Array<{ name: string; atFill: number }> = [];
  const crLog: string[] = [];
  const handled = new Set<number>();
  const setActive = (name: string, on: boolean) =>
    gql(page, "mutation($id:ID!,$a:Boolean!){ setPlayerActiveStatus(id:$id, active:$a){ id } }", { id: idOf.get(name), a: on });

  const runEvents = async () => {
    // People back from the CR rejoin the queue.
    for (const r of crReturns.filter((x) => x.atFill === fills)) {
      await setActive(r.name, true);
      await refresh();
      await say(`${r.name} is back from the CR and in the queue again`);
    }
    if (handled.has(fills)) return;
    handled.add(fills);
    for (const ev of TIMELINE[fills] ?? []) {
      if (ev.kind === "arrive") {
        for (const n of ev.names) {
          await gql(page, "mutation($id:ID!){ checkInPlayer(id:$id, checkedIn:true){ id } }", { id: idOf.get(n) });
          arrivedAt.set(n, fills);
        }
        await refresh();
        await say(`Checked in: ${ev.names.join(", ")}${ev.names.length >= 5 ? " (a late group)" : ""}`);
      } else if (ev.kind === "partners") {
        for (const [a, b] of ev.pairs) {
          await gql(page, "mutation($id:ID!,$in:UpdatePlayerInput!){ updateSessionPlayer(id:$id, input:$in){ id } }", { id: idOf.get(a), in: { fixedPartnerId: idOf.get(b) } });
        }
        await refresh();
        await say(`Partner requests: ${ev.pairs.map(([a, b]) => `${a} & ${b}`).join(", ")} are now fixed partners`);
      } else if (ev.kind === "leave") {
        for (const n of ev.names) { await setActive(n, false); leftAt.set(n, fills); }
        await refresh();
        await say(`Going home: ${ev.names.join(", ")} (sit out for the rest of the night)`);
      } else if (ev.kind === "cr") {
        // The game just filled has someone who's in the CR: swap them for the next person waiting.
        const d = await gql(page, `query($id:ID!){ session(id:$id){
            activeGames { id gameNumber teamA { players { id fixedPartnerId } } teamB { players { id fixedPartnerId } } }
            queuedPlayers { id fixedPartnerId } } }`, { id: sessionId });
        const game = [...d.session.activeGames].sort((x: any, y: any) => y.gameNumber - x.gameNumber)[0];
        const all = [...game.teamA.players, ...game.teamB.players];
        const away = all.find((p: any) => !p.fixedPartnerId);
        const sub = d.session.queuedPlayers.find((p: any) => !p.fixedPartnerId && p.id !== away?.id);
        if (!game || !away || !sub) continue;
        await setActive(nameOf.get(away.id)!, false);
        const swap = (ids: string[]) => ids.map((id) => (id === away.id ? sub.id : id));
        await gql(page, "mutation($id:ID!,$a:[ID!]!,$b:[ID!]!){ updateGameTeams(id:$id, teamAPlayerIds:$a, teamBPlayerIds:$b){ id } }", {
          id: game.id, a: swap(game.teamA.players.map((p: any) => p.id)), b: swap(game.teamB.players.map((p: any) => p.id)),
        });
        crReturns.push({ name: nameOf.get(away.id)!, atFill: fills + CR_AWAY_FILLS });
        crLog.push(`game #${game.gameNumber}: ${nameOf.get(away.id)} in the CR, ${nameOf.get(sub.id)} took the spot`);
        await refresh();
        await say(`${nameOf.get(away.id)} is in the CR — court edited: ${nameOf.get(sub.id)} plays game ${game.gameNumber} instead`);
      }
    }
  };

  await runEvents();
  while (fills < TOTAL_GAMES) {
    if ((await fillBtn.count()) > 0 && (await fillBtn.first().isEnabled())) {
      const before = await recordBtn.count();
      await fillBtn.first().click();
      const filled = await expect(recordBtn).toHaveCount(before + 1, { timeout: 8_000 }).then(() => true, () => false);
      if (filled) {
        fills++;
        await announce(page, `Court filled (game ${fills})`);
        await pause();
        await runEvents();
        continue;
      }
    }
    await courtsLoaded();
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
      players { id name fixedPartnerId }
      completedGames { gameNumber edited teamA { players { id } } teamB { players { id } } }
      activeGames { gameNumber edited teamA { players { id } } teamB { players { id } } } } }`, { id: sessionId });
  const fixedOf = new Map<string, string | null>(data.session.players.map((p: any) => [p.id, p.fixedPartnerId]));
  const games = [...data.session.completedGames, ...data.session.activeGames]
    .sort((a: any, b: any) => a.gameNumber - b.gameNumber)
    .map((g: any) => ({ n: g.gameNumber, edited: g.edited, a: g.teamA.players.map((p: any) => p.id) as string[], b: g.teamB.players.map((p: any) => p.id) as string[] }));
  const nm = (id: string) => nameOf.get(id) ?? id;
  const seq = new Map<string, number[]>();
  for (const g of games) for (const id of [...g.a, ...g.b]) seq.set(id, [...(seq.get(id) ?? []), g.n]);

  // repeats (fixed partners excluded)
  const pairCount = new Map<string, number>();
  let backToBack = 0, threeInARow = 0;
  for (const g of games) {
    const ids = [...g.a, ...g.b];
    for (let i = 0; i < 4; i++) for (let j = i + 1; j < 4; j++) {
      if (fixedOf.get(ids[i]) === ids[j]) continue;
      const k = [nm(ids[i]), nm(ids[j])].sort().join(" & ");
      pairCount.set(k, (pairCount.get(k) ?? 0) + 1);
      const s = seq.get(ids[i])!; const at = s.indexOf(g.n); const o = seq.get(ids[j])!;
      if (at >= 1 && o.includes(s[at - 1])) { backToBack++; if (at >= 2 && o.includes(s[at - 2])) threeInARow++; }
    }
  }
  // late group: games where 3+ of them played together
  const lateIds = new Set(LATE_GROUP.map((n) => idOf.get(n)!));
  const lateBunched = games.filter((g) => [...g.a, ...g.b].filter((id) => lateIds.has(id)).length >= 3);
  // fixed partners after the request: always on the same team?
  const pairCheck = [["Ana", "Ben"], ["Kyn", "Leo"]].map(([x, y]) => {
    const ix = idOf.get(x)!, iy = idOf.get(y)!;
    const after = games.filter((g) => g.n > 9 && ([...g.a, ...g.b].includes(ix) || [...g.a, ...g.b].includes(iy)));
    const together = after.filter((g) => (g.a.includes(ix) && g.a.includes(iy)) || (g.b.includes(ix) && g.b.includes(iy))).length;
    return `${x} & ${y}: ${together} of ${after.length} games after the request on the same team`;
  });

  const wholeNight = NAMES.filter((n) => (arrivedAt.get(n) ?? 99) <= 1 && !leftAt.has(n));
  const counts = (ns: string[]) => ns.map((n) => (seq.get(idOf.get(n)!) ?? []).length);

  console.log(`\n===== Club night: ${games.length} games, ${MIX ? "Hybrid + Mix everyone" : "Hybrid"} =====`);
  console.log("What happened:");
  for (const line of story) console.log(`  ${line}`);
  console.log("\nGame log:");
  for (const g of games) console.log(`  #${String(g.n).padStart(2)} ${g.a.map(nm).join(" + ")}  vs  ${g.b.map(nm).join(" + ")}${g.edited ? "   [edited]" : ""}`);
  console.log("\nPlayer        arrived   left    games   first game");
  for (const n of NAMES) {
    const s = seq.get(idOf.get(n)!) ?? [];
    console.log(`  ${n.padEnd(10)}  ${String(arrivedAt.get(n) ?? "-").padStart(5)}   ${String(leftAt.get(n) ?? "-").padStart(4)}   ${String(s.length).padStart(4)}     ${s[0] ? `#${s[0]}` : "never"}${LATE_GROUP.includes(n) ? "   (late group)" : ""}`);
  }
  console.log(`\nStayed all night (${wholeNight.length}): games min ${Math.min(...counts(wholeNight))}, max ${Math.max(...counts(wholeNight))}`);
  console.log(`Late group of 6: games ${counts(LATE_GROUP).join(", ")} | games with 3+ of them together: ${lateBunched.length}${lateBunched.length ? ` (#${lateBunched.map((g) => g.n).join(", #")})` : ""}`);
  console.log(`Fixed partners: ${pairCheck.join(" | ")}`);
  console.log(`CR swaps: ${crLog.join(" | ") || "none"}`);
  console.log(`Edited games: ${games.filter((g) => g.edited).map((g) => `#${g.n}`).join(", ") || "none"}`);
  console.log(`Pairs together 3+ times (fixed partners excluded): ${[...pairCount].filter(([, c]) => c >= 3).map(([k, c]) => `${k} (${c})`).join(", ") || "none"}`);
  console.log(`Back-to-back pairs: ${backToBack}   |   3 games in a row: ${threeInARow}`);
  await announce(page, `Done: ${games.length} games. Summary is in the terminal.`);
  await pause(3_000);
});

import { expect, test, type Page } from "@playwright/test";
import { activeSessionId, courtLineups, gql, login, resetToOneGame } from "./helpers";

type P = { id: string; name: string };
const SESSION = `query($id: ID!){ session(id: $id){
  players { id name fixedPartnerId checkedIn }
  queuedPlayers { id name }
  matchRequests { id }
  courts { id courtNumber currentGame { id teamA { players { id name } } teamB { players { id name } } } }
} }`;

async function load(page: Page, id: string) {
  const s = (await gql(page, SESSION, { id })).session;
  s.courts.sort((a: { courtNumber: number }, b: { courtNumber: number }) => a.courtNumber - b.courtNumber);
  return s;
}

/** Same starting point every test: no fixed partners, requests, bumps or custom order, one game on court 1. */
async function reset(page: Page, id: string) {
  const s = await load(page, id);
  for (const p of s.players.filter((x: { fixedPartnerId?: string }) => x.fixedPartnerId)) {
    await gql(page, "mutation($id: ID!){ updateSessionPlayer(id: $id, input: { fixedPartnerId: null }){ id } }", { id: p.id });
  }
  // Late arrivals added by earlier tests go home again.
  for (const p of s.players.filter((x: { name: string; checkedIn: boolean }) => x.name.startsWith("Late ") && x.checkedIn)) {
    await gql(page, "mutation($id: ID!){ checkInPlayer(id: $id, checkedIn: false){ id } }", { id: p.id });
  }
  for (const r of s.matchRequests) {
    await gql(page, "mutation($s: ID!, $r: ID!){ cancelMatchRequest(sessionId: $s, requestId: $r){ id } }", { s: id, r: r.id });
  }
  // Saving an order clears anyone bumped to the front; then clear the order itself.
  await gql(page, "mutation($s: ID!, $p: [ID!]!){ setManualQueueOrder(sessionId: $s, playerIds: $p){ id } }", { s: id, p: [s.players[0].id] });
  await gql(page, "mutation($s: ID!){ clearManualQueueOrder(sessionId: $s){ id } }", { s: id });
  await resetToOneGame(page, id);
}

async function onDeck(page: Page): Promise<string[]> {
  const names = await page.getByTestId("on-deck-player").allTextContents();
  return names.map((n) => n.trim()).sort();
}

const consoleErrors: string[] = [];
test.beforeEach(async ({ page }) => {
  consoleErrors.length = 0;
  page.on("console", (m) => { if (m.type() === "error") consoleErrors.push(m.text()); });
  await login(page);
  await reset(page, await activeSessionId(page));
});

test.afterEach(() => {
  // React warnings (bad keys, invalid DOM nesting...) show as console errors: none allowed here.
  expect(consoleErrors.filter((e) => !/Failed to load resource|net::ERR|antd: compatible/.test(e))).toEqual([]);
});

test("Fill Court puts exactly the four On Deck showed on court", async ({ page }) => {
  const id = await activeSessionId(page);
  await page.goto(`/dashboard/sessions/${id}`);
  await expect(page.getByTestId("on-deck-player")).toHaveCount(4);
  const promised = await onDeck(page);
  await page.getByRole("button", { name: "Fill Court" }).click();
  await expect(page.getByRole("button", { name: "Record Result" })).toHaveCount(2);
  expect(await courtLineups(page)).toContain(promised.join(","));
});

test("a player taken out of a game by a lineup edit is up next", async ({ page }) => {
  const id = await activeSessionId(page);
  const s = await load(page, id);
  const game = s.courts[0].currentGame;
  const out: P = game.teamA.players[0];
  const sub: P = s.queuedPlayers[s.queuedPlayers.length - 1];
  await gql(page, "mutation($g: ID!, $a: [ID!]!, $b: [ID!]!){ updateGameTeams(id: $g, teamAPlayerIds: $a, teamBPlayerIds: $b){ id } }", {
    g: game.id,
    a: [sub.id, game.teamA.players[1].id],
    b: game.teamB.players.map((p: P) => p.id),
  });
  await page.goto(`/dashboard/sessions/${id}`);
  await expect(page.getByTestId("on-deck-player")).toHaveCount(4);
  expect(await onDeck(page)).toContain(out.name);
  await page.getByRole("button", { name: "Fill Court" }).click();
  await expect(page.getByRole("button", { name: "Record Result" })).toHaveCount(2);
  expect((await courtLineups(page)).join(",")).toContain(out.name);
});

test("fixed partners are marked, and splitting them in a lineup edit warns", async ({ page }) => {
  const id = await activeSessionId(page);
  const s = await load(page, id);
  const onCourt: P = s.courts[0].currentGame.teamA.players[0];
  const waiting: P = s.queuedPlayers[0];
  await gql(page, "mutation($id: ID!, $p: ID!){ updateSessionPlayer(id: $id, input: { fixedPartnerId: $p }){ id } }", { id: waiting.id, p: onCourt.id });

  await page.goto(`/dashboard/sessions/${id}`);
  await expect(page.getByText(`Fixed partner: ${onCourt.name}`, { exact: true })).toBeVisible();
  await expect(page.getByLabel(`Fixed partner ${waiting.name}`).first()).toBeVisible(); // mark on the court card

  // The court player is on a team, their partner is waiting: the lineup as it stands splits them.
  await page.getByRole("button", { name: "Edit lineup" }).first().click();
  await expect(page.getByRole("alert").filter({ hasText: "fixed partners" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Save anyway" })).toBeVisible();
  await page.getByRole("button", { name: "Cancel" }).click();

  // And in the custom-order editor.
  await page.getByRole("button", { name: "Edit order" }).click();
  await expect(page.getByTestId("queue-order-row").filter({ hasText: waiting.name })).toContainText(`Fixed partner: ${onCourt.name}`);
  await expect(page.getByText(/Fixed partners always play together/)).toBeVisible();
});

test("request a match from the form: it waits for its last player, and can be removed", async ({ page }) => {
  const id = await activeSessionId(page);
  const q: P[] = (await load(page, id)).queuedPlayers;
  const [a, b] = [q[0], q[1]];
  const [c, d] = [q[3], q[q.length - 1]];
  await page.goto(`/dashboard/sessions/${id}`);
  await expect(page.getByTestId("on-deck-player")).toHaveCount(4);

  await page.getByRole("button", { name: "Request match" }).click();
  const dialog = page.getByRole("dialog", { name: "Request a match" });
  const pick = async (index: number, names: string[]) => {
    const box = dialog.getByRole("combobox").nth(index);
    for (const name of names) {
      await box.click();
      await box.fill(name);
      // Typing the full name leaves it as the highlighted option; Enter picks it.
      await expect(page.getByRole("option", { name, exact: true })).toHaveCount(1);
      await box.press("Enter");
    }
    await box.press("Escape"); // close the list so it doesn't cover the next box
  };
  await pick(0, [a.name, b.name]);
  await pick(1, [c.name, d.name]);
  await expect(dialog.getByText(a.name, { exact: true })).toBeVisible();
  await expect(dialog.getByText(d.name, { exact: true })).toBeVisible();
  await dialog.getByRole("button", { name: "Request" }).click();
  await expect(dialog).toBeHidden();

  await expect(page.getByText(`Requested: ${a.name} & ${b.name} vs ${c.name} & ${d.name}`)).toBeVisible();
  await expect(page.getByText(new RegExp(`plays when ${d.name}'s turn comes`))).toBeVisible();
  // A and B were up next, but they now wait for D: On Deck has moved on to others.
  expect(await onDeck(page)).not.toContain(a.name);

  await page.getByRole("button", { name: "Remove requested match" }).click();
  await expect(page.getByText(/^Requested:/)).toHaveCount(0);
  expect(await onDeck(page)).toContain(a.name);
});

test("a requested match goes on court together, on the requested teams", async ({ page }) => {
  const id = await activeSessionId(page);
  const q: P[] = (await load(page, id)).queuedPlayers;
  const teamA = [q[0].id, q[1].id];
  const teamB = [q[3].id, q[q.length - 1].id];
  await gql(page, "mutation($s: ID!, $a: [ID!]!, $b: [ID!]!){ requestMatch(sessionId: $s, teamAPlayerIds: $a, teamBPlayerIds: $b){ id } }", { s: id, a: teamA, b: teamB });

  let played: { teamA: string[]; teamB: string[] } | null = null;
  for (let step = 0; step < 12 && !played; step++) {
    const s = await load(page, id);
    const free = s.courts.find((c: { currentGame: unknown }) => !c.currentGame);
    if (free) {
      const g = (await gql(page, "mutation($s: ID!, $c: ID!){ generateNextGame(sessionId: $s, courtId: $c){ teamA { players { id } } teamB { players { id } } } }", { s: id, c: free.id })).generateNextGame;
      const ids = (t: { players: { id: string }[] }) => t.players.map((p) => p.id).sort();
      const all = [...ids(g.teamA), ...ids(g.teamB)];
      const requested = [...teamA, ...teamB];
      // Never only some of the four: they play together or not at all.
      expect(requested.filter((x) => all.includes(x)).length === 0 || requested.every((x) => all.includes(x))).toBe(true);
      if (requested.every((x) => all.includes(x))) played = { teamA: ids(g.teamA), teamB: ids(g.teamB) };
    } else {
      const oldest = s.courts.find((c: { currentGame: unknown }) => c.currentGame).currentGame;
      await gql(page, "mutation($g: ID!){ completeGame(id: $g, input: { winningTeam: A }){ id } }", { g: oldest.id });
    }
  }
  expect(played).not.toBeNull();
  expect([played!.teamA, played!.teamB].map((t) => t.join()).sort()).toEqual([teamA.sort().join(), teamB.sort().join()].sort());
  expect((await load(page, id)).matchRequests).toEqual([]);
});

test("a dragged custom order is followed exactly, and keeps being followed after results", async ({ page }) => {
  const id = await activeSessionId(page);
  await page.goto(`/dashboard/sessions/${id}`);
  await expect(page.getByTestId("on-deck-player")).toHaveCount(4);

  await page.getByRole("button", { name: "Edit order" }).click();
  const rows = page.getByTestId("queue-order-row");
  await expect(rows).toHaveCount(8);
  // Keyboard drag (same as the mouse): last player to the top, then the (new) 2nd to the bottom.
  const drag = async (from: number, steps: number) => {
    await rows.nth(from).focus();
    await page.keyboard.press("Space");
    await page.waitForTimeout(150); // picked up
    for (let i = 0; i < Math.abs(steps); i++) {
      await page.keyboard.press(steps < 0 ? "ArrowUp" : "ArrowDown");
      await page.waitForTimeout(120); // let each step's move animation settle
    }
    await page.keyboard.press("Space");
    await page.waitForTimeout(250);
  };
  const names = () => rows.evaluateAll((els) => els.map((el) => el.querySelector("span span")?.textContent?.trim() ?? ""));
  const initial = await names();
  await drag(7, -7);
  await expect.poll(async () => (await names())[0]).toBe(initial[7]);
  await drag(1, 6);
  const saved = await names();
  // The drags really moved people: the old last is now first, the old first went down the list.
  expect(saved[0]).toBe(initial[7]);
  expect(saved.indexOf(initial[0])).toBeGreaterThan(1);
  expect([...saved].sort()).toEqual([...initial].sort());
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByText(/Custom order active/)).toBeVisible();

  // The queue shows exactly that order, and On Deck is its first four.
  await expect.poll(async () => page.getByTestId("queue-row").evaluateAll((els) => els.map((el) => el.getAttribute("data-player-name")))).toEqual(saved);
  expect(await onDeck(page)).toEqual(saved.slice(0, 4).sort());

  // Fill the open court: the first four play.
  await page.getByRole("button", { name: "Fill Court" }).click();
  await expect(page.getByRole("button", { name: "Record Result" })).toHaveCount(2);
  expect(await courtLineups(page)).toContain(saved.slice(0, 4).sort().join(","));

  // A result on the other court: auto-fill puts the NEXT four of the saved order on it.
  const before = await courtLineups(page);
  const other = before.findIndex((l) => l !== saved.slice(0, 4).sort().join(","));
  await page.getByRole("button", { name: "Record Result" }).nth(other).click();
  await page.getByRole("dialog").getByText("Team A").first().click();
  await expect.poll(async () => (await courtLineups(page))[other]).toBe(saved.slice(4, 8).sort().join(","));
});

test("late arrivals: a new player gets the next court; someone back from a break can be dragged in", async ({ page }) => {
  const id = await activeSessionId(page);
  const back: P = (await load(page, id)).queuedPlayers[0]; // has played; will step out and return
  const name = `Late ${Date.now().toString().slice(-5)}`;
  const added = (await gql(page, "mutation($s: ID!, $n: String!){ addSessionPlayer(sessionId: $s, input: { name: $n }){ id } }", { s: id, n: name })).addSessionPlayer;
  await gql(page, "mutation($id: ID!){ checkInPlayer(id: $id, checkedIn: true){ id } }", { id: added.id });
  await gql(page, "mutation($id: ID!){ checkInPlayer(id: $id, checkedIn: false){ id } }", { id: back.id });
  await gql(page, "mutation($id: ID!){ checkInPlayer(id: $id, checkedIn: true){ id } }", { id: back.id });

  await page.goto(`/dashboard/sessions/${id}`);
  await expect(page.getByTestId("on-deck-player")).toHaveCount(4);
  // The new arrival is in On Deck straight away; the returning player waits behind the others.
  expect(await onDeck(page)).toContain(name);
  expect(await onDeck(page)).not.toContain(back.name);

  // The organiser can still drag the returning player to the front.
  await page.getByRole("button", { name: "Edit order" }).click();
  const rows = page.getByTestId("queue-order-row");
  const names = await rows.evaluateAll((els) => els.map((el) => el.querySelector("span span")?.textContent?.trim() ?? ""));
  const from = names.indexOf(back.name);
  await rows.nth(from).focus();
  await page.keyboard.press("Space");
  for (let i = 0; i < from; i++) {
    await page.keyboard.press("ArrowUp");
    await page.waitForTimeout(80);
  }
  await page.keyboard.press("Space");
  await page.waitForTimeout(200);
  await page.getByRole("button", { name: "Save" }).click();
  await expect.poll(async () => onDeck(page)).toContain(back.name);

  // Fill Court plays exactly that On Deck.
  const promised = await onDeck(page);
  await page.getByRole("button", { name: "Fill Court" }).click();
  await expect(page.getByRole("button", { name: "Record Result" })).toHaveCount(2);
  expect(await courtLineups(page)).toContain(promised.join(","));
});

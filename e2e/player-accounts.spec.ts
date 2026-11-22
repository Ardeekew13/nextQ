import { expect, test } from "@playwright/test";
import { activeSessionId, gql, login, seededClubId } from "./helpers";

/** Two people with the same name stay two accounts: picking "No, a new player" never merges them. */
test("adding a name that matches a club member asks who it is, and 'new player' keeps them apart", async ({ page }) => {
  await login(page);
  const id = await activeSessionId(page);
  const name = `XAVIER${Date.now().toString().slice(-5)}`;
  // Someone of that name is already on the club roster (from an earlier session).
  const existing = (await gql(page, "mutation($c: ID!, $n: String!){ addClubMember(clubId: $c, input: { name: $n }){ id } }", { c: seededClubId(), n: name })).addClubMember;

  // The one-time "Enjoying the session so far?" prompt would cover the page.
  await page.addInitScript((sid) => { try { window.localStorage.setItem(`support-prompt-mid-${sid}`, "1"); } catch { /* ignore */ } }, id);
  await page.goto(`/dashboard/sessions/${id}`);
  await page.getByRole("tab", { name: "Players" }).click();
  await page.getByRole("button", { name: /Add player/i }).first().click();
  const dialog = page.getByRole("dialog", { name: "Add players" });
  await dialog.getByPlaceholder("PLAYER NAME").fill(name);
  await dialog.getByRole("button", { name: "Add player" }).click();

  const who = page.getByRole("dialog", { name: `Who is ${name}?` });
  await expect(who).toBeVisible();
  await expect(who.getByRole("button", { name: `Yes — ${name}` })).toBeVisible();
  await who.getByRole("button", { name: "No, a new player" }).click();
  await expect(who).toBeHidden();

  const find = async () =>
    ((await gql(page, "query($id: ID!){ session(id: $id){ players { name memberId } } }", { id })).session.players as Array<{ name: string; memberId: string }>).find((p) => p.name === name);
  await expect.poll(find).toBeTruthy();
  const added = (await find())!;
  expect(added.memberId).toBeTruthy();
  expect(added.memberId).not.toBe(existing.id); // a separate account, not merged with the roster member
});

test("import from Reclub: link by Reclub account, and a renamed Reclub player is still the same person", async ({ page }) => {
  await login(page);
  const id = await activeSessionId(page);
  await page.addInitScript((sid) => { try { window.localStorage.setItem(`support-prompt-mid-${sid}`, "1"); } catch { /* ignore */ } }, id);
  await page.goto(`/dashboard/sessions/${id}`);
  await page.getByRole("tab", { name: "Players" }).click();

  const openReclub = async (link: string) => {
    await page.getByRole("button", { name: /Add player/i }).first().click();
    const dialog = page.getByRole("dialog", { name: "Add players" });
    // The dialog animates in; retry the tab click until it's really selected.
    const tab = dialog.getByRole("tab", { name: "From Reclub" });
    await expect(async () => {
      await tab.click();
      await expect(tab).toHaveAttribute("aria-selected", "true", { timeout: 1_000 });
    }).toPass();
    await dialog.getByLabel("Reclub event link").fill(link);
    await dialog.getByRole("button", { name: "Read" }).click();
    await expect(dialog.getByText(/E2E rally/)).toBeVisible();
    return dialog;
  };

  // First import: Pong and his +1 are new; Waity is on the waitlist, so he isn't listed at all.
  let dialog = await openReclub("reclub.co/m/E2E001");
  const rows = dialog.getByTestId("reclub-row");
  await expect(rows).toHaveCount(2);
  await expect(rows.filter({ hasText: "Guesty" })).toContainText("+1 guest of Pong");
  await expect(dialog.getByText("Waity")).toHaveCount(0);
  await dialog.getByRole("button", { name: "Add 2 players" }).click();
  await expect(dialog).toBeHidden();

  const players = async () =>
    (await gql(page, "query($id: ID!){ session(id: $id){ players { name memberId } } }", { id })).session.players as Array<{ name: string; memberId: string }>;
  // Names are stored in uppercase however Reclub spells them.
  await expect.poll(async () => (await players()).map((p) => p.name)).toEqual(expect.arrayContaining(["PONG", "GUESTY"]));
  const pong = (await players()).find((p) => p.name === "PONG")!;
  expect(pong.memberId).toBeTruthy();

  // Next event: Pong renamed himself "Jhon P" on Reclub. Same Reclub account -> same player.
  await page.reload();
  await page.getByRole("tab", { name: "Players" }).click();
  dialog = await openReclub("https://reclub.co/m/E2E002");
  await expect(dialog.getByTestId("reclub-row").filter({ hasText: "Jhon P" })).toContainText("Already in this session as PONG");
});

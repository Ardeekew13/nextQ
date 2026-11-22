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

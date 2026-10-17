/**
 * No internet and intermittent internet, in a real browser against the real server.
 * Each test ends with the session as it found it shape-wise (same number of games on court),
 * and checks that after a reload the server shows exactly what the organiser saw.
 */
import { expect, test, type Page } from "@playwright/test";
import { activeSessionId, courtLineups, login, waitForSynced } from "./helpers";

async function openSession(page: Page) {
  await login(page);
  const id = await activeSessionId(page);
  const snapshot = page.waitForResponse(
    (r) => r.url().includes("/api/graphql") && (r.request().postData() ?? "").includes("sessionQueueSnapshot")
  );
  await page.goto(`/dashboard/sessions/${id}`);
  await snapshot;
  await expect(page.getByRole("button", { name: "Record Result" }).first()).toBeVisible();
}

async function recordFirstResult(page: Page, team: "Team A" | "Team B" = "Team A") {
  await page.getByRole("button", { name: "Record Result" }).first().click();
  await page.getByRole("dialog").getByText(team).first().click();
  await expect(page.getByRole("dialog")).toBeHidden();
}

test("no internet: several results with auto-fill, a refresh while offline, then everything syncs", async ({ page, context }) => {
  await openSession(page);
  const games = await page.getByRole("button", { name: "Record Result" }).count();

  await context.setOffline(true);
  await expect(page.getByText("You're offline.")).toBeVisible();
  for (const team of ["Team A", "Team B", "Team A"] as const) {
    const before = await courtLineups(page);
    await recordFirstResult(page, team);
    // Auto-fill: still the same number of games, with a new line-up on court.
    await expect(page.getByRole("button", { name: "Record Result" })).toHaveCount(games);
    expect(await courtLineups(page)).not.toEqual(before);
  }
  const seen = await courtLineups(page);

  // The page is reloaded with no connection (tablet slept, browser restarted…): nothing is lost.
  await page.reload().catch(() => {}); // offline reload may show the browser's error page
  await context.setOffline(false);
  await page.goto(page.url());
  await waitForSynced(page);
  await page.reload();
  await expect(page.getByRole("button", { name: "Record Result" })).toHaveCount(games);
  expect(await courtLineups(page)).toEqual(seen);
});

test("intermittent: requests fail at random and the signal drops between actions, nothing is lost or doubled", async ({ page, context }) => {
  await openSession(page);
  const games = await page.getByRole("button", { name: "Record Result" }).count();
  const completed = async () => {
    const res = await page.request.post("/api/graphql", {
      data: { query: "query($id: ID!){ session(id: $id){ completedGames { id } } }", variables: { id: page.url().split("/").pop() } },
    });
    return ((await res.json())?.data?.session?.completedGames ?? []).length as number;
  };
  const doneBefore = await completed();

  // Flaky network: some requests never arrive, some arrive but the answer is lost.
  let n = 0;
  await page.route("**/api/graphql", async (route) => {
    n++;
    if (n % 3 === 0) return route.abort("failed"); // lost on the way
    if (n % 3 === 1) {
      await route.fetch().catch(() => {}); // the server gets it…
      return route.abort("failed"); // …but the answer never comes back
    }
    return route.continue();
  });

  for (let i = 0; i < 4; i++) {
    if (i % 2 === 1) await context.setOffline(true); // signal drops for this one
    await recordFirstResult(page, i % 2 ? "Team B" : "Team A");
    await expect(page.getByRole("button", { name: "Record Result" })).toHaveCount(games);
    await context.setOffline(false);
  }
  const seen = await courtLineups(page);

  // Signal is good again.
  await page.unroute("**/api/graphql");
  await waitForSynced(page, 60_000);
  await page.reload();
  await expect(page.getByRole("button", { name: "Record Result" })).toHaveCount(games);
  expect(await courtLineups(page)).toEqual(seen);
  // Exactly 4 more finished games on the server: no result lost, none saved twice.
  expect(await completed()).toBe(doneBefore + 4);
});

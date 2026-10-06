import { expect, test } from "@playwright/test";
import { activeSessionId, login } from "./helpers";

test("session overview shows courts and the waiting queue", async ({ page }) => {
  await login(page);
  const id = await activeSessionId(page);
  await page.goto(`/dashboard/sessions/${id}`);
  await expect(page.getByText("Waiting Queue")).toBeVisible();
  await expect(page.getByRole("button", { name: "Record Result" })).toHaveCount(1);
});

test("works offline: record a result, fill a court, then syncs when back online", async ({ page, context }) => {
  await login(page);
  const id = await activeSessionId(page);

  // Load once online so the queue snapshot is on the device.
  const snapshot = page.waitForResponse(
    (r) => r.url().includes("/api/graphql") && (r.request().postData() ?? "").includes("sessionQueueSnapshot")
  );
  await page.goto(`/dashboard/sessions/${id}`);
  await snapshot;
  await expect(page.getByRole("button", { name: "Record Result" })).toHaveCount(1);

  await context.setOffline(true);
  await expect(page.getByText("You're offline.")).toBeVisible();

  // Record the running game's result: the court frees up immediately.
  await page.getByRole("button", { name: "Record Result" }).click();
  await page.getByRole("dialog").getByText("Team A").first().click();
  await expect(page.getByRole("button", { name: "Record Result" })).toHaveCount(0);

  // Fill a court with no connection: a game appears on it.
  await page.getByRole("button", { name: "Fill Court" }).first().click();
  await expect(page.getByRole("button", { name: "Record Result" })).toHaveCount(1);

  // Back online: everything syncs and the game is still there after a reload.
  await context.setOffline(false);
  await expect(page.getByText("You're offline.")).toBeHidden();
  await expect(page.getByText(/saved action/)).toBeHidden({ timeout: 30_000 });
  await page.reload();
  await expect(page.getByRole("button", { name: "Record Result" })).toHaveCount(1);
});

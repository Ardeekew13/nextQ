import { expect, test } from "@playwright/test";
import { E2E_EMAIL, E2E_PASSWORD } from "./env";
import { login } from "./helpers";

test("organiser can log in and reach the dashboard", async ({ page }) => {
  await login(page);
  await expect(page).toHaveURL(/\/dashboard/);
});

test("a wrong password does not log in", async ({ page }) => {
  await page.goto("/login");
  await page.getByPlaceholder("Enter your email").first().fill(E2E_EMAIL);
  await page.getByPlaceholder("Password").first().fill(`${E2E_PASSWORD}-wrong`);
  await page.getByRole("button", { name: "Log In" }).first().click();
  await expect(page).toHaveURL(/\/login/);
});

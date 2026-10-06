import fs from "node:fs";
import path from "node:path";
import { expect, type Page } from "@playwright/test";
import { E2E_EMAIL, E2E_PASSWORD } from "./env";

export function seededClubId(): string {
  return JSON.parse(fs.readFileSync(path.join(process.cwd(), "e2e", ".seed.json"), "utf-8")).clubId;
}

export async function login(page: Page) {
  await page.goto("/login");
  await page.getByPlaceholder("Enter your email").first().fill(E2E_EMAIL);
  await page.getByPlaceholder("Password").first().fill(E2E_PASSWORD);
  await page.getByRole("button", { name: "Log In" }).first().click();
  await expect(page).toHaveURL(/\/dashboard/);
}

/** Looks up the seeded club's active session through the API (uses the login cookie). */
export async function activeSessionId(page: Page): Promise<string> {
  const res = await page.request.post("/api/graphql", {
    data: {
      query: "query($clubId: ID!){ activeSession(clubId: $clubId){ id } }",
      variables: { clubId: seededClubId() },
    },
  });
  const body = await res.json();
  const id = body?.data?.activeSession?.id;
  if (!id) throw new Error(`No active session found: ${JSON.stringify(body)}`);
  return id;
}

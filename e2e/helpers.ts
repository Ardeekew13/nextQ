import fs from "node:fs";
import path from "node:path";
import { expect, type Page } from "@playwright/test";
import { E2E_EMAIL, E2E_PASSWORD } from "./env";

export function seededClubId(): string {
  return JSON.parse(fs.readFileSync(path.join(process.cwd(), "e2e", ".seed.json"), "utf-8")).clubId;
}

export async function login(page: Page) {
  await page.goto("/login");
  await page.getByRole("textbox", { name: "Email" }).fill(E2E_EMAIL);
  await page.getByRole("textbox", { name: "Password" }).fill(E2E_PASSWORD);
  await page.getByRole("button", { name: "Log in", exact: true }).click();
  await expect(page).toHaveURL(/\/dashboard/);
  // The first-time "fixed partners" tour covers the whole screen; mark it seen so it
  // doesn't block clicks in the tests.
  await page.request.post("/api/graphql", { data: { query: "mutation { markFixedPartnerTourSeen }" } });
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

/** Waits until everything this browser recorded has reached the server (the on-device queue
 * of results and games is empty). The "Syncing…" banner only shows for slow syncs now, so it
 * can't be used for this. */
export async function waitForSynced(page: Page, timeout = 30_000) {
  await page.waitForFunction(
    () => {
      try {
        const list = JSON.parse(window.localStorage.getItem("nextq.pendingResults.v1") ?? "[]");
        return Array.isArray(list) && list.length === 0;
      } catch {
        return false;
      }
    },
    null,
    { timeout }
  );
}

/** Who is on each court right now, as shown on screen (one sorted, comma-joined list per court;
 * "" for an open court). */
export async function courtLineups(page: Page): Promise<string[]> {
  return page.getByTestId("court-card").evaluateAll((cards) =>
    cards.map((card) =>
      [...card.querySelectorAll('[data-testid="court-player"]')]
        .map((el) => (el.textContent ?? "").trim())
        .sort()
        .join(",")
    )
  );
}

async function gql(page: Page, query: string, variables: Record<string, unknown>) {
  const res = await page.request.post("/api/graphql", { data: { query, variables } });
  const body = await res.json();
  if (body.errors?.length) throw new Error(`GraphQL: ${JSON.stringify(body.errors)}`);
  return body.data;
}

/**
 * Puts the session in the same state before every test: exactly one game running (on the first
 * court), the other court open, and the support prompt already seen. Tests share one database and some leave it differently
 * (e.g. a test that fails halfway), which would otherwise break every test after it.
 */
export async function resetToOneGame(page: Page, sessionId: string) {
  // The one-time "Enjoying the session so far?" prompt would cover the page mid-test.
  await page.addInitScript((id) => {
    try {
      window.localStorage.setItem(`support-prompt-mid-${id}`, "1");
    } catch {
      /* ignore */
    }
  }, sessionId);
  const data = await gql(page, "query($id: ID!){ session(id: $id){ courts { id courtNumber currentGame { id } } } }", { id: sessionId });
  const courts = [...data.session.courts].sort((a: { courtNumber: number }, b: { courtNumber: number }) => a.courtNumber - b.courtNumber);
  for (const c of courts) {
    if (c.currentGame) await gql(page, "mutation($id: ID!){ cancelGame(id: $id){ id } }", { id: c.currentGame.id });
  }
  await gql(page, "mutation($s: ID!, $c: ID!){ generateNextGame(sessionId: $s, courtId: $c){ id } }", { s: sessionId, c: courts[0].id });
}

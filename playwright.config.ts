import { defineConfig, devices } from "@playwright/test";
import { E2E_BASE_URL, E2E_JWT_SECRET, E2E_MONGODB_URI, E2E_PORT, assertSafeDatabase } from "./e2e/env";

assertSafeDatabase(E2E_MONGODB_URI);

export default defineConfig({
  testDir: "./e2e",
  globalSetup: "./e2e/global-setup.ts",
  // Tests share one seeded database and mutate it, so run them one at a time.
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: [["list"], ["html", { open: "never" }]],
  timeout: 60_000,
  expect: { timeout: 10_000 },
  use: {
    baseURL: E2E_BASE_URL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        // Use a browser that's already installed instead of Playwright's own download (handy when
        // `npx playwright install` can't download): E2E_BROWSER=msedge (always on Windows) or chrome.
        ...(process.env.E2E_BROWSER ? { channel: process.env.E2E_BROWSER } : {}),
      },
    },
  ],
  webServer: {
    // Own dev server on its own port with the test database, so it can't touch the one you
    // use day to day.
    command: `npx next dev -p ${E2E_PORT}`,
    url: `${E2E_BASE_URL}/login`,
    reuseExistingServer: false,
    timeout: 180_000,
    env: {
      MONGODB_URI: E2E_MONGODB_URI,
      JWT_SECRET: E2E_JWT_SECRET,
      // Tests fire requests much faster than people do: don't rate limit them.
      RATE_LIMIT_ORGANISER_MAX: "1000000",
      RATE_LIMIT_PUBLIC_MAX: "1000000",
      RATE_LIMIT_IP_CEILING: "1000000",
      NEXT_PUBLIC_APP_URL: E2E_BASE_URL,
    },
  },
});

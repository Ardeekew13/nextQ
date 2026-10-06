import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { E2E_JWT_SECRET, E2E_MONGODB_URI, E2E_PASSWORD, assertSafeDatabase } from "./env";

/** Seeds the e2e database (organiser, club, active session, courts, players) before the run. */
export default function globalSetup() {
  assertSafeDatabase(E2E_MONGODB_URI);
  const out = execFileSync("npx", ["tsx", "scripts/seed.ts"], {
    cwd: process.cwd(),
    encoding: "utf-8",
    env: {
      ...process.env,
      MONGODB_URI: E2E_MONGODB_URI,
      JWT_SECRET: E2E_JWT_SECRET,
      SEED_PASSWORD: E2E_PASSWORD,
    },
  });
  const clubId = /\/dashboard\/clubs\/([a-f0-9]{24})/.exec(out)?.[1];
  if (!clubId) throw new Error(`Seed did not report a club id:\n${out}`);
  fs.writeFileSync(path.join(process.cwd(), "e2e", ".seed.json"), JSON.stringify({ clubId }));
}

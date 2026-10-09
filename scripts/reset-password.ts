/**
 * Sets a new password for one organiser account, straight in the database (for when email
 * reset isn't set up). You type the password at a hidden prompt, so it never appears in your
 * shell history or on screen.
 *
 *   npx tsx scripts/reset-password.ts someone@example.com
 *
 * Uses MONGODB_URI from .env.local, so check which database that points at first.
 */
import fs from "node:fs";
import path from "node:path";
import readline from "node:readline";

for (const file of [".env.local", ".env"]) {
  const filePath = path.resolve(process.cwd(), file);
  if (!fs.existsSync(filePath)) continue;
  for (const line of fs.readFileSync(filePath, "utf-8").split("\n")) {
    const m = /^\s*([\w.-]+)\s*=\s*(.*)?\s*$/.exec(line);
    if (!m) continue;
    let v = m[2] ?? "";
    if (v.startsWith('"') && v.endsWith('"')) v = v.slice(1, -1);
    if (!(m[1] in process.env)) process.env[m[1]] = v;
  }
}

function ask(question: string, hidden = false): Promise<string> {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    if (hidden) {
      (rl as unknown as { _writeToOutput: (s: string) => void })._writeToOutput = (s: string) => {
        if (s.includes(question)) process.stdout.write(s);
      };
    }
    rl.question(question, (answer) => {
      rl.close();
      if (hidden) process.stdout.write("\n");
      resolve(answer);
    });
  });
}

async function main() {
  const email = (process.argv[2] ?? "").trim().toLowerCase();
  if (!email) throw new Error("Usage: npx tsx scripts/reset-password.ts <email>");

  const { connectToDatabase } = await import("../src/lib/db");
  const { User } = await import("../src/models/User");
  const { hashPassword } = await import("../src/lib/auth");

  const host = (process.env.MONGODB_URI ?? "").replace(/\/\/[^@]*@/, "//***@").split("?")[0];
  console.log(`Database: ${host}`);
  await connectToDatabase();

  const user = await User.findOne({ email });
  if (!user) throw new Error(`No account with email ${email} in that database.`);
  console.log(`Found account: ${user.name} <${user.email}>`);

  const first = await ask("New password (hidden): ", true);
  if (first.length < 8) throw new Error("Use at least 8 characters.");
  const second = await ask("Type it again: ", true);
  if (first !== second) throw new Error("The two passwords didn't match. Nothing was changed.");

  user.passwordHash = await hashPassword(first);
  user.resetPasswordTokenHash = null;
  user.resetPasswordExpires = null;
  await user.save();
  console.log(`Done. ${email} can now log in with the new password.`);
  process.exit(0);
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});

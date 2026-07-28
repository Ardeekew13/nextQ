import { connectToDatabase } from "../src/lib/db";
import { User } from "../src/models/User";
import { hashPassword } from "../src/lib/auth";

async function main() {
  const email = process.argv[2];
  const newPassword = process.argv[3];
  if (!email || !newPassword) {
    console.error("Usage: npx tsx scripts/resetPassword.ts <email> <newPassword>");
    process.exit(1);
  }
  await connectToDatabase();
  const passwordHash = await hashPassword(newPassword);
  const result = await User.updateOne({ email }, { passwordHash });
  if (result.matchedCount === 0) {
    console.error(`No user found with email: ${email}`);
    process.exit(1);
  }
  console.log(`✅ Password reset for ${email}`);
  process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });

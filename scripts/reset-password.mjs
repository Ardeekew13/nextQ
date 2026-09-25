#!/usr/bin/env node
// One-off password reset for a pickleq organiser account.
// Run this from your own Mac Terminal (not inside the Cowork sandbox) so it can
// actually reach your MongoDB Atlas cluster.
//
// Usage:
//   MONGODB_URI="<your Atlas connection string>" node scripts/reset-password.mjs you@example.com "NewPassword123!"
//
// (Grab the Atlas URI from the commented-out line in .env.local if you still have it there.)

import mongoose from "mongoose";
import bcrypt from "bcryptjs";

const [, , email, newPassword] = process.argv;

if (!email || !newPassword) {
  console.error("Usage: node scripts/reset-password.mjs <email> <newPassword>");
  process.exit(1);
}

if (
  newPassword.length < 12 ||
  !/[A-Z]/.test(newPassword) ||
  !/[0-9]/.test(newPassword) ||
  !/[!@#$%^&*]/.test(newPassword)
) {
  console.error(
    "New password must be 12+ characters and include an uppercase letter, a number, and a special character (!@#$%^&*) — same rule the app enforces on signup."
  );
  process.exit(1);
}

const uri = process.env.MONGODB_URI;
if (!uri) {
  console.error("Set MONGODB_URI first, e.g.:\n  MONGODB_URI=\"mongodb+srv://...\" node scripts/reset-password.mjs ...");
  process.exit(1);
}

const UserSchema = new mongoose.Schema({
  email: String,
  passwordHash: String,
  name: String,
  role: String,
});
const User = mongoose.models.User || mongoose.model("User", UserSchema);

async function main() {
  await mongoose.connect(uri);
  const user = await User.findOne({ email: email.trim().toLowerCase() });
  if (!user) {
    console.error(`No user found with email "${email}"`);
    process.exit(1);
  }
  user.passwordHash = await bcrypt.hash(newPassword, 10);
  await user.save();
  console.log(`Password updated for ${user.email}. You can log in with the new password now.`);
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

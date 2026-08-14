import mongoose from "mongoose";
import { User } from "../src/models/User";
import { UserRole } from "../src/types/enums";

const email = process.argv[2];

if (!email) {
  console.error("Usage: yarn ts-node scripts/make-admin.ts <email>");
  process.exit(1);
}

async function makeAdmin() {
  try {
    await mongoose.connect(process.env.MONGODB_URI || "");

    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      console.error(`User with email ${email} not found`);
      process.exit(1);
    }

    user.role = UserRole.ADMIN;
    await user.save();

    console.log(`✓ User ${email} is now an ADMIN`);
    process.exit(0);
  } catch (error) {
    console.error("Error:", error);
    process.exit(1);
  }
}

makeAdmin();

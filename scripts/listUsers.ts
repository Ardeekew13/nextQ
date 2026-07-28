import { connectToDatabase } from "../src/lib/db";
import { User } from "../src/models/User";

async function main() {
  await connectToDatabase();
  const users = await User.find({}, "email name createdAt").lean();
  console.log("\nUsers in database:");
  users.forEach((u: any) => console.log(` • ${u.email}  (${u.name})`));
  process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });

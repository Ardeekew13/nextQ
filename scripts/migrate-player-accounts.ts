/**
 * Player accounts: links every session player to a club member account (ClubMember), so stats
 * follow the person rather than the name. Dry run by default; add --apply to write.
 *
 *   npx tsx scripts/migrate-player-accounts.ts            # what it would do
 *   npx tsx scripts/migrate-player-accounts.ts --apply    # do it
 *
 * - Drops the old "one member per name per club" unique index (two Christians are now allowed)
 *   and creates the new indexes.
 * - For each session player without an account: the one club member with that name in the
 *   session's club, or a new member if there's none. Names shared by several members are listed
 *   for you to sort out (their games can't be told apart automatically).
 *
 * Uses MONGODB_URI from .env.local like the other scripts.
 */
import fs from "node:fs";
import path from "node:path";

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

async function main() {
  const apply = process.argv.includes("--apply");
  const { connectToDatabase } = await import("../src/lib/db");
  const { ClubMember } = await import("../src/models/ClubMember");
  const { SessionPlayer } = await import("../src/models/SessionPlayer");
  const { Session } = await import("../src/models/Session");
  await connectToDatabase();

  const indexes = await ClubMember.collection.indexes();
  const oldUnique = indexes.find((i) => i.unique && JSON.stringify(i.key) === JSON.stringify({ clubId: 1, name: 1 }));
  console.log(oldUnique ? `Old unique name index: ${oldUnique.name} (${apply ? "dropping" : "would drop"})` : "Old unique name index: already gone");
  if (apply) {
    if (oldUnique?.name) await ClubMember.collection.dropIndex(oldUnique.name);
    await ClubMember.syncIndexes();
    await SessionPlayer.syncIndexes();
  }

  const clubOf = new Map((await Session.find({}).select("clubId organiserId").lean()).map((s) => [String(s._id), s]));
  const members = await ClubMember.find({}).select("clubId name").lean();
  const byClubName = new Map<string, typeof members>();
  const keyOf = (clubId: unknown, name: string) => `${String(clubId)}|${name.trim().toLowerCase()}`;
  for (const m of members) {
    const k = keyOf(m.clubId, m.name);
    byClubName.set(k, [...(byClubName.get(k) ?? []), m]);
  }

  const unlinked = await SessionPlayer.find({ $or: [{ memberId: null }, { memberId: { $exists: false } }] }).select("sessionId name").lean();
  let linked = 0;
  let created = 0;
  const ambiguous = new Map<string, number>();
  for (const p of unlinked) {
    const session = clubOf.get(String(p.sessionId));
    if (!session) continue;
    const k = keyOf(session.clubId, p.name);
    const found = byClubName.get(k) ?? [];
    if (found.length > 1) {
      ambiguous.set(k, (ambiguous.get(k) ?? 0) + 1);
      continue;
    }
    let memberId = found[0]?._id;
    if (!memberId) {
      created += 1;
      if (apply) {
        const m = await ClubMember.create({ clubId: session.clubId, organiserId: session.organiserId, name: p.name.trim() });
        memberId = m._id;
        byClubName.set(k, [m.toObject() as never]);
      } else {
        byClubName.set(k, [{ _id: "new", clubId: session.clubId, name: p.name } as never]);
      }
    }
    linked += 1;
    if (apply && memberId) await SessionPlayer.updateOne({ _id: p._id }, { $set: { memberId } });
  }
  console.log(`${unlinked.length} session players without an account: ${linked} ${apply ? "linked" : "would be linked"} (${created} new members), ${[...ambiguous.values()].reduce((a, b) => a + b, 0)} left for you.`);
  for (const [k, n] of ambiguous) console.log(`  shared name "${k.split("|")[1]}" in club ${k.split("|")[0]}: ${n} session player(s)`);
  if (!apply) console.log("Dry run. Add --apply to write.");
  process.exit(0);
}
main().catch((e) => { console.error(e); process.exit(1); });

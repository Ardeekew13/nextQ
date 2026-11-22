import { GraphQLError } from "graphql";
import { ClubMember } from "@/models/ClubMember";
import { SessionPlayer } from "@/models/SessionPlayer";
import { isSameName } from "@/lib/playerNames";

type SessionLike = { _id: unknown; clubId: unknown; organiserId: unknown };

/**
 * Which club member account a player being added to a session is. Accounts, not names, are who
 * a player is across sessions: two people can share a name, and a name can change.
 *  - memberId given: that account (must be in this club).
 *  - newMember: a brand-new account, even if someone in the club has the same name.
 *  - otherwise: the one club member with exactly this name, or a new account if there's none.
 *    With several members of that name the organiser has to pick (SAME_NAME error).
 */
export async function resolveMember(
  session: SessionLike,
  input: { name: string; nickname?: string | null; skillLevel?: string | null; memberId?: string | null; newMember?: boolean | null }
) {
  const name = input.name.trim();
  if (input.memberId) {
    const member = await ClubMember.findOne({ _id: input.memberId, clubId: session.clubId });
    if (!member) throw new GraphQLError("That club member wasn't found.", { extensions: { code: "BAD_USER_INPUT" } });
    return member;
  }
  if (!input.newMember) {
    const sameName = (await ClubMember.find({ clubId: session.clubId }).select("name nickname totalGames updatedAt")).filter((m) =>
      isSameName(m.name, name)
    );
    if (sameName.length === 1) return ClubMember.findById(sameName[0]._id).then((m) => m!);
    if (sameName.length > 1) {
      throw new GraphQLError(`${sameName.length} club members are called ${name}. Pick which one, or add them as a new player.`, {
        extensions: {
          code: "SAME_NAME",
          members: sameName.map((m) => ({ id: String(m._id), name: m.name, nickname: m.nickname ?? null })),
        },
      });
    }
  }
  return ClubMember.create({
    clubId: session.clubId,
    organiserId: session.organiserId,
    name,
    nickname: input.nickname ?? undefined,
    skillLevel: input.skillLevel ?? undefined,
  });
}

/** Refuses a member who's already in this session (under any name). */
export async function assertNotInSession(sessionId: unknown, memberId: unknown, label: string) {
  const already = await SessionPlayer.findOne({ sessionId, memberId }).select("name").lean();
  if (already) {
    throw new GraphQLError(`${label} is already in this session${already.name !== label ? ` as ${already.name}` : ""}.`, {
      extensions: { code: "BAD_USER_INPUT" },
    });
  }
}

/** MongoDB expression for who a SessionPlayer row is across sessions: its member id, or
 * "n:<name>" for rows from before accounts (see playerKey). Use as a $group _id. */
export const ACCOUNT_KEY_EXPR = {
  $ifNull: [{ $toString: "$memberId" }, { $concat: ["n:", { $toLower: { $trim: { input: "$name" } } }] }],
};

/** Adds up a player's rows: their own account's, plus rows from before accounts under their
 * name when nobody else in the club shares that name (those can't be told apart). */
export function accountRows<T>(byKey: Map<string, T>, memberId: unknown, name: string, nameIsUnique: boolean): T[] {
  const out: T[] = [];
  const own = memberId ? byKey.get(String(memberId)) : undefined;
  if (own) out.push(own);
  const legacy = byKey.get(`n:${name.trim().toLowerCase()}`);
  if (legacy && (nameIsUnique || !memberId)) out.push(legacy);
  return out;
}

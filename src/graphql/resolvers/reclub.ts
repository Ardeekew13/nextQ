import { GraphQLError } from "graphql";
import { ClubMember, type ClubMemberDoc } from "@/models/ClubMember";
import type { HydratedDocument } from "mongoose";
import { SessionPlayer } from "@/models/SessionPlayer";
import { fetchReclubMeet, type ReclubMeet, type ReclubParticipant } from "@/lib/reclub";
import { isSameName } from "@/lib/playerNames";
import { requireSessionOwner } from "../guards";
import type { GraphQLContext } from "../context";

type MemberLite = { _id: unknown; name: string; reclubUserId?: number | null; reclubName?: string | null; reclubUsername?: string | null };

/** Fetches the event, turning Reclub/format problems into a readable error. Tests swap this. */
export const reclubSource = { fetch: (link: string): Promise<ReclubMeet> => fetchReclubMeet(link) };

/** Only confirmed players (and their +1s) are imported: not the waitlist or invites. */
async function loadMeet(link: string) {
  try {
    const meet = await reclubSource.fetch(link);
    return { ...meet, participants: meet.participants.filter((p) => p.status === "CONFIRMED") };
  } catch (err) {
    throw new GraphQLError(err instanceof Error ? err.message : "Couldn't read that Reclub event.", {
      extensions: { code: "BAD_USER_INPUT" },
    });
  }
}

/**
 * Which club member a Reclub row is. A player already linked by their Reclub account is certain,
 * whatever they're called now. Otherwise members with the same name (and no other Reclub account)
 * are suggested: one is offered as the match, several are left for the organiser to pick.
 */
function matchRow(row: ReclubParticipant, members: MemberLite[]) {
  const asMatch = (m: MemberLite, how: "RECLUB" | "NAME") => ({
    memberId: String(m._id),
    name: m.name,
    how,
    reclubName: m.reclubName ?? null,
  });
  if (row.userId !== null) {
    const linked = members.find((m) => m.reclubUserId === row.userId);
    if (linked) return { match: asMatch(linked, "RECLUB"), candidates: [] };
  }
  const sameName = members.filter(
    (m) => (m.reclubUserId === null || m.reclubUserId === undefined) && (isSameName(m.name, row.name) || (m.reclubName ? isSameName(m.reclubName, row.name) : false))
  );
  if (sameName.length === 1) return { match: asMatch(sameName[0], "NAME"), candidates: [] };
  return { match: null, candidates: sameName.map((m) => asMatch(m, "NAME")) };
}

/** A name not used by anyone else in the session ("Christian" -> "Christian 2"). */
function freeLabel(name: string, used: string[]): string {
  if (!used.some((u) => isSameName(u, name))) return name;
  for (let n = 2; ; n++) {
    const candidate = `${name} ${n}`;
    if (!used.some((u) => isSameName(u, candidate))) return candidate;
  }
}

export const reclubResolvers = {
  Query: {
    reclubImportPreview: async (_p: unknown, args: { sessionId: string; link: string }, context: GraphQLContext) => {
      const session = await requireSessionOwner(context, args.sessionId);
      const meet = await loadMeet(args.link);
      const [members, inSession] = await Promise.all([
        ClubMember.find({ clubId: session.clubId }).select("name reclubUserId reclubName reclubUsername").lean<MemberLite[]>(),
        SessionPlayer.find({ sessionId: session._id }).select("name memberId").lean(),
      ]);
      const sessionNameOf = new Map(inSession.map((p) => [String(p.memberId ?? ""), p.name]));
      return {
        code: meet.code,
        eventName: meet.name,
        startsAt: meet.startsAt,
        clubName: meet.clubName,
        rows: meet.participants.map((row) => {
          const { match, candidates } = matchRow(row, members);
          return {
            key: row.key,
            kind: row.kind,
            status: row.status,
            name: row.name,
            username: row.username,
            reclubUserId: row.userId,
            guestOfName: row.guestOfName,
            isHost: row.isHost,
            match,
            candidates,
            inSessionAs: match ? sessionNameOf.get(match.memberId) ?? null : null,
          };
        }),
        members: [...members]
          .sort((a, b) => a.name.localeCompare(b.name))
          .map((m) => ({
            memberId: String(m._id),
            name: m.name,
            reclubUsername: m.reclubUsername ?? null,
            linked: m.reclubUserId !== null && m.reclubUserId !== undefined,
            inSessionAs: sessionNameOf.get(String(m._id)) ?? null,
          })),
      };
    },
  },

  Mutation: {
    importReclubPlayers: async (
      _p: unknown,
      args: { sessionId: string; link: string; picks: Array<{ key: string; memberId?: string | null; newMember?: boolean | null }> },
      context: GraphQLContext
    ) => {
      const session = await requireSessionOwner(context, args.sessionId);
      // Re-read the event on the server: the names and Reclub ids come from Reclub, not the browser.
      const meet = await loadMeet(args.link);
      const rowByKey = new Map(meet.participants.map((r) => [r.key, r]));
      const existing = await SessionPlayer.find({ sessionId: session._id }).select("name memberId").lean();
      const usedLabels = existing.map((p) => p.name);
      const usedMembers = new Set(existing.map((p) => String(p.memberId ?? "")));
      const added: Array<{ memberId: unknown; name: string; nickname?: string; skillLevel?: string }> = [];

      for (const pick of args.picks) {
        const row = rowByKey.get(pick.key);
        if (!row) continue; // no longer on the event
        let member: HydratedDocument<ClubMemberDoc> | null = null;
        // Linked by Reclub account: always that member, whatever was picked.
        if (row.userId !== null) member = await ClubMember.findOne({ clubId: session.clubId, reclubUserId: row.userId });
        if (!member && pick.memberId && !pick.newMember) {
          member = await ClubMember.findOne({ _id: pick.memberId, clubId: session.clubId });
          if (!member) throw new GraphQLError(`The club member picked for ${row.name} wasn't found.`, { extensions: { code: "BAD_USER_INPUT" } });
          if (row.userId !== null && member.reclubUserId !== null && member.reclubUserId !== undefined && member.reclubUserId !== row.userId) {
            throw new GraphQLError(`${member.name} is already linked to a different Reclub account.`, { extensions: { code: "BAD_USER_INPUT" } });
          }
        }
        if (!member) {
          member = await ClubMember.create({ clubId: session.clubId, organiserId: session.organiserId, name: row.name });
        }
        // Remember the Reclub account and keep its username/name current (the id never changes).
        if (row.userId !== null) {
          member.reclubUserId = row.userId as never;
          member.reclubUsername = row.username as never;
          member.reclubName = row.name as never;
          await member.save();
        }
        if (usedMembers.has(String(member._id))) continue; // already in the session
        usedMembers.add(String(member._id));
        const label = freeLabel(member.name, usedLabels);
        usedLabels.push(label);
        added.push({ memberId: member._id, name: label, nickname: member.nickname ?? undefined, skillLevel: member.skillLevel ?? undefined });
      }

      if (added.length === 0) return [];
      const players = await SessionPlayer.insertMany(added.map((a) => ({ ...a, sessionId: session._id })));
      session.playerIds.push(...players.map((p) => p._id));
      await session.save();
      await ClubMember.updateMany({ _id: { $in: added.map((a) => a.memberId) } }, { $inc: { sessionsPlayed: 1 } });
      return players;
    },
  },
};

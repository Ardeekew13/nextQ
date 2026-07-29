import { GraphQLError } from "graphql";
import { ClubMember } from "@/models/ClubMember";
import { Club } from "@/models/Club";
import { Session } from "@/models/Session";
import { SessionPlayer } from "@/models/SessionPlayer";
import { requireOrganiser } from "../guards";
import type { GraphQLContext } from "../context";

/** Ensure the calling organiser has access to the club (owner or co-organiser) */
async function requireClubAccess(context: GraphQLContext, clubId: string) {
  requireOrganiser(context);
  const club = await Club.findById(clubId);
  if (!club) throw new GraphQLError("Club not found.", { extensions: { code: "NOT_FOUND" } });
  const isOwner = String(club.organiserId) === String(context.organiser!.sub);
  const coOrganiserIds = (club.coOrganiserIds ?? []) as unknown[];
  const isCoOrg = coOrganiserIds.some((id) => String(id) === String(context.organiser!.sub));
  if (!isOwner && !isCoOrg) {
    throw new GraphQLError("Not authorised.", { extensions: { code: "FORBIDDEN" } });
  }
  return club;
}

/** Ensure the calling organiser owns the member's club */
async function requireMemberOwner(context: GraphQLContext, memberId: string) {
  requireOrganiser(context);
  const member = await ClubMember.findById(memberId);
  if (!member) throw new GraphQLError("Club member not found.", { extensions: { code: "NOT_FOUND" } });
  await requireClubAccess(context, String(member.clubId));
  return member;
}

export const clubMemberResolvers = {
  Query: {
    clubMembers: async (
      _p: unknown,
      args: { clubId: string },
      context: GraphQLContext
    ) => {
      await requireClubAccess(context, args.clubId);
      return ClubMember.find({ clubId: args.clubId }).sort({ name: 1 });
    },
  },

  Mutation: {
    addClubMember: async (
      _p: unknown,
      args: { clubId: string; input: { name: string; nickname?: string; skillLevel?: string } },
      context: GraphQLContext
    ) => {
      await requireClubAccess(context, args.clubId);
      if (!args.input.name.trim()) {
        throw new GraphQLError("Name is required.", { extensions: { code: "BAD_USER_INPUT" } });
      }
      const existing = await ClubMember.findOne({ clubId: args.clubId, name: args.input.name.trim() });
      if (existing) {
        throw new GraphQLError("A member with that name already exists in this club.", {
          extensions: { code: "CONFLICT" },
        });
      }
      return ClubMember.create({
        clubId: args.clubId,
        organiserId: context.organiser!.sub,
        name: args.input.name.trim(),
        nickname: args.input.nickname,
        skillLevel: args.input.skillLevel,
      });
    },

    updateClubMember: async (
      _p: unknown,
      args: { id: string; input: Partial<{ name: string; nickname: string; skillLevel: string; active: boolean }> },
      context: GraphQLContext
    ) => {
      const member = await requireMemberOwner(context, args.id);
      if (args.input.name !== undefined) member.name = args.input.name.trim();
      if (args.input.nickname !== undefined) member.nickname = args.input.nickname;
      if (args.input.skillLevel !== undefined) member.skillLevel = args.input.skillLevel as never;
      if (args.input.active !== undefined) member.active = args.input.active;
      await member.save();
      return member;
    },

    removeClubMember: async (_p: unknown, args: { id: string }, context: GraphQLContext) => {
      await requireMemberOwner(context, args.id);
      await ClubMember.findByIdAndDelete(args.id);
      return true;
    },

    /**
     * Bulk-import selected club members into a session.
     * Each member becomes a new SessionPlayer (skips if already in session by name).
     */
    importClubMembersToSession: async (
      _p: unknown,
      args: { sessionId: string; memberIds: string[] },
      context: GraphQLContext
    ) => {
      requireOrganiser(context);
      const session = await Session.findById(args.sessionId);
      if (!session) throw new GraphQLError("Session not found.", { extensions: { code: "NOT_FOUND" } });
      if (String(session.organiserId) !== String(context.organiser!.sub)) {
        throw new GraphQLError("Not authorised.", { extensions: { code: "FORBIDDEN" } });
      }

      const members = await ClubMember.find({ _id: { $in: args.memberIds } });
      if (members.length === 0) return [];

      // Get existing session player names to skip duplicates
      const existing = await SessionPlayer.find({ sessionId: session._id }).select("name");
      const existingNames = new Set(existing.map((p) => p.name.toLowerCase()));

      const toAdd = members.filter((m) => !existingNames.has(m.name.toLowerCase()));
      if (toAdd.length === 0) return [];

      const players = await SessionPlayer.insertMany(
        toAdd.map((m) => ({
          sessionId: session._id,
          name: m.name,
          nickname: m.nickname ?? undefined,
          skillLevel: m.skillLevel ?? undefined,
        }))
      );

      session.playerIds.push(...players.map((p) => p._id));
      await session.save();

      // Bump sessionsPlayed counter for each imported member
      await ClubMember.updateMany(
        { _id: { $in: toAdd.map((m) => m._id) } },
        { $inc: { sessionsPlayed: 1 } }
      );

      return players;
    },
  },

  ClubMember: {
    id: (parent: { _id: unknown }) => String(parent._id),
  },
};

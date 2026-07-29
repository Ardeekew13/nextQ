import { GraphQLError } from "graphql";
import { Club } from "@/models/Club";
import { Session } from "@/models/Session";
import { slugify, withRandomSuffix } from "@/lib/slug";
import { SessionStatus } from "@/types/enums";
import { requireOrganiser, requireClubOwner } from "../guards";
import type { GraphQLContext } from "../context";

function generateJoinCode(): string {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

async function uniqueClubSlug(desired: string): Promise<string> {
  let slug = slugify(desired) || "club";
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const existing = await Club.findOne({ slug });
    if (!existing) return slug;
    slug = withRandomSuffix(slugify(desired) || "club");
  }
}

export const clubResolvers = {
  Query: {
    myClubs: async (_parent: unknown, _args: unknown, context: GraphQLContext) => {
      const organiser = requireOrganiser(context);
      return Club.find({
        $or: [
          { organiserId: organiser.sub },
          { coOrganiserIds: organiser.sub },
        ],
      }).sort({ createdAt: -1 });
    },
    club: async (_parent: unknown, args: { id: string }, context: GraphQLContext) => {
      return requireClubOwner(context, args.id);
    },
    publicClub: async (_parent: unknown, args: { slug: string }) => {
      return Club.findOne({ slug: args.slug.toLowerCase() });
    },
  },
  Mutation: {
    createClub: async (
      _parent: unknown,
      args: { input: { name: string; slug?: string; logoUrl?: string; location?: string; description?: string } },
      context: GraphQLContext
    ) => {
      const organiser = requireOrganiser(context);
      if (!args.input.name.trim()) {
        throw new GraphQLError("Club name is required.", { extensions: { code: "BAD_USER_INPUT" } });
      }
      const slug = await uniqueClubSlug(args.input.slug || args.input.name);
      return Club.create({
        organiserId: organiser.sub,
        name: args.input.name.trim(),
        slug,
        logoUrl: args.input.logoUrl,
        location: args.input.location,
        description: args.input.description,
      });
    },

    updateClub: async (
      _parent: unknown,
      args: { id: string; input: Partial<{ name: string; slug: string; logoUrl: string; location: string; description: string }> },
      context: GraphQLContext
    ) => {
      const club = await requireClubOwner(context, args.id);
      if (args.input.name !== undefined) club.name = args.input.name.trim();
      if (args.input.logoUrl !== undefined) club.logoUrl = args.input.logoUrl;
      if (args.input.location !== undefined) club.location = args.input.location;
      if (args.input.description !== undefined) club.description = args.input.description;
      if (args.input.slug !== undefined && slugify(args.input.slug) !== club.slug) {
        club.slug = await uniqueClubSlug(args.input.slug);
      }
      await club.save();
      return club;
    },

    deleteClub: async (_parent: unknown, args: { id: string }, context: GraphQLContext) => {
      const club = await requireClubOwner(context, args.id);
      const activeSessions = await Session.countDocuments({
        clubId: club._id,
        status: { $in: [SessionStatus.ACTIVE, SessionStatus.PAUSED] },
      });
      if (activeSessions > 0) {
        throw new GraphQLError("Cannot delete a club with an active or paused session.", {
          extensions: { code: "BAD_USER_INPUT" },
        });
      }
      await Session.deleteMany({ clubId: club._id });
      await club.deleteOne();
      return true;
    },

    generateClubJoinCode: async (_parent: unknown, args: { id: string }, context: GraphQLContext) => {
      const club = await requireClubOwner(context, args.id);
      let code = generateJoinCode();
      // Ensure unique
      while (await Club.findOne({ joinCode: code })) {
        code = generateJoinCode();
      }
      club.joinCode = code;
      await club.save();
      return club;
    },

    joinClub: async (_parent: unknown, args: { joinCode: string }, context: GraphQLContext) => {
      const organiser = requireOrganiser(context);
      const club = await Club.findOne({ joinCode: args.joinCode.trim().toUpperCase() });
      if (!club) {
        throw new GraphQLError("Invalid join code.", { extensions: { code: "NOT_FOUND" } });
      }
      if (String(club.organiserId) === String(organiser.sub)) {
        throw new GraphQLError("You already own this club.", { extensions: { code: "BAD_USER_INPUT" } });
      }
      const coOrganiserIds = (club.coOrganiserIds ?? []) as unknown[];
      if (coOrganiserIds.some((id) => String(id) === String(organiser.sub))) {
        throw new GraphQLError("You have already joined this club.", { extensions: { code: "BAD_USER_INPUT" } });
      }
      await Club.updateOne({ _id: club._id }, { $addToSet: { coOrganiserIds: organiser.sub } });
      return Club.findById(club._id);
    },
  },
  Club: {
    id: (parent: { _id: unknown }) => String(parent._id),
    sessions: async (parent: { _id: unknown }) => {
      return Session.find({ clubId: parent._id }).sort({ sessionDate: -1 });
    },
  },
  PublicClub: {
    id: (parent: { _id: unknown }) => String(parent._id),
    activeSessions: async (parent: { _id: unknown }) => {
      return Session.find({
        clubId: parent._id,
        publicPublished: true,
        status: { $in: [SessionStatus.ACTIVE, SessionStatus.PAUSED, SessionStatus.DRAFT] },
      }).sort({ sessionDate: -1 });
    },
    recentCompletedSessions: async (parent: { _id: unknown }) => {
      return Session.find({
        clubId: parent._id,
        publicPublished: true,
        status: SessionStatus.COMPLETED,
      })
        .sort({ finalisedAt: -1 })
        .limit(10);
    },
  },
};

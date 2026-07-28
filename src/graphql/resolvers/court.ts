import { GraphQLError } from "graphql";
import { Court } from "@/models/Court";
import { Game } from "@/models/Game";
import { Session } from "@/models/Session";
import { CourtStatus } from "@/types/enums";
import { requireSessionOwner, requireOrganiser } from "../guards";
import type { GraphQLContext } from "../context";

async function requireCourtOwner(context: GraphQLContext, courtId: string) {
  requireOrganiser(context);
  const court = await Court.findById(courtId);
  if (!court) {
    throw new GraphQLError("Court not found.", { extensions: { code: "NOT_FOUND" } });
  }
  await requireSessionOwner(context, String(court.sessionId));
  return court;
}

export const courtResolvers = {
  Query: {
    sessionCourts: async (_p: unknown, args: { sessionId: string }, context: GraphQLContext) => {
      await requireSessionOwner(context, args.sessionId);
      return Court.find({ sessionId: args.sessionId }).sort({ courtNumber: 1 });
    },
  },

  Mutation: {
    addCourt: async (
      _p: unknown,
      args: { sessionId: string; input: { courtNumber: number; name?: string } },
      context: GraphQLContext
    ) => {
      const session = await requireSessionOwner(context, args.sessionId);
      const existing = await Court.findOne({ sessionId: session._id, courtNumber: args.input.courtNumber });
      if (existing) {
        throw new GraphQLError(`Court ${args.input.courtNumber} already exists for this session.`, {
          extensions: { code: "BAD_USER_INPUT" },
        });
      }
      const court = await Court.create({
        sessionId: session._id,
        courtNumber: args.input.courtNumber,
        name: args.input.name,
      });
      session.courtIds.push(court._id);
      await session.save();
      return court;
    },

    updateCourt: async (
      _p: unknown,
      args: { id: string; input: Partial<{ courtNumber: number; name: string; status: string }> },
      context: GraphQLContext
    ) => {
      const court = await requireCourtOwner(context, args.id);
      if (args.input.name !== undefined) court.name = args.input.name;
      if (args.input.status !== undefined) court.status = args.input.status as never;
      if (args.input.courtNumber !== undefined) court.courtNumber = args.input.courtNumber;
      await court.save();
      return court;
    },

    disableCourt: async (_p: unknown, args: { id: string; disabled: boolean }, context: GraphQLContext) => {
      const court = await requireCourtOwner(context, args.id);
      if (args.disabled && court.activeGameId) {
        throw new GraphQLError("Cannot disable a court that has a game in progress.", {
          extensions: { code: "BAD_USER_INPUT" },
        });
      }
      court.status = args.disabled ? CourtStatus.DISABLED : CourtStatus.AVAILABLE;
      await court.save();
      return court;
    },
  },

  Court: {
    id: (parent: { _id: unknown }) => String(parent._id),
    currentGame: async (parent: { activeGameId: unknown }) => {
      if (!parent.activeGameId) return null;
      return Game.findById(parent.activeGameId);
    },
    previousGames: async (parent: { previousGameIds?: unknown[] }) => {
      if (!parent.previousGameIds?.length) return [];
      return Game.find({ _id: { $in: parent.previousGameIds } }).sort({ gameNumber: 1 });
    },
  },
};

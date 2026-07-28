import { GraphQLError } from "graphql";
import { SessionPlayer } from "@/models/SessionPlayer";
import { Session } from "@/models/Session";
import { Game } from "@/models/Game";
import { ClubMember } from "@/models/ClubMember";
import { SessionStatus } from "@/types/enums";
import { getSessionStandingsWithPlayers } from "@/lib/stats";
import { getPlayerNamesForSession } from "../context";
import { requireSessionOwner, requireOrganiser } from "../guards";
import type { GraphQLContext } from "../context";

async function requirePlayerOwner(context: GraphQLContext, playerId: string) {
  requireOrganiser(context);
  const player = await SessionPlayer.findById(playerId);
  if (!player) {
    throw new GraphQLError("Player not found.", { extensions: { code: "NOT_FOUND" } });
  }
  await requireSessionOwner(context, String(player.sessionId));
  return player;
}

async function historyMapToEntries(
  context: GraphQLContext,
  sessionId: string,
  history: Map<string, number> | Record<string, number>
) {
  const names = await getPlayerNamesForSession(context, sessionId);
  const entries = history instanceof Map ? Array.from(history.entries()) : Object.entries(history ?? {});
  return entries.map(([playerId, count]) => ({
    playerId,
    playerName: names.get(playerId) ?? "Unknown player",
    count,
  }));
}

async function getPlayerGames(sessionId: string, playerId: string) {
  return Game.find({
    sessionId,
    $or: [{ teamAPlayerIds: playerId }, { teamBPlayerIds: playerId }],
  }).sort({ gameNumber: 1 });
}

export const playerResolvers = {
  Query: {
    sessionPlayers: async (_p: unknown, args: { sessionId: string }, context: GraphQLContext) => {
      await requireSessionOwner(context, args.sessionId);
      return SessionPlayer.find({ sessionId: args.sessionId }).sort({ createdAt: 1 });
    },
    playerSessionStats: async (
      _p: unknown,
      args: { sessionId: string; playerId: string },
      context: GraphQLContext
    ) => {
      await requireSessionOwner(context, args.sessionId);
      const standings = await getSessionStandingsWithPlayers(args.sessionId);
      const entry = standings.find((s) => s.id === args.playerId);
      if (!entry || !entry.player) {
        throw new GraphQLError("Player not found in this session.", { extensions: { code: "NOT_FOUND" } });
      }
      const games = await getPlayerGames(args.sessionId, args.playerId);
      return { ...entry, games };
    },
    playerGameLogs: async (
      _p: unknown,
      args: { sessionId: string; playerId: string },
      context: GraphQLContext
    ) => {
      await requireSessionOwner(context, args.sessionId);
      return getPlayerGames(args.sessionId, args.playerId);
    },
  },

  Mutation: {
    addSessionPlayer: async (
      _p: unknown,
      args: { sessionId: string; input: { name: string; nickname?: string; skillLevel?: string } },
      context: GraphQLContext
    ) => {
      const session = await requireSessionOwner(context, args.sessionId);
      if (!args.input.name.trim()) {
        throw new GraphQLError("Player name is required.", { extensions: { code: "BAD_USER_INPUT" } });
      }
      const player = await SessionPlayer.create({
        sessionId: session._id,
        name: args.input.name.trim(),
        nickname: args.input.nickname,
        skillLevel: args.input.skillLevel,
      });
      session.playerIds.push(player._id);
      await session.save();
      // Upsert into club roster
      await ClubMember.findOneAndUpdate(
        { clubId: session.clubId, name: args.input.name.trim() },
        { $setOnInsert: { organiserId: session.organiserId, nickname: args.input.nickname, skillLevel: args.input.skillLevel } },
        { upsert: true, new: false }
      );
      return player;
    },

    addSessionPlayers: async (
      _p: unknown,
      args: { sessionId: string; inputs: Array<{ name: string; nickname?: string; skillLevel?: string }> },
      context: GraphQLContext
    ) => {
      const session = await requireSessionOwner(context, args.sessionId);
      const validNames = args.inputs.filter((input) => input.name.trim());
      if (validNames.length === 0) {
        throw new GraphQLError("At least one valid player name is required.", {
          extensions: { code: "BAD_USER_INPUT" },
        });
      }
      const players = await SessionPlayer.insertMany(
        validNames.map((input) => ({
          sessionId: session._id,
          name: input.name.trim(),
          nickname: input.nickname,
          skillLevel: input.skillLevel,
        }))
      );
      session.playerIds.push(...players.map((p) => p._id));
      await session.save();
      // Upsert all into club roster
      await Promise.all(
        validNames.map((input) =>
          ClubMember.findOneAndUpdate(
            { clubId: session.clubId, name: input.name.trim() },
            { $setOnInsert: { organiserId: session.organiserId, nickname: input.nickname, skillLevel: input.skillLevel } },
            { upsert: true, new: false }
          )
        )
      );
      return players;
    },

    updateSessionPlayer: async (
      _p: unknown,
      args: { id: string; input: Partial<{ name: string; nickname: string; skillLevel: string }> },
      context: GraphQLContext
    ) => {
      const player = await requirePlayerOwner(context, args.id);
      if (args.input.name !== undefined) player.name = args.input.name.trim();
      if (args.input.nickname !== undefined) player.nickname = args.input.nickname;
      if (args.input.skillLevel !== undefined) player.skillLevel = args.input.skillLevel as never;
      await player.save();
      return player;
    },

    removeSessionPlayer: async (_p: unknown, args: { id: string }, context: GraphQLContext) => {
      const player = await requirePlayerOwner(context, args.id);
      const session = await Session.findById(player.sessionId);
      if (session && session.status !== SessionStatus.DRAFT) {
        throw new GraphQLError("Players can only be removed before the session starts.", {
          extensions: { code: "BAD_USER_INPUT" },
        });
      }
      await player.deleteOne();
      if (session) {
        session.playerIds = session.playerIds.filter((id) => String(id) !== String(player._id));
        await session.save();
      }
      return true;
    },

    checkInPlayer: async (_p: unknown, args: { id: string; checkedIn: boolean }, context: GraphQLContext) => {
      const player = await requirePlayerOwner(context, args.id);
      player.checkedIn = args.checkedIn;
      player.checkedInAt = args.checkedIn ? new Date() : undefined;
      if (args.checkedIn) player.queueEnteredAt = new Date();
      await player.save();
      return player;
    },

    setPlayerActiveStatus: async (_p: unknown, args: { id: string; active: boolean }, context: GraphQLContext) => {
      const player = await requirePlayerOwner(context, args.id);
      player.active = args.active;
      if (args.active) player.queueEnteredAt = new Date();
      await player.save();
      return player;
    },
  },

  SessionPlayer: {
    id: (parent: { _id: unknown }) => String(parent._id),
    winRate: (parent: { gamesPlayed: number; wins: number }) =>
      parent.gamesPlayed === 0 ? 0 : (parent.wins / parent.gamesPlayed) * 100,
    partnerHistory: (parent: { sessionId: unknown; partnerHistory: unknown }, _args: unknown, context: GraphQLContext) =>
      historyMapToEntries(context, String(parent.sessionId), parent.partnerHistory as never),
    opponentHistory: (
      parent: { sessionId: unknown; opponentHistory: unknown },
      _args: unknown,
      context: GraphQLContext
    ) => historyMapToEntries(context, String(parent.sessionId), parent.opponentHistory as never),
  },

  PlayerStatistics: {
    player: (parent: { player: unknown }) => parent.player,
  },
};

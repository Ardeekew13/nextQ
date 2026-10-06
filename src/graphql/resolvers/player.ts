import { GraphQLError } from "graphql";
import { SessionPlayer } from "@/models/SessionPlayer";
import { Session } from "@/models/Session";
import { Game } from "@/models/Game";
import { ClubMember } from "@/models/ClubMember";
import { SessionStatus } from "@/types/enums";
import { getSessionStandingsWithPlayers } from "@/lib/stats";
import { getPlayerNamesForSession } from "../context";
import { requireSessionOwner, requireOrganiser } from "../guards";
import { isSameName, isSimilarName } from "@/lib/playerNames";
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

/**
 * Sets (or clears) a mutual "fixed partner" link between two players in the same session.
 * Setting A -> B always makes B -> A too, and unlinks either player's previous partner
 * first so no player is ever linked to more than one fixed partner at a time.
 */
async function setFixedPartner(
  player: Awaited<ReturnType<typeof SessionPlayer.findById>> & { _id: unknown; sessionId: unknown; fixedPartnerId?: unknown },
  partnerId: string | null,
  sessionId: string
) {
  if (!player) return;

  if (partnerId === null) {
    if (player.fixedPartnerId) {
      await SessionPlayer.updateOne({ _id: player.fixedPartnerId }, { $set: { fixedPartnerId: null } });
      player.fixedPartnerId = null;
    }
    return;
  }

  if (String(partnerId) === String(player._id)) {
    throw new GraphQLError("A player can't be their own fixed partner.", {
      extensions: { code: "BAD_USER_INPUT" },
    });
  }

  const partner = await SessionPlayer.findById(partnerId);
  if (!partner || String(partner.sessionId) !== String(sessionId)) {
    throw new GraphQLError("Fixed partner must be another player in this session.", {
      extensions: { code: "BAD_USER_INPUT" },
    });
  }

  // Unlink each player's previous partner (if any, and if different from the new pairing)
  if (player.fixedPartnerId && String(player.fixedPartnerId) !== String(partner._id)) {
    await SessionPlayer.updateOne({ _id: player.fixedPartnerId }, { $set: { fixedPartnerId: null } });
  }
  if (partner.fixedPartnerId && String(partner.fixedPartnerId) !== String(player._id)) {
    await SessionPlayer.updateOne({ _id: partner.fixedPartnerId }, { $set: { fixedPartnerId: null } });
  }

  player.fixedPartnerId = partner._id as never;
  partner.fixedPartnerId = player._id as never;
  await partner.save();
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
    /** Possible "same person" matches for a name about to be added: near matches among this
     * session's players and the club roster (exact matches are blocked outright on add). */
    similarPlayers: async (_p: unknown, args: { sessionId: string; name: string }, context: GraphQLContext) => {
      const session = await requireSessionOwner(context, args.sessionId);
      const [players, members] = await Promise.all([
        SessionPlayer.find({ sessionId: session._id }).select("name").lean(),
        ClubMember.find({ clubId: session.clubId }).select("name").lean(),
      ]);
      const inSession = players.filter((p) => isSimilarName(p.name, args.name));
      const sessionNames = players.map((p) => p.name);
      const fromRoster = members.filter(
        (m) => isSimilarName(m.name, args.name) && !sessionNames.some((n) => isSameName(n, m.name))
      );
      return [
        ...inSession.map((p) => ({ id: String(p._id), name: p.name, source: "SESSION" })),
        ...fromRoster.map((m) => ({ id: String(m._id), name: m.name, source: "CLUB" })),
      ];
    },
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
      args: {
        sessionId: string;
        input: { name: string; nickname?: string; skillLevel?: string; fixedPartnerId?: string | null };
      },
      context: GraphQLContext
    ) => {
      const session = await requireSessionOwner(context, args.sessionId);
      if (!args.input.name.trim()) {
        throw new GraphQLError("Player name is required.", { extensions: { code: "BAD_USER_INPUT" } });
      }
      const existingPlayers = await SessionPlayer.find({ sessionId: session._id }).select("name").lean();
      if (existingPlayers.some((p) => isSameName(p.name, args.input.name))) {
        throw new GraphQLError(`"${args.input.name.trim()}" is already in this session.`, {
          extensions: { code: "BAD_USER_INPUT" },
        });
      }
      const player = await SessionPlayer.create({
        sessionId: session._id,
        name: args.input.name.trim(),
        nickname: args.input.nickname,
        skillLevel: args.input.skillLevel,
      });
      session.playerIds.push(player._id);
      await session.save();
      if (args.input.fixedPartnerId) {
        await setFixedPartner(player, args.input.fixedPartnerId, args.sessionId);
        await player.save();
      }
      // Upsert into club roster, unless the same person is already on it under a
      // spelling/spacing/case variant (the unique index only catches exact matches).
      const rosterNames = await ClubMember.find({ clubId: session.clubId }).select("name").lean();
      if (!rosterNames.some((m) => isSameName(m.name, args.input.name))) {
        await ClubMember.findOneAndUpdate(
          { clubId: session.clubId, name: args.input.name.trim() },
          { $setOnInsert: { organiserId: session.organiserId, nickname: args.input.nickname, skillLevel: args.input.skillLevel } },
          { upsert: true, new: false }
        );
      }
      return player;
    },

    addSessionPlayers: async (
      _p: unknown,
      args: { sessionId: string; inputs: Array<{ name: string; nickname?: string; skillLevel?: string }> },
      context: GraphQLContext
    ) => {
      const session = await requireSessionOwner(context, args.sessionId);
      const nonEmpty = args.inputs.filter((input) => input.name.trim());
      if (nonEmpty.length === 0) {
        throw new GraphQLError("At least one valid player name is required.", {
          extensions: { code: "BAD_USER_INPUT" },
        });
      }
      // Skip anyone already in the session, and repeats within this same batch.
      const existingPlayers = await SessionPlayer.find({ sessionId: session._id }).select("name").lean();
      const seen = existingPlayers.map((p) => p.name);
      const validNames = nonEmpty.filter((input) => {
        if (seen.some((n) => isSameName(n, input.name))) return false;
        seen.push(input.name);
        return true;
      });
      if (validNames.length === 0) {
        throw new GraphQLError("Everyone in that list is already in this session.", {
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
      // Upsert into club roster, skipping anyone already there under a name variant.
      const rosterNames = (await ClubMember.find({ clubId: session.clubId }).select("name").lean()).map((m) => m.name);
      const newForRoster = validNames.filter((input) => !rosterNames.some((n) => isSameName(n, input.name)));
      await Promise.all(
        newForRoster.map((input) =>
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
      args: {
        id: string;
        input: Partial<{ name: string; nickname: string; skillLevel: string; fixedPartnerId: string | null }>;
      },
      context: GraphQLContext
    ) => {
      const player = await requirePlayerOwner(context, args.id);
      if (args.input.name !== undefined) player.name = args.input.name.trim();
      if (args.input.nickname !== undefined) player.nickname = args.input.nickname;
      if (args.input.skillLevel !== undefined) player.skillLevel = args.input.skillLevel as never;
      if (args.input.fixedPartnerId !== undefined) {
        await setFixedPartner(player, args.input.fixedPartnerId, String(player.sessionId));
      }
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
      if (player.fixedPartnerId) {
        await SessionPlayer.updateOne({ _id: player.fixedPartnerId }, { $set: { fixedPartnerId: null } });
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
    fixedPartnerId: (parent: { fixedPartnerId?: unknown }) =>
      parent.fixedPartnerId ? String(parent.fixedPartnerId) : null,
    fixedPartner: async (parent: { fixedPartnerId?: unknown }) => {
      if (!parent.fixedPartnerId) return null;
      // Explicit await (rather than returning the Query directly) so this resolver
      // always hands GraphQL a plain, already-settled value.
      return SessionPlayer.findById(parent.fixedPartnerId).exec();
    },
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

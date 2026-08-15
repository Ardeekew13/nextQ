import { GraphQLError } from "graphql";
import { ClubMember } from "@/models/ClubMember";
import { Session } from "@/models/Session";
import { SessionPlayer } from "@/models/SessionPlayer";
import { SessionStatus } from "@/types/enums";
import { requireOrganiser, requireClubAccess } from "../guards";
import type { GraphQLContext } from "../context";

/** Ensure the calling organiser owns (or, as ADMIN, has access to) the member's club */
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
      args: { clubId: string; filter?: string },
      context: GraphQLContext
    ) => {
      await requireClubAccess(context, args.clubId);
      const members = await ClubMember.find({ clubId: args.clubId }).sort({ name: 1 }).lean();

      // Get all sessions for this club
      const sessions = await Session.find({ clubId: args.clubId }).select("_id").lean();
      const sessionIds = sessions.map((s) => s._id);

      if (sessionIds.length === 0) {
        // No sessions, return members with 0 stats
        return members.map((m) => ({
          ...m,
          totalGames: 0,
          wins: 0,
          losses: 0,
          winRate: 0,
        }));
      }

      // Aggregate stats for all members in one go
      const memberNames = members.map((m) => m.name);
      const stats = await SessionPlayer.aggregate([
        { $match: { sessionId: { $in: sessionIds }, name: { $in: memberNames } } },
        {
          $group: {
            _id: "$name",
            totalWins: { $sum: "$wins" },
            totalLosses: { $sum: "$losses" },
          },
        },
      ]);

      // Create a map for O(1) lookups
      const statsMap = new Map(
        stats.map((s) => [
          s._id,
          {
            wins: s.totalWins,
            losses: s.totalLosses,
            totalGames: s.totalWins + s.totalLosses,
          },
        ])
      );

      // Merge stats into members
      let result = members.map((m) => {
        const playerStats = statsMap.get(m.name) || { wins: 0, losses: 0, totalGames: 0 };
        return {
          ...m,
          totalGames: playerStats.totalGames,
          wins: playerStats.wins,
          losses: playerStats.losses,
          winRate: playerStats.totalGames > 0 ? playerStats.wins / playerStats.totalGames : 0,
        };
      });

      // Apply filter if provided
      if (args.filter) {
        result = result.filter((m: any) => {
          if (args.filter === "played" && (m.totalGames ?? 0) === 0) return false;
          if (args.filter === "never" && (m.totalGames ?? 0) > 0) return false;
          if (args.filter === "unrated" && m.skillLevel) return false;
          return true;
        });
      }

      return result;
    },

    /** Aggregate all-time stats for each player in a session across all club sessions */
    sessionPlayersAllTime: async (
      _p: unknown,
      args: { sessionId: string },
      context: GraphQLContext
    ) => {
      requireOrganiser(context);
      const session = await Session.findById(args.sessionId).select("clubId organiserId").lean();
      if (!session) throw new GraphQLError("Session not found.", { extensions: { code: "NOT_FOUND" } });

      // Get all session IDs for this club
      const clubSessions = await Session.find({ clubId: session.clubId }).select("_id").lean();
      const clubSessionIds = clubSessions.map((s) => s._id);

      // Get current session players (to know which names to aggregate)
      const currentPlayers = await SessionPlayer.find({ sessionId: args.sessionId })
        .select("name nickname skillLevel")
        .lean();
      if (currentPlayers.length === 0) return [];

      const names = currentPlayers.map((p) => p.name);

      // Aggregate wins/losses/gamesPlayed by player name across all club sessions
      const agg = await SessionPlayer.aggregate([
        { $match: { sessionId: { $in: clubSessionIds }, name: { $in: names } } },
        {
          $group: {
            _id: "$name",
            totalGames: { $sum: "$gamesPlayed" },
            totalWins: { $sum: "$wins" },
            totalLosses: { $sum: "$losses" },
            sessionsPlayed: { $sum: { $cond: [{ $gt: ["$gamesPlayed", 0] }, 1, 0] } },
          },
        },
      ]);

      // Build a map for O(1) lookups
      const statsMap = new Map(agg.map((r) => [r._id as string, r]));

      // Merge with current-session player metadata (nickname, skillLevel)
      return currentPlayers.map((p) => {
        const s = statsMap.get(p.name);
        const totalGames = s?.totalGames ?? 0;
        const totalWins = s?.totalWins ?? 0;
        const totalLosses = s?.totalLosses ?? 0;
        return {
          name: p.name,
          nickname: p.nickname ?? null,
          skillLevel: p.skillLevel ?? null,
          totalGames,
          totalWins,
          totalLosses,
          winRate: totalGames > 0 ? totalWins / totalGames : 0,
          sessionsPlayed: s?.sessionsPlayed ?? 0,
        };
      });
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
      const member = await requireMemberOwner(context, args.id);
      await ClubMember.findByIdAndDelete(args.id);

      // Also drop them from any not-yet-started session in this club — a
      // session that's already active/completed keeps its player history.
      const draftSessions = await Session.find({ clubId: member.clubId, status: SessionStatus.DRAFT })
        .select("_id")
        .lean();
      const normalizedName = member.name.trim().toLowerCase();
      await SessionPlayer.deleteMany({
        sessionId: { $in: draftSessions.map((s) => s._id) },
        $expr: { $eq: [{ $toLower: { $trim: { input: "$name" } } }, normalizedName] },
      });

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

    totalGames: (parent: any) => parent.totalGames ?? 0,
    wins: (parent: any) => parent.wins ?? 0,
    losses: (parent: any) => parent.losses ?? 0,
    winRate: (parent: any) => parent.winRate ?? 0,
  },
};

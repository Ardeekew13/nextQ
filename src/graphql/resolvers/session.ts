import { GraphQLError } from "graphql";
import { Session } from "@/models/Session";
import { Club } from "@/models/Club";
import { Court } from "@/models/Court";
import { Game } from "@/models/Game";
import { SessionPlayer } from "@/models/SessionPlayer";
import { slugify, withRandomSuffix } from "@/lib/slug";
import { getEligiblePlayers } from "@/lib/eligibility";
import { getSessionStandingsWithPlayers, getSessionPodiumWithPlayers } from "@/lib/stats";
import { buildPublicSessionUrl, diffMinutes } from "@/lib/urls";
import { SessionStatus, GameStatus, DEFAULT_SESSION_SETTINGS, PairingMode, MatchingStyle, QueueMode, type SessionSettings } from "@/types/enums";
import { requireOrganiser, requireClubOwner, requireSessionOwner } from "../guards";
import type { GraphQLContext } from "../context";

async function uniqueSessionSlug(clubId: unknown, desired: string): Promise<string> {
  let slug = slugify(desired) || "session";
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const existing = await Session.findOne({ clubId, slug });
    if (!existing) return slug;
    slug = withRandomSuffix(slugify(desired) || "session");
  }
}

function mergeSettings(
  existing: SessionSettings,
  input?: Partial<{
    scoring: { pointsTarget: number; winByTwo: boolean };
    rankingOrder: string[];
    avoidRepeatPartnersWindow: number;
    avoidRepeatOpponentsWindow: number;
    pairingMode: string;
    matchingStyle: string;
    queueMode: string;
    maxConsecutiveGames: number;
  }> | null
): SessionSettings {
  if (!input) return existing;
  return {
    scoring: input.scoring ? { ...input.scoring } : existing.scoring,
    rankingOrder: (input.rankingOrder as SessionSettings["rankingOrder"]) ?? existing.rankingOrder,
    avoidRepeatPartnersWindow: input.avoidRepeatPartnersWindow ?? existing.avoidRepeatPartnersWindow,
    avoidRepeatOpponentsWindow: input.avoidRepeatOpponentsWindow ?? existing.avoidRepeatOpponentsWindow,
    pairingMode: (input.pairingMode as SessionSettings["pairingMode"]) ?? existing.pairingMode ?? PairingMode.SMART,
    matchingStyle: (input.matchingStyle as SessionSettings["matchingStyle"]) ?? existing.matchingStyle ?? MatchingStyle.BALANCED,
    queueMode: (input.queueMode as SessionSettings["queueMode"]) ?? existing.queueMode ?? QueueMode.HYBRID,
    maxConsecutiveGames: input.maxConsecutiveGames ?? existing.maxConsecutiveGames ?? 2,
  };
}

function assertTransition(
  currentStatus: string,
  allowedFrom: string[],
  action: string
) {
  if (!allowedFrom.includes(currentStatus)) {
    throw new GraphQLError(
      `Cannot ${action} a session that is currently ${currentStatus}.`,
      { extensions: { code: "BAD_USER_INPUT" } }
    );
  }
}

async function buildSessionSummary(sessionDoc: {
  _id: unknown;
  clubId: unknown;
  name: string;
  sessionDate: Date;
  startTime?: string | null;
  endTime?: string | null;
  status: string;
}) {
  const sessionId = String(sessionDoc._id);
  const [club, standings, podium, completedGames, totalPlayers] = await Promise.all([
    Club.findById(sessionDoc.clubId),
    getSessionStandingsWithPlayers(sessionId),
    getSessionPodiumWithPlayers(sessionId),
    Game.find({ sessionId, status: GameStatus.COMPLETED }).sort({ gameNumber: 1 }),
    SessionPlayer.countDocuments({ sessionId }),
  ]);

  return {
    club,
    sessionName: sessionDoc.name,
    sessionDate: sessionDoc.sessionDate,
    durationMinutes: diffMinutes(sessionDoc.startTime, sessionDoc.endTime),
    totalPlayers,
    totalCompletedGames: completedGames.length,
    averageGamesPerPlayer: totalPlayers > 0 ? (completedGames.length * 4) / totalPlayers : 0,
    podium,
    standings,
    gameLogs: completedGames,
    isFinal: sessionDoc.status === SessionStatus.COMPLETED,
  };
}

export const sessionResolvers = {
  Query: {
    sessionsByClub: async (_p: unknown, args: { clubId: string }, context: GraphQLContext) => {
      await requireClubOwner(context, args.clubId);
      return Session.find({ clubId: args.clubId }).sort({ sessionDate: -1 });
    },
    session: async (_p: unknown, args: { id: string }, context: GraphQLContext) => {
      return requireSessionOwner(context, args.id);
    },
    activeSession: async (_p: unknown, args: { clubId: string }, context: GraphQLContext) => {
      await requireClubOwner(context, args.clubId);
      return Session.findOne({ clubId: args.clubId, status: SessionStatus.ACTIVE });
    },
    publicSession: async (_p: unknown, args: { clubSlug: string; sessionSlug: string }) => {
      const club = await Club.findOne({ slug: args.clubSlug.toLowerCase() });
      if (!club) return null;
      const session = await Session.findOne({ clubId: club._id, slug: args.sessionSlug.toLowerCase() });
      if (!session || !session.publicPublished) return null;
      return session;
    },
  },

  Mutation: {
    createSession: async (
      _p: unknown,
      args: {
        input: {
          clubId: string;
          name: string;
          slug?: string;
          sessionDate: Date;
          startTime?: string;
          endTime?: string;
          numberOfCourts?: number;
          settings?: Parameters<typeof mergeSettings>[1];
        };
      },
      context: GraphQLContext
    ) => {
      const club = await requireClubOwner(context, args.input.clubId);
      const organiser = requireOrganiser(context);
      if (!args.input.name.trim()) {
        throw new GraphQLError("Session name is required.", { extensions: { code: "BAD_USER_INPUT" } });
      }

      const ongoingSession = await Session.findOne({
        clubId: club._id,
        status: { $in: [SessionStatus.ACTIVE, SessionStatus.PAUSED] },
      });
      if (ongoingSession) {
        throw new GraphQLError(
          `Finish "${ongoingSession.name}" before starting a new session.`,
          { extensions: { code: "BAD_USER_INPUT" } }
        );
      }

      const slug = await uniqueSessionSlug(club._id, args.input.slug || args.input.name);
      const settings = mergeSettings(DEFAULT_SESSION_SETTINGS, args.input.settings);

      const session = await Session.create({
        clubId: club._id,
        organiserId: organiser.sub,
        name: args.input.name.trim(),
        slug,
        sessionDate: args.input.sessionDate,
        startTime: args.input.startTime,
        endTime: args.input.endTime,
        settings,
      });

      const numberOfCourts = args.input.numberOfCourts ?? 0;
      if (numberOfCourts > 0) {
        const courts = await Court.insertMany(
          Array.from({ length: numberOfCourts }, (_, i) => ({
            sessionId: session._id,
            courtNumber: i + 1,
          }))
        );
        session.courtIds = courts.map((c) => c._id);
        await session.save();
      }

      return session;
    },

    updateSession: async (
      _p: unknown,
      args: {
        id: string;
        input: Partial<{
          name: string;
          slug: string;
          sessionDate: Date;
          startTime: string;
          endTime: string;
          settings: Parameters<typeof mergeSettings>[1];
        }>;
      },
      context: GraphQLContext
    ) => {
      const session = await requireSessionOwner(context, args.id);
      if (args.input.name !== undefined) session.name = args.input.name.trim();
      if (args.input.sessionDate !== undefined) session.sessionDate = args.input.sessionDate;
      if (args.input.startTime !== undefined) session.startTime = args.input.startTime;
      if (args.input.endTime !== undefined) session.endTime = args.input.endTime;
      if (args.input.settings !== undefined) {
        session.settings = mergeSettings(session.settings as SessionSettings, args.input.settings) as typeof session.settings;
      }
      if (args.input.slug !== undefined && slugify(args.input.slug) !== session.slug) {
        session.slug = await uniqueSessionSlug(session.clubId, args.input.slug);
      }
      await session.save();
      return session;
    },

    startSession: async (_p: unknown, args: { id: string }, context: GraphQLContext) => {
      const session = await requireSessionOwner(context, args.id);
      assertTransition(session.status, [SessionStatus.DRAFT], "start");
      session.status = SessionStatus.ACTIVE;
      session.startTime = new Date().toISOString();
      session.publicPublished = true;
      await session.save();
      return session;
    },

    pauseSession: async (_p: unknown, args: { id: string }, context: GraphQLContext) => {
      const session = await requireSessionOwner(context, args.id);
      assertTransition(session.status, [SessionStatus.ACTIVE], "pause");
      session.status = SessionStatus.PAUSED;
      await session.save();
      return session;
    },

    resumeSession: async (_p: unknown, args: { id: string }, context: GraphQLContext) => {
      const session = await requireSessionOwner(context, args.id);
      assertTransition(session.status, [SessionStatus.PAUSED], "resume");
      session.status = SessionStatus.ACTIVE;
      await session.save();
      return session;
    },

    finishSession: async (_p: unknown, args: { id: string }, context: GraphQLContext) => {
      const session = await requireSessionOwner(context, args.id);
      assertTransition(session.status, [SessionStatus.ACTIVE, SessionStatus.PAUSED], "finish");

      const standings = await getSessionStandingsWithPlayers(String(session._id));
      session.finalStandings = standings.map((entry) => ({
        playerId: entry.player!._id,
        rank: entry.rank,
        name: entry.name,
        gamesPlayed: entry.gamesPlayed,
        wins: entry.wins,
        losses: entry.losses,
        winRate: entry.winRate,
      })) as typeof session.finalStandings;
      session.status = SessionStatus.COMPLETED;
      session.endTime = new Date().toISOString();
      session.finalisedAt = new Date();
      session.publicPublished = true;
      await session.save();
      return session;
    },

    cancelSession: async (_p: unknown, args: { id: string }, context: GraphQLContext) => {
      const session = await requireSessionOwner(context, args.id);
      assertTransition(
        session.status,
        [SessionStatus.DRAFT, SessionStatus.ACTIVE, SessionStatus.PAUSED],
        "cancel"
      );
      session.status = SessionStatus.CANCELLED;
      await session.save();
      return session;
    },

    deleteSession: async (_p: unknown, args: { id: string }, context: GraphQLContext) => {
      const session = await requireSessionOwner(context, args.id);
      if (session.status === SessionStatus.ACTIVE || session.status === SessionStatus.PAUSED) {
        throw new GraphQLError(
          "Cannot delete an active or paused session. Finish or cancel it first.",
          { extensions: { code: "BAD_USER_INPUT" } }
        );
      }
      await Game.deleteMany({ sessionId: session._id });
      await Court.deleteMany({ sessionId: session._id });
      await SessionPlayer.deleteMany({ sessionId: session._id });
      await session.deleteOne();
      return true;
    },
  },

  Session: {
    id: (parent: { _id: unknown }) => String(parent._id),
    clubSlug: async (parent: { clubId: unknown }) => {
      const club = await Club.findById(parent.clubId).select("slug").lean();
      return club?.slug ?? "";
    },
    players: async (parent: { _id: unknown }) => SessionPlayer.find({ sessionId: parent._id }),
    courts: async (parent: { _id: unknown }) => Court.find({ sessionId: parent._id }).sort({ courtNumber: 1 }),
    activeGames: async (parent: { _id: unknown }) =>
      Game.find({ sessionId: parent._id, status: { $in: [GameStatus.QUEUED, GameStatus.IN_PROGRESS] } }).sort({
        gameNumber: 1,
      }),
    completedGames: async (parent: { _id: unknown }) =>
      Game.find({ sessionId: parent._id, status: GameStatus.COMPLETED }).sort({ gameNumber: 1 }),
    queuedPlayers: async (parent: { _id: unknown }) => getEligiblePlayers(String(parent._id)),
    standings: async (parent: { _id: unknown }) => getSessionStandingsWithPlayers(String(parent._id)),
    podium: async (parent: { _id: unknown }) => getSessionPodiumWithPlayers(String(parent._id)),
    publicUrl: async (parent: { clubId: unknown; slug: string }) => {
      const club = await Club.findById(parent.clubId);
      return buildPublicSessionUrl(club?.slug ?? "", parent.slug);
    },
  },

  PublicSession: {
    id: (parent: { _id: unknown }) => String(parent._id),
    club: async (parent: { clubId: unknown }) => Club.findById(parent.clubId),
    courts: async (parent: { _id: unknown }) => Court.find({ sessionId: parent._id }).sort({ courtNumber: 1 }),
    checkedInPlayerCount: async (parent: { _id: unknown }) =>
      SessionPlayer.countDocuments({ sessionId: parent._id, checkedIn: true }),
    activeGames: async (parent: { _id: unknown }) =>
      Game.find({ sessionId: parent._id, status: { $in: [GameStatus.QUEUED, GameStatus.IN_PROGRESS] } }).sort({
        gameNumber: 1,
      }),
    queuedPlayers: async (parent: { _id: unknown }) => getEligiblePlayers(String(parent._id)),
    completedGames: async (parent: { _id: unknown }) =>
      Game.find({ sessionId: parent._id, status: GameStatus.COMPLETED }).sort({ gameNumber: 1 }),
    standings: async (parent: { _id: unknown }) => getSessionStandingsWithPlayers(String(parent._id)),
    podium: async (parent: { _id: unknown }) => getSessionPodiumWithPlayers(String(parent._id)),
    summary: async (parent: {
      _id: unknown;
      clubId: unknown;
      name: string;
      sessionDate: Date;
      startTime?: string | null;
      endTime?: string | null;
      status: string;
    }) => buildSessionSummary(parent),
    publicUrl: async (parent: { clubId: unknown; slug: string }) => {
      const club = await Club.findById(parent.clubId);
      return buildPublicSessionUrl(club?.slug ?? "", parent.slug);
    },
  },

  SessionSettings: {
    pairingMode: (parent: { pairingMode?: string }) =>
      parent.pairingMode ?? PairingMode.SMART,
    matchingStyle: (parent: { matchingStyle?: string }) =>
      parent.matchingStyle ?? MatchingStyle.BALANCED,
    queueMode: (parent: { queueMode?: string }) =>
      parent.queueMode ?? QueueMode.HYBRID,
    maxConsecutiveGames: (parent: { maxConsecutiveGames?: number }) =>
      parent.maxConsecutiveGames ?? 2,
  },
};

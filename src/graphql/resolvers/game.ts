import { GraphQLError } from "graphql";
import { Game } from "@/models/Game";
import { Court } from "@/models/Court";
import { SessionPlayer, type SessionPlayerDoc } from "@/models/SessionPlayer";
import { generateGame, type MatchPlayer } from "@/lib/matchmaking";
import { generateNextGame as queueEngineGenerate, type QueuePlayer } from "@/lib/queueEngine";
import { getEligiblePlayers, toQueuePlayer, queuePoolSeed, seededRandom } from "@/lib/eligibility";
import { rebuildSessionStatistics } from "@/lib/stats";
import { withOptionalTransaction } from "@/lib/transaction";
import { CourtStatus, GameStatus, WinningTeam, PairingMode, QueueMode, type SessionSettings } from "@/types/enums";
import { requireSessionOwner, requireOrganiser } from "../guards";
import type { GraphQLContext } from "../context";
import type { HydratedDocument } from "mongoose";

function toMatchPlayer(doc: HydratedDocument<SessionPlayerDoc>): MatchPlayer {
  const partnerHistory: Map<string, number> =
    doc.partnerHistory instanceof Map ? doc.partnerHistory : new Map(Object.entries(doc.partnerHistory ?? {}));
  const opponentHistory: Map<string, number> =
    doc.opponentHistory instanceof Map ? doc.opponentHistory : new Map(Object.entries(doc.opponentHistory ?? {}));
  return {
    id: String(doc._id),
    gamesPlayed: doc.gamesPlayed,
    queueEnteredAt: doc.queueEnteredAt,
    gamesSatOut: doc.gamesSatOut,
    partnerHistory: Object.fromEntries(partnerHistory),
    opponentHistory: Object.fromEntries(opponentHistory),
  };
}

async function requireGameOwner(context: GraphQLContext, gameId: string) {
  requireOrganiser(context);
  const game = await Game.findById(gameId);
  if (!game) {
    throw new GraphQLError("Game not found.", { extensions: { code: "NOT_FOUND" } });
  }
  const session = await requireSessionOwner(context, String(game.sessionId));
  return { game, session };
}

export const gameResolvers = {
  Query: {
    sessionGames: async (
      _p: unknown,
      args: { sessionId: string; status?: string },
      context: GraphQLContext
    ) => {
      await requireSessionOwner(context, args.sessionId);
      const filter: Record<string, unknown> = { sessionId: args.sessionId };
      if (args.status) filter.status = args.status;
      return Game.find(filter).sort({ gameNumber: 1 });
    },
  },

  Mutation: {
    generateNextGame: async (
      _p: unknown,
      args: { sessionId: string; courtId: string },
      context: GraphQLContext
    ) => {
      const session = await requireSessionOwner(context, args.sessionId);

      const [court, eligibleDocs, priorGames, lastGame] = await Promise.all([
        Court.findById(args.courtId),
        getEligiblePlayers(args.sessionId),
        Game.find(
          { sessionId: args.sessionId, status: { $ne: GameStatus.CANCELLED } },
          { teamAPlayerIds: 1, teamBPlayerIds: 1 }
        )
          .sort({ gameNumber: -1 })
          .limit(200),
        Game.findOne({ sessionId: session._id }).sort({ gameNumber: -1 }),
      ]);

      if (!court || String(court.sessionId) !== String(session._id)) {
        throw new GraphQLError("Court not found for this session.", { extensions: { code: "NOT_FOUND" } });
      }
      if (court.status !== CourtStatus.AVAILABLE) {
        throw new GraphQLError(`Court is currently ${court.status.toLowerCase()} and cannot start a new game.`, {
          extensions: { code: "BAD_USER_INPUT" },
        });
      }

      // Build QueuePlayer objects (superset of old MatchPlayer), including win rate
      const eligible: QueuePlayer[] = eligibleDocs.map(toQueuePlayer);

      const settings = session.settings as SessionSettings;
      const pastGroups = new Set(
        priorGames.map((g) => [...g.teamAPlayerIds, ...g.teamBPlayerIds].map(String).sort().join(":"))
      );

      // Seeded from the eligible pool so this matches the organiser-facing preview
      // (queuedPlayers/nextGamePreview) bit-for-bit whenever the pool hasn't changed.
      const result = queueEngineGenerate(eligible, {
        mode: (settings.queueMode ?? QueueMode.HYBRID) as QueueMode,
        maxConsecutiveGames: settings.maxConsecutiveGames ?? 2,
        pastGroups,
        random: seededRandom(queuePoolSeed(eligibleDocs)),
      });

      if (!result.ok) {
        throw new GraphQLError(result.reason ?? "Unable to generate a game.", {
          extensions: { code: "BAD_USER_INPUT" },
        });
      }

      const selectedIds = new Set(result.selected.map((p) => p.id));
      const playersSatOutIds = eligible.filter((p) => !selectedIds.has(p.id)).map((p) => p.id);

      const gameNumber = (lastGame?.gameNumber ?? 0) + 1;

      const game = await Game.create({
        sessionId: session._id,
        courtId: court._id,
        gameNumber,
        teamAPlayerIds: result.teamA.map((p) => p.id),
        teamBPlayerIds: result.teamB.map((p) => p.id),
        status: GameStatus.QUEUED,
        playersSatOutIds,
      });

      // Increment consecutive games for selected players, reset for sat-out players
      court.activeGameId = game._id;
      court.status = CourtStatus.IN_USE;
      await Promise.all([
        SessionPlayer.updateMany(
          { _id: { $in: [...selectedIds] } },
          { $inc: { consecutiveGames: 1 } }
        ),
        playersSatOutIds.length > 0
          ? SessionPlayer.updateMany(
              { _id: { $in: playersSatOutIds } },
              { $set: { consecutiveGames: 0 } }
            )
          : Promise.resolve(),
        court.save(),
      ]);

      return game;
    },

    fillCourtManually: async (
      _p: unknown,
      args: { courtId: string; teamAPlayerIds: string[]; teamBPlayerIds: string[] },
      context: GraphQLContext
    ) => {
      requireOrganiser(context);

      const court = await Court.findById(args.courtId);
      if (!court) {
        throw new GraphQLError("Court not found.", { extensions: { code: "NOT_FOUND" } });
      }
      if (court.status !== CourtStatus.AVAILABLE) {
        throw new GraphQLError(`Court is currently ${court.status.toLowerCase()} and cannot start a new game.`, {
          extensions: { code: "BAD_USER_INPUT" },
        });
      }

      await requireSessionOwner(context, String(court.sessionId));

      const allPlayerIds = [...args.teamAPlayerIds, ...args.teamBPlayerIds];
      if (new Set(allPlayerIds).size !== allPlayerIds.length) {
        throw new GraphQLError("A player cannot appear in both teams.", { extensions: { code: "BAD_USER_INPUT" } });
      }

      const players = await SessionPlayer.find({ _id: { $in: allPlayerIds }, sessionId: court.sessionId });
      if (players.length !== allPlayerIds.length) {
        throw new GraphQLError("One or more players were not found in this session.", {
          extensions: { code: "BAD_USER_INPUT" },
        });
      }

      // Prevent the same 4 players from queuing together again (require at least 1 new player)
      const priorGames = await Game.find(
        { sessionId: court.sessionId, status: { $ne: GameStatus.CANCELLED } },
        { teamAPlayerIds: 1, teamBPlayerIds: 1 }
      );
      const pastGroups = new Set(
        priorGames.map((g) => [...g.teamAPlayerIds, ...g.teamBPlayerIds].map(String).sort().join(":"))
      );
      const currentGroup = allPlayerIds.map(String).sort().join(":");
      if (pastGroups.has(currentGroup)) {
        // Check if at least 1 player is new (hasn't played in any completed game)
        const allPlayerDocs = await SessionPlayer.find({ sessionId: court.sessionId });
        const playersWhoHavePlayed = new Set(
          priorGames.flatMap((g) => [...g.teamAPlayerIds, ...g.teamBPlayerIds]).map(String)
        );
        const newPlayers = allPlayerIds.filter((id) => !playersWhoHavePlayed.has(id));

        if (newPlayers.length === 0) {
          throw new GraphQLError("These 4 players have already played together. Add at least 1 new player.", {
            extensions: { code: "DUPLICATE_GROUP" },
          });
        }
      }

      const lastGame = await Game.findOne({ sessionId: court.sessionId }).sort({ gameNumber: -1 });
      const gameNumber = (lastGame?.gameNumber ?? 0) + 1;

      const game = await Game.create({
        sessionId: court.sessionId,
        courtId: court._id,
        gameNumber,
        teamAPlayerIds: args.teamAPlayerIds,
        teamBPlayerIds: args.teamBPlayerIds,
        status: GameStatus.QUEUED,
        playersSatOutIds: [],
      });

      court.activeGameId = game._id;
      court.status = CourtStatus.IN_USE;
      await court.save();

      return game;
    },

    updateGameTeams: async (
      _p: unknown,
      args: { id: string; teamAPlayerIds: string[]; teamBPlayerIds: string[] },
      context: GraphQLContext
    ) => {
      const { game } = await requireGameOwner(context, args.id);
      if (game.status === GameStatus.COMPLETED || game.status === GameStatus.CANCELLED) {
        throw new GraphQLError(`Cannot edit teams of a ${game.status.toLowerCase()} game.`, {
          extensions: { code: "BAD_USER_INPUT" },
        });
      }
      const allIds = [...args.teamAPlayerIds, ...args.teamBPlayerIds];
      if (new Set(allIds).size !== allIds.length) {
        throw new GraphQLError("A player cannot appear in both teams.", { extensions: { code: "BAD_USER_INPUT" } });
      }
      const players = await SessionPlayer.find({ _id: { $in: allIds }, sessionId: game.sessionId });
      if (players.length !== allIds.length) {
        throw new GraphQLError("One or more players were not found in this session.", {
          extensions: { code: "BAD_USER_INPUT" },
        });
      }
      // Reconstruct the eligible pool at generation time (old teams + old sat-out),
      // then recompute who sat out against the NEW team composition - otherwise a
      // swapped-in player keeps their stale "sat out" credit for this round (and a
      // swapped-out player loses theirs), corrupting gamesSatOut and, in turn, the
      // queue engine's future scoring for both players.
      const priorEligiblePool = new Set(
        [...game.teamAPlayerIds, ...game.teamBPlayerIds, ...(game.playersSatOutIds ?? [])].map(String)
      );
      const newTeamIds = new Set(allIds.map(String));
      game.playersSatOutIds = [...priorEligiblePool].filter((id) => !newTeamIds.has(id)) as never[];

      game.teamAPlayerIds = args.teamAPlayerIds as never[];
      game.teamBPlayerIds = args.teamBPlayerIds as never[];
      await game.save();
      return game;
    },

    startGame: async (_p: unknown, args: { id: string }, context: GraphQLContext) => {
      const { game } = await requireGameOwner(context, args.id);
      if (game.status !== GameStatus.QUEUED) {
        throw new GraphQLError(`Cannot start a game that is ${game.status}.`, {
          extensions: { code: "BAD_USER_INPUT" },
        });
      }
      game.status = GameStatus.IN_PROGRESS;
      game.startedAt = new Date();
      await game.save();
      return game;
    },

    completeGame: async (
      _p: unknown,
      args: {
        id: string;
        input: { winningTeam: string; notes?: string };
      },
      context: GraphQLContext
    ) => {
      const organiser = requireOrganiser(context);
      const { game, session } = await requireGameOwner(context, args.id);
      if (game.status !== GameStatus.QUEUED && game.status !== GameStatus.IN_PROGRESS) {
        throw new GraphQLError(`Cannot complete a game that is ${game.status}.`, {
          extensions: { code: "BAD_USER_INPUT" },
        });
      }

      return withOptionalTransaction(async (mongooseSession) => {
        game.winningTeam = args.input.winningTeam as never;
        game.notes = args.input.notes;
        game.status = GameStatus.COMPLETED;
        game.completedAt = new Date();
        game.recordedBy = organiser.sub as never;
        await game.save({ session: mongooseSession });

        const court = await Court.findById(game.courtId).session(mongooseSession ?? null);
        if (court) {
          court.activeGameId = null;
          court.status = CourtStatus.AVAILABLE;
          court.previousGameIds.push(game._id);
          await court.save({ session: mongooseSession });
        }

        const playerIds = [...game.teamAPlayerIds, ...game.teamBPlayerIds];
        await SessionPlayer.updateMany(
          { _id: { $in: playerIds } },
          { $set: { queueEnteredAt: new Date(), consecutiveGames: 0 } },
          { session: mongooseSession ?? undefined }
        );

        await rebuildSessionStatistics(String(session._id), mongooseSession);
        return game;
      });
    },

    updateGameResult: async (
      _p: unknown,
      args: {
        id: string;
        input: { winningTeam: string; notes?: string };
      },
      context: GraphQLContext
    ) => {
      const { game, session } = await requireGameOwner(context, args.id);
      if (game.status !== GameStatus.COMPLETED) {
        throw new GraphQLError("Only a completed game's result can be edited. Use completeGame first.", {
          extensions: { code: "BAD_USER_INPUT" },
        });
      }

      return withOptionalTransaction(async (mongooseSession) => {
        game.winningTeam = args.input.winningTeam as never;
        if (args.input.notes !== undefined) game.notes = args.input.notes;
        await game.save({ session: mongooseSession });

        await rebuildSessionStatistics(String(session._id), mongooseSession);
        return game;
      });
    },

    cancelGame: async (_p: unknown, args: { id: string }, context: GraphQLContext) => {
      const { game, session } = await requireGameOwner(context, args.id);
      if (game.status === GameStatus.CANCELLED) {
        throw new GraphQLError("Game is already cancelled.", { extensions: { code: "BAD_USER_INPUT" } });
      }

      return withOptionalTransaction(async (mongooseSession) => {
        const wasCompleted = game.status === GameStatus.COMPLETED;
        game.status = GameStatus.CANCELLED;
        await game.save({ session: mongooseSession });

        const court = await Court.findById(game.courtId).session(mongooseSession ?? null);
        if (court && String(court.activeGameId ?? "") === String(game._id)) {
          court.activeGameId = null;
          court.status = CourtStatus.AVAILABLE;
          await court.save({ session: mongooseSession });
        }

        if (wasCompleted) {
          await rebuildSessionStatistics(String(session._id), mongooseSession);
        }
        return game;
      });
    },

    deleteGame: async (_p: unknown, args: { id: string }, context: GraphQLContext) => {
      const { game, session } = await requireGameOwner(context, args.id);

      return withOptionalTransaction(async (mongooseSession) => {
        const wasCompleted = game.status === GameStatus.COMPLETED;

        const court = await Court.findById(game.courtId).session(mongooseSession ?? null);
        if (court) {
          if (String(court.activeGameId ?? "") === String(game._id)) {
            court.activeGameId = null;
            court.status = CourtStatus.AVAILABLE;
          }
          court.previousGameIds = court.previousGameIds.filter((id) => String(id) !== String(game._id));
          await court.save({ session: mongooseSession });
        }

        await game.deleteOne({ session: mongooseSession });

        if (wasCompleted) {
          await rebuildSessionStatistics(String(session._id), mongooseSession);
        }
        return true;
      });
    },
  },

  Game: {
    id: (parent: { _id: unknown }) => String(parent._id),
    court: async (parent: { courtId: unknown }) => Court.findById(parent.courtId),
    teamA: async (parent: { teamAPlayerIds: unknown[] }) => ({
      players: await SessionPlayer.find({ _id: { $in: parent.teamAPlayerIds } }),
    }),
    teamB: async (parent: { teamBPlayerIds: unknown[] }) => ({
      players: await SessionPlayer.find({ _id: { $in: parent.teamBPlayerIds } }),
    }),
    losingTeam: (parent: { winningTeam?: string }) => {
      if (!parent.winningTeam) return null;
      return parent.winningTeam === WinningTeam.A ? WinningTeam.B : WinningTeam.A;
    },
  },
};

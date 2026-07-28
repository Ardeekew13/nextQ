import { describe, expect, it } from "vitest";
import { clubResolvers } from "@/graphql/resolvers/club";
import { sessionResolvers } from "@/graphql/resolvers/session";
import { playerResolvers } from "@/graphql/resolvers/player";
import { courtResolvers } from "@/graphql/resolvers/court";
import { gameResolvers } from "@/graphql/resolvers/game";
import type { GraphQLContext } from "@/graphql/context";

const loggedOutContext: GraphQLContext = { organiser: null, playerNameCache: new Map(), csrfToken: "test-token" };

/**
 * Every organiser-only mutation must reject anonymous (public) callers
 * before it touches the database. This guards the "public users must not be
 * able to add/remove players, generate games, change scores, or change
 * session/club settings" requirement at the resolver layer.
 */
describe("organiser mutations reject anonymous callers", () => {
  const cases: Array<[string, () => Promise<unknown>]> = [
    ["createClub", () => clubResolvers.Mutation.createClub(null, { input: { name: "X" } }, loggedOutContext)],
    ["updateClub", () => clubResolvers.Mutation.updateClub(null, { id: "club-1", input: {} }, loggedOutContext)],
    ["deleteClub", () => clubResolvers.Mutation.deleteClub(null, { id: "club-1" }, loggedOutContext)],
    [
      "createSession",
      () =>
        sessionResolvers.Mutation.createSession(
          null,
          { input: { clubId: "club-1", name: "Session", sessionDate: new Date() } },
          loggedOutContext
        ),
    ],
    ["startSession", () => sessionResolvers.Mutation.startSession(null, { id: "session-1" }, loggedOutContext)],
    ["finishSession", () => sessionResolvers.Mutation.finishSession(null, { id: "session-1" }, loggedOutContext)],
    ["cancelSession", () => sessionResolvers.Mutation.cancelSession(null, { id: "session-1" }, loggedOutContext)],
    [
      "addSessionPlayer",
      () =>
        playerResolvers.Mutation.addSessionPlayer(
          null,
          { sessionId: "session-1", input: { name: "Player" } },
          loggedOutContext
        ),
    ],
    ["removeSessionPlayer", () => playerResolvers.Mutation.removeSessionPlayer(null, { id: "player-1" }, loggedOutContext)],
    [
      "checkInPlayer",
      () => playerResolvers.Mutation.checkInPlayer(null, { id: "player-1", checkedIn: true }, loggedOutContext),
    ],
    [
      "addCourt",
      () => courtResolvers.Mutation.addCourt(null, { sessionId: "session-1", input: { courtNumber: 1 } }, loggedOutContext),
    ],
    ["disableCourt", () => courtResolvers.Mutation.disableCourt(null, { id: "court-1", disabled: true }, loggedOutContext)],
    [
      "generateNextGame",
      () =>
        gameResolvers.Mutation.generateNextGame(
          null,
          { sessionId: "session-1", courtId: "court-1" },
          loggedOutContext
        ),
    ],
    ["startGame", () => gameResolvers.Mutation.startGame(null, { id: "game-1" }, loggedOutContext)],
    [
      "completeGame",
      () =>
        gameResolvers.Mutation.completeGame(
          null,
          { id: "game-1", input: { teamAScore: 11, teamBScore: 5, winningTeam: "A" } },
          loggedOutContext
        ),
    ],
    ["cancelGame", () => gameResolvers.Mutation.cancelGame(null, { id: "game-1" }, loggedOutContext)],
    ["deleteGame", () => gameResolvers.Mutation.deleteGame(null, { id: "game-1" }, loggedOutContext)],
  ];

  it.each(cases)("%s throws UNAUTHENTICATED for a logged-out caller", async (_name, run) => {
    await expect(run()).rejects.toMatchObject({ extensions: { code: "UNAUTHENTICATED" } });
  });
});

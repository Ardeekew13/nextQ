import { DateScalar } from "./scalars";
import { authResolvers } from "./auth";
import { clubResolvers } from "./club";
import { sessionResolvers } from "./session";
import { playerResolvers } from "./player";
import { courtResolvers } from "./court";
import { gameResolvers } from "./game";
import { clubMemberResolvers } from "./clubMember";

export const resolvers = {
  Date: DateScalar,

  Query: {
    ...authResolvers.Query,
    ...clubResolvers.Query,
    ...sessionResolvers.Query,
    ...playerResolvers.Query,
    ...courtResolvers.Query,
    ...gameResolvers.Query,
    ...clubMemberResolvers.Query,
  },

  Mutation: {
    ...authResolvers.Mutation,
    ...clubResolvers.Mutation,
    ...sessionResolvers.Mutation,
    ...playerResolvers.Mutation,
    ...courtResolvers.Mutation,
    ...gameResolvers.Mutation,
    ...clubMemberResolvers.Mutation,
  },

  Club: clubResolvers.Club,
  PublicClub: clubResolvers.PublicClub,
  Session: sessionResolvers.Session,
  PublicSession: sessionResolvers.PublicSession,
  SessionSettings: sessionResolvers.SessionSettings,
  SessionPlayer: playerResolvers.SessionPlayer,
  PlayerStatistics: playerResolvers.PlayerStatistics,
  Court: courtResolvers.Court,
  Game: gameResolvers.Game,
  ClubMember: clubMemberResolvers.ClubMember,
};

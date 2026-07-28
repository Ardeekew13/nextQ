import { GraphQLError } from "graphql";
import { Club } from "@/models/Club";
import { Session } from "@/models/Session";
import type { GraphQLContext } from "./context";
import type { AuthTokenPayload } from "@/lib/auth";

export function requireOrganiser(context: GraphQLContext): AuthTokenPayload {
  if (!context.organiser) {
    throw new GraphQLError("You must be logged in as an organiser to do that.", {
      extensions: { code: "UNAUTHENTICATED" },
    });
  }
  return context.organiser;
}

export async function requireClubOwner(context: GraphQLContext, clubId: string) {
  const organiser = requireOrganiser(context);
  const club = await Club.findById(clubId);
  if (!club) {
    throw new GraphQLError("Club not found.", { extensions: { code: "NOT_FOUND" } });
  }
  if (String(club.organiserId) !== organiser.sub) {
    throw new GraphQLError("You do not have access to this club.", {
      extensions: { code: "FORBIDDEN" },
    });
  }
  return club;
}

export async function requireSessionOwner(context: GraphQLContext, sessionId: string) {
  const organiser = requireOrganiser(context);
  const session = await Session.findById(sessionId);
  if (!session) {
    throw new GraphQLError("Session not found.", { extensions: { code: "NOT_FOUND" } });
  }
  if (String(session.organiserId) !== organiser.sub) {
    throw new GraphQLError("You do not have access to this session.", {
      extensions: { code: "FORBIDDEN" },
    });
  }
  return session;
}

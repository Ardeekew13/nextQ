/**
 * Every type a resolver module defines must be wired into the combined resolver map the server
 * uses — otherwise its fields silently resolve to null (e.g. GameEdit made the session page
 * crash after a court was edited).
 */
import { describe, expect, it } from "vitest";
import { resolvers } from "@/graphql/resolvers";
import { authResolvers } from "@/graphql/resolvers/auth";
import { clubResolvers } from "@/graphql/resolvers/club";
import { sessionResolvers } from "@/graphql/resolvers/session";
import { playerResolvers } from "@/graphql/resolvers/player";
import { courtResolvers } from "@/graphql/resolvers/court";
import { gameResolvers } from "@/graphql/resolvers/game";
import { clubMemberResolvers } from "@/graphql/resolvers/clubMember";

describe("resolver registry", () => {
  const modules = { authResolvers, clubResolvers, sessionResolvers, playerResolvers, courtResolvers, gameResolvers, clubMemberResolvers };
  for (const [moduleName, mod] of Object.entries(modules)) {
    it(`${moduleName}: every type it defines is registered`, () => {
      for (const [typeName, fields] of Object.entries(mod as Record<string, unknown>)) {
        if (typeName === "Query" || typeName === "Mutation") {
          for (const field of Object.keys(fields as object)) expect((resolvers as any)[typeName][field], `${typeName}.${field}`).toBeDefined();
          continue;
        }
        expect((resolvers as any)[typeName], `${moduleName}.${typeName} is not in resolvers/index.ts`).toBe(fields);
      }
    });
  }
});

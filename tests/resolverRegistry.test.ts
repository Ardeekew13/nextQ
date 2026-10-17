/**
 * Every type resolver a module defines must be registered in the server's resolver map, under
 * its own name. A missing one isn't a build error — the server just returns null for that
 * type's fields and the page crashes (the live "GameEdit.fromTeamA" incident). Registering it
 * under the wrong name (Game: gameResolvers.GameEdit) breaks the build instead.
 */
import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db", () => ({ connectToDatabase: vi.fn() }));

describe("resolver registry", () => {
  // Importing every resolver module (and mongoose models) can take a few seconds cold.
  it("registers every type resolver from every module under its own name", { timeout: 30_000 }, async () => {
    const { resolvers } = await import("@/graphql/resolvers");
    const modules = await Promise.all([
      import("@/graphql/resolvers/auth").then((m) => m.authResolvers),
      import("@/graphql/resolvers/club").then((m) => m.clubResolvers),
      import("@/graphql/resolvers/session").then((m) => m.sessionResolvers),
      import("@/graphql/resolvers/player").then((m) => m.playerResolvers),
      import("@/graphql/resolvers/court").then((m) => m.courtResolvers),
      import("@/graphql/resolvers/game").then((m) => m.gameResolvers),
      import("@/graphql/resolvers/clubMember").then((m) => m.clubMemberResolvers),
    ]);
    const registry = resolvers as Record<string, unknown>;
    for (const mod of modules) {
      for (const [typeName, typeResolvers] of Object.entries(mod as Record<string, unknown>)) {
        if (typeName === "Query" || typeName === "Mutation") continue;
        expect(registry[typeName], `${typeName} is not registered in src/graphql/resolvers/index.ts`).toBe(typeResolvers);
      }
    }
  });

  it("every registered type exists in the schema", { timeout: 30_000 }, async () => {
    const { resolvers } = await import("@/graphql/resolvers");
    const { typeDefs } = await import("@/graphql/typeDefs");
    const sdl = typeof typeDefs === "string" ? typeDefs : (typeDefs as { loc?: { source: { body: string } } }).loc?.source.body ?? "";
    for (const name of Object.keys(resolvers)) {
      if (name === "Query" || name === "Mutation") continue;
      expect(sdl, `${name} has resolvers but isn't in the schema`).toMatch(new RegExp(`(type|scalar)\\s+${name}\\b`));
    }
  });
});

import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("@/models/Club", () => ({
  Club: { findById: vi.fn() },
}));
vi.mock("@/models/Session", () => ({
  Session: { findById: vi.fn() },
}));

import { Club } from "@/models/Club";
import { Session } from "@/models/Session";
import { requireOrganiser, requireClubOwner, requireSessionOwner } from "@/graphql/guards";
import type { GraphQLContext } from "@/graphql/context";

function contextFor(organiserId: string | null): GraphQLContext {
  return {
    organiser: organiserId ? { sub: organiserId, email: "organiser@test.dev", name: "Test Organiser" } : null,
    playerNameCache: new Map(),
    csrfToken: "test-csrf-token",
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("requireOrganiser", () => {
  it("throws UNAUTHENTICATED when there is no logged-in organiser", () => {
    try {
      requireOrganiser(contextFor(null));
      expect.unreachable("should have thrown");
    } catch (error: any) {
      expect(error.extensions.code).toBe("UNAUTHENTICATED");
    }
  });

  it("returns the organiser payload when logged in", () => {
    const organiser = requireOrganiser(contextFor("organiser-1"));
    expect(organiser.sub).toBe("organiser-1");
  });
});

describe("requireClubOwner", () => {
  it("throws UNAUTHENTICATED before touching the database when logged out", async () => {
    await expect(requireClubOwner(contextFor(null), "club-1")).rejects.toMatchObject({
      extensions: { code: "UNAUTHENTICATED" },
    });
    expect(Club.findById).not.toHaveBeenCalled();
  });

  it("throws NOT_FOUND when the club does not exist", async () => {
    (Club.findById as any).mockResolvedValue(null);
    await expect(requireClubOwner(contextFor("organiser-1"), "missing-club")).rejects.toMatchObject({
      extensions: { code: "NOT_FOUND" },
    });
  });

  it("throws FORBIDDEN when a different organiser owns the club", async () => {
    (Club.findById as any).mockResolvedValue({ organiserId: "owner-1" });
    await expect(requireClubOwner(contextFor("intruder"), "club-1")).rejects.toMatchObject({
      extensions: { code: "FORBIDDEN" },
    });
  });

  it("returns the club when the organiser owns it", async () => {
    (Club.findById as any).mockResolvedValue({ organiserId: "owner-1" });
    const club = await requireClubOwner(contextFor("owner-1"), "club-1");
    expect(club.organiserId).toBe("owner-1");
  });
});

describe("requireSessionOwner", () => {
  it("throws FORBIDDEN when a different organiser owns the session", async () => {
    (Session.findById as any).mockResolvedValue({ organiserId: "owner-1" });
    await expect(requireSessionOwner(contextFor("intruder"), "session-1")).rejects.toMatchObject({
      extensions: { code: "FORBIDDEN" },
    });
  });

  it("returns the session when the organiser owns it", async () => {
    (Session.findById as any).mockResolvedValue({ organiserId: "owner-1" });
    const session = await requireSessionOwner(contextFor("owner-1"), "session-1");
    expect(session.organiserId).toBe("owner-1");
  });
});

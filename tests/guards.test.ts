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
    organiser: organiserId ? { sub: organiserId, email: "organiser@test.dev", name: "Test Organiser", role: "ORGANISER" } : null,
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
  // A session belongs to a club, so access is checked against that club's owner and
  // co-organisers - not just session.organiserId - so whoever has access to the club has
  // access to every session under it, not only the ones they personally created.
  const sessionDoc = { clubId: "club-1", organiserId: "creator-1" };

  it("throws FORBIDDEN when neither the club's owner nor a co-organiser", async () => {
    (Session.findById as any).mockResolvedValue(sessionDoc);
    (Club.findById as any).mockResolvedValue({ organiserId: "owner-1", coOrganiserIds: [] });
    await expect(requireSessionOwner(contextFor("intruder"), "session-1")).rejects.toMatchObject({
      extensions: { code: "FORBIDDEN" },
    });
  });

  it("returns the session for the club's owner, even if someone else created the session", async () => {
    (Session.findById as any).mockResolvedValue(sessionDoc);
    (Club.findById as any).mockResolvedValue({ organiserId: "owner-1", coOrganiserIds: [] });
    const session = await requireSessionOwner(contextFor("owner-1"), "session-1");
    expect(session).toBe(sessionDoc);
  });

  it("returns the session for a co-organiser who joined the club via a join code, not just the owner or creator", async () => {
    (Session.findById as any).mockResolvedValue(sessionDoc);
    (Club.findById as any).mockResolvedValue({ organiserId: "owner-1", coOrganiserIds: ["co-organiser-1"] });
    const session = await requireSessionOwner(contextFor("co-organiser-1"), "session-1");
    expect(session).toBe(sessionDoc);
  });

  it("still throws FORBIDDEN for someone who is a co-organiser of a DIFFERENT club", async () => {
    (Session.findById as any).mockResolvedValue(sessionDoc);
    // "outsider" co-organises some other club, but isn't in THIS club's coOrganiserIds.
    (Club.findById as any).mockResolvedValue({ organiserId: "owner-1", coOrganiserIds: ["someone-else"] });
    await expect(requireSessionOwner(contextFor("outsider"), "session-1")).rejects.toMatchObject({
      extensions: { code: "FORBIDDEN" },
    });
  });
});

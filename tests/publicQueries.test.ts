import { describe, expect, it, vi } from "vitest";

vi.mock("@/models/Club", () => ({
  Club: { findOne: vi.fn(), findById: vi.fn() },
}));
vi.mock("@/models/Session", () => ({
  Session: { findOne: vi.fn(), findById: vi.fn() },
}));

import { Club } from "@/models/Club";
import { Session } from "@/models/Session";
import { clubResolvers } from "@/graphql/resolvers/club";
import { sessionResolvers } from "@/graphql/resolvers/session";

/**
 * Public queries must work for anonymous callers (no organiser session at
 * all) and must never require - or even look at - context.organiser.
 */
describe("anonymous public queries", () => {
  it("publicClub resolves without any auth context", async () => {
    (Club.findOne as any).mockResolvedValue({ _id: "club-1", slug: "pickle-ann", name: "Pickle Ann" });
    const club = await clubResolvers.Query.publicClub(null, { slug: "pickle-ann" });
    expect(club).toMatchObject({ slug: "pickle-ann" });
    expect(Club.findOne).toHaveBeenCalledWith({ slug: "pickle-ann" });
  });

  it("publicClub returns null for an unknown slug rather than throwing", async () => {
    (Club.findOne as any).mockResolvedValue(null);
    const club = await clubResolvers.Query.publicClub(null, { slug: "does-not-exist" });
    expect(club).toBeNull();
  });

  it("publicSession resolves a published session without any auth context", async () => {
    (Club.findOne as any).mockResolvedValue({ _id: "club-1", slug: "pickle-ann" });
    (Session.findOne as any).mockResolvedValue({
      _id: "session-1",
      clubId: "club-1",
      slug: "friday-open-play",
      publicPublished: true,
    });
    const session = await sessionResolvers.Query.publicSession(null, {
      clubSlug: "pickle-ann",
      sessionSlug: "friday-open-play",
    });
    expect(session).toMatchObject({ slug: "friday-open-play" });
  });

  it("publicSession hides a session that has not been published yet", async () => {
    (Club.findOne as any).mockResolvedValue({ _id: "club-1", slug: "pickle-ann" });
    (Session.findOne as any).mockResolvedValue({
      _id: "session-1",
      clubId: "club-1",
      slug: "draft-session",
      publicPublished: false,
    });
    const session = await sessionResolvers.Query.publicSession(null, {
      clubSlug: "pickle-ann",
      sessionSlug: "draft-session",
    });
    expect(session).toBeNull();
  });

  it("publicSession returns null when the club does not exist", async () => {
    (Club.findOne as any).mockResolvedValue(null);
    const session = await sessionResolvers.Query.publicSession(null, {
      clubSlug: "no-such-club",
      sessionSlug: "anything",
    });
    expect(session).toBeNull();
  });
});

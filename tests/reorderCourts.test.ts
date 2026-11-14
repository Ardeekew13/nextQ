import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("@/models/Club", () => ({
  Club: { findById: vi.fn() },
}));
vi.mock("@/models/Session", () => ({
  Session: { findById: vi.fn() },
}));
vi.mock("@/models/Court", () => ({
  Court: { find: vi.fn(), findOne: vi.fn(), findById: vi.fn(), create: vi.fn(), findByIdAndDelete: vi.fn() },
}));
vi.mock("@/models/Game", () => ({
  Game: { findById: vi.fn() },
}));

import { Club } from "@/models/Club";
import { Session } from "@/models/Session";
import { Court } from "@/models/Court";
import { courtResolvers } from "@/graphql/resolvers/court";
import type { GraphQLContext } from "@/graphql/context";

function contextFor(organiserId: string): GraphQLContext {
  return {
    organiser: { sub: organiserId, email: "organiser@test.dev", name: "Test Organiser", role: "ORGANISER" },
    playerNameCache: new Map(),
    csrfToken: "test-csrf-token",
  };
}

function mockCourt(id: string, courtNumber: number) {
  return { _id: id, courtNumber, displayOrder: undefined as number | undefined, save: vi.fn().mockResolvedValue(undefined) };
}

beforeEach(() => {
  vi.clearAllMocks();
  (Session.findById as any).mockResolvedValue({ _id: "session-1", clubId: "club-1" });
  (Club.findById as any).mockResolvedValue({ organiserId: "owner-1", coOrganiserIds: [] });
});

describe("reorderCourts", () => {
  it("rejects when a court from this session is left out of courtIds", async () => {
    (Court.find as any).mockResolvedValue([mockCourt("c1", 1), mockCourt("c2", 2), mockCourt("c3", 3)]);
    await expect(
      courtResolvers.Mutation.reorderCourts(null, { sessionId: "session-1", courtIds: ["c1", "c2"] }, contextFor("owner-1"))
    ).rejects.toMatchObject({ extensions: { code: "BAD_USER_INPUT" } });
  });

  it("rejects a duplicate id in courtIds", async () => {
    (Court.find as any).mockResolvedValue([mockCourt("c1", 1), mockCourt("c2", 2)]);
    await expect(
      courtResolvers.Mutation.reorderCourts(null, { sessionId: "session-1", courtIds: ["c1", "c1"] }, contextFor("owner-1"))
    ).rejects.toMatchObject({ extensions: { code: "BAD_USER_INPUT" } });
  });

  it("rejects an id that doesn't belong to any court in this session", async () => {
    (Court.find as any).mockResolvedValue([mockCourt("c1", 1), mockCourt("c2", 2)]);
    await expect(
      courtResolvers.Mutation.reorderCourts(
        null,
        { sessionId: "session-1", courtIds: ["c1", "someone-elses-court"] },
        contextFor("owner-1")
      )
    ).rejects.toMatchObject({ extensions: { code: "BAD_USER_INPUT" } });
  });

  it("saves each court's displayOrder to match the requested order and returns them in that order", async () => {
    const c1 = mockCourt("c1", 1);
    const c2 = mockCourt("c2", 2);
    const c3 = mockCourt("c3", 3);
    (Court.find as any).mockResolvedValue([c1, c2, c3]);

    const result = await courtResolvers.Mutation.reorderCourts(
      null,
      { sessionId: "session-1", courtIds: ["c3", "c1", "c2"] },
      contextFor("owner-1")
    );

    expect(c3.displayOrder).toBe(0);
    expect(c1.displayOrder).toBe(1);
    expect(c2.displayOrder).toBe(2);
    expect(c1.save).toHaveBeenCalled();
    expect(c2.save).toHaveBeenCalled();
    expect(c3.save).toHaveBeenCalled();
    expect(result.map((c: any) => c._id)).toEqual(["c3", "c1", "c2"]);
  });

  it("lets a co-organiser (not just the owner) reorder courts", async () => {
    (Club.findById as any).mockResolvedValue({ organiserId: "owner-1", coOrganiserIds: ["co-organiser-1"] });
    const c1 = mockCourt("c1", 1);
    const c2 = mockCourt("c2", 2);
    (Court.find as any).mockResolvedValue([c1, c2]);

    const result = await courtResolvers.Mutation.reorderCourts(
      null,
      { sessionId: "session-1", courtIds: ["c2", "c1"] },
      contextFor("co-organiser-1")
    );
    expect(result.map((c: any) => c._id)).toEqual(["c2", "c1"]);
  });
});

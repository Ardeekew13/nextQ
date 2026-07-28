import { describe, expect, it } from "vitest";
import { computeStandings, computePodium, type StandingsInput } from "@/lib/ranking";
import { DEFAULT_SESSION_SETTINGS } from "@/types/enums";

function makePlayer(overrides: Partial<StandingsInput> & { id: string; name: string }): StandingsInput {
  return {
    gamesPlayed: 0,
    wins: 0,
    losses: 0,
    pointsScored: 0,
    pointsConceded: 0,
    pointDifferential: 0,
    currentStreak: 0,
    longestWinStreak: 0,
    gamesSatOut: 0,
    checkedInAt: null,
    ...overrides,
  };
}

describe("computeStandings", () => {
  it("ranks by wins first", () => {
    const players = [
      makePlayer({ id: "a", name: "A", gamesPlayed: 4, wins: 3, losses: 1 }),
      makePlayer({ id: "b", name: "B", gamesPlayed: 4, wins: 1, losses: 3 }),
    ];
    const standings = computeStandings(players, DEFAULT_SESSION_SETTINGS.rankingOrder);
    expect(standings[0].id).toBe("a");
    expect(standings[0].rank).toBe(1);
    expect(standings[1].rank).toBe(2);
  });

  it("computes 0% win rate for a player with no games played", () => {
    const [entry] = computeStandings(
      [makePlayer({ id: "a", name: "A" })],
      DEFAULT_SESSION_SETTINGS.rankingOrder
    );
    expect(entry.winRate).toBe(0);
  });

  it("gives tied players the same rank and skips the next rank (competition ranking)", () => {
    const players = [
      makePlayer({ id: "a", name: "A", gamesPlayed: 4, wins: 3, losses: 1, pointsScored: 40, pointsConceded: 30 }),
      makePlayer({ id: "b", name: "B", gamesPlayed: 4, wins: 3, losses: 1, pointsScored: 40, pointsConceded: 30 }),
      makePlayer({ id: "c", name: "C", gamesPlayed: 4, wins: 1, losses: 3, pointsScored: 20, pointsConceded: 40 }),
    ];
    const standings = computeStandings(players, DEFAULT_SESSION_SETTINGS.rankingOrder);
    const byId = Object.fromEntries(standings.map((s) => [s.id, s]));
    expect(byId.a.rank).toBe(1);
    expect(byId.b.rank).toBe(1);
    expect(byId.c.rank).toBe(3); // rank 2 is skipped because two players tied for 1st
  });

  it("falls through the configured ranking order: win rate, then point differential, then points scored", () => {
    const players = [
      // Same wins/losses (so same win rate), but higher point differential.
      makePlayer({ id: "high-diff", name: "High Diff", gamesPlayed: 4, wins: 2, losses: 2, pointsScored: 50, pointsConceded: 30 }),
      makePlayer({ id: "low-diff", name: "Low Diff", gamesPlayed: 4, wins: 2, losses: 2, pointsScored: 40, pointsConceded: 38 }),
    ];
    const standings = computeStandings(players, DEFAULT_SESSION_SETTINGS.rankingOrder);
    expect(standings[0].id).toBe("high-diff");
  });

  it("uses earliest check-in as the final tie-breaker", () => {
    const players = [
      makePlayer({
        id: "later",
        name: "Later",
        gamesPlayed: 2,
        wins: 1,
        losses: 1,
        pointsScored: 20,
        pointsConceded: 20,
        checkedInAt: new Date("2026-01-01T10:05:00Z"),
      }),
      makePlayer({
        id: "earlier",
        name: "Earlier",
        gamesPlayed: 2,
        wins: 1,
        losses: 1,
        pointsScored: 20,
        pointsConceded: 20,
        checkedInAt: new Date("2026-01-01T10:00:00Z"),
      }),
    ];
    const standings = computeStandings(players, DEFAULT_SESSION_SETTINGS.rankingOrder);
    expect(standings[0].id).toBe("earlier");
  });
});

describe("computePodium", () => {
  it("returns the top three players, excluding anyone with zero games played", () => {
    const players = [
      makePlayer({ id: "a", name: "A", gamesPlayed: 4, wins: 4 }),
      makePlayer({ id: "b", name: "B", gamesPlayed: 4, wins: 3 }),
      makePlayer({ id: "c", name: "C", gamesPlayed: 4, wins: 2 }),
      makePlayer({ id: "d", name: "D", gamesPlayed: 4, wins: 1 }),
      makePlayer({ id: "never-played", name: "Never Played", gamesPlayed: 0, wins: 0 }),
    ];
    const standings = computeStandings(players, DEFAULT_SESSION_SETTINGS.rankingOrder);
    const podium = computePodium(standings);
    expect(podium.map((p) => p.id)).toEqual(["a", "b", "c"]);
    expect(podium.every((p) => p.position <= 3)).toBe(true);
  });

  it("includes every player tied within the top three, even if that's more than three entries", () => {
    const players = [
      makePlayer({ id: "a", name: "A", gamesPlayed: 4, wins: 3 }),
      makePlayer({ id: "b", name: "B", gamesPlayed: 4, wins: 3 }),
      makePlayer({ id: "c", name: "C", gamesPlayed: 4, wins: 3 }),
      makePlayer({ id: "d", name: "D", gamesPlayed: 4, wins: 1 }),
    ];
    const standings = computeStandings(players, DEFAULT_SESSION_SETTINGS.rankingOrder);
    const podium = computePodium(standings);
    expect(podium.length).toBe(3);
    expect(podium.every((p) => p.rank === 1)).toBe(true);
  });

  it("shows only the available ranked players when fewer than three have completed games", () => {
    const players = [
      makePlayer({ id: "a", name: "A", gamesPlayed: 2, wins: 2 }),
      makePlayer({ id: "b", name: "B", gamesPlayed: 0, wins: 0 }),
    ];
    const standings = computeStandings(players, DEFAULT_SESSION_SETTINGS.rankingOrder);
    const podium = computePodium(standings);
    expect(podium.length).toBe(1);
    expect(podium[0].id).toBe("a");
  });
});

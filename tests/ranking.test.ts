import { describe, expect, it } from "vitest";
import { computeStandings, computePodium, findFirstPlaceTie, type StandingsInput } from "@/lib/ranking";
import { DEFAULT_SESSION_SETTINGS } from "@/types/enums";

function makePlayer(overrides: Partial<StandingsInput> & { id: string; name: string }): StandingsInput {
  return {
    gamesPlayed: 0,
    wins: 0,
    losses: 0,
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

  it("never shares a rank, but reports a genuine tie for 1st so it can be played off", () => {
    const players = [
      makePlayer({ id: "a", name: "A", gamesPlayed: 4, wins: 3, losses: 1 }),
      makePlayer({ id: "b", name: "B", gamesPlayed: 4, wins: 3, losses: 1 }),
      makePlayer({ id: "c", name: "C", gamesPlayed: 4, wins: 1, losses: 3 }),
    ];
    const standings = computeStandings(players, DEFAULT_SESSION_SETTINGS.rankingOrder);
    expect(standings.map((s) => s.rank)).toEqual([1, 2, 3]);
    expect(standings[2].id).toBe("c");
    // A and B are only separated by the arbitrary last-resort fallback, so it's a real tie.
    expect(findFirstPlaceTie(players, DEFAULT_SESSION_SETTINGS.rankingOrder).map((p) => p.id).sort()).toEqual(["a", "b"]);
  });

  it("reports no tie when 1st place is clear", () => {
    const players = [
      makePlayer({ id: "a", name: "A", gamesPlayed: 4, wins: 4 }),
      makePlayer({ id: "b", name: "B", gamesPlayed: 4, wins: 3, losses: 1 }),
    ];
    expect(findFirstPlaceTie(players, DEFAULT_SESSION_SETTINGS.rankingOrder)).toEqual([]);
  });

  it("falls through the ranking order to the next criterion when one is tied", () => {
    const players = [
      makePlayer({ id: "a-more-losses", name: "A", gamesPlayed: 6, wins: 3, losses: 3 }),
      makePlayer({ id: "z-fewer-losses", name: "Z", gamesPlayed: 4, wins: 3, losses: 1 }),
    ];
    // Same wins; fewer losses wins, even though "a-..." would win the alphabetical fallback.
    const standings = computeStandings(players, ["WINS", "FEWEST_LOSSES"]);
    expect(standings[0].id).toBe("z-fewer-losses");
  });

  it("ignores point-based criteria now that scores aren't recorded", () => {
    const players = [
      makePlayer({ id: "a", name: "A", gamesPlayed: 2, wins: 1, losses: 1 }),
      makePlayer({ id: "b", name: "B", gamesPlayed: 2, wins: 1, losses: 1 }),
    ];
    const tie = findFirstPlaceTie(players, ["POINT_DIFFERENTIAL", "POINTS_SCORED", "WINS"]);
    expect(tie.map((p) => p.id).sort()).toEqual(["a", "b"]);
  });

  it("uses earliest check-in as the final tie-breaker", () => {
    const players = [
      makePlayer({
        id: "later",
        name: "Later",
        gamesPlayed: 2,
        wins: 1,
        losses: 1,
        checkedInAt: new Date("2026-01-01T10:05:00Z"),
      }),
      makePlayer({
        id: "earlier",
        name: "Earlier",
        gamesPlayed: 2,
        wins: 1,
        losses: 1,
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

  it("keeps the podium to one player per position when several are tied, and flags the tie", () => {
    const players = [
      makePlayer({ id: "a", name: "A", gamesPlayed: 4, wins: 3, losses: 1 }),
      makePlayer({ id: "b", name: "B", gamesPlayed: 4, wins: 3, losses: 1 }),
      makePlayer({ id: "c", name: "C", gamesPlayed: 4, wins: 3, losses: 1 }),
      makePlayer({ id: "d", name: "D", gamesPlayed: 4, wins: 1, losses: 3 }),
    ];
    const standings = computeStandings(players, DEFAULT_SESSION_SETTINGS.rankingOrder);
    const podium = computePodium(standings);
    expect(podium.map((p) => p.position)).toEqual([1, 2, 3]);
    expect(podium.map((p) => p.id)).not.toContain("d");
    expect(findFirstPlaceTie(players, DEFAULT_SESSION_SETTINGS.rankingOrder)).toHaveLength(3);
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

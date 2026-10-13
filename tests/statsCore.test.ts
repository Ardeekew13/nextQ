import { describe, expect, it } from "vitest";
import { computePlayerStatistics, type CompletedGameLike } from "@/lib/statsCore";

const PLAYER_IDS = ["p1", "p2", "p3", "p4"];

function game(overrides: Partial<CompletedGameLike>): CompletedGameLike {
  return {
    teamAPlayerIds: ["p1", "p2"],
    teamBPlayerIds: ["p3", "p4"],
    winningTeam: "A",
    playersSatOutIds: [],
    ...overrides,
  };
}

describe("computePlayerStatistics", () => {
  it("records a completed game: games played, wins and losses (scores are no longer tracked)", () => {
    const results = computePlayerStatistics(PLAYER_IDS, [game({})]);

    const winner = results.get("p1")!;
    expect(winner.gamesPlayed).toBe(1);
    expect(winner.wins).toBe(1);
    expect(winner.losses).toBe(0);

    const loser = results.get("p3")!;
    expect(loser.gamesPlayed).toBe(1);
    expect(loser.wins).toBe(0);
    expect(loser.losses).toBe(1);

    // Only a winner is recorded now; no points fields should appear.
    expect(winner).not.toHaveProperty("pointsScored");
    expect(winner).not.toHaveProperty("pointDifferential");
  });

  it("computes win rate as wins / gamesPlayed elsewhere (ranking.ts), but tracks the raw counts correctly across multiple games", () => {
    const games = [
      game({ winningTeam: "A" }),
      game({ winningTeam: "B" }),
      game({ winningTeam: "A" }),
    ];
    const results = computePlayerStatistics(PLAYER_IDS, games);
    const p1 = results.get("p1")!;
    expect(p1.gamesPlayed).toBe(3);
    expect(p1.wins).toBe(2);
    expect(p1.losses).toBe(1);
  });

  it("tracks current and longest win streaks correctly, resetting on a loss", () => {
    const games = [
      game({ winningTeam: "A" }), // p1 win streak 1
      game({ winningTeam: "A" }), // p1 win streak 2
      game({ winningTeam: "A" }), // p1 win streak 3 (longest so far)
      game({ winningTeam: "B" }), // p1 loses, streak resets to -1
    ];
    const results = computePlayerStatistics(PLAYER_IDS, games);
    const p1 = results.get("p1")!;
    expect(p1.longestWinStreak).toBe(3);
    expect(p1.currentStreak).toBe(-1);
  });

  it("increments gamesSatOut for players recorded as sitting out a completed game", () => {
    const results = computePlayerStatistics(
      [...PLAYER_IDS, "p5"],
      [game({ playersSatOutIds: ["p5"] }), game({ playersSatOutIds: ["p5"] })]
    );
    expect(results.get("p5")!.gamesSatOut).toBe(2);
    expect(results.get("p1")!.gamesSatOut).toBe(0);
  });

  it("tracks partner and opponent history counts", () => {
    const results = computePlayerStatistics(PLAYER_IDS, [game({}), game({})]);
    const p1 = results.get("p1")!;
    expect(p1.partnerHistory.p2).toBe(2);
    expect(p1.opponentHistory.p3).toBe(2);
    expect(p1.opponentHistory.p4).toBe(2);
  });

  it("recalculates statistics correctly after a game result is edited", () => {
    const original = [game({ winningTeam: "A" })];
    const edited = [game({ winningTeam: "B" })];

    const before = computePlayerStatistics(PLAYER_IDS, original);
    expect(before.get("p1")!.wins).toBe(1);
    expect(before.get("p3")!.losses).toBe(1);

    // Editing a result means recomputing from the corrected game list, not
    // patching the old numbers - this mirrors what rebuildSessionStatistics does.
    const after = computePlayerStatistics(PLAYER_IDS, edited);
    expect(after.get("p1")!.wins).toBe(0);
    expect(after.get("p1")!.losses).toBe(1);
    expect(after.get("p3")!.wins).toBe(1);
    expect(after.get("p3")!.losses).toBe(0);
    // Streaks are rebuilt too, not carried over from the original result.
    expect(after.get("p1")!.currentStreak).toBe(-1);
    expect(after.get("p1")!.longestWinStreak).toBe(0);
  });

  it("is unaffected by games that are not present (cancelled games contribute nothing)", () => {
    const completedOnly = [game({})];
    const results = computePlayerStatistics(PLAYER_IDS, completedOnly);
    // Simulate "cancel the completed game" by recomputing with an empty list.
    const afterCancel = computePlayerStatistics(PLAYER_IDS, []);
    expect(results.get("p1")!.gamesPlayed).toBe(1);
    expect(afterCancel.get("p1")!.gamesPlayed).toBe(0);
  });
});

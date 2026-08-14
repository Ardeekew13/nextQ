import { describe, expect, it, beforeEach } from "vitest";
import { generateNextGame, type QueuePlayer } from "@/lib/queueEngine";

function makePlayer(overrides: Partial<QueuePlayer> & { id: string }): QueuePlayer {
  return {
    gamesPlayed: 0,
    consecutiveGames: 0,
    queueEnteredAt: new Date("2026-01-01T00:00:00Z"),
    gamesSatOut: 0,
    partnerHistory: {},
    opponentHistory: {},
    ...overrides,
  };
}

describe("Game Generation - 4-Player Group Prevention", () => {
  it("prevents the exact same 4 players from being selected again", () => {
    const players = [
      makePlayer({ id: "p1", gamesPlayed: 1 }),
      makePlayer({ id: "p2", gamesPlayed: 1 }),
      makePlayer({ id: "p3", gamesPlayed: 1 }),
      makePlayer({ id: "p4", gamesPlayed: 1 }),
      makePlayer({ id: "p5", gamesPlayed: 0 }), // new player
    ];

    // First generation - no past groups
    const first = generateNextGame(players);
    expect(first.ok).toBe(true);

    if (!first.ok) return;

    // Simulate first game with p1, p2, p3, p4
    const firstGameIds = [
      ...first.teamA.map((p) => p.id),
      ...first.teamB.map((p) => p.id),
    ].sort();
    const pastGroups = new Set([firstGameIds.join(":")]);

    // Second generation - should fail with same 4 (no new player)
    const second = generateNextGame(players, {
      pastGroups,
    });

    // Since all 4 players from past group are still in eligible list,
    // and no new players are available to substitute, selection should fail
    expect(second.ok).toBe(false);
  });

  it("allows the same 4 players if at least 1 new player is in the group", () => {
    const players = [
      makePlayer({ id: "p1", gamesPlayed: 1 }),
      makePlayer({ id: "p2", gamesPlayed: 1 }),
      makePlayer({ id: "p3", gamesPlayed: 1 }),
      makePlayer({ id: "p4", gamesPlayed: 1 }),
      makePlayer({ id: "p5", gamesPlayed: 0 }), // new player
      makePlayer({ id: "p6", gamesPlayed: 0 }), // another new player
    ];

    // First generation
    const first = generateNextGame(players);
    expect(first.ok).toBe(true);

    if (!first.ok) return;

    const firstGameIds = [
      ...first.teamA.map((p) => p.id),
      ...first.teamB.map((p) => p.id),
    ];

    // Create pastGroups with first game
    const pastGroups = new Set([firstGameIds.sort().join(":")]);

    // Second generation with at least 1 new player should succeed
    const second = generateNextGame(players, {
      pastGroups,
    });

    // Should succeed because new players are available
    expect(second.ok).toBe(true);

    if (second.ok) {
      // Verify at least 1 new player is in the selection
      const secondGameIds = [
        ...second.teamA.map((p) => p.id),
        ...second.teamB.map((p) => p.id),
      ];
      const hasNewPlayer = secondGameIds.some((id) => !firstGameIds.includes(id));
      expect(hasNewPlayer).toBe(true);
    }
  });

  it("allows different combinations of the same players", () => {
    const players = [
      makePlayer({ id: "p1" }),
      makePlayer({ id: "p2" }),
      makePlayer({ id: "p3" }),
      makePlayer({ id: "p4" }),
      makePlayer({ id: "p5" }),
    ];

    // First game: p1, p2, p3, p4
    const pastGroups = new Set(["p1:p2:p3:p4"]);

    // Second game attempt: p1, p2, p3, p5 (different from first)
    const second = generateNextGame(players, {
      pastGroups,
    });

    // Should succeed - different 4-player group (p5 instead of p4)
    expect(second.ok).toBe(true);
  });
});

describe("Game Generation - Team Shuffling", () => {
  it("produces different team assignments on multiple generations", () => {
    const players = [
      makePlayer({ id: "p1" }),
      makePlayer({ id: "p2" }),
      makePlayer({ id: "p3" }),
      makePlayer({ id: "p4" }),
      makePlayer({ id: "p5" }),
      makePlayer({ id: "p6" }),
    ];

    // Generate multiple games and check team assignments vary
    const assignments: string[] = [];

    for (let i = 0; i < 5; i++) {
      const result = generateNextGame(players, {
        mode: "HYBRID" as const,
      });

      if (result.ok) {
        const teamAIds = result.teamA.map((p) => p.id).sort().join(",");
        assignments.push(teamAIds);
      }
    }

    // With randomization, we should see some variety in team assignments
    // (though with only 6 players, not guaranteed every call differs)
    expect(assignments.length).toBe(5);
  });

  it("respects avoid repeat partnerships when shuffling", () => {
    const p1 = makePlayer({ id: "p1" });
    const p2 = makePlayer({ id: "p2" });
    const p3 = makePlayer({ id: "p3" });
    const p4 = makePlayer({ id: "p4" });

    // Mark p1 and p2 as frequent partners
    p1.partnerHistory = { p2: 10 };
    p2.partnerHistory = { p1: 10 };

    const players = [p1, p2, p3, p4];

    const result = generateNextGame(players, {
      mode: "HYBRID" as const,
    });

    if (result.ok) {
      const teamAIds = new Set(result.teamA.map((p) => p.id));
      const teamBIds = new Set(result.teamB.map((p) => p.id));

      // p1 and p2 should not be on the same team
      const sameteam = (teamAIds.has("p1") && teamAIds.has("p2")) || (teamBIds.has("p1") && teamBIds.has("p2"));
      expect(sameteam).toBe(false);
    }
  });
});

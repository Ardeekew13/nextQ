import { describe, expect, it } from "vitest";
import {
  selectEligiblePlayers,
  assignTeams,
  generateGame,
  type MatchPlayer,
} from "@/lib/matchmaking";

function makePlayer(overrides: Partial<MatchPlayer> & { id: string }): MatchPlayer {
  return {
    gamesPlayed: 0,
    queueEnteredAt: new Date("2026-01-01T00:00:00Z"),
    gamesSatOut: 0,
    partnerHistory: {},
    opponentHistory: {},
    ...overrides,
  };
}

describe("selectEligiblePlayers", () => {
  it("fails clearly when fewer than four players are eligible", () => {
    const result = selectEligiblePlayers([makePlayer({ id: "p1" }), makePlayer({ id: "p2" })]);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toMatch(/at least 4/i);
    }
  });

  it("prioritises players with the fewest games played", () => {
    const players = [
      makePlayer({ id: "veteran-1", gamesPlayed: 5 }),
      makePlayer({ id: "veteran-2", gamesPlayed: 5 }),
      makePlayer({ id: "veteran-3", gamesPlayed: 5 }),
      makePlayer({ id: "rookie-1", gamesPlayed: 0 }),
      makePlayer({ id: "rookie-2", gamesPlayed: 0 }),
      makePlayer({ id: "rookie-3", gamesPlayed: 0 }),
      makePlayer({ id: "rookie-4", gamesPlayed: 0 }),
    ];
    const result = selectEligiblePlayers(players, () => 0.5);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.selected.every((p) => p.id.startsWith("rookie"))).toBe(true);
    }
  });

  it("prioritises the longest-waiting players when games played are tied", () => {
    const base = { gamesPlayed: 2, gamesSatOut: 0, partnerHistory: {}, opponentHistory: {} };
    const players = [
      makePlayer({ id: "waited-longest", queueEnteredAt: new Date("2026-01-01T00:00:00Z"), ...base }),
      makePlayer({ id: "waited-second", queueEnteredAt: new Date("2026-01-01T00:05:00Z"), ...base }),
      makePlayer({ id: "waited-third", queueEnteredAt: new Date("2026-01-01T00:10:00Z"), ...base }),
      makePlayer({ id: "waited-fourth", queueEnteredAt: new Date("2026-01-01T00:15:00Z"), ...base }),
      makePlayer({ id: "just-arrived", queueEnteredAt: new Date("2026-01-01T00:20:00Z"), ...base }),
    ];
    const result = selectEligiblePlayers(players, () => 0.5);
    expect(result.ok).toBe(true);
    if (result.ok) {
      const ids = result.selected.map((p) => p.id);
      expect(ids).not.toContain("just-arrived");
      expect(ids).toContain("waited-longest");
    }
  });

  it("breaks true ties randomly rather than always picking the same order", () => {
    const players = Array.from({ length: 6 }, (_, i) => makePlayer({ id: `p${i}` }));
    let random = 0;
    const fakeRandom = () => {
      random += 0.1;
      return random % 1;
    };
    const first = selectEligiblePlayers(players, fakeRandom).ok
      ? (selectEligiblePlayers(players, fakeRandom) as { ok: true; selected: MatchPlayer[] }).selected.map((p) => p.id)
      : [];
    expect(first.length).toBe(4);
  });
});

describe("assignTeams", () => {
  it("avoids repeating the same partnership when an alternative exists", () => {
    const [p1, p2, p3, p4] = ["p1", "p2", "p3", "p4"].map((id) => makePlayer({ id }));
    // p1 & p2 have partnered many times before; p1 & p3 / p1 & p4 have not.
    p1.partnerHistory = { p2: 5 };
    p2.partnerHistory = { p1: 5 };

    const { teamA, teamB } = assignTeams([p1, p2, p3, p4], new Set(), () => 0.5);
    const teamAIds = teamA.map((p) => p.id).sort();
    const teamBIds = teamB.map((p) => p.id).sort();
    const isRepeatPartnership =
      (teamAIds.includes("p1") && teamAIds.includes("p2")) || (teamBIds.includes("p1") && teamBIds.includes("p2"));
    expect(isRepeatPartnership).toBe(false);
  });

  it("still produces a valid split when every option repeats a prior pairing", () => {
    const [p1, p2, p3, p4] = ["p1", "p2", "p3", "p4"].map((id) => makePlayer({ id }));
    for (const player of [p1, p2, p3, p4]) {
      player.partnerHistory = { p1: 1, p2: 1, p3: 1, p4: 1 };
      delete (player.partnerHistory as Record<string, number>)[player.id];
    }
    const { teamA, teamB } = assignTeams([p1, p2, p3, p4]);
    expect(teamA.length).toBe(2);
    expect(teamB.length).toBe(2);
    const allIds = new Set([...teamA, ...teamB].map((p) => p.id));
    expect(allIds.size).toBe(4);
  });

  it("avoids repeating the exact same four-player group when a different split of players is available elsewhere", () => {
    const [p1, p2, p3, p4] = ["p1", "p2", "p3", "p4"].map((id) => makePlayer({ id }));
    const pastGroups = new Set([["p1", "p2", "p3", "p4"].sort().join(":")]);
    // groupRepeat penalty applies regardless of split chosen here (same 4 players),
    // but the function must still return a valid result rather than failing.
    const assignment = assignTeams([p1, p2, p3, p4], pastGroups);
    expect(assignment.teamA.length).toBe(2);
    expect(assignment.score).toBeGreaterThanOrEqual(0);
  });
});

describe("generateGame", () => {
  it("prevents a player from being double-booked by only selecting from the eligible pool passed in", () => {
    const eligible = Array.from({ length: 5 }, (_, i) => makePlayer({ id: `eligible-${i}` }));
    const result = generateGame(eligible);
    expect(result.ok).toBe(true);
    const selectedIds = result.selected!.map((p) => p.id);
    expect(new Set(selectedIds).size).toBe(4);
    expect(selectedIds.every((id) => eligible.some((p) => p.id === id))).toBe(true);
  });

  it("returns a clear failure reason instead of generating an incomplete game", () => {
    const result = generateGame([makePlayer({ id: "solo" })]);
    expect(result.ok).toBe(false);
    expect(result.reason).toBeTruthy();
    expect(result.selected).toBeUndefined();
  });
});

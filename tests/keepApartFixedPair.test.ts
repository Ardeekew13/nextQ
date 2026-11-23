/**
 * Session 6b02c5ab (Sunday 8PM): fixed partners YECYEC + INDAY sat out 40+ minutes because
 * "Break them up" groups held both partners. Fixed partners always play together, so a
 * keep-apart group only counts as broken when it puts two *different* units in one game.
 */
import { describe, expect, it } from "vitest";
import { generateNextGame, type QueuePlayer } from "@/lib/queueEngine";
import { findTogetherGroups } from "@/lib/togetherGroups";
import { QueueMode } from "@/types/enums";

const T0 = Date.UTC(2026, 10, 22, 12);
const p = (id: string, waitMin: number, extra: Partial<QueuePlayer> = {}): QueuePlayer => ({
  id, gamesPlayed: 3, consecutiveGames: 0, queueEnteredAt: new Date(T0 - waitMin * 60_000), gamesSatOut: 0,
  partnerHistory: {}, opponentHistory: {}, recentGames: [], ...extra,
});

describe("keep-apart with fixed partners", () => {
  it("a group holding both fixed partners doesn't hold the pair back in strict mode", () => {
    const pool = [
      p("yecyec", 40, { fixedPartnerId: "inday" }), p("inday", 40, { fixedPartnerId: "yecyec" }),
      p("a", 30), p("b", 25), p("c", 5), p("d", 4), p("e", 3), p("f", 2),
    ];
    const r = generateNextGame(pool, {
      mode: QueueMode.SMART, maxConsecutiveGames: 2, tiebreakSeed: "t",
      keepApart: [["ekang", "yecyec", "inday"], ["yecyec", "inday", "reymund"]],
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const ids = [...r.teamA, ...r.teamB].map((x) => x.id);
    expect(ids).toEqual(expect.arrayContaining(["yecyec", "inday", "a", "b"]));
  });

  it("still keeps a different player away from the pair", () => {
    const pool = [
      p("yecyec", 40, { fixedPartnerId: "inday" }), p("inday", 40, { fixedPartnerId: "yecyec" }),
      p("ekang", 35), p("a", 30), p("b", 25), p("c", 5),
    ];
    const r = generateNextGame(pool, {
      mode: QueueMode.SMART, maxConsecutiveGames: 2, tiebreakSeed: "t",
      keepApart: [["ekang", "yecyec", "inday"]],
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const ids = [...r.teamA, ...r.teamB].map((x) => x.id);
    expect(ids).toContain("yecyec");
    expect(ids).not.toContain("ekang");
  });

  it("together-groups never suggest breaking up a pair plus nobody else", () => {
    const games = [1, 2, 3].map((n) => ({ id: `g${n}`, gameNumber: n, playerIds: ["yecyec", "inday", `x${n}`, `y${n}`] }));
    const groups = findTogetherGroups(games, { fixedPairs: [["yecyec", "inday"]] });
    expect(groups).toEqual([]);
  });
});

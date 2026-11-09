/**
 * Regression tests for the organiser's manual queue order (drag-to-reorder the queue list,
 * then Save): `QueuePlayer.manualPriority` / `QueueEngineOptions.manualOrderLength` in
 * queueEngine.ts.
 *
 * The feature is scoring-only: a manually-ordered player's position becomes the dominant
 * term in `playerScore`, so the saved order decides who's selected for the very next game
 * (the top 4 of the order = the next foursome), overriding the usual wait-time/games-played
 * priority. Every other fairness rule - the consecutive-game limit, fixed-partner pairing,
 * trio-avoidance, keep-apart groups - still runs exactly as it does for the automatic order;
 * manual order only changes WHO gets picked, never whether those rules apply.
 */
import { describe, expect, it } from "vitest";
import { generateNextGame, rankQueue, type QueuePlayer } from "@/lib/queueEngine";
import { QueueMode } from "@/types/enums";

const T0 = new Date("2026-01-01T10:00:00Z").getTime();

function qp(id: string, minutesWaited: number, extra: Partial<QueuePlayer> = {}): QueuePlayer {
  return {
    id,
    gamesPlayed: 0,
    consecutiveGames: 0,
    queueEnteredAt: new Date(T0 + minutesWaited * 60_000),
    gamesSatOut: 0,
    partnerHistory: {},
    opponentHistory: {},
    ...extra,
  };
}

const SEED = "manual-queue-order-test";

describe("manual queue order — generateNextGame", () => {
  it("picks the manually-ordered players next, even over players who've waited far longer", () => {
    // e joined first and would normally go first in every mode. a-d joined later, in wait
    // order a, b, c, d - but are manually reordered to d, c, b, a (saved positions 0-3).
    // With that manual order in effect, d/c/b/a must be the next foursome, not e.
    const eligible: QueuePlayer[] = [
      qp("e", 0),
      qp("a", 10, { manualPriority: 3 }),
      qp("b", 20, { manualPriority: 2 }),
      qp("c", 30, { manualPriority: 1 }),
      qp("d", 40, { manualPriority: 0 }),
    ];

    const result = generateNextGame(eligible, { mode: QueueMode.HYBRID, tiebreakSeed: SEED, manualOrderLength: 4 });
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const ids = result.selected.map((p) => p.id);
    expect(new Set(ids)).toEqual(new Set(["a", "b", "c", "d"]));
    expect(ids).not.toContain("e");
  });

  it("falls back to normal wait-time ordering once manual order is cleared (manualOrderLength: 0)", () => {
    // Same pool as above, but with no manual order in effect: e (joined first) must be
    // included, proving the override above came from manualOrderLength, not some other bias.
    const eligible: QueuePlayer[] = [qp("e", 0), qp("a", 10), qp("b", 20), qp("c", 30), qp("d", 40)];
    const result = generateNextGame(eligible, { mode: QueueMode.HYBRID, tiebreakSeed: SEED });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.selected.map((p) => p.id)).toContain("e");
  });

  it("keeps a fixed-partner pair together, deciding the pair's turn by the partner with the worse manual position", () => {
    // pairA is saved first in the manual order (position 0), but pairB (their fixed partner)
    // is saved last (position 5). Per the documented "pair waits for its slower half" rule,
    // the pair's effective turn is position 5, so two independently-higher-priority manual
    // singles (c, d at positions 1 and 2) must be picked ahead of the pair.
    const eligible: QueuePlayer[] = [
      qp("pairA", 0, { manualPriority: 0, fixedPartnerId: "pairB" }),
      qp("pairB", 0, { manualPriority: 5, fixedPartnerId: "pairA" }),
      qp("c", 0, { manualPriority: 1 }),
      qp("d", 0, { manualPriority: 2 }),
      qp("x", 0, { manualPriority: 3 }),
      qp("y", 0, { manualPriority: 4 }),
    ];

    const result = generateNextGame(eligible, { mode: QueueMode.HYBRID, tiebreakSeed: SEED, manualOrderLength: 6 });
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const ids = result.selected.map((p) => p.id);
    // c, d, x, y (positions 1-4) outrank the pair (effective position 5) and fill all 4 seats.
    expect(new Set(ids)).toEqual(new Set(["c", "d", "x", "y"]));
  });
});

describe("manual queue order — rankQueue (the organiser-facing preview)", () => {
  it("lists manually-ordered players first, in their saved order, then everyone else", () => {
    const eligible: QueuePlayer[] = [
      qp("p4", 0),
      qp("p5", 1),
      qp("p6", 2),
      qp("p1", 3, { manualPriority: 0 }),
      qp("p2", 4, { manualPriority: 1 }),
      qp("p3", 5, { manualPriority: 2 }),
    ];

    const ranked = rankQueue(eligible, { mode: QueueMode.HYBRID, tiebreakSeed: SEED, manualOrderLength: 3 });
    const ids = ranked.map((p) => p.id);

    expect(ids.slice(0, 3)).toEqual(["p1", "p2", "p3"]);
    expect(new Set(ids.slice(3))).toEqual(new Set(["p4", "p5", "p6"]));
  });
});

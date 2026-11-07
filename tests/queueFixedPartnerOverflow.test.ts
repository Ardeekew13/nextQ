/**
 * Regression test for a crash reported on production: a session's `nextGamePreview` (and by
 * extension `generateNextGame`) threw "Cannot read properties of undefined (reading 'id')"
 * instead of returning a result.
 *
 * Root cause: in `selectPlayers`, the `take()` closure silently dropped a fixed-partner pair
 * when it arrived with exactly one empty seat left (`selectedList.length === 3`) — it neither
 * added the pair nor queued it in `skipped`, so the round ended with a 3-player "foursome".
 * `generateNextGame` still returned `{ ok: true, selected }` with that undersized array typed
 * (falsely) as a `PlayerQuad`. `assignTeams` → `legalSplits` then destructured a 4th player
 * that didn't exist, and later read `.id` off that `undefined` value while scoring team splits.
 *
 * The fix: a fixed pair is never split and never dropped. When it arrives with only one seat
 * open, the lowest-priority single already seated gives way instead (scanning from the back of
 * `selectedList`, skipping anyone who's already part of an intact seated pair), freeing the
 * second seat the pair needs. A defensive guard in `selectPlayers` also now fails the round
 * cleanly (`ok: false`) rather than return a short list, as a backstop against any future
 * regression of the same shape.
 */
import { describe, expect, it } from "vitest";
import { generateNextGame, type QueuePlayer } from "@/lib/queueEngine";
import { QueueMode } from "@/types/enums";

const T0 = new Date("2026-01-01T10:00:00Z").getTime();
// Wide enough apart (> the 2-minute wait-bucket window) that priority order is unambiguous,
// and a fixed tiebreakSeed so the result is fully deterministic.
const SEED = "fixed-partner-overflow-test";

function qp(id: string, minutesWaited: number, extra: Partial<QueuePlayer> = {}): QueuePlayer {
  return {
    id,
    gamesPlayed: 0,
    consecutiveGames: 0,
    queueEnteredAt: new Date(T0 - minutesWaited * 60_000),
    gamesSatOut: 0,
    partnerHistory: {},
    opponentHistory: {},
    ...extra,
  };
}

describe("generateNextGame — fixed-partner pair with exactly one seat open", () => {
  it("never splits the pair: a lower-priority single gives way instead, and the pair plays as partners", () => {
    // 3 ordinary singles, each waiting longer than the last (highest priority first), plus one
    // fixed pair that joined most recently. By priority order the 3 singles would fill 3 seats,
    // leaving exactly 1 seat for a pair that needs 2 — the shape that used to get silently
    // dropped, producing a 3-player "foursome" and crashing downstream.
    const eligible: QueuePlayer[] = [
      qp("s1", 40),
      qp("s2", 30),
      qp("s3", 20),
      qp("pairA", 10, { fixedPartnerId: "pairB" }),
      qp("pairB", 10, { fixedPartnerId: "pairA" }),
    ];

    // A throw here (the original bug) fails the test on its own; no explicit assertion needed.
    const result = generateNextGame(eligible, { mode: QueueMode.HYBRID, tiebreakSeed: SEED });

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const { selected, teamA, teamB } = result;

    // A full, well-formed foursome — no undefined slots.
    expect(selected).toHaveLength(4);
    for (const p of selected) expect(p && typeof p.id).toBe("string");

    // Both teams are real pairs of real players.
    expect(teamA).toHaveLength(2);
    expect(teamB).toHaveLength(2);
    for (const p of [...teamA, ...teamB]) expect(p && typeof p.id).toBe("string");

    const ids = [...teamA, ...teamB].map((p) => p.id);
    expect(new Set(ids).size).toBe(4);

    // The fixed pair is NEVER split: both halves are in, together, every time.
    expect(ids).toEqual(expect.arrayContaining(["pairA", "pairB"]));
    // They're seated as partners (same team), not just in the same foursome as opponents.
    const teamOf = (id: string) => (teamA.some((p) => p.id === id) ? "A" : "B");
    expect(teamOf("pairA")).toBe(teamOf("pairB"));

    // To make room, the single with the WORST priority of the three (s3, who joined most
    // recently among the singles) is the one who sits this round out — s1 and s2 still play.
    expect(ids).toEqual(expect.arrayContaining(["s1", "s2"]));
    expect(ids).not.toContain("s3");
  });

  it("falls back to ok: false instead of crashing if fewer than 4 players are eligible", () => {
    const eligible: QueuePlayer[] = [qp("a", 0), qp("b", 1), qp("c", 2)];
    expect(() => generateNextGame(eligible, { mode: QueueMode.HYBRID })).not.toThrow();
    const result = generateNextGame(eligible, { mode: QueueMode.HYBRID });
    expect(result.ok).toBe(false);
  });
});

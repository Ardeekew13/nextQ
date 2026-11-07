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
 * The fix: when a pair can't fit, it's recorded as "deferred"; if the round still ends one
 * seat short with a deferred pair on hand, one half of that pair fills the last seat instead
 * of handing back a broken foursome. A defensive guard in `selectPlayers` also now fails the
 * round cleanly (`ok: false`) rather than return a short list, as a backstop against any
 * future regression of the same shape.
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
  it("never returns a short foursome, and never throws, when a fixed pair can't both fit", () => {
    // 3 ordinary singles, each waiting longer than the last (highest priority first), plus one
    // fixed pair that joined most recently. By priority order the 3 singles fill 3 seats,
    // leaving exactly 1 seat for a pair that needs 2 — the shape that used to get silently
    // dropped, producing a 3-player "foursome".
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

    // No duplicate or phantom players across the two teams.
    const ids = [...teamA, ...teamB].map((p) => p.id);
    expect(new Set(ids).size).toBe(4);

    // The 3 longest-waiting singles always fit; only one half of the stranded pair joins them.
    expect(ids).toEqual(expect.arrayContaining(["s1", "s2", "s3"]));
    const pairMembersIncluded = ids.filter((id) => id === "pairA" || id === "pairB");
    expect(pairMembersIncluded.length).toBe(1);
  });

  it("falls back to ok: false instead of crashing if fewer than 4 players are eligible", () => {
    const eligible: QueuePlayer[] = [qp("a", 0), qp("b", 1), qp("c", 2)];
    expect(() => generateNextGame(eligible, { mode: QueueMode.HYBRID })).not.toThrow();
    const result = generateNextGame(eligible, { mode: QueueMode.HYBRID });
    expect(result.ok).toBe(false);
  });
});

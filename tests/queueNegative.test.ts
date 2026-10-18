/**
 * Negative and edge-case tests for the strength estimate, club history, balanced teams and
 * the stable "up next" changes. The aim is to break things: bad data, tiny pools, odd
 * clocks, conflicting rules — and to check invariants that must hold for ANY input.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/models/Session", () => ({ Session: { find: vi.fn(), findById: vi.fn() } }));
vi.mock("@/models/SessionPlayer", () => ({ SessionPlayer: { aggregate: vi.fn(), find: vi.fn() } }));

import { Session } from "@/models/Session";
import { SessionPlayer } from "@/models/SessionPlayer";
import { blendedStrength, strengthTier, HISTORY_SESSIONS } from "@/lib/playerStrength";
import { loadClubHistory } from "@/lib/clubHistory";
import { generateNextGame, rankQueue, type QueuePlayer } from "@/lib/queueEngine";
import { deriveLocalState, generateLocalGame, rankLocalQueue, type QueueSnapshot } from "@/lib/offlineQueue";
import { DEFAULT_QUEUE_SETTINGS, DEFAULT_SESSION_SETTINGS, QueueMode } from "@/types/enums";
import { seededRandom } from "@/lib/seededRandom";

const T0 = new Date("2026-01-01T10:00:00Z").getTime();
const finite = (n: number) => Number.isFinite(n);

function qp(id: string, sec = 0, extra: Partial<QueuePlayer> = {}): QueuePlayer {
  return {
    id,
    gamesPlayed: 1,
    consecutiveGames: 0,
    queueEnteredAt: new Date(T0 + sec * 1000),
    gamesSatOut: 0,
    partnerHistory: {},
    opponentHistory: {},
    ...extra,
  };
}

afterEach(() => vi.useRealTimers());

// ---------------------------------------------------------------------------
describe("blendedStrength — bad data", () => {
  it("treats an unknown skill level like Unrated", () => {
    expect(blendedStrength({ skillLevel: "EXPERT", wins: 0, games: 0 })).toBe(50);
    expect(blendedStrength({ skillLevel: "", wins: 0, games: 0 })).toBe(50);
    expect(blendedStrength({ skillLevel: null, wins: 0, games: 0 })).toBe(50);
  });

  it("never returns NaN or Infinity for missing / corrupt numbers", () => {
    const bad = [undefined, null, NaN, Infinity, -Infinity] as unknown as number[];
    for (const v of bad) {
      expect(finite(blendedStrength({ wins: v, games: 3 }))).toBe(true);
      expect(finite(blendedStrength({ wins: 1, games: v }))).toBe(true);
      expect(finite(blendedStrength({ club: { wins: v, games: 10 }, wins: 0, games: 0 }))).toBe(true);
      expect(finite(blendedStrength({ club: { wins: 3, games: v }, wins: 0, games: 0 }))).toBe(true);
    }
  });

  it("stays within 0-100 even if wins exceed games or counts go negative", () => {
    const cases = [
      { wins: 10, games: 2 },
      { wins: -5, games: 2 },
      { wins: 2, games: -4 },
      { club: { wins: 100, games: 10 }, wins: 0, games: 0 },
      { club: { wins: -20, games: 10 }, wins: 0, games: 0 },
    ];
    for (const c of cases) {
      const s = blendedStrength(c);
      expect(s).toBeGreaterThanOrEqual(0);
      expect(s).toBeLessThanOrEqual(100);
    }
  });

  it("ignores a club record with wins but zero games", () => {
    expect(blendedStrength({ club: { wins: 7, games: 0 }, wins: 0, games: 0 })).toBe(50);
  });
});

describe("strengthTier — boundaries", () => {
  it("is Mid exactly at the cut-offs and for garbage input", () => {
    expect(strengthTier(60)).toBe("MID");
    expect(strengthTier(40)).toBe("MID");
    expect(strengthTier(60.01)).toBe("STRONG");
    expect(strengthTier(39.99)).toBe("DEVELOPING");
    expect(strengthTier(NaN)).toBe("MID");
  });
});

// ---------------------------------------------------------------------------
describe("loadClubHistory — DB edge cases", () => {
  // A query chain: select / sort / limit return the chain, lean() resolves the rows.
  const chain = (rows: unknown[]) => {
    const q: Record<string, unknown> = {};
    q.select = () => q;
    q.sort = () => q;
    q.limit = () => q;
    q.lean = () => Promise.resolve(rows);
    return q;
  };
  beforeEach(() => vi.clearAllMocks());

  it("does no queries without a club or without names", async () => {
    expect((await loadClubHistory(undefined, "s", ["Ann"])).size).toBe(0);
    expect((await loadClubHistory("club", "s", [])).size).toBe(0);
    expect(Session.find).not.toHaveBeenCalled();
  });

  it("returns empty and skips the aggregate when the club has no completed sessions", async () => {
    (Session.find as any).mockReturnValue(chain([]));
    expect((await loadClubHistory("club", "s", ["Ann"])).size).toBe(0);
    expect(SessionPlayer.aggregate).not.toHaveBeenCalled();
  });

  it("excludes the current session and only completed ones", async () => {
    (Session.find as any).mockReturnValue(chain([]));
    await loadClubHistory("club", "current", ["Ann"]);
    expect(Session.find).toHaveBeenCalledWith(
      expect.objectContaining({ clubId: "club", status: "COMPLETED", _id: { $ne: "current" } })
    );
  });

  it("merges name variants by case and spacing, and survives missing fields", async () => {
    (Session.find as any).mockReturnValue(chain([
      { _id: "s1", sessionDate: "2026-01-01" },
      { _id: "s2", sessionDate: null },
    ]));
    (SessionPlayer.aggregate as any).mockResolvedValue([
      { name: "  JM ", sessionId: "s1", wins: 3, gamesPlayed: 5 },
      { name: "jm", sessionId: "s2", wins: undefined, gamesPlayed: 4 },
    ]);
    const h = await loadClubHistory("club", "now", ["JM", "jm "]);
    expect(h.get("jm")).toEqual({ wins: 3, games: 9 });
  });

  it(`counts only the ${HISTORY_SESSIONS} most recent sessions`, async () => {
    const sessions = Array.from({ length: 12 }, (_, i) => ({ _id: `s${i}`, sessionDate: new Date(T0 + i * 86_400_000) }));
    (Session.find as any).mockReturnValue(chain(sessions));
    // Two oldest sessions were all losses; the 10 recent ones all wins.
    (SessionPlayer.aggregate as any).mockResolvedValue(
      sessions.map((s, i) => ({ name: "Ann", sessionId: s._id, wins: i < 2 ? 0 : 4, gamesPlayed: 4 }))
    );
    const h = await loadClubHistory("club", "now", ["Ann"]);
    expect(h.get("ann")).toEqual({ wins: 40, games: 40 });
  });
});

// ---------------------------------------------------------------------------
describe("queue engine — hostile inputs", () => {
  it("refuses fewer than 4 players with every option on, instead of throwing", () => {
    for (const n of [0, 1, 3]) {
      const pool = Array.from({ length: n }, (_, i) => qp(`p${i}`));
      const r = generateNextGame(pool, { mixEveryone: true, rankMatchups: true, balanceTeams: true, tiebreakSeed: "s" });
      expect(r.ok).toBe(false);
    }
    expect(rankQueue([], { tiebreakSeed: "s" })).toEqual([]);
  });

  it("still produces a valid game when strengths are missing or NaN", () => {
    const pool = [qp("a", 0, { winRate: NaN }), qp("b", 0), qp("c", 0, { winRate: 80 }), qp("d", 0, { winRate: undefined })];
    const r = generateNextGame(pool, { balanceTeams: true, rankMatchups: true, tiebreakSeed: "s" });
    expect(r.ok).toBe(true);
    if (r.ok) expect(new Set([...r.teamA, ...r.teamB].map((p) => p.id)).size).toBe(4);
  });

  it("copes with an invalid or future check-in time without dropping or duplicating players", () => {
    vi.useFakeTimers();
    vi.setSystemTime(T0 + 600_000);
    const pool = [
      qp("bad", 0, { queueEnteredAt: new Date("not a date") }),
      qp("future", 99_999),
      qp("a", 10), qp("b", 20), qp("c", 30), qp("d", 40),
    ];
    const ranked = rankQueue(pool, { tiebreakSeed: "s" });
    expect(ranked.map((p) => p.id).sort()).toEqual(pool.map((p) => p.id).sort());
    const r = generateNextGame(pool, { tiebreakSeed: "s" });
    expect(r.ok).toBe(true);
  });

  it("balanced teams never split a fixed pair, even when that makes the game lopsided", () => {
    const pool = [
      qp("s1", 0, { winRate: 90, fixedPartnerId: "s2" }),
      qp("s2", 0, { winRate: 85, fixedPartnerId: "s1" }),
      qp("d1", 0, { winRate: 20 }),
      qp("d2", 0, { winRate: 25 }),
    ];
    const r = generateNextGame(pool, { balanceTeams: true, rankMatchups: true, tiebreakSeed: "s" });
    expect(r.ok).toBe(true);
    if (r.ok) {
      const team = (r.teamA.some((p) => p.id === "s1") ? r.teamA : r.teamB).map((p) => p.id).sort();
      expect(team).toEqual(["s1", "s2"]);
    }
  });

  it("rank matchups / balanced teams never override a keep-apart group", () => {
    // a and b are the two strongest — rank matchups would love to group them.
    const pool = [
      qp("a", 0, { winRate: 95 }), qp("b", 0, { winRate: 94 }),
      qp("c", 0, { winRate: 60 }), qp("d", 0, { winRate: 55 }),
      qp("e", 0, { winRate: 50 }), qp("f", 0, { winRate: 45 }),
    ];
    for (let i = 0; i < 20; i++) {
      const r = generateNextGame(pool, { rankMatchups: true, balanceTeams: true, keepApart: [["a", "b"]], tiebreakSeed: `s${i}` });
      expect(r.ok).toBe(true);
      if (r.ok) {
        const ids = r.selected.map((p) => p.id);
        expect(ids.includes("a") && ids.includes("b")).toBe(false);
      }
    }
  });

  it("someone who hasn't played yet still beats a long waiter (absolute wait slots regression)", () => {
    vi.useFakeTimers();
    vi.setSystemTime(T0 + 4 * 3_600_000);
    const pool = [
      qp("w1", 0), qp("w2", 0), qp("w3", 0), qp("w4", 0), // waited 4 hours
      qp("new", 4 * 3600 - 5, { gamesPlayed: 0 }), // just arrived, never played
    ];
    const r = generateNextGame(pool, { mode: QueueMode.HYBRID, tiebreakSeed: "s" });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.selected.map((p) => p.id)).toContain("new");
  });

  it("still enforces the rest rule when enough others are waiting", () => {
    const pool = [
      qp("tired", -600, { consecutiveGames: 2 }),
      qp("a", 0), qp("b", 0), qp("c", 0), qp("d", 0),
    ];
    const r = generateNextGame(pool, { maxConsecutiveGames: 2, tiebreakSeed: "s" });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.selected.map((p) => p.id)).not.toContain("tired");
  });

  it("different sessions don't all get the same tie order (seed is actually used)", () => {
    const tied = Array.from({ length: 8 }, (_, i) => qp(`p${i}`, 0));
    const orders = new Set(
      ["s1", "s2", "s3", "s4", "s5"].map((seed) => rankQueue(tied, { tiebreakSeed: seed }).map((p) => p.id).join())
    );
    expect(orders.size).toBeGreaterThan(1);
  });
});

// ---------------------------------------------------------------------------
describe("invariants for ANY pool and ANY option combination (fuzz)", () => {
  it("always picks 4 distinct waiting players, splits them 2v2, and ranks everyone exactly once", () => {
    vi.useFakeTimers();
    const rnd = seededRandom("fuzz");
    const modes = [QueueMode.HYBRID, QueueMode.BALANCED, QueueMode.SMART];
    for (let round = 0; round < 300; round++) {
      vi.setSystemTime(T0 + Math.floor(rnd() * 3_600_000));
      const n = 4 + Math.floor(rnd() * 14);
      const ids = Array.from({ length: n }, (_, i) => `p${i}`);
      const pool = ids.map((id, i) => {
        const p = qp(id, Math.floor(rnd() * 3600), {
          gamesPlayed: Math.floor(rnd() * 6),
          consecutiveGames: Math.floor(rnd() * 3),
          gamesSatOut: Math.floor(rnd() * 3),
          winRate: rnd() < 0.1 ? undefined : rnd() * 100,
        });
        for (const other of ids) {
          if (other !== id && rnd() < 0.15) p.partnerHistory[other] = 1;
          if (other !== id && rnd() < 0.15) p.opponentHistory[other] = 1;
        }
        // occasional mutual fixed pair
        if (i % 2 === 1 && rnd() < 0.1) {
          p.fixedPartnerId = ids[i - 1];
        }
        return p;
      });
      // make fixed pairs mutual
      for (const p of pool) if (p.fixedPartnerId) pool.find((o) => o.id === p.fixedPartnerId)!.fixedPartnerId = p.id;
      const keepApart = rnd() < 0.3 ? [[ids[0], ids[1]]] : [];
      const opts = {
        mode: modes[round % 3],
        mixEveryone: rnd() < 0.5,
        rankMatchups: rnd() < 0.5,
        balanceTeams: rnd() < 0.5,
        tiebreakSeed: `s${round}`,
        keepApart,
        pastGroups: new Set([ids.slice(0, 4).sort().join(":")]),
      };

      const ranked = rankQueue(pool, opts).map((p) => p.id);
      expect(ranked.slice().sort()).toEqual(ids.slice().sort());

      const r = generateNextGame(pool, opts);
      expect(r.ok, `round ${round}`).toBe(true);
      if (!r.ok) continue;
      const picked = r.selected.map((p) => p.id);
      expect(new Set(picked).size).toBe(4);
      picked.forEach((id) => expect(ids).toContain(id));
      const teamIds = [...r.teamA, ...r.teamB].map((p) => p.id);
      expect(r.teamA.length).toBe(2);
      expect(r.teamB.length).toBe(2);
      expect(teamIds.slice().sort()).toEqual(picked.slice().sort());
      // fixed pairs that are both in the game are on the same team
      for (const p of r.selected) {
        if (p.fixedPartnerId && picked.includes(p.fixedPartnerId)) {
          const inA = r.teamA.some((t) => t.id === p.id);
          expect(r.teamA.some((t) => t.id === p.fixedPartnerId)).toBe(inA);
        }
      }
      // same inputs → same answer (determinism)
      const again = generateNextGame(pool, opts);
      expect(again.ok && again.teamA.map((p) => p.id)).toEqual(r.teamA.map((p) => p.id));
    }
  });
});

// ---------------------------------------------------------------------------
describe("offline mode agrees with the server", () => {
  function snap(extra: Partial<QueueSnapshot> = {}): QueueSnapshot {
    const players = Array.from({ length: 8 }, (_, i) => ({
      id: `p${i}`,
      name: `P${i}`,
      checkedIn: true,
      active: true,
      gamesPlayed: i % 3,
      wins: i % 2,
      losses: (i % 3) - (i % 2) < 0 ? 0 : (i % 3) - (i % 2),
      currentStreak: 0,
      longestWinStreak: 0,
      consecutiveGames: 0,
      queueEnteredAt: new Date(T0 + i * 40_000).toISOString(),
      gamesSatOut: 0,
      partnerHistory: {},
      opponentHistory: {},
      skillLevel: i < 2 ? "ADVANCED" : i > 5 ? "NOVICE" : null,
      clubWins: i * 3,
      clubGames: i * 5,
    }));
    return {
      sessionId: "sess-9",
      takenAt: new Date(T0).toISOString(),
      queueMode: "HYBRID",
      maxConsecutiveGames: 2,
      lastGameNumber: 0,
      players,
      activeGames: [],
      courts: [{ id: "c1", courtNumber: 1, status: "AVAILABLE" }],
      pastGroups: [],
      keepApart: [],
      ...extra,
    };
  }

  it("balanced teams default ON offline when an old snapshot has no setting", () => {
    vi.useFakeTimers();
    vi.setSystemTime(T0 + 900_000);
    const s = snap();
    delete (s as Partial<QueueSnapshot>).balanceTeams;
    const state = deriveLocalState(s, []);
    const local = generateLocalGame(s, state);
    const explicit = generateLocalGame({ ...s, balanceTeams: true }, deriveLocalState({ ...s, balanceTeams: true }, []));
    expect(local).toEqual(explicit);
  });

  it("offline ranking is stable over time and survives a snapshot without strength fields", () => {
    vi.useFakeTimers();
    const s = snap();
    for (const p of s.players) {
      delete p.skillLevel;
      delete p.clubWins;
      delete p.clubGames;
    }
    const orders = new Set<string>();
    for (let m = 15; m < 45; m += 3) {
      vi.setSystemTime(T0 + m * 60_000);
      orders.add(rankLocalQueue(s, deriveLocalState(s, [])).map((p) => p.id).join());
    }
    expect(orders.size).toBe(1);
  });
});

// ---------------------------------------------------------------------------
describe("reset to default", () => {
  it("matches the real session defaults", () => {
    expect(DEFAULT_QUEUE_SETTINGS.queueMode).toBe(DEFAULT_SESSION_SETTINGS.queueMode);
    expect(DEFAULT_QUEUE_SETTINGS.maxConsecutiveGames).toBe(DEFAULT_SESSION_SETTINGS.maxConsecutiveGames);
    expect(DEFAULT_QUEUE_SETTINGS.mixEveryone).toBe(DEFAULT_SESSION_SETTINGS.mixEveryone);
    expect(DEFAULT_QUEUE_SETTINGS.rankMatchups).toBe(DEFAULT_SESSION_SETTINGS.rankMatchups);
    expect(DEFAULT_QUEUE_SETTINGS.balanceTeams).toBe(DEFAULT_SESSION_SETTINGS.balanceTeams);
  });
});

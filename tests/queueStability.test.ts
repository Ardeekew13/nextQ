import { afterEach, describe, expect, it, vi } from "vitest";
import { generateNextGame, rankQueue, type QueuePlayer } from "@/lib/queueEngine";
import { QueueMode } from "@/types/enums";

const T0 = new Date("2026-01-01T10:00:00Z").getTime();

function player(id: string, enteredSecondsAfterT0: number, extra: Partial<QueuePlayer> = {}): QueuePlayer {
  return {
    id,
    gamesPlayed: 1,
    consecutiveGames: 0,
    queueEnteredAt: new Date(T0 + enteredSecondsAfterT0 * 1000),
    gamesSatOut: 0,
    partnerHistory: {},
    opponentHistory: {},
    ...extra,
  };
}

// Players who came off courts at different moments, some only seconds apart — the case
// where the old elapsed-time buckets flipped in and out of ties as the clock ticked.
const pool = () => [
  player("a", 0),
  player("b", 0),
  player("c", 0),
  player("d", 0),
  player("e", 50),
  player("f", 70),
  player("g", 100),
  player("h", 130),
  player("i", 200),
];

afterEach(() => vi.useRealTimers());

describe("Up next stays put", () => {
  for (const mode of [QueueMode.HYBRID, QueueMode.BALANCED, QueueMode.SMART]) {
    it(`${mode}: the order doesn't change just because time passes`, () => {
      vi.useFakeTimers();
      const orders = new Set<string>();
      for (let sec = 210; sec <= 210 + 15 * 60; sec += 7) {
        vi.setSystemTime(T0 + sec * 1000);
        const ranked = rankQueue(pool(), { mode, tiebreakSeed: "session-1", random: Math.random });
        orders.add(ranked.map((p) => p.id).join(","));
      }
      expect(orders.size).toBe(1);
    });
  }

  it("players tied on wait and games keep their order when someone else joins or leaves", () => {
    vi.useFakeTimers();
    vi.setSystemTime(T0 + 600_000);
    // Eight players who all came off the same courts at the same moment: a full tie.
    const tied = ["p1", "p2", "p3", "p4", "p5", "p6", "p7", "p8"].map((id) => player(id, 0));
    const before = rankQueue(tied, { tiebreakSeed: "session-1" }).map((p) => p.id);

    // A court finishes: four more players join the back of the queue.
    const joined = [...tied, player("x1", 300), player("x2", 300), player("x3", 300), player("x4", 300)];
    const afterJoin = rankQueue(joined, { tiebreakSeed: "session-1" }).map((p) => p.id);
    expect(afterJoin.slice(0, 8)).toEqual(before);

    // Someone at the back checks out.
    const afterLeave = rankQueue(tied.filter((p) => p.id !== before[7]), { tiebreakSeed: "session-1" }).map((p) => p.id);
    expect(afterLeave).toEqual(before.slice(0, 7));
  });
});

describe("Balanced teams", () => {
  const four = () => [
    player("strong", 0, { winRate: 75 }),
    player("mid", 0, { winRate: 55 }),
    player("dev1", 0, { winRate: 35 }),
    player("dev2", 0, { winRate: 30 }),
  ];
  const teamOf = (team: QueuePlayer[]) => team.map((p) => p.id).sort().join("+");

  it("puts the strongest with the weakest when on", () => {
    const r = generateNextGame(four(), { balanceTeams: true, tiebreakSeed: "s" });
    expect(r.ok).toBe(true);
    if (r.ok) {
      const teams = [teamOf(r.teamA), teamOf(r.teamB)].sort();
      expect(teams).toEqual(["dev1+mid", "dev2+strong"]);
    }
  });

  it("still avoids a repeat partnership before balancing", () => {
    const players = four();
    players[0].partnerHistory = { dev2: 1 };
    players[3].partnerHistory = { strong: 1 };
    const r = generateNextGame(players, { balanceTeams: true, tiebreakSeed: "s" });
    expect(r.ok).toBe(true);
    if (r.ok) {
      const teams = [teamOf(r.teamA), teamOf(r.teamB)];
      expect(teams).not.toContain("dev2+strong");
      // Next most even split: strong + dev1 vs mid + dev2.
      expect(teams.sort()).toEqual(["dev1+strong", "dev2+mid"]);
    }
  });
});

describe("Toggling options and back restores Up next", () => {
  it("returns to the exact same game after turning Mix everyone / Rank matchups on and off", () => {
    vi.useFakeTimers();
    vi.setSystemTime(T0 + 600_000);
    const players = [
      player("a", 0, { winRate: 70, partnerHistory: { e: 1 } }),
      player("b", 10, { winRate: 40, gamesPlayed: 2 }),
      player("c", 20, { winRate: 60 }),
      player("d", 30, { winRate: 35, opponentHistory: { a: 1 } }),
      player("e", 40, { winRate: 55, partnerHistory: { a: 1 } }),
      player("f", 50, { winRate: 45 }),
      player("g", 60, { winRate: 65 }),
      player("h", 70, { winRate: 30 }),
    ];
    const game = (opts: { mixEveryone?: boolean; rankMatchups?: boolean }) => {
      const r = generateNextGame(players, { ...opts, balanceTeams: true, tiebreakSeed: "session-1", pastGroups: new Set(["a:b:c:e"]) });
      if (!r.ok) throw new Error(r.reason);
      return `${r.teamA.map((p) => p.id).join("+")} vs ${r.teamB.map((p) => p.id).join("+")}`;
    };

    const original = game({});
    vi.setSystemTime(T0 + 700_000); // a little time passes while the organiser fiddles
    game({ mixEveryone: true });
    game({ mixEveryone: true, rankMatchups: true });
    game({ rankMatchups: true });
    vi.setSystemTime(T0 + 800_000);
    expect(game({})).toBe(original);
  });
});

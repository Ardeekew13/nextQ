/**
 * No internet / flaky internet: a whole club night run on the device (record result → auto-fill,
 * fill court) while the connection drops, requests are lost before reaching the server, answers
 * are lost AFTER the server saved, and refreshes fail. At the end, what the organiser saw must
 * be exactly what the server has: every game once, every result once, nothing stuck or refused.
 */
import { describe, expect, it } from "vitest";
import {
  deriveLocalState,
  generateLocalGame,
  type CompleteOp,
  type FillOp,
  type LocalOp,
  type QueueSnapshot,
  type SnapshotPlayer,
} from "@/lib/offlineQueue";
import { syncPending } from "@/lib/offlineSync";
import { isNetworkFailure, type PendingOp } from "@/lib/offlineResults";
import { seededRandom } from "@/lib/seededRandom";

const T0 = new Date("2026-01-01T19:00:00Z").getTime();
const iso = (min: number) => new Date(T0 + min * 60_000).toISOString();

function player(i: number): SnapshotPlayer {
  return {
    id: `p${i}`, name: `P${i}`, checkedIn: true, active: true, gamesPlayed: 0, wins: 0, losses: 0,
    currentStreak: 0, longestWinStreak: 0, consecutiveGames: 0, queueEnteredAt: iso(i * 0.1), gamesSatOut: 0,
    partnerHistory: {}, opponentHistory: {},
  };
}

function initial(players: number, courts: number): QueueSnapshot {
  return {
    sessionId: "s1", takenAt: iso(0), queueMode: "HYBRID", maxConsecutiveGames: 2, mixEveryone: true,
    lastGameNumber: 0, players: Array.from({ length: players }, (_, i) => player(i + 1)), activeGames: [],
    courts: Array.from({ length: courts }, (_, i) => ({ id: `c${i + 1}`, courtNumber: i + 1, status: "AVAILABLE" })),
    pastGroups: [], keepApart: [], knownClientIds: [],
  };
}

/** A fake server with the same rules as syncOfflineGame / completeGame. */
class FakeServer {
  accepted: LocalOp[] = []; // as the device sent them, translated to the device's game ids
  private serverIdOf = new Map<string, string>(); // clientGameId -> server id
  private localIdOf = new Map<string, string>(); // server id -> clientGameId
  completedWith = new Map<string, "A" | "B">(); // clientGameId -> winner
  constructor(private readonly start: QueueSnapshot) {}

  private state() {
    return deriveLocalState({ ...this.start, knownClientIds: [] }, this.accepted);
  }

  syncFill(e: FillOp): string {
    const existing = this.serverIdOf.get(e.localGameId);
    if (existing) return existing; // idempotent on clientGameId
    const st = this.state();
    const court = st.courts.find((c) => c.id === e.courtId);
    if (!court || court.currentGameId) throw new Error("Court is currently in_use and cannot start a new game.");
    const busy = new Set(st.activeGames.flatMap((g) => [...g.teamA, ...g.teamB]));
    if ([...e.teamAPlayerIds, ...e.teamBPlayerIds].some((id) => busy.has(id))) {
      throw new Error("One of these players is already in a game on another court.");
    }
    const id = `srv-${this.serverIdOf.size + 1}`;
    this.serverIdOf.set(e.localGameId, id);
    this.localIdOf.set(id, e.localGameId);
    this.accepted.push({ ...e });
    return id;
  }

  complete(e: CompleteOp, serverId: string): void {
    const local = this.localIdOf.get(serverId);
    if (!local) throw new Error("Game not found.");
    const done = this.completedWith.get(local);
    if (done === e.winningTeam) return; // same result again: harmless no-op
    if (done) throw new Error("Cannot complete a game that is COMPLETED.");
    this.completedWith.set(local, e.winningTeam);
    this.accepted.push({ ...e, gameId: local });
  }

  /** What sessionQueueSnapshot would return now. */
  snapshot(): QueueSnapshot {
    const st = this.state();
    return {
      ...this.start,
      players: st.players,
      lastGameNumber: st.lastGameNumber,
      pastGroups: [...st.pastGroups],
      activeGames: st.activeGames.map((g) => ({ ...g, id: this.serverIdOf.get(g.id)!, clientId: g.id })),
      knownClientIds: [...this.serverIdOf.keys()],
    };
  }
}

type Net = { online: boolean; lossBefore: number; lossAfter: number; refreshFail: number };
const networkError = () => new TypeError("Failed to fetch");

function runNight(seed: string, opts: { players: number; courts: number; actions: number; net: (step: number, rnd: () => number) => Net }) {
  const rnd = seededRandom(seed);
  const server = new FakeServer(initial(opts.players, opts.courts));
  let snapshot = server.snapshot();
  let pending: PendingOp[] = [];
  let idMap: Record<string, string> = {};
  let net: Net = { online: true, lossBefore: 0, lossAfter: 0, refreshFail: 0 };
  let localN = 0;
  let minute = 1;
  let fillsMade = 0;
  let resultsMade = 0;

  const request = <T>(fn: () => T): Promise<T> => {
    if (!net.online || rnd() < net.lossBefore) return Promise.reject(networkError()); // never reached the server
    const out = fn(); // the server saves it…
    if (rnd() < net.lossAfter) return Promise.reject(networkError()); // …but the answer is lost
    return Promise.resolve(out);
  };
  const sync = () =>
    syncPending({
      load: () => pending.map((p) => ({ ...p })),
      save: (l) => (pending = l.map((p) => ({ ...p }))),
      loadIdMap: () => ({ ...idMap }),
      saveIdMap: (m) => (idMap = { ...m }),
      isNetworkFailure,
      sendFill: (e) => request(() => server.syncFill(e)),
      sendResult: (e, id) => request(() => server.complete(e, id)),
      refresh: async () => {
        if (!net.online || rnd() < net.refreshFail) throw networkError();
        snapshot = server.snapshot(); // the dashboard (and so the snapshot) reloads
      },
    });
  const view = () => deriveLocalState(snapshot, pending.filter((p) => !p.error));
  const fill = (courtId: string): boolean => {
    const st = view();
    if (st.courts.find((c) => c.id === courtId)?.currentGameId) return false;
    const picked = generateLocalGame(snapshot, st);
    if (!picked.ok) return false;
    pending.push({
      kind: "fill", id: `op-${pending.length}-${localN}`, sessionId: "s1", courtId, localGameId: `local-${++localN}`,
      teamAPlayerIds: picked.teamA, teamBPlayerIds: picked.teamB, playersSatOutIds: picked.satOut, createdAt: iso(minute),
    });
    fillsMade++;
    return true;
  };

  return (async () => {
    for (let step = 0; step < opts.actions; step++) {
      net = opts.net(step, rnd);
      minute += 4 + Math.floor(rnd() * 6);
      // The page also re-fetches the snapshot every 20 s, even while actions are still unsent.
      if (net.online && rnd() < 0.3) snapshot = server.snapshot();
      const st = view();
      const court = st.courts[Math.floor(rnd() * st.courts.length)];
      if (court.currentGameId) {
        // Record result, then auto-fill that court — one click, no waiting for the network.
        pending.push({
          kind: "complete", id: `r-${step}`, sessionId: "s1", gameId: court.currentGameId,
          winningTeam: rnd() < 0.5 ? "A" : "B", recordedAt: iso(minute),
        });
        resultsMade++;
      }
      fill(court.id);
      await sync(); // the background sync runs after every action (and may get nowhere)
    }
    const seen = view(); // what the organiser has on screen at the end of the night
    const seenGames = new Map(seen.players.map((p) => [p.id, p.gamesPlayed]));
    const seenCourts = seen.courts.map((c) => {
      const g = seen.activeGames.find((x) => x.id === c.currentGameId);
      return g ? [...g.teamA, ...g.teamB].sort().join(",") : "";
    });

    // The connection comes back for good: keep syncing until nothing is left.
    net = { online: true, lossBefore: 0, lossAfter: 0, refreshFail: 0 };
    for (let i = 0; i < 5 && pending.length > 0; i++) await sync();

    const serverState = server.snapshot();
    const serverView = deriveLocalState(serverState, []);
    return {
      pending,
      errors: pending.filter((p) => p.error),
      fillsMade,
      resultsMade,
      serverFills: server.accepted.filter((o) => o.kind === "fill").length,
      serverResults: server.accepted.filter((o) => o.kind === "complete").length,
      seenGames,
      serverGames: new Map(serverView.players.map((p) => [p.id, p.gamesPlayed])),
      seenCourts,
      serverCourts: serverView.courts.map((c) => {
        const g = serverView.activeGames.find((x) => x.id === c.currentGameId);
        return g ? [...g.teamA, ...g.teamB].sort().join(",") : "";
      }),
    };
  })();
}

function expectNightSavedExactly(r: Awaited<ReturnType<typeof runNight>>) {
  expect(r.errors, "nothing refused by the server").toEqual([]);
  expect(r.pending, "nothing left waiting").toEqual([]);
  expect(r.serverFills, "every game saved once").toBe(r.fillsMade);
  expect(r.serverResults, "every result saved once").toBe(r.resultsMade);
  expect(r.serverGames, "everyone's game count matches the screen").toEqual(r.seenGames);
  expect(r.serverCourts, "the courts match the screen").toEqual(r.seenCourts);
}

describe("no internet at all", () => {
  it("a whole stretch offline: everything recorded is saved exactly once when it comes back", async () => {
    const r = await runNight("offline", {
      players: 18, courts: 2, actions: 30,
      net: () => ({ online: false, lossBefore: 0, lossAfter: 0, refreshFail: 0 }),
    });
    expect(r.fillsMade).toBeGreaterThan(20);
    expectNightSavedExactly(r);
  });
});

describe("intermittent internet", () => {
  for (const seed of ["a", "b", "c", "d", "e", "f", "g", "h"]) {
    it(`drops, lost requests and lost answers (night ${seed})`, async () => {
      const r = await runNight(`flaky-${seed}`, {
        players: 22, courts: 2, actions: 40,
        net: (step, rnd) => {
          // Signal comes and goes in stretches, and is unreliable when it's there.
          const online = Math.floor(step / 3) % 3 !== 1 && rnd() > 0.15;
          return { online, lossBefore: 0.2, lossAfter: 0.2, refreshFail: 0.25 };
        },
      });
      expect(r.resultsMade).toBeGreaterThan(10);
      expectNightSavedExactly(r);
    });
  }
  it("very bad signal: most answers lost after the server saved (retries must not duplicate)", async () => {
    const r = await runNight("lost-answers", {
      players: 16, courts: 3, actions: 40,
      net: () => ({ online: true, lossBefore: 0.1, lossAfter: 0.6, refreshFail: 0.5 }),
    });
    expectNightSavedExactly(r);
  });
});

describe("the server refuses something", () => {
  it("a refused game is flagged with its result, and everything after it still syncs", async () => {
    const server = new FakeServer(initial(12, 2));
    // Another device already put p1-p4 on court 2.
    server.syncFill({ kind: "fill", id: "x", sessionId: "s1", courtId: "c2", localGameId: "other-1", teamAPlayerIds: ["p1", "p2"], teamBPlayerIds: ["p3", "p4"], playersSatOutIds: [], createdAt: iso(1) });
    let pending: PendingOp[] = [
      { kind: "fill", id: "f1", sessionId: "s1", courtId: "c1", localGameId: "local-1", teamAPlayerIds: ["p1", "p5"], teamBPlayerIds: ["p6", "p7"], playersSatOutIds: [], createdAt: iso(2) },
      { kind: "complete", id: "r1", sessionId: "s1", gameId: "local-1", winningTeam: "A", recordedAt: iso(14) },
      { kind: "fill", id: "f2", sessionId: "s1", courtId: "c1", localGameId: "local-2", teamAPlayerIds: ["p5", "p6"], teamBPlayerIds: ["p7", "p8"], playersSatOutIds: [], createdAt: iso(15) },
    ];
    let idMap: Record<string, string> = {};
    await syncPending({
      load: () => pending, save: (l) => (pending = l), loadIdMap: () => idMap, saveIdMap: (m) => (idMap = m),
      isNetworkFailure,
      sendFill: async (e) => server.syncFill(e),
      sendResult: async (e, id) => server.complete(e, id),
      refresh: async () => {},
    });
    expect(pending.find((p) => p.id === "f1")?.error).toMatch(/already in a game/);
    expect(pending.find((p) => p.id === "r1")?.error).toMatch(/not saved/);
    // The next game went through (and, being saved, was cleared from the device).
    expect(pending.find((p) => p.id === "f2")).toBeUndefined();
    expect(server.snapshot().knownClientIds).toContain("local-2");
  });
});

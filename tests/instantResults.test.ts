/**
 * Local-first results and fills: recording a result and filling a court happen on the device
 * at once (like pickleq.app), and are checked and saved by the server in the background.
 */
import { describe, expect, it, vi } from "vitest";
import { FRESH_SNAPSHOT_MS, fillOnDevice, snapshotMatchesServer } from "@/lib/fillLocation";
import { deriveLocalState, generateLocalGame, type LocalOp, type QueueSnapshot, type SnapshotPlayer } from "@/lib/offlineQueue";
import { nextToSend, type PendingOp } from "@/lib/offlineResults";

describe("fillOnDevice: when the next game is picked on this device", () => {
  const base = { hasSnapshot: true, online: true, outdated: false, matchesServer: true, hasUnsynced: () => false };
  it("online with a fresh copy of the session: instantly on the device, no waiting for the network", async () => {
    const syncNow = vi.fn(async () => {});
    expect(await fillOnDevice({ ...base, snapshotAgeMs: 5_000, syncNow })).toBe(true);
    expect(syncNow).not.toHaveBeenCalled();
  });
  it("an old copy: the server picks (after sending anything waiting)", async () => {
    const syncNow = vi.fn(async () => {});
    expect(await fillOnDevice({ ...base, snapshotAgeMs: FRESH_SNAPSHOT_MS + 1, syncNow })).toBe(false);
    expect(await fillOnDevice({ ...base, snapshotAgeMs: Infinity, syncNow })).toBe(false);
  });
  it("an old copy with a result still waiting: sends it, then the server picks", async () => {
    let waiting = true;
    const syncNow = vi.fn(async () => { waiting = false; });
    expect(await fillOnDevice({ ...base, snapshotAgeMs: Infinity, hasUnsynced: () => waiting, syncNow })).toBe(false);
    expect(syncNow).toHaveBeenCalledOnce();
  });
  it("a recent copy that is behind the server (missing a game it just saved): the server picks", async () => {
    expect(await fillOnDevice({ ...base, matchesServer: false, snapshotAgeMs: 1_000, syncNow: async () => {} })).toBe(false);
  });
  it("this browser runs older queue rules than the server: the server picks", async () => {
    expect(await fillOnDevice({ ...base, outdated: true, snapshotAgeMs: 1_000, syncNow: async () => {} })).toBe(false);
  });
  it("offline: on the device; no copy at all: the server", async () => {
    expect(await fillOnDevice({ ...base, online: false, snapshotAgeMs: Infinity, syncNow: async () => {} })).toBe(true);
    expect(await fillOnDevice({ ...base, hasSnapshot: false, snapshotAgeMs: 0, syncNow: async () => {} })).toBe(false);
  });
});

describe("snapshotMatchesServer", () => {
  const snapshot = {
    activeGames: [{ id: "g1" }],
    players: [
      { id: "a", checkedIn: true, active: true },
      { id: "b", checkedIn: true, active: true },
      { id: "c", checkedIn: false, active: true },
    ],
  };
  it("agrees when the same games run and the same players are available", () => {
    expect(snapshotMatchesServer(snapshot, { activeGameIds: ["g1"], availablePlayerIds: ["b", "a"] })).toBe(true);
  });
  it("a game the server saved a moment ago isn't in the snapshot yet", () => {
    expect(snapshotMatchesServer(snapshot, { activeGameIds: ["g1", "g2"], availablePlayerIds: ["a", "b"] })).toBe(false);
  });
  it("a game has finished on the server", () => {
    expect(snapshotMatchesServer(snapshot, { activeGameIds: [], availablePlayerIds: ["a", "b"] })).toBe(false);
  });
  it("someone checked in or out since", () => {
    expect(snapshotMatchesServer(snapshot, { activeGameIds: ["g1"], availablePlayerIds: ["a", "b", "c"] })).toBe(false);
    expect(snapshotMatchesServer(snapshot, { activeGameIds: ["g1"], availablePlayerIds: ["a"] })).toBe(false);
  });
});

describe("nextToSend: the background sync", () => {
  const op = (id: string, extra: Partial<PendingOp> = {}) =>
    ({ id, kind: "complete", sessionId: "s1", gameId: `g${id}`, winningTeam: "A", recordedAt: "", ...extra }) as unknown as PendingOp;
  it("sends oldest first, skipping sent and failed entries", () => {
    expect(nextToSend([op("1", { synced: true }), op("2", { error: "x" }), op("3"), op("4")], new Set())?.id).toBe("3");
  });
  it("an entry queued during a sync (the auto-filled game) goes out in that same sync", () => {
    const pending = [op("1")];
    const tried = new Set<string>();
    const first = nextToSend(pending, tried)!;
    tried.add(first.id);
    pending.push(op("2")); // queued while the first request was in flight
    expect(nextToSend(pending, tried)?.id).toBe("2");
  });
  it("never tries the same entry twice in one sync (a failed send waits for the next)", () => {
    expect(nextToSend([op("1")], new Set(["1"]))).toBeUndefined();
  });
});

// ── Record a result, then auto-fill: what the device does in that one click ──
const T0 = new Date("2026-01-01T10:00:00Z").getTime();
const iso = (min: number) => new Date(T0 + min * 60000).toISOString();
const player = (i: number): SnapshotPlayer => ({
  id: `p${i}`, name: `P${i}`, checkedIn: true, active: true, gamesPlayed: 0, wins: 0, losses: 0,
  currentStreak: 0, longestWinStreak: 0, consecutiveGames: 0, queueEnteredAt: iso(i), gamesSatOut: 0,
  partnerHistory: {}, opponentHistory: {},
});
const snap = (n: number): QueueSnapshot => ({
  sessionId: "s1", takenAt: iso(0), queueMode: "HYBRID", maxConsecutiveGames: 2, lastGameNumber: 0,
  players: Array.from({ length: n }, (_, i) => player(i + 1)), activeGames: [],
  courts: [{ id: "c1", courtNumber: 1, status: "AVAILABLE" }, { id: "c2", courtNumber: 2, status: "AVAILABLE" }],
  pastGroups: [], keepApart: [],
});
const fill = (n: number, courtId: string, a: string[], b: string[], satOut: string[]): LocalOp => ({
  kind: "fill", id: `f${n}`, sessionId: "s1", courtId, localGameId: `local-${n}`, teamAPlayerIds: a, teamBPlayerIds: b, playersSatOutIds: satOut, createdAt: iso(n),
});

describe("record result → auto-fill (one click, no network)", () => {
  it("frees the court and puts four waiting players on it, never someone still on the other court", () => {
    const s = snap(12);
    const ops: LocalOp[] = [
      fill(1, "c1", ["p1", "p2"], ["p3", "p4"], []),
      fill(2, "c2", ["p5", "p6"], ["p7", "p8"], []),
      { kind: "complete", id: "r1", sessionId: "s1", gameId: "local-1", winningTeam: "A", recordedAt: iso(15) },
    ];
    const state = deriveLocalState(s, ops);
    expect(state.courts.find((c) => c.id === "c1")?.currentGameId).toBeFalsy();
    const next = generateLocalGame(s, state);
    expect(next.ok).toBe(true);
    if (!next.ok) return;
    const picked = [...next.teamA, ...next.teamB];
    expect(new Set(picked).size).toBe(4);
    for (const busy of ["p5", "p6", "p7", "p8"]) expect(picked).not.toContain(busy);
    // Those who haven't played yet go first.
    for (const id of picked) expect(["p9", "p10", "p11", "p12"]).toContain(id);
  });
  it("not enough players waiting: no game (the court just stays open)", () => {
    const s = snap(6);
    const ops: LocalOp[] = [
      fill(1, "c1", ["p1", "p2"], ["p3", "p4"], ["p5", "p6"]),
    ];
    // p5, p6 waiting, c1 busy: only 2 free players
    expect(generateLocalGame(s, deriveLocalState(s, ops)).ok).toBe(false);
  });
});

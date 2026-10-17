import { describe, expect, it } from "vitest";
import { InMemoryCache, gql } from "@apollo/client";
import { placeGameOnCourt, shouldShowDeviceCopy, slowToSync } from "@/lib/courtDisplay";
import { pruneSynced, type PendingOp } from "@/lib/offlineResults";

describe("shouldShowDeviceCopy: no flash of old server data after recording a result", () => {
  it("shows the device copy while an action hasn't reached the server", () => {
    expect(shouldShowDeviceCopy({ hasSnapshot: true, ops: [{ synced: false }] })).toBe(true);
  });
  it("keeps it after the result reached the server, until the refreshed dashboard has landed", () => {
    // The bug: the result was marked synced, the device copy dropped, and the server's stale data
    // put the finished game back on its court ("Saving result… Almost done.").
    expect(shouldShowDeviceCopy({ hasSnapshot: true, ops: [{ synced: true }] })).toBe(true);
  });
  it("switches to the server's data once those entries are cleared", () => {
    expect(shouldShowDeviceCopy({ hasSnapshot: true, ops: [] })).toBe(false);
  });
  it("ignores failed actions and needs a snapshot", () => {
    expect(shouldShowDeviceCopy({ hasSnapshot: true, ops: [{ error: "rejected" }] })).toBe(false);
    expect(shouldShowDeviceCopy({ hasSnapshot: false, ops: [{ synced: false }] })).toBe(false);
  });
});

describe("pruneSynced: what a sync keeps after the dashboard has refreshed", () => {
  const op = (id: string, sessionId: string, extra: Partial<PendingOp> = {}) =>
    ({ id, kind: "complete", sessionId, gameId: `g-${id}`, winningTeam: "A", recordedAt: "", ...extra }) as unknown as PendingOp;
  it("drops synced entries of a session that has nothing left to send", () => {
    expect(pruneSynced([op("1", "s1", { synced: true })])).toEqual([]);
  });
  it("keeps them while that session still has something to send", () => {
    const all = [op("1", "s1", { synced: true }), op("2", "s1")];
    expect(pruneSynced(all).map((p) => p.id)).toEqual(["1", "2"]);
  });
  it("a failed entry doesn't keep synced ones (and the device copy) around for good", () => {
    const all = [op("1", "s1", { synced: true }), op("2", "s1", { error: "rejected" })];
    expect(pruneSynced(all).map((p) => p.id)).toEqual(["2"]);
  });
  it("sessions are independent", () => {
    const all = [op("1", "s1", { synced: true }), op("2", "s2")];
    expect(pruneSynced(all).map((p) => p.id)).toEqual(["2"]);
  });
});

const QUERY = gql`
  query Dash($id: ID!) {
    session(id: $id) {
      id
      courts { id status currentGame { id teamA { players { id name } } teamB { players { id name } } } }
      queuedPlayers { id name }
      nextGamePreview { teamA { players { id name } } teamB { players { id name } } }
      activeGames { id teamA { players { id name } } teamB { players { id name } } }
    }
  }
`;
const p = (id: string) => ({ __typename: "SessionPlayer", id, name: id.toUpperCase() });
const team = (...ids: string[]) => ({ __typename: "Team", players: ids.map(p) });

function seeded() {
  const cache = new InMemoryCache();
  cache.writeQuery({
    query: QUERY,
    variables: { id: "s1" },
    data: {
      session: {
        __typename: "Session", id: "s1",
        courts: [
          { __typename: "Court", id: "c1", status: "AVAILABLE", currentGame: null },
          { __typename: "Court", id: "c2", status: "AVAILABLE", currentGame: null },
        ],
        queuedPlayers: ["a", "b", "c", "d", "e", "f"].map(p),
        nextGamePreview: { __typename: "NextGamePreview", teamA: team("a", "b"), teamB: team("c", "d") },
        activeGames: [],
      },
    },
  });
  return cache;
}
const game = { __typename: "Game", id: "g1", teamA: team("a", "d"), teamB: team("b", "c") };

describe("placeGameOnCourt: the court shows the line-up as soon as it's announced", () => {
  it("puts the game on its court, takes the four out of the queue and clears the stale preview", () => {
    const cache = seeded();
    // What Apollo does with the mutation's answer before calling update()
    cache.writeFragment({ id: "Game:g1", fragment: gql`fragment G on Game { id teamA { players { id name } } teamB { players { id name } } }`, data: game });
    placeGameOnCourt(cache, "s1", "c1", game);
    const s = cache.readQuery<any>({ query: QUERY, variables: { id: "s1" } })!.session;
    expect(s.courts[0].status).toBe("IN_USE");
    expect(s.courts[0].currentGame.id).toBe("g1");
    expect(s.courts[0].currentGame.teamA.players.map((x: any) => x.id)).toEqual(["a", "d"]);
    expect(s.courts[1].currentGame).toBeNull();
    expect(s.queuedPlayers.map((x: any) => x.id)).toEqual(["e", "f"]);
    expect(s.nextGamePreview).toBeNull();
    expect(s.activeGames.map((g: any) => g.id)).toEqual(["g1"]);
  });
  it("does nothing without a game, and never duplicates an active game", () => {
    const cache = seeded();
    placeGameOnCourt(cache, "s1", "c1", null);
    expect(cache.readQuery<any>({ query: QUERY, variables: { id: "s1" } })!.session.courts[0].currentGame).toBeNull();
    cache.writeFragment({ id: "Game:g1", fragment: gql`fragment G on Game { id teamA { players { id name } } teamB { players { id name } } }`, data: game });
    placeGameOnCourt(cache, "s1", "c1", game);
    placeGameOnCourt(cache, "s1", "c1", game);
    expect(cache.readQuery<any>({ query: QUERY, variables: { id: "s1" } })!.session.activeGames).toHaveLength(1);
  });
});

describe("slowToSync: the 'Syncing…' banner only for a slow sync", () => {
  const at = (ms: number) => new Date(ms).toISOString();
  it("ignores actions sent a moment ago, sent ones and failed ones", () => {
    const now = 100_000;
    expect(slowToSync([{ kind: "complete", recordedAt: at(now - 1_000) }], now)).toBe(0);
    expect(slowToSync([{ kind: "fill", createdAt: at(now - 60_000), synced: true }], now)).toBe(0);
    expect(slowToSync([{ kind: "fill", createdAt: at(now - 60_000), error: "x" }], now)).toBe(0);
  });
  it("counts ones still waiting after a few seconds", () => {
    const now = 100_000;
    expect(slowToSync([{ kind: "complete", recordedAt: at(now - 6_000) }, { kind: "fill", createdAt: at(now - 9_000) }], now)).toBe(2);
  });
});

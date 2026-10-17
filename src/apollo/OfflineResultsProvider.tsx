"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useApolloClient } from "@apollo/client";
import { COMPLETE_GAME, SYNC_OFFLINE_GAME } from "@/graphql/documents/organiser";
import {
  PENDING_CHANGED_EVENT,
  isNetworkFailure,
  loadIdMap,
  loadPending,
  newPendingId,
  pruneSynced,
  saveIdMap,
  savePending,
  type PendingOp,
} from "@/lib/offlineResults";
import { isLocalGameId, newLocalGameId } from "@/lib/offlineQueue";

interface OfflineResultsValue {
  pending: PendingOp[];
  online: boolean;
  syncing: boolean;
  /** Records a result instantly: queues it locally and sends it in the background.
   * `gameId` may be the temporary id of a game that was generated offline. */
  recordResult: (input: { sessionId: string; gameId: string; winningTeam: "A" | "B"; notes?: string }) => void;
  /** Queues a game generated on this device. Returns its temporary id. */
  fillCourt: (input: {
    sessionId: string;
    courtId: string;
    teamAPlayerIds: string[];
    teamBPlayerIds: string[];
    playersSatOutIds: string[];
    /** How the line-up was chosen: "AUTO" (the queue) or "TOP_FOUR". */
    source?: string;
  }) => string;
  /** Sends everything waiting right now and resolves once the server has it (or the
   * connection fails). Lets a court fill wait for a just-recorded result to land, so the
   * server can pick the next game instead of this device. */
  syncNow: () => Promise<void>;
  /** Re-send an entry the server rejected. */
  retry: (id: string) => void;
  /** Drop a queued entry for good (and any results that depend on a dropped game). */
  discard: (id: string) => void;
}

const Ctx = createContext<OfflineResultsValue | null>(null);

const RETRY_INTERVAL_MS = 15_000;

export function OfflineResultsProvider({ children }: { children: ReactNode }) {
  const client = useApolloClient();
  const [pending, setPending] = useState<PendingOp[]>([]);
  const [online, setOnline] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const flushing = useRef(false);

  // Load what's already queued (e.g. from before a refresh) and track changes.
  useEffect(() => {
    const sync = () => setPending(loadPending());
    sync();
    setOnline(navigator.onLine);
    window.addEventListener(PENDING_CHANGED_EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(PENDING_CHANGED_EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  const runFlush = useCallback(async () => {
    if (flushing.current) return;
    flushing.current = true;
    setSyncing(true);
    let sentAny = false;
    const update = (id: string, patch: Partial<PendingOp>) =>
      savePending(loadPending().map((p) => (p.id === id ? ({ ...p, ...patch } as PendingOp) : p)));
    try {
      // Oldest first, one at a time: a game is created before its result, and results land
      // in the order they were recorded.
      for (const entry of loadPending()) {
        if (entry.error || entry.synced) continue;
        try {
          if (entry.kind === "fill") {
            const res = await client.mutate({
              mutation: SYNC_OFFLINE_GAME,
              variables: {
                sessionId: entry.sessionId,
                courtId: entry.courtId,
                clientGameId: entry.localGameId,
                teamAPlayerIds: entry.teamAPlayerIds,
                teamBPlayerIds: entry.teamBPlayerIds,
                playersSatOutIds: entry.playersSatOutIds,
                createdAt: entry.createdAt,
                source: entry.source ?? null,
              },
            });
            const real = res.data?.syncOfflineGame?.id;
            if (real) saveIdMap({ ...loadIdMap(), [entry.localGameId]: real });
          } else {
            const realId = isLocalGameId(entry.gameId) ? loadIdMap()[entry.gameId] : entry.gameId;
            if (!realId) {
              update(entry.id, { error: "The game this result belongs to was not saved." });
              continue;
            }
            await client.mutate({
              mutation: COMPLETE_GAME,
              variables: {
                id: realId,
                input: { winningTeam: entry.winningTeam, notes: entry.notes, recordedAt: entry.recordedAt },
              },
            });
          }
          update(entry.id, { synced: true });
          sentAny = true;
        } catch (err) {
          if (isNetworkFailure(err)) break; // still offline: stop, keep everything queued
          const message = err instanceof Error ? err.message : "Could not save";
          update(entry.id, { error: message });
          // Results for a game that never got saved can't be sent either.
          if (entry.kind === "fill") {
            savePending(
              loadPending().map((p) =>
                p.kind === "complete" && p.gameId === entry.localGameId && !p.synced
                  ? { ...p, error: "The game this result belongs to was not saved." }
                  : p
              )
            );
          }
        }
      }

      // Show the server's fresh state BEFORE dropping the on-device replay. Clearing first
      // would flash the old server data (the finished game back on its court) until the
      // refetch lands.
      // Also when an earlier sync sent everything but couldn't refresh (the connection dropped
      // right after): until the screen has the server's new state, the device copy stays.
      if (sentAny || loadPending().some((p) => p.synced)) {
        try {
          await client.refetchQueries({ include: ["SessionDashboard"] });
        } catch {
          /* offline again: keep the replay, try on the next flush */
          return;
        }
      }

      // A session whose every entry has reached the server no longer needs the replay:
      // clear it so the next snapshot is the plain server state.
      const all = loadPending();
      const keep = pruneSynced(all);
      if (keep.length !== all.length) {
        savePending(keep);
        const mapped = loadIdMap();
        const liveLocal = new Set(keep.flatMap((p) => (p.kind === "fill" ? [p.localGameId] : isLocalGameId(p.gameId) ? [p.gameId] : [])));
        saveIdMap(Object.fromEntries(Object.entries(mapped).filter(([k]) => liveLocal.has(k))));
      }
    } finally {
      flushing.current = false;
      setSyncing(false);
      // Refresh everything else (and take a new queue snapshot now that nothing is pending).
      if (sentAny) void client.refetchQueries({ include: "active" });
    }
  }, [client]);

  // One flush at a time; callers that arrive mid-flush wait for the same one.
  const flushPromise = useRef<Promise<void> | null>(null);
  const flush = useCallback((): Promise<void> => {
    if (flushPromise.current) return flushPromise.current;
    const run = runFlush().finally(() => {
      flushPromise.current = null;
    });
    flushPromise.current = run;
    return run;
  }, [runFlush]);

  const syncNow = useCallback(async () => {
    await flush();
    // Anything queued while that flush was running goes too.
    if (loadPending().some((p) => !p.error && !p.synced)) await flush();
  }, [flush]);

  // Sync when the connection returns, on a timer while anything is waiting, and on load.
  useEffect(() => {
    const goOnline = () => {
      setOnline(true);
      void flush();
    };
    const goOffline = () => setOnline(false);
    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);
    void flush();
    const timer = window.setInterval(() => {
      // Retry anything unsent, and finish a sync whose refresh didn't get through.
      if (loadPending().some((p) => (!p.error && !p.synced) || p.synced)) void flush();
    }, RETRY_INTERVAL_MS);
    return () => {
      window.removeEventListener("online", goOnline);
      window.removeEventListener("offline", goOffline);
      window.clearInterval(timer);
    };
  }, [flush]);

  const recordResult = useCallback<OfflineResultsValue["recordResult"]>(
    (input) => {
      const current = loadPending();
      if (current.some((p) => p.kind === "complete" && p.gameId === input.gameId)) return; // already queued for this game
      savePending([
        ...current,
        { kind: "complete", id: newPendingId(), recordedAt: new Date().toISOString(), ...input },
      ]);
      void flush();
    },
    [flush]
  );

  const fillCourt = useCallback<OfflineResultsValue["fillCourt"]>(
    (input) => {
      const localGameId = newLocalGameId();
      savePending([
        ...loadPending(),
        { kind: "fill", id: newPendingId(), localGameId, createdAt: new Date().toISOString(), ...input },
      ]);
      void flush();
      return localGameId;
    },
    [flush]
  );

  const retry = useCallback(
    (id: string) => {
      savePending(
        loadPending().map((p) => {
          if (p.id === id) return { ...p, error: undefined };
          return p;
        })
      );
      // A retried game lets its waiting results try again too.
      const target = loadPending().find((p) => p.id === id);
      if (target?.kind === "fill") {
        savePending(
          loadPending().map((p) =>
            p.kind === "complete" && p.gameId === target.localGameId ? { ...p, error: undefined } : p
          )
        );
      }
      void flush();
    },
    [flush]
  );

  const discard = useCallback((id: string) => {
    const all = loadPending();
    const target = all.find((p) => p.id === id);
    const dropLocal = target?.kind === "fill" ? target.localGameId : null;
    savePending(
      all.filter((p) => p.id !== id && !(dropLocal && p.kind === "complete" && p.gameId === dropLocal))
    );
  }, []);

  const value = useMemo(
    () => ({ pending, online, syncing, recordResult, fillCourt, syncNow, retry, discard }),
    [pending, online, syncing, recordResult, fillCourt, syncNow, retry, discard]
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useOfflineResults(): OfflineResultsValue {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useOfflineResults must be used inside OfflineResultsProvider");
  return ctx;
}

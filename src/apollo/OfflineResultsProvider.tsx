"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useApolloClient } from "@apollo/client";
import { COMPLETE_GAME, SYNC_OFFLINE_GAME } from "@/graphql/documents/organiser";
import { syncPending } from "@/lib/offlineSync";
import {
  PENDING_CHANGED_EVENT,
  isNetworkFailure,
  loadIdMap,
  loadPending,
  newPendingId,
  saveIdMap,
  savePending,
  type PendingOp,
} from "@/lib/offlineResults";
import { newLocalGameId } from "@/lib/offlineQueue";

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
  /** Whether this entry's request may be on its way to the server right now (then wait for
   * syncNow before deciding it wasn't sent). */
  isSending: (id: string) => boolean;
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
  /** Id of the entry whose request is on its way to the server right now. */
  const sendingId = useRef<string | null>(null);

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
    try {
      const outcome = await syncPending({
        load: loadPending,
        save: savePending,
        loadIdMap,
        saveIdMap,
        isNetworkFailure,
        onSending: (id) => {
          sendingId.current = id;
        },
        sendFill: async (entry) => {
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
              createdOffline: entry.madeOffline ?? null,
            },
          });
          return res.data?.syncOfflineGame?.id;
        },
        sendResult: async (entry, serverGameId) => {
          await client.mutate({
            mutation: COMPLETE_GAME,
            variables: {
              id: serverGameId,
              input: { winningTeam: entry.winningTeam, notes: entry.notes, recordedAt: entry.recordedAt },
            },
          });
        },
        refresh: async () => {
          await client.refetchQueries({ include: ["SessionDashboard"] });
        },
      });
      sentAny = outcome.sentAny;
    } finally {
      sendingId.current = null;
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
        {
          kind: "fill",
          id: newPendingId(),
          localGameId,
          createdAt: new Date().toISOString(),
          // Made on this device either way (local-first); only flagged "offline" when it really was.
          madeOffline: typeof navigator !== "undefined" && !navigator.onLine,
          ...input,
        },
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
      void syncNow(); // after any sync already running (it may have skipped this entry)
    },
    [syncNow]
  );

  const discard = useCallback((id: string) => {
    const all = loadPending();
    const target = all.find((p) => p.id === id);
    const dropLocal = target?.kind === "fill" ? target.localGameId : null;
    savePending(
      all.filter((p) => p.id !== id && !(dropLocal && p.kind === "complete" && p.gameId === dropLocal))
    );
  }, []);

  const isSending = useCallback((id: string) => sendingId.current === id, []);
  const value = useMemo(
    () => ({ pending, online, syncing, recordResult, fillCourt, syncNow, isSending, retry, discard }),
    [pending, online, syncing, recordResult, fillCourt, syncNow, isSending, retry, discard]
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useOfflineResults(): OfflineResultsValue {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useOfflineResults must be used inside OfflineResultsProvider");
  return ctx;
}

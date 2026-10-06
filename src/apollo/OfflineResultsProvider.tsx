"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useApolloClient } from "@apollo/client";
import { COMPLETE_GAME } from "@/graphql/documents/organiser";
import {
  PENDING_CHANGED_EVENT,
  isNetworkFailure,
  loadPending,
  newPendingId,
  savePending,
  type PendingResult,
} from "@/lib/offlineResults";

interface OfflineResultsValue {
  pending: PendingResult[];
  online: boolean;
  syncing: boolean;
  /** Records a result instantly: queues it locally and sends it in the background. */
  recordResult: (input: { sessionId: string; gameId: string; winningTeam: "A" | "B"; notes?: string }) => void;
  /** Re-send an entry the server rejected. */
  retry: (id: string) => void;
  /** Drop a queued entry for good. */
  discard: (id: string) => void;
}

const Ctx = createContext<OfflineResultsValue | null>(null);

const RETRY_INTERVAL_MS = 15_000;

export function OfflineResultsProvider({ children }: { children: ReactNode }) {
  const client = useApolloClient();
  const [pending, setPending] = useState<PendingResult[]>([]);
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

  const flush = useCallback(async () => {
    if (flushing.current) return;
    flushing.current = true;
    setSyncing(true);
    let sentAny = false;
    try {
      // Oldest first, one at a time, so results land in the order they were recorded.
      for (const entry of loadPending()) {
        if (entry.error) continue;
        try {
          await client.mutate({
            mutation: COMPLETE_GAME,
            variables: {
              id: entry.gameId,
              input: { winningTeam: entry.winningTeam, notes: entry.notes, recordedAt: entry.recordedAt },
            },
          });
          savePending(loadPending().filter((p) => p.id !== entry.id));
          sentAny = true;
        } catch (err) {
          if (isNetworkFailure(err)) break; // still offline: stop, keep everything queued
          const message = err instanceof Error ? err.message : "Could not save result";
          savePending(loadPending().map((p) => (p.id === entry.id ? { ...p, error: message } : p)));
        }
      }
    } finally {
      flushing.current = false;
      setSyncing(false);
      if (sentAny) void client.refetchQueries({ include: "active" });
    }
  }, [client]);

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
      if (loadPending().some((p) => !p.error)) void flush();
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
      if (current.some((p) => p.gameId === input.gameId)) return; // already queued for this game
      savePending([...current, { id: newPendingId(), recordedAt: new Date().toISOString(), ...input }]);
      void flush();
    },
    [flush]
  );

  const retry = useCallback(
    (id: string) => {
      savePending(loadPending().map((p) => (p.id === id ? { ...p, error: undefined } : p)));
      void flush();
    },
    [flush]
  );

  const discard = useCallback((id: string) => {
    savePending(loadPending().filter((p) => p.id !== id));
  }, []);

  const value = useMemo(
    () => ({ pending, online, syncing, recordResult, retry, discard }),
    [pending, online, syncing, recordResult, retry, discard]
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useOfflineResults(): OfflineResultsValue {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useOfflineResults must be used inside OfflineResultsProvider");
  return ctx;
}

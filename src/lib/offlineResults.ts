/**
 * Offline-safe storage for match results that have been recorded but not yet saved to the
 * server. Results sit in localStorage so they survive a refresh or a dropped connection,
 * and are sent in order once the server is reachable again. Browser-only; every storage
 * call is wrapped because localStorage can be blocked or full.
 */

import type { LocalOp, QueueSnapshot } from "@/lib/offlineQueue";

export type PendingOp = LocalOp & {
  /** Already accepted by the server. Kept (until the whole session catches up) so the
   * on-device replay stays consistent with the snapshot it started from. */
  synced?: boolean;
};

/** Kept for readability at call sites that only care about results. */
export type PendingResult = PendingOp;

const KEY = "nextq.pendingResults.v1";
const ID_MAP_KEY = "nextq.localGameIds.v1";
const SNAPSHOT_KEY = "nextq.queueSnapshot.v1.";
export const PENDING_CHANGED_EVENT = "nextq-pending-results-changed";

export function loadPending(): PendingOp[] {
  try {
    const raw = window.localStorage.getItem(KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(parsed)) return [];
    // Entries saved before offline game generation existed had no `kind`: they were results.
    return parsed.map((p) => (p.kind ? p : { ...p, kind: "complete" }));
  } catch {
    return [];
  }
}

export function savePending(list: PendingOp[]): void {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(list));
  } catch {
    /* storage unavailable: results still sync this session from memory */
  }
  window.dispatchEvent(new Event(PENDING_CHANGED_EVENT));
}

export function newPendingId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

/** local game id -> real id, filled in as offline games reach the server. */
export function loadIdMap(): Record<string, string> {
  try {
    const raw = window.localStorage.getItem(ID_MAP_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

export function saveIdMap(map: Record<string, string>): void {
  try {
    window.localStorage.setItem(ID_MAP_KEY, JSON.stringify(map));
  } catch {
    /* ignore */
  }
}

export function loadSnapshot(sessionId: string): QueueSnapshot | null {
  try {
    const raw = window.localStorage.getItem(SNAPSHOT_KEY + sessionId);
    return raw ? (JSON.parse(raw) as QueueSnapshot) : null;
  } catch {
    return null;
  }
}

export function saveSnapshot(snapshot: QueueSnapshot): void {
  try {
    window.localStorage.setItem(SNAPSHOT_KEY + snapshot.sessionId, JSON.stringify(snapshot));
  } catch {
    /* ignore */
  }
}

/** True when a failed request never reached the server (offline, timeout, DNS), as opposed
 * to the server answering with an error. Only these are worth retrying automatically. */
export function isNetworkFailure(err: unknown): boolean {
  const e = err as { networkError?: { statusCode?: number } | null; message?: string; name?: string };
  if (e?.networkError) {
    const status = e.networkError.statusCode;
    return status === undefined || status >= 500 || status === 408 || status === 429;
  }
  return e instanceof TypeError || /failed to fetch|network|load failed/i.test(e?.message ?? "");
}

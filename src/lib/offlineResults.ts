/**
 * Offline-safe storage for match results that have been recorded but not yet saved to the
 * server. Results sit in localStorage so they survive a refresh or a dropped connection,
 * and are sent in order once the server is reachable again. Browser-only; every storage
 * call is wrapped because localStorage can be blocked or full.
 */

export interface PendingResult {
  /** Client-generated id for this queued entry. */
  id: string;
  sessionId: string;
  gameId: string;
  winningTeam: "A" | "B";
  notes?: string;
  /** When the organiser actually recorded it - sent along so wait times stay accurate. */
  recordedAt: string;
  /** Set when the server rejected it (not a network problem); needs the organiser's attention. */
  error?: string;
}

const KEY = "nextq.pendingResults.v1";
export const PENDING_CHANGED_EVENT = "nextq-pending-results-changed";

export function loadPending(): PendingResult[] {
  try {
    const raw = window.localStorage.getItem(KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function savePending(list: PendingResult[]): void {
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

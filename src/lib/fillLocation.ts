/**
 * Decides whether a court fill must happen on this device (offline replay) or can go to the
 * server. Pure apart from the callbacks, so it can be unit tested.
 *
 * The server should pick whenever it can: it always has the latest players, check-ins, edits
 * and rules. The device only picks when the server can't — no connection, or actions that
 * still haven't reached it after trying to send them.
 */
export async function shouldFillOnDevice(opts: {
  hasSnapshot: boolean;
  online: boolean;
  /** Are there actions for this session the server doesn't have yet (failed ones excluded)? */
  hasUnsynced: () => boolean;
  /** Send everything waiting now; resolves when done or when the connection fails. */
  syncNow: () => Promise<void>;
}): Promise<boolean> {
  if (!opts.hasSnapshot) return false; // can't pick offline without a snapshot: try the server
  if (!opts.online) return true;
  if (!opts.hasUnsynced()) return false;
  // Typically a result recorded a moment ago: send it first, then let the server pick.
  try {
    await opts.syncNow();
  } catch {
    /* treat like a failed send: whatever is still waiting decides below */
  }
  return opts.hasUnsynced();
}

/** A queue snapshot younger than this is trusted for an instant fill on this device. The
 * dashboard refreshes it on every reload (at least every 20 s while the page is open). */
export const FRESH_SNAPSHOT_MS = 60_000;

/**
 * Local-first fill: pick the next game on this device (instant, like recording a result) and
 * let the server check it in the background, whenever the device's copy of the session can be
 * trusted. Falls back to `shouldFillOnDevice` (server picks) when this browser runs older queue
 * rules than the server, or its copy is old and nothing is waiting to sync.
 */
export async function fillOnDevice(opts: {
  hasSnapshot: boolean;
  online: boolean;
  /** This browser's queue rules differ from the server's. */
  outdated: boolean;
  /** How long ago this device received its current snapshot (Infinity if never this visit). */
  snapshotAgeMs: number;
  hasUnsynced: () => boolean;
  syncNow: () => Promise<void>;
}): Promise<boolean> {
  if (!opts.hasSnapshot) return false;
  if (!opts.online) return true;
  if (!opts.outdated && opts.snapshotAgeMs <= FRESH_SNAPSHOT_MS) return true;
  return shouldFillOnDevice(opts);
}

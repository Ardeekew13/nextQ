/**
 * The background sync of results and games recorded on this device: sends each waiting entry to
 * the server in order, survives a dropped or flaky connection, and clears what the server has
 * once the screen has the server's fresh state. Pure apart from the injected dependencies, so it
 * can be tested against a fake server with an unreliable network (tests/intermittent.test.ts).
 */
import { isLocalGameId, type CompleteOp, type FillOp } from "@/lib/offlineQueue";
import { nextToSend, pruneSynced, type PendingOp } from "@/lib/offlineResults";

/** Local→server game ids kept after syncing, newest last (so "Undo" can still find them). */
export const RECENT_IDS_KEPT = 20;

export interface SyncDeps {
  load: () => PendingOp[];
  save: (list: PendingOp[]) => void;
  loadIdMap: () => Record<string, string>;
  saveIdMap: (map: Record<string, string>) => void;
  /** Saves a game made on this device; resolves to the server's id for it. */
  sendFill: (entry: FillOp) => Promise<string | undefined>;
  /** Saves a result against the server's id of its game. */
  sendResult: (entry: CompleteOp, serverGameId: string) => Promise<void>;
  /** Reloads the server's state for the screen (the dashboard). */
  refresh: () => Promise<void>;
  isNetworkFailure: (err: unknown) => boolean;
  /** Told which entry is on its way to the server (null when none). */
  onSending?: (id: string | null) => void;
}

export interface SyncOutcome {
  /** At least one entry reached the server. */
  sentAny: boolean;
  /** Stopped early because the connection failed (everything unsent stays queued). */
  interrupted: boolean;
}

export async function syncPending(deps: SyncDeps): Promise<SyncOutcome> {
  let sentAny = false;
  let interrupted = false;
  const update = (id: string, patch: Partial<PendingOp>) =>
    deps.save(deps.load().map((p) => (p.id === id ? ({ ...p, ...patch } as PendingOp) : p)));
  try {
    // Oldest first, one at a time: a game is created before its result, and results land in
    // the order they were recorded. Re-read after each send so anything queued meanwhile
    // (e.g. the auto-filled game right after its court's result) goes in this same sync.
    const tried = new Set<string>();
    for (;;) {
      const entry = nextToSend(deps.load(), tried);
      if (!entry) break;
      tried.add(entry.id);
      deps.onSending?.(entry.id);
      try {
        if (entry.kind === "fill") {
          const real = await deps.sendFill(entry);
          if (real) deps.saveIdMap({ ...deps.loadIdMap(), [entry.localGameId]: real });
        } else {
          const realId = isLocalGameId(entry.gameId) ? deps.loadIdMap()[entry.gameId] : entry.gameId;
          if (!realId) {
            update(entry.id, { error: "The game this result belongs to was not saved." });
            continue;
          }
          await deps.sendResult(entry, realId);
        }
        update(entry.id, { synced: true });
        sentAny = true;
      } catch (err) {
        if (deps.isNetworkFailure(err)) {
          interrupted = true;
          break; // still offline: stop, keep everything queued
        }
        const message = err instanceof Error ? err.message : "Could not save";
        update(entry.id, { error: message });
        // Results for a game that never got saved can't be sent either.
        if (entry.kind === "fill") {
          deps.save(
            deps.load().map((p) =>
              p.kind === "complete" && p.gameId === entry.localGameId && !p.synced
                ? { ...p, error: "The game this result belongs to was not saved." }
                : p
            )
          );
        }
      }
    }
  } finally {
    deps.onSending?.(null);
  }

  // Show the server's fresh state BEFORE dropping the on-device replay: clearing first would
  // flash the old server data (the finished game back on its court) until the refetch lands.
  // Also when an earlier sync sent everything but couldn't refresh (the connection dropped
  // right after): until the screen has the server's new state, the device copy stays.
  if (sentAny || deps.load().some((p) => p.synced)) {
    try {
      await deps.refresh();
    } catch {
      return { sentAny, interrupted: true }; // offline again: keep the replay for the next sync
    }
  }

  // A session whose every entry has reached the server no longer needs the replay.
  const all = deps.load();
  const keep = pruneSynced(all);
  if (keep.length !== all.length) {
    deps.save(keep);
    const liveLocal = new Set(
      keep.flatMap((p) => (p.kind === "fill" ? [p.localGameId] : isLocalGameId(p.gameId) ? [p.gameId] : []))
    );
    const entries = Object.entries(deps.loadIdMap());
    const recent = new Set(entries.slice(-RECENT_IDS_KEPT).map(([k]) => k));
    deps.saveIdMap(Object.fromEntries(entries.filter(([k]) => liveLocal.has(k) || recent.has(k))));
  }
  return { sentAny, interrupted };
}

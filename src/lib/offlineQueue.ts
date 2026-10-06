/**
 * Offline match generation. Pure (no DB, no React) so it can run in the browser and be
 * unit tested.
 *
 * The browser keeps a snapshot of the session's queue state (taken while online) plus an
 * ordered list of operations the organiser did since: "fill a court" and "record a result".
 * `deriveLocalState` replays those operations on the snapshot with exactly the same rules the
 * server applies, so the courts, queue and next-game preview stay correct with no connection,
 * and `generateLocalGame` picks the next four with the same queue engine the server uses.
 */

import { QueueMode } from "@/types/enums";
import { generateNextGame, rankQueue, type QueuePlayer } from "@/lib/queueEngine";
import { poolSeed, seededRandom } from "@/lib/seededRandom";

export interface SnapshotPlayer {
  id: string;
  name: string;
  checkedIn: boolean;
  active: boolean;
  gamesPlayed: number;
  wins: number;
  losses: number;
  currentStreak: number;
  longestWinStreak: number;
  consecutiveGames: number;
  /** ISO timestamp. */
  queueEnteredAt: string;
  gamesSatOut: number;
  partnerHistory: Record<string, number>;
  opponentHistory: Record<string, number>;
  fixedPartnerId?: string | null;
}

export interface SnapshotGame {
  id: string;
  courtId: string;
  gameNumber: number;
  teamA: string[];
  teamB: string[];
  satOut: string[];
  status: string;
  startedAt?: string | null;
}

export interface SnapshotCourt {
  id: string;
  courtNumber: number;
  name?: string | null;
  status: string;
}

export interface QueueSnapshot {
  sessionId: string;
  takenAt: string;
  queueMode: string;
  maxConsecutiveGames: number;
  lastGameNumber: number;
  players: SnapshotPlayer[];
  activeGames: SnapshotGame[];
  courts: SnapshotCourt[];
  /** Sorted player ids joined by ":" for every earlier game. */
  pastGroups: string[];
  keepApart: string[][];
}

export interface FillOp {
  kind: "fill";
  id: string;
  sessionId: string;
  courtId: string;
  /** Temporary id ("local-…") until the server creates the real game. */
  localGameId: string;
  teamAPlayerIds: string[];
  teamBPlayerIds: string[];
  playersSatOutIds: string[];
  createdAt: string;
  error?: string;
}

export interface CompleteOp {
  kind: "complete";
  id: string;
  sessionId: string;
  /** Real id, or the localGameId of a fill op that hasn't reached the server yet. */
  gameId: string;
  winningTeam: "A" | "B";
  notes?: string;
  recordedAt: string;
  error?: string;
}

export type LocalOp = FillOp | CompleteOp;

export interface LocalState {
  players: SnapshotPlayer[];
  activeGames: SnapshotGame[];
  courts: Array<SnapshotCourt & { currentGameId: string | null }>;
  lastGameNumber: number;
  pastGroups: Set<string>;
  /** Players free to be picked, longest-waiting first. */
  eligible: SnapshotPlayer[];
}

export const LOCAL_GAME_PREFIX = "local-";
export const isLocalGameId = (id: string) => id.startsWith(LOCAL_GAME_PREFIX);

function bump(map: Record<string, number>, key: string) {
  map[key] = (map[key] ?? 0) + 1;
}

function groupKey(ids: string[]) {
  return [...ids].sort().join(":");
}

function clonePlayer(p: SnapshotPlayer): SnapshotPlayer {
  return { ...p, partnerHistory: { ...p.partnerHistory }, opponentHistory: { ...p.opponentHistory } };
}

function applyResult(
  byId: Map<string, SnapshotPlayer>,
  game: SnapshotGame,
  winningTeam: "A" | "B",
  recordedAt: string
) {
  const applyTeam = (team: string[], opponents: string[], won: boolean) => {
    for (const id of team) {
      const p = byId.get(id);
      if (!p) continue;
      p.gamesPlayed += 1;
      if (won) {
        p.wins += 1;
        p.currentStreak = p.currentStreak >= 0 ? p.currentStreak + 1 : 1;
        p.longestWinStreak = Math.max(p.longestWinStreak, p.currentStreak);
      } else {
        p.losses += 1;
        p.currentStreak = p.currentStreak <= 0 ? p.currentStreak - 1 : -1;
      }
      for (const mate of team) if (mate !== id) bump(p.partnerHistory, mate);
      for (const opp of opponents) bump(p.opponentHistory, opp);
      p.queueEnteredAt = recordedAt;
      p.consecutiveGames = 0;
    }
  };
  applyTeam(game.teamA, game.teamB, winningTeam === "A");
  applyTeam(game.teamB, game.teamA, winningTeam === "B");
  for (const id of game.satOut) {
    const p = byId.get(id);
    if (p) p.gamesSatOut += 1;
  }
}

/** Replays `ops` (oldest first, any session) on top of `snapshot`. */
export function deriveLocalState(snapshot: QueueSnapshot, ops: LocalOp[]): LocalState {
  const byId = new Map(snapshot.players.map((p) => [p.id, clonePlayer(p)]));
  let activeGames = snapshot.activeGames.map((g) => ({ ...g }));
  const pastGroups = new Set(snapshot.pastGroups);
  let lastGameNumber = snapshot.lastGameNumber;

  for (const op of ops) {
    if (op.sessionId !== snapshot.sessionId) continue;
    if (op.kind === "fill") {
      const selected = new Set([...op.teamAPlayerIds, ...op.teamBPlayerIds]);
      for (const id of selected) {
        const p = byId.get(id);
        if (p) p.consecutiveGames += 1;
      }
      for (const id of op.playersSatOutIds) {
        const p = byId.get(id);
        if (p) p.consecutiveGames = 0;
      }
      lastGameNumber += 1;
      activeGames.push({
        id: op.localGameId,
        courtId: op.courtId,
        gameNumber: lastGameNumber,
        teamA: op.teamAPlayerIds,
        teamB: op.teamBPlayerIds,
        satOut: op.playersSatOutIds,
        status: "QUEUED",
        startedAt: null,
      });
      pastGroups.add(groupKey([...selected]));
    } else {
      const game = activeGames.find((g) => g.id === op.gameId);
      if (!game) continue; // already finished on the server, or discarded
      activeGames = activeGames.filter((g) => g.id !== op.gameId);
      applyResult(byId, game, op.winningTeam, op.recordedAt);
    }
  }

  const busy = new Set(activeGames.flatMap((g) => [...g.teamA, ...g.teamB]));
  const players = [...byId.values()];
  const eligible = players
    .filter((p) => p.checkedIn && p.active && !busy.has(p.id))
    .sort((a, b) => new Date(a.queueEnteredAt).getTime() - new Date(b.queueEnteredAt).getTime());

  const courts = snapshot.courts.map((c) => {
    const current = activeGames.find((g) => g.courtId === c.id) ?? null;
    const status = current ? "IN_USE" : c.status === "IN_USE" ? "AVAILABLE" : c.status;
    return { ...c, status, currentGameId: current?.id ?? null };
  });

  return { players, activeGames, courts, lastGameNumber, pastGroups, eligible };
}

function toQueuePlayer(p: SnapshotPlayer): QueuePlayer {
  return {
    id: p.id,
    gamesPlayed: p.gamesPlayed,
    consecutiveGames: p.consecutiveGames,
    queueEnteredAt: new Date(p.queueEnteredAt),
    gamesSatOut: p.gamesSatOut,
    partnerHistory: p.partnerHistory,
    opponentHistory: p.opponentHistory,
    winRate: p.gamesPlayed > 0 ? (p.wins / p.gamesPlayed) * 100 : 0,
    fixedPartnerId: p.fixedPartnerId ?? undefined,
  };
}

function engineOptions(snapshot: QueueSnapshot, state: LocalState) {
  return {
    mode: (snapshot.queueMode ?? QueueMode.HYBRID) as QueueMode,
    maxConsecutiveGames: snapshot.maxConsecutiveGames ?? 2,
    pastGroups: state.pastGroups,
    keepApart: snapshot.keepApart,
    random: seededRandom(poolSeed(state.eligible.map((p) => p.id))),
  };
}

/** Waiting players in the order they'd be picked — same scoring as the server preview. */
export function rankLocalQueue(snapshot: QueueSnapshot, state: LocalState): SnapshotPlayer[] {
  if (state.eligible.length === 0) return [];
  const byId = new Map(state.eligible.map((p) => [p.id, p]));
  return rankQueue(state.eligible.map(toQueuePlayer), engineOptions(snapshot, state))
    .map((p) => byId.get(p.id))
    .filter((p): p is SnapshotPlayer => Boolean(p));
}

export type LocalGenerateResult =
  | { ok: true; teamA: string[]; teamB: string[]; satOut: string[] }
  | { ok: false; reason: string };

/** What the server's `generateNextGame` would pick right now, computed on this device. */
export function generateLocalGame(snapshot: QueueSnapshot, state: LocalState): LocalGenerateResult {
  if (state.eligible.length < 4) {
    return { ok: false, reason: "Need at least 4 checked-in players waiting to fill a court." };
  }
  const result = generateNextGame(state.eligible.map(toQueuePlayer), engineOptions(snapshot, state));
  if (!result.ok) return { ok: false, reason: result.reason ?? "Unable to generate a game." };
  const picked = new Set(result.selected.map((p) => p.id));
  return {
    ok: true,
    teamA: result.teamA.map((p) => p.id),
    teamB: result.teamB.map((p) => p.id),
    satOut: state.eligible.filter((p) => !picked.has(p.id)).map((p) => p.id),
  };
}

export function newLocalGameId(): string {
  return `${LOCAL_GAME_PREFIX}${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

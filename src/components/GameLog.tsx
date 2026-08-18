"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Typography, Dropdown } from "antd";

const { Text } = Typography;

export interface GameLogPlayer {
  id: string;
  name: string;
}

export interface GameLogView {
  id: string;
  gameNumber: number;
  winningTeam?: string | null;
  status: string;
  startedAt?: string | null;
  completedAt?: string | null;
  court?: { id: string; courtNumber: number; name?: string | null } | null;
  teamA: { players: GameLogPlayer[] };
  teamB: { players: GameLogPlayer[] };
}

export interface GameLogStats {
  gamesPlayed: number;
  rounds: number;
  avgGameMin: number;
  voided: number;
}

function teamLabel(players: GameLogPlayer[]) {
  return players.map((p) => p.name).join(" & ");
}

function toTime(iso: string | null | undefined) {
  if (!iso) return "—";
  return new Date(iso).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false });
}

function durationMin(startedAt: string | null | undefined, completedAt: string | null | undefined) {
  if (!startedAt || !completedAt) return null;
  return Math.round((new Date(completedAt).getTime() - new Date(startedAt).getTime()) / 60000);
}

/** Group sorted games into rounds.
 *  A new round begins whenever a court we've already seen in the current group reappears.
 */
function groupIntoRounds(games: GameLogView[]): { roundNum: number; games: GameLogView[] }[] {
  const rounds: { roundNum: number; games: GameLogView[] }[] = [];
  let current: GameLogView[] = [];
  const seenCourts = new Set<string>();

  for (const g of games) {
    const courtId = g.court?.id ?? "__none__";
    if (seenCourts.has(courtId) && current.length > 0) {
      rounds.push({ roundNum: 0, games: current });
      current = [];
      seenCourts.clear();
    }
    current.push(g);
    seenCourts.add(courtId);
  }
  if (current.length > 0) rounds.push({ roundNum: 0, games: current });

  // Assign round numbers (oldest = round 1)
  const total = rounds.length;
  return rounds.map((r, i) => ({ ...r, roundNum: total - i }));
}

export function GameLog({
  games,
  renderActions,
  onStats,
  scoringLabel,
}: {
  games: GameLogView[];
  renderActions?: (game: GameLogView) => ReactNode;
  onStats?: (s: GameLogStats) => void;
  scoringLabel?: string;
}) {
  const [courtFilter, setCourtFilter] = useState<string>("all");
  const [playerSearch, setPlayerSearch] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const ROUNDS_PER_PAGE = 5;

  const courtOptions = useMemo(() => {
    const seen = new Map<string, { id: string; number: number; label: string }>();
    for (const game of games) {
      if (game.court && !seen.has(game.court.id)) {
        seen.set(game.court.id, {
          id: game.court.id,
          number: game.court.courtNumber,
          label: game.court.name || `Court ${game.court.courtNumber}`,
        });
      }
    }
    return Array.from(seen.values()).sort((a, b) => a.number - b.number);
  }, [games]);

  // Derive stats
  const stats = useMemo<GameLogStats>(() => {
    const completed = games.filter((g) => g.status === "COMPLETED");
    const voided = games.filter((g) => g.status === "CANCELLED").length;
    const durations = completed
      .map((g) => durationMin(g.startedAt, g.completedAt))
      .filter((d): d is number => d !== null);
    const avgGameMin = durations.length > 0 ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length) : 0;
    const roundCount = groupIntoRounds([...games].sort((a, b) => b.gameNumber - a.gameNumber)).length;
    return { gamesPlayed: completed.length, rounds: roundCount, avgGameMin, voided };
  }, [games]);

  // Notify parent of stats
  useEffect(() => {
    onStats?.(stats);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stats.gamesPlayed, stats.rounds, stats.avgGameMin, stats.voided]);

  // Filter
  const filtered = useMemo(() => {
    return games.filter((g) => {
      if (g.status === "QUEUED" || g.status === "IN_PROGRESS") return false; // only show completed/cancelled
      if (courtFilter !== "all" && g.court?.id !== courtFilter) return false;
      if (playerSearch.trim()) {
        const q = playerSearch.trim().toLowerCase();
        const names = [...g.teamA.players, ...g.teamB.players].map((p) => p.name.toLowerCase());
        if (!names.some((n) => n.includes(q))) return false;
      }
      return true;
    });
  }, [games, courtFilter, playerSearch]);

  // Sort newest first, then group into rounds
  const sorted = useMemo(() => [...filtered].sort((a, b) => b.gameNumber - a.gameNumber), [filtered]);
  const rounds = useMemo(() => groupIntoRounds(sorted), [sorted]);

  const totalRounds = groupIntoRounds([...games].filter(g => g.status !== "QUEUED" && g.status !== "IN_PROGRESS").sort((a, b) => b.gameNumber - a.gameNumber)).length;

  // Pagination
  const totalPages = Math.ceil(rounds.length / ROUNDS_PER_PAGE);
  const startIdx = (currentPage - 1) * ROUNDS_PER_PAGE;
  const paginatedRounds = rounds.slice(startIdx, startIdx + ROUNDS_PER_PAGE);

  const thStyle: React.CSSProperties = {
    fontSize: 11, fontWeight: 700, letterSpacing: "0.12em",
    textTransform: "uppercase", color: "#9ca3af",
    padding: "12px 14px", userSelect: "none",
  };

  const GRID = "50px 90px 1fr 90px 90px 44px";

  return (
    <div style={{ display: "flex", flexDirection: "column", padding: "0 24px" }}>
      <style>{`
        .gl-row:hover { background: #fdf2f8 !important; }
        .gl-round-header { background: #fff0f5; }

        @media (max-width: 1024px) {
          .gl-toolbar {
            flex-direction: column;
            gap: 12px;
            align-items: stretch;
          }
          .gl-search {
            width: 100% !important;
            max-width: none !important;
          }
          .gl-court-pills {
            flex-wrap: nowrap;
            overflow-x: auto;
            -webkit-overflow-scrolling: touch;
          }
        }

        @media (max-width: 768px) {
          .gl-table-header {
            display: none !important;
          }
          .gl-table-wrapper {
            margin: 0;
            padding: 0;
            overflow: visible;
          }
          .gl-round-header {
            grid-template-columns: 1fr !important;
            padding: 8px 24px !important;
            border-bottom: 1px solid rgba(138,39,72,0.12) !important;
            margin-bottom: 0 !important;
            min-height: 36px !important;
            position: relative !important;
            display: flex !important;
            justify-content: space-between !important;
            align-items: center !important;
          }
          .gl-round-header + .gl-row > div:nth-child(6) {
            display: flex !important;
            position: absolute !important;
            top: 6px !important;
            right: 20px !important;
            z-index: 100 !important;
            padding: 0 !important;
            margin-top: -45px !important;
            background: transparent !important;
          }
          .gl-round-header > div {
            display: flex;
            align-items: center;
            gap: 10px;
            justify-content: space-between;
          }
          .gl-round-header span:first-child {
            font-size: 11px !important;
            font-weight: 800 !important;
            color: #e11d74 !important;
          }
          .gl-round-header span:last-child {
            font-size: 10px !important;
            color: rgba(29,31,32,0.45) !important;
          }
          .gl-row {
            grid-template-columns: 1fr !important;
            padding: 0 !important;
            border: none !important;
            border-bottom: 1px solid rgba(138,39,72,0.12) !important;
            background: transparent !important;
            min-height: auto !important;
            gap: 0 !important;
          }
          .gl-row > div:nth-child(1),
          .gl-row > div:nth-child(2) {
            display: none !important;
          }
          .gl-row > div {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 8px 24px !important;
            border-bottom: none !important;
            font-size: 12px !important;
          }
          .gl-row > div:nth-child(3) {
            flex-direction: column !important;
            align-items: center !important;
            text-align: center !important;
          }
          .gl-row > div:nth-child(3) span {
            font-size: 12px !important;
            display: block !important;
            margin: 2px 0 !important;
          }
          .gl-row > div:nth-child(3) span:nth-child(2) {
            font-size: 11px !important;
          }
          .gl-row > div:nth-child(3) span::before {
            display: none !important;
          }
          .gl-row > div:nth-child(3) > span:first-child {
            font-size: 12px !important;
          }
          .gl-row > div:nth-child(3) > span:first-child::before {
            content: "" !important;
          }
          .gl-row > div:nth-child(3) span span {
            display: none !important;
          }
          .gl-row > div:nth-child(4) {
            display: none !important;
          }
          .gl-round-header {
            position: relative !important;
          }
          div > .gl-row:first-of-type > div:nth-child(6) {
            display: flex !important;
            justify-content: center !important;
            align-items: center !important;
            padding: 0 !important;
            position: absolute !important;
            right: 20px !important;
            top: -32px !important;
            min-height: 32px !important;
            z-index: 10 !important;
          }
          div > .gl-row:first-of-type > div:nth-child(6) button {
            color: rgba(29,31,32,0.5) !important;
            font-size: 18px !important;
            padding: 4px 8px !important;
          }
          .gl-row > div:nth-child(6) {
            display: none !important;
          }
          .gl-round-header > div:last-child {
            display: flex !important;
            justify-content: flex-end !important;
            padding: 0 24px 0 0 !important;
          }
        }
      `}</style>

      {/* Toolbar */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px 0", borderBottom: "1px solid rgba(138,39,72,0.08)" }} className="gl-toolbar">
        {/* Search */}
        <div style={{ position: "relative", width: 220, flexShrink: 0 }} className="gl-search">
          <span style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "#e11d74", fontSize: 13, pointerEvents: "none" }}>&#128269;</span>
          <input
            value={playerSearch}
            onChange={(e) => setPlayerSearch(e.target.value)}
            placeholder="Search by player..."
            style={{ width: "100%", paddingLeft: 32, paddingRight: 12, height: 38, fontSize: 13, border: "1px solid #fbb6ce", borderRadius: 6, outline: "none", boxSizing: "border-box", color: "#1d1f20", background: "#fff0f5" }}
          />
        </div>

        {/* Court filter pills */}
        <div style={{ display: "flex", gap: 6 }} className="gl-court-pills">
          {[{ id: "all", label: "All courts" }, ...courtOptions.map(c => ({ id: c.id, label: c.label }))].map(({ id, label }) => {
            const active = courtFilter === id;
            return (
              <button key={id} onClick={() => setCourtFilter(id)} style={{ padding: "0 16px", height: 38, fontSize: 13, fontWeight: 500, borderRadius: 6, border: "1px solid #e5e7eb", cursor: "pointer", background: active ? "#fff0f5" : "#fff", color: active ? "#e11d74" : "#1d1f20", borderColor: active ? "#fbb6ce" : "#e5e7eb", transition: "all 0.12s" }}>
                {label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="gl-table-wrapper">
        {/* Table header */}
        <div style={{ display: "grid", gridTemplateColumns: GRID, padding: "0", background: "#f9f0f4", borderTop: "1px solid rgba(138,39,72,0.12)", borderBottom: "2px solid rgba(225,29,116,0.18)" }} className="gl-table-header">
          <div style={thStyle}>#</div>
          <div style={thStyle}>Court</div>
          <div style={thStyle}>Matchup · <span style={{ color: "#e11d74", fontWeight: 800 }}>Winner in pink</span></div>
          <div style={thStyle}>Length</div>
          <div style={thStyle}>Ended</div>
          <div style={thStyle} />
        </div>

        {/* Rounds */}
        {rounds.length === 0 ? (
        <div style={{ padding: 48, textAlign: "center" }}>
          <Text type="secondary">No completed games yet</Text>
        </div>
      ) : (
        paginatedRounds.map((round) => {
          const roundTime = round.games[0]?.completedAt ? toTime(round.games[0].completedAt) : "";
          const voidedCount = round.games.filter(g => g.status === "CANCELLED").length;
          return (
            <div key={round.roundNum}>
              {/* Round header */}
              <div className="gl-round-header" style={{ display: "grid", gridTemplateColumns: GRID, padding: "0", minHeight: 36, alignItems: "center", borderBottom: "1px solid rgba(225,29,116,0.08)" }}>
                <div style={{ gridColumn: "1 / -1", display: "flex", alignItems: "center", gap: 10, padding: "0 14px" }}>
                  <span style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.14em", color: "#e11d74", textTransform: "uppercase" }}>
                    Round {round.roundNum}
                  </span>
                  <span style={{ fontSize: 11, color: "rgba(29,31,32,0.45)" }}>
                    {roundTime}{roundTime ? " · " : ""}{round.games.length} game{round.games.length !== 1 ? "s" : ""}
                    {voidedCount > 0 ? ` · ${voidedCount} voided` : ""}
                  </span>
                </div>
              </div>

              {/* Game rows */}
              {round.games.map((game) => {
                const isVoided = game.status === "CANCELLED";
                const teamALabel = teamLabel(game.teamA.players);
                const teamBLabel = teamLabel(game.teamB.players);
                const winnerIsA = game.winningTeam === "A";
                const winnerIsB = game.winningTeam === "B";
                const dur = durationMin(game.startedAt, game.completedAt);
                const courtLabel = game.court ? (game.court.name || `Court ${game.court.courtNumber}`) : "—";

                return (
                  <div key={game.id} className="gl-row" style={{ display: "grid", gridTemplateColumns: GRID, padding: "0", minHeight: 52, alignItems: "center", borderBottom: "1px solid rgba(138,39,72,0.06)", background: "#fff" }}>
                    {/* # */}
                    <div style={{ fontSize: 13, color: isVoided ? "rgba(29,31,32,0.3)" : "rgba(29,31,32,0.5)", padding: "0 14px" }} className="gl-cell">{game.gameNumber}</div>

                    {/* Court */}
                    <div style={{ fontSize: 13, color: isVoided ? "rgba(29,31,32,0.3)" : "#1d1f20", textDecoration: isVoided ? "line-through" : "none", padding: "0 14px" }} className="gl-cell">{courtLabel}</div>

                    {/* Matchup */}
                    <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", padding: "0 14px" }} className="gl-cell">
                      {/* Team A */}
                      <span style={{ fontSize: 14, fontWeight: winnerIsA ? 700 : 400, color: isVoided ? "rgba(29,31,32,0.3)" : winnerIsA ? "#e11d74" : "#1d1f20", textDecoration: isVoided ? "line-through" : "none", display: "flex", alignItems: "center", gap: 4 }}>
                        {winnerIsA && !isVoided && <span style={{ fontSize: 12 }}>✓</span>}
                        {teamALabel}
                      </span>
                      <span style={{ fontSize: 11, color: "rgba(29,31,32,0.35)", fontWeight: 500 }}>vs</span>
                      {/* Team B */}
                      <span style={{ fontSize: 14, fontWeight: winnerIsB ? 700 : 400, color: isVoided ? "rgba(29,31,32,0.3)" : winnerIsB ? "#e11d74" : "#1d1f20", textDecoration: isVoided ? "line-through" : "none", display: "flex", alignItems: "center", gap: 4 }}>
                        {winnerIsB && !isVoided && <span style={{ fontSize: 12 }}>✓</span>}
                        {teamBLabel}
                      </span>
                      {isVoided && (
                        <span style={{ display: "inline-block", border: "1px solid #e5e7eb", borderRadius: 4, fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", color: "rgba(29,31,32,0.4)", padding: "1px 6px", textTransform: "uppercase", marginLeft: 4 }}>
                          Voided
                        </span>
                      )}
                    </div>

                    {/* Length */}
                    <div style={{ fontSize: 13, color: "rgba(29,31,32,0.5)", padding: "0 14px" }} className="gl-cell">
                      {dur !== null ? `${dur} min` : "—"}
                    </div>

                    {/* Ended */}
                    <div style={{ fontSize: 13, color: "rgba(29,31,32,0.5)", padding: "0 14px" }} className="gl-cell">
                      {toTime(game.completedAt)}
                    </div>

                    {/* Actions */}
                    <div style={{ padding: "0 14px" }}>
                      {renderActions ? (
                        <Dropdown
                          trigger={["click"]}
                          dropdownRender={() => (
                            <div style={{ background: "#fff", borderRadius: 8, boxShadow: "0 4px 16px rgba(0,0,0,0.12)", padding: "4px 0", minWidth: 160 }}>
                              {renderActions(game)}
                            </div>
                          )}
                        >
                          <button style={{ background: "none", border: "none", cursor: "pointer", color: "rgba(29,31,32,0.35)", fontSize: 18, padding: "0 4px", lineHeight: 1, display: "flex", alignItems: "center" }}>&#8942;</button>
                        </Dropdown>
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </div>
          );
        })
      )}
      </div>

      {/* Footer */}
      {rounds.length > 0 && (
        <div style={{ padding: "12px 0", borderTop: "1px solid rgba(138,39,72,0.08)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <Text type="secondary" style={{ fontSize: 12 }}>
              {paginatedRounds.length > 0 ? `Rounds ${paginatedRounds[0]?.roundNum}–${paginatedRounds[paginatedRounds.length - 1]?.roundNum} of ${totalRounds}` : "No rounds"}
            </Text>
            {totalPages > 1 && (
              <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
                <button disabled={currentPage === 1} onClick={() => setCurrentPage(p => p - 1)} style={{ background: "none", border: "1px solid rgba(29,31,32,0.2)", borderRadius: 4, cursor: currentPage === 1 ? "default" : "pointer", color: currentPage === 1 ? "rgba(29,31,32,0.25)" : "#1d1f20", fontSize: 13, padding: "2px 10px" }}>‹</button>
                <span style={{ fontSize: 12, color: "rgba(29,31,32,0.5)", padding: "0 6px" }}>{currentPage} / {totalPages}</span>
                <button disabled={currentPage === totalPages} onClick={() => setCurrentPage(p => p + 1)} style={{ background: "none", border: "1px solid rgba(29,31,32,0.2)", borderRadius: 4, cursor: currentPage === totalPages ? "default" : "pointer", color: currentPage === totalPages ? "rgba(29,31,32,0.25)" : "#1d1f20", fontSize: 13, padding: "2px 10px" }}>›</button>
              </div>
            )}
          </div>
          {scoringLabel && (
            <Text type="secondary" style={{ fontSize: 12 }}>{scoringLabel}</Text>
          )}
        </div>
      )}
    </div>
  );
}


export interface GameLogPlayer {
  id: string;
  name: string;
}

export interface GameLogView {
  id: string;
  gameNumber: number;
  winningTeam?: string | null;
  status: string;
  completedAt?: string | null;
  court?: { id: string; courtNumber: number; name?: string | null } | null;
  teamA: { players: GameLogPlayer[] };
  teamB: { players: GameLogPlayer[] };
}

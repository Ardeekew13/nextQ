"use client";

import { useMemo, useEffect, useState } from "react";
import { useQuery } from "@apollo/client";
import { App, Empty } from "antd";
import { Share2, Copy } from "lucide-react";
import { SESSION_STANDINGS_QUERY } from "@/graphql/documents/organiser";
import { CLUB_STANDINGS_QUERY } from "@/graphql/documents/public";
import type { StandingRowView } from "@/components/StandingsTable";
import type { PodiumEntryView } from "@/components/Podium";

const STANDINGS_STYLES = `
  @media (max-width: 768px) {
    .session-stats-container {
      display: none !important;
    }
    .standings-podium {
      flex-direction: row !important;
      align-items: flex-end !important;
      gap: 8px !important;
      margin-bottom: 24px !important;
    }
    .standings-podium-entry {
      flex: 1 !important;
      min-width: 0 !important;
    }
    .standings-podium-entry > div:first-child {
      margin-bottom: 3px !important;
    }
    .standings-podium-entry > div:first-child span:first-child {
      font-size: 8px !important;
    }
    .standings-podium-entry > div:first-child span:nth-child(2) {
      font-size: 7px !important;
    }
    .standings-podium-entry > div:first-child span:last-child {
      font-size: 5px !important;
    }
    .standings-podium-entry:nth-child(1) > div:last-child {
      min-height: 110px !important;
    }
    .standings-podium-entry:nth-child(3) > div:last-child {
      min-height: 95px !important;
    }
    .standings-podium-entry > div:last-child {
      padding: 14px 12px !important;
      display: flex !important;
      flex-direction: column !important;
      justify-content: space-between !important;
    }
    .standings-podium-entry > div:last-child > div:first-child {
      font-size: 6px !important;
      margin-bottom: 0 !important;
      line-height: 1.1 !important;
      flex-shrink: 0 !important;
    }
    .standings-podium-entry > div:last-child > div:last-child {
      font-size: 10px !important;
      line-height: 1.2 !important;
      text-align: center !important;
      margin-top: auto !important;
    }
    .standings-podium-entry:nth-child(2) > div:last-child {
      padding: 24px 18px !important;
      min-height: 160px !important;
      display: flex !important;
      flex-direction: column !important;
      justify-content: space-between !important;
    }
    .standings-podium-entry:nth-child(2) > div:last-child > div:first-child {
      font-size: 8px !important;
      margin-bottom: 6px !important;
      letter-spacing: 0.15em !important;
    }
    .standings-podium-entry:nth-child(2) > div:last-child > div:nth-child(2) {
      font-size: 28px !important;
      line-height: 1 !important;
    }
    .standings-podium-entry:nth-child(2) > div:last-child > div:nth-child(3) {
      font-size: 8px !important;
      margin-top: 0 !important;
      line-height: 1.2 !important;
      text-align: center !important;
    }
    .standings-table-header {
      display: none;
    }
    .standings-row {
      grid-template-columns: 1fr !important;
      border: 1px solid rgba(138,39,72,0.12);
      border-radius: 8px;
      margin-bottom: 12px;
      gap: 0 !important;
      padding: 0 !important;
      min-height: auto !important;
    }
    .standings-row > div {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 10px 12px !important;
      border-bottom: 1px solid rgba(138,39,72,0.08);
    }
    .standings-row > div:first-child::before {
      content: "Rank: ";
      font-weight: 700;
      font-size: 11px;
      color: rgba(29,31,32,0.5);
      text-transform: uppercase;
      letter-spacing: 0.1em;
      margin-right: 8px;
    }
    .standings-row > div:nth-child(2)::before {
      content: "Player: ";
      font-weight: 700;
      font-size: 11px;
      color: rgba(29,31,32,0.5);
      text-transform: uppercase;
      letter-spacing: 0.1em;
      margin-right: 8px;
    }
    .standings-row > div:nth-child(3)::before {
      content: "GP: ";
      font-weight: 700;
      font-size: 11px;
      color: rgba(29,31,32,0.5);
      text-transform: uppercase;
      letter-spacing: 0.1em;
      margin-right: 8px;
    }
    .standings-row > div:nth-child(4)::before {
      content: "W-L: ";
      font-weight: 700;
      font-size: 11px;
      color: rgba(29,31,32,0.5);
      text-transform: uppercase;
      letter-spacing: 0.1em;
      margin-right: 8px;
    }
    .standings-row > div:nth-child(5)::before {
      content: "Win %: ";
      font-weight: 700;
      font-size: 11px;
      color: rgba(29,31,32,0.5);
      text-transform: uppercase;
      letter-spacing: 0.1em;
      margin-right: 8px;
    }
    .standings-row > div:nth-child(6)::before {
      content: "Streak: ";
      font-weight: 700;
      font-size: 11px;
      color: rgba(29,31,32,0.5);
      text-transform: uppercase;
      letter-spacing: 0.1em;
      margin-right: 8px;
    }
    .standings-row > div:last-child {
      border-bottom: none;
    }
    .standings-pagination {
      flex-direction: column;
      gap: 12px;
    }
    .standings-pagination button {
      width: 100%;
    }
  }
`;

export interface StandingsTabStats {
  playersRanked: number;
  games: number;
  unbeaten: number;
}

const MEDAL_COLOR: Record<number, string> = { 1: "#d4af37", 2: "#9ca3af", 3: "#b06a3d" };

function streakLabel(v: number) {
  if (v === 0) return null;
  return v > 0 ? `W${v}` : `L${Math.abs(v)}`;
}

export function StandingsTab({
  sessionId,
  onStats,
}: {
  sessionId: string;
  onStats?: (s: StandingsTabStats) => void;
}) {
  const { message } = App.useApp();
  const PAGE_SIZE = 15;
  const [page, setPage] = useState(1);
  const [view, setView] = useState<"session" | "alltime">("session");

  const { data, loading } = useQuery(SESSION_STANDINGS_QUERY, {
    variables: { id: sessionId },
  });

  const session = data?.session;
  const clubSlug: string = session?.clubSlug ?? "";

  const { data: clubStandingsData, loading: clubStandingsLoading } = useQuery(CLUB_STANDINGS_QUERY, {
    variables: { slug: clubSlug },
    skip: !clubSlug,
  });

  const clubStandings: any[] = clubStandingsData?.clubStandings ?? [];
  const standings: StandingRowView[] = session?.standings ?? [];
  const podium: PodiumEntryView[] = session?.podium ?? [];

  const tabStats = useMemo<StandingsTabStats>(() => ({
    playersRanked: standings.length,
    games: Math.floor(standings.reduce((sum, s) => sum + s.gamesPlayed, 0) / 2),
    unbeaten: standings.filter((s) => s.losses === 0 && s.wins > 0).length,
  }), [standings]);

  useEffect(() => {
    onStats?.(tabStats);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tabStats.playersRanked, tabStats.games, tabStats.unbeaten]);
  useEffect(() => { setPage(1); }, [standings.length, view]);

  const totalPages = view === "session"
    ? Math.max(1, Math.ceil(standings.length / PAGE_SIZE))
    : Math.max(1, Math.ceil(clubStandings.length / PAGE_SIZE));
  const pagedStandings = standings.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const pagedClubStandings = clubStandings.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const notes = useMemo(() => {
    if (!standings.length) return null;
    const longestStreak = [...standings].sort((a, b) => Math.abs(b.currentStreak) - Math.abs(a.currentStreak))[0];
    const mostGames = [...standings].sort((a, b) => b.gamesPlayed - a.gamesPlayed)[0];
    const fewestGames = [...standings].sort((a, b) => a.gamesPlayed - b.gamesPlayed)[0];
    const spread = mostGames.gamesPlayed - fewestGames.gamesPlayed;
    const fairCount = standings.filter((s) => s.gamesPlayed >= fewestGames.gamesPlayed && s.gamesPlayed <= fewestGames.gamesPlayed + spread).length;
    return { longestStreak, mostGames, fewestGames, spread, fairCount, total: standings.length };
  }, [standings]);

  const p1 = podium.find((e) => e.position === 1);
  const p2 = podium.find((e) => e.position === 2);
  const p3 = podium.find((e) => e.position === 3);

  function handleCopyLink() {
    if (!session?.publicUrl) return;
    navigator.clipboard.writeText(session.publicUrl);
    message.success("Public link copied!");
  }

  function handleOpenPublicView() {
    if (!session?.publicUrl) return;
    window.open(session.publicUrl, "_blank", "noopener,noreferrer");
  }

  if (loading && !data) return null;
  if (!session) return <Empty description="Session not found" style={{ padding: 48 }} />;

  const GRID = "60px 1fr 130px 110px 100px 90px";

  return (
    <div style={{ display: "flex", alignItems: "flex-start", flex: 1, minHeight: 0, overflow: "hidden" }}>
      <style>{STANDINGS_STYLES}</style>
      {/* ── Main content ── */}
      <div style={{ flex: 1, minWidth: 0, padding: "24px 28px", overflowY: "auto", height: "100%" }}>

        {/* Podium */}
        {podium.length > 0 && (
          <>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
              <span style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.14em", textTransform: "uppercase", color: "rgba(29,31,32,0.45)" }}>PODIUM</span>
              {session?.publicUrl && (
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <button
                    onClick={handleCopyLink}
                    title="Copy public link"
                    style={{
                      display: "flex", alignItems: "center", gap: 6, padding: "6px 12px",
                      fontSize: 12, fontWeight: 600, border: "1px solid #e5e7eb", borderRadius: 6,
                      background: "#fff", color: "#1d1f20", cursor: "pointer",
                    }}
                  >
                    <Copy size={13} />
                    Copy link
                  </button>
                  <button
                    onClick={handleOpenPublicView}
                    title="Open public standings & games (view only)"
                    style={{
                      display: "flex", alignItems: "center", gap: 6, padding: "6px 12px",
                      fontSize: 12, fontWeight: 600, border: "none", borderRadius: 6,
                      background: "#e11d74", color: "#fff", cursor: "pointer",
                    }}
                  >
                    <Share2 size={13} />
                    Share result
                  </button>
                </div>
              )}
            </div>

            {/* 2nd | 1st | 3rd */}
            <div style={{ display: "flex", alignItems: "flex-end", gap: 12, marginBottom: 40 }} className="standings-podium">
              {p2 && (
                <div style={{ flex: 1, minWidth: 0 }} className="standings-podium-entry">
                  <div style={{ marginBottom: 8 }}>
                    <span style={{ fontSize: 22, fontWeight: 800, fontFamily: "'Barlow Condensed', sans-serif", color: MEDAL_COLOR[2] }}>2 </span>
                    <span style={{ fontSize: 15, fontWeight: 700, fontFamily: "'Barlow Condensed', sans-serif", color: "#1d1f20", textTransform: "uppercase" }}>{p2.player.nickname || p2.player.name}</span>
                    <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", color: MEDAL_COLOR[2], marginLeft: 6 }}>SILVER</span>
                  </div>
                  <div style={{ background: "#fff0f5", border: "1px solid #fbb6ce", borderTop: `4px solid ${MEDAL_COLOR[2]}`, borderRadius: 8, padding: "20px 18px" }}>
                    <div style={{ fontSize: 12, color: "rgba(29,31,32,0.5)", marginTop: 6 }}>{p2.wins}-{p2.losses} · {p2.gamesPlayed} games</div>
                  </div>
                </div>
              )}

              {p1 && (
                <div style={{ flex: 1.3, minWidth: 0 }} className="standings-podium-entry">
                  <div style={{ marginBottom: 8 }}>
                    <span style={{ fontSize: 28, fontWeight: 800, fontFamily: "'Barlow Condensed', sans-serif", color: MEDAL_COLOR[1] }}>1 </span>
                    <span style={{ fontSize: 18, fontWeight: 700, fontFamily: "'Barlow Condensed', sans-serif", color: "#1d1f20", textTransform: "uppercase" }}>{p1.player.nickname || p1.player.name}</span>
                    <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", color: MEDAL_COLOR[1], marginLeft: 6 }}>GOLD</span>
                  </div>
                  <div style={{ background: "#3d0a1e", borderTop: `4px solid ${MEDAL_COLOR[1]}`, borderRadius: 8, padding: "28px 22px" }}>
                    <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.14em", color: "rgba(255,255,255,0.45)", textTransform: "uppercase", marginBottom: 8 }}>SESSION WINNER</div>
                    <div style={{ fontSize: 52, fontWeight: 800, fontFamily: "'Barlow Condensed', sans-serif", color: "#fff", lineHeight: 1 }}>{p1.winRate.toFixed(0)}%</div>
                    <div style={{ fontSize: 13, color: "rgba(255,255,255,0.55)", marginTop: 8 }}>{p1.wins}-{p1.losses} · {p1.gamesPlayed} games{p1.losses === 0 ? " · unbeaten" : ""}</div>
                  </div>
                </div>
              )}

              {p3 && (
                <div style={{ flex: 1, minWidth: 0 }} className="standings-podium-entry">
                  <div style={{ marginBottom: 8 }}>
                    <span style={{ fontSize: 22, fontWeight: 800, fontFamily: "'Barlow Condensed', sans-serif", color: MEDAL_COLOR[3] }}>3 </span>
                    <span style={{ fontSize: 15, fontWeight: 700, fontFamily: "'Barlow Condensed', sans-serif", color: "#1d1f20", textTransform: "uppercase" }}>{p3.player.nickname || p3.player.name}</span>
                    <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", color: MEDAL_COLOR[3], marginLeft: 6 }}>BRONZE</span>
                  </div>
                  <div style={{ background: "#fff0f5", border: "1px solid #fbb6ce", borderTop: `4px solid ${MEDAL_COLOR[3]}`, borderRadius: 8, padding: "20px 18px" }}>
                    <div style={{ fontSize: 12, color: "rgba(29,31,32,0.5)", marginTop: 6 }}>{p3.wins}-{p3.losses} · {p3.gamesPlayed} games</div>
                  </div>
                </div>
              )}
            </div>
          </>
        )}

        {/* Full Standings heading + toggle */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
          <span style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.14em", textTransform: "uppercase", color: "rgba(29,31,32,0.45)" }}>FULL STANDINGS</span>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <span style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase", color: "rgba(29,31,32,0.35)" }}>RANKED BY WIN %, THEN WINS</span>
            <div style={{ display: "flex", border: "1px solid #e5e7eb", borderRadius: 6, overflow: "hidden", flexShrink: 0 }}>
              {(["session", "alltime"] as const).map((v) => (
                <button key={v} onClick={() => setView(v)} style={{
                  padding: "5px 14px", fontSize: 12, fontWeight: 600, border: "none", cursor: "pointer",
                  background: view === v ? "#e11d74" : "#fff",
                  color: view === v ? "#fff" : "#1d1f20",
                  transition: "all 0.12s",
                }}>
                  {v === "session" ? "This session" : "All time"}
                </button>
              ))}
            </div>
          </div>
        </div>

        {view === "session" ? (
        <div style={{ border: "1px solid rgba(138,39,72,0.12)", borderRadius: 8, overflow: "hidden" }}>
          {/* Header */}
          <div style={{ display: "grid", gridTemplateColumns: GRID, background: "#f9f0f4", borderBottom: "2px solid rgba(225,29,116,0.18)" }} className="standings-table-header">
            {(["RANK", "NAME", "GAMES PLAYED", "WIN / LOSE", "WIN RATE", "STREAK"] as const).map((h, i) => (
              <div key={h} style={{
                fontSize: 10, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase",
                color: "#e11d74", padding: "12px 14px", userSelect: "none",
                textAlign: i >= 2 ? "right" : "left",
              }}>{h}</div>
            ))}
          </div>

          {standings.length === 0 && !loading && (
            <div style={{ padding: 48, textAlign: "center", color: "rgba(29,31,32,0.4)", fontSize: 14 }}>No standings yet</div>
          )}

          {pagedStandings.map((row, idx) => {
            const medal = MEDAL_COLOR[row.rank];
            const streak = streakLabel(row.currentStreak);
            const isTop3 = row.rank <= 3;
            const isWin = row.currentStreak > 0;
            return (
              <div key={row.player.id} style={{
                display: "grid", gridTemplateColumns: GRID,
                borderBottom: idx < pagedStandings.length - 1 ? "1px solid rgba(138,39,72,0.06)" : "none",
                background: idx % 2 === 0 ? "#fff" : "#fdf9fb",
                alignItems: "center", minHeight: 48,
              }} className="standings-row">
                <div style={{ padding: "0 14px", fontSize: isTop3 ? 16 : 13, fontWeight: isTop3 ? 800 : 400, color: medal ?? "rgba(29,31,32,0.45)", fontFamily: "'Barlow Condensed', sans-serif" }}>{row.rank}</div>
                <div style={{ padding: "0 14px", fontSize: 14, fontWeight: isTop3 ? 700 : 500, color: "#1d1f20" }}>{row.player.nickname || row.player.name}</div>
                <div style={{ padding: "0 14px", fontSize: 14, color: "rgba(29,31,32,0.65)", textAlign: "right" }}>{row.gamesPlayed}</div>
                <div style={{ padding: "0 14px", fontSize: 14, color: "rgba(29,31,32,0.65)", textAlign: "right" }}>{row.wins}-{row.losses}</div>
                <div style={{ padding: "0 14px", fontSize: 14, fontWeight: 700, color: "#e11d74", textAlign: "right" }}>{row.winRate.toFixed(0)}%</div>
                <div style={{ padding: "0 14px", textAlign: "right" }}>
                  {streak ? (
                    <span style={{
                      display: "inline-block", padding: "2px 8px", borderRadius: 4,
                      fontSize: 12, fontWeight: 700, fontFamily: "'Barlow Condensed', sans-serif",
                      background: isWin ? "rgba(225,29,116,0.08)" : "rgba(0,0,0,0.04)",
                      color: isWin ? "#e11d74" : "#6b7280",
                      border: `1px solid ${isWin ? "rgba(225,29,116,0.2)" : "rgba(0,0,0,0.1)"}`,
                    }}>{streak}</span>
                  ) : (
                    <span style={{ color: "rgba(29,31,32,0.3)", fontSize: 13 }}>—</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
        ) : (
        /* ── All-time club standings table ── */
        <div style={{ border: "1px solid rgba(138,39,72,0.12)", borderRadius: 8, overflow: "hidden" }}>
          <div style={{ display: "grid", gridTemplateColumns: "60px 1fr 110px 110px 100px 90px", background: "#f9f0f4", borderBottom: "2px solid rgba(225,29,116,0.18)" }} className="standings-table-header">
            {(["RANK", "PLAYER", "TOTAL GP", "W–L", "WIN RATE", "SESSIONS"] as const).map((h, i) => (
              <div key={h} style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "#e11d74", padding: "12px 14px", userSelect: "none", textAlign: i >= 2 ? "right" : "left" }}>{h}</div>
            ))}
          </div>

          {clubStandingsLoading && !clubStandingsData ? (
            <div style={{ padding: 32, textAlign: "center", color: "rgba(29,31,32,0.4)" }}>Loading…</div>
          ) : clubStandings.length === 0 ? (
            <div style={{ padding: 48, textAlign: "center", color: "rgba(29,31,32,0.4)", fontSize: 14 }}>No club standings yet</div>
          ) : (
            pagedClubStandings.map((row: any, idx: number) => {
              const medal = MEDAL_COLOR[row.rank];
              const isTop3 = row.rank <= 3;
              const inSession = standings.some((s) => (s.player.nickname || s.player.name).toLowerCase() === (row.nickname || row.name).toLowerCase());
              return (
                <div key={`${row.name}-${row.rank}`} style={{
                  display: "grid", gridTemplateColumns: "60px 1fr 110px 110px 100px 90px",
                  borderBottom: idx < pagedClubStandings.length - 1 ? "1px solid rgba(138,39,72,0.06)" : "none",
                  background: inSession ? "rgba(225,29,116,0.04)" : (idx % 2 === 0 ? "#fff" : "#fdf9fb"),
                  alignItems: "center", minHeight: 48,
                }} className="standings-row">
                  <div style={{ padding: "0 14px", fontSize: isTop3 ? 16 : 13, fontWeight: isTop3 ? 800 : 400, color: medal ?? "rgba(29,31,32,0.45)", fontFamily: "'Barlow Condensed', sans-serif" }}>{row.rank}</div>
                  <div style={{ padding: "0 14px", fontSize: 14, fontWeight: inSession ? 700 : (isTop3 ? 600 : 400), color: inSession ? "#e11d74" : "#1d1f20" }}>{row.nickname || row.name}</div>
                  <div style={{ padding: "0 14px", fontSize: 14, color: "rgba(29,31,32,0.65)", textAlign: "right" }}>{row.totalGames}</div>
                  <div style={{ padding: "0 14px", fontSize: 14, color: "rgba(29,31,32,0.65)", textAlign: "right" }}>{row.wins}–{row.losses}</div>
                  <div style={{ padding: "0 14px", fontSize: 14, fontWeight: 700, color: "#e11d74", textAlign: "right" }}>{(row.winRate * 100).toFixed(0)}%</div>
                  <div style={{ padding: "0 14px", fontSize: 13, color: "rgba(29,31,32,0.5)", textAlign: "right" }}>{row.sessionsPlayed}</div>
                </div>
              );
            })
          )}
        </div>
        )}

        {((view === "session" && standings.length > 0) || (view === "alltime" && clubStandings.length > 0)) && (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 0 4px" }} className="standings-pagination">
            <span style={{ fontSize: 12, color: "rgba(29,31,32,0.4)" }}>
              {view === "session"
                ? `Showing ${(page - 1) * PAGE_SIZE + 1}–${Math.min(page * PAGE_SIZE, standings.length)} of ${standings.length} players`
                : `Showing ${(page - 1) * PAGE_SIZE + 1}–${Math.min(page * PAGE_SIZE, clubStandings.length)} of ${clubStandings.length} players`}
            </span>
            {totalPages > 1 && (
              <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                  style={{ padding: "4px 10px", fontSize: 13, fontWeight: 600, border: "1px solid #e5e7eb", borderRadius: 4, background: "#fff", color: page === 1 ? "rgba(29,31,32,0.25)" : "#1d1f20", cursor: page === 1 ? "default" : "pointer" }}
                >‹</button>
                {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                  <button key={p} onClick={() => setPage(p)} style={{
                    padding: "4px 10px", fontSize: 13, fontWeight: 600, border: "1px solid",
                    borderColor: p === page ? "#e11d74" : "#e5e7eb", borderRadius: 4,
                    background: p === page ? "#e11d74" : "#fff",
                    color: p === page ? "#fff" : "#1d1f20", cursor: "pointer",
                  }}>{p}</button>
                ))}
                <button
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  style={{ padding: "4px 10px", fontSize: 13, fontWeight: 600, border: "1px solid #e5e7eb", borderRadius: 4, background: "#fff", color: page === totalPages ? "rgba(29,31,32,0.25)" : "#1d1f20", cursor: page === totalPages ? "default" : "pointer" }}
                >›</button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

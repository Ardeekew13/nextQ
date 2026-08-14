"use client";

import { useState, useMemo } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { useQuery } from "@apollo/client";
import { Skeleton } from "antd";
import { PUBLIC_CLUB_QUERY, CLUB_STANDINGS_QUERY } from "@/graphql/documents/public";

const MEDAL_COLOR: Record<number, string> = { 1: "#d4af37", 2: "#9ca3af", 3: "#b06a3d" };
const PAGE_SIZE = 20;

function winRateDisplay(v: number) {
  return v.toFixed(3).replace(/^0/, "");
}

function streakLabel(v: number) {
  if (v === 0) return null;
  return v > 0 ? `W${v}` : `L${Math.abs(v)}`;
}

interface ClubStanding {
  rank: number;
  name: string;
  nickname?: string | null;
  totalGames: number;
  wins: number;
  losses: number;
  winRate: number;
  sessionsPlayed: number;
  currentStreak: number;
  longestWinStreak: number;
}

export default function ClubStandingsPage() {
  const params = useParams<{ clubSlug: string }>();
  const [page, setPage] = useState(1);

  const { data: clubData, loading: clubLoading } = useQuery(PUBLIC_CLUB_QUERY, {
    variables: { slug: params.clubSlug },
  });

  const { data: standingsData, loading: standingsLoading } = useQuery(CLUB_STANDINGS_QUERY, {
    variables: { slug: params.clubSlug },
    pollInterval: 30000,
  });

  const club = clubData?.publicClub;
  const standings: ClubStanding[] = standingsData?.clubStandings ?? [];

  const p1 = standings[0];
  const p2 = standings[1];
  const p3 = standings[2];

  // Notes
  const notes = useMemo(() => {
    if (!standings.length) return null;
    const hottestStreak = [...standings].sort((a, b) => b.longestWinStreak - a.longestWinStreak)[0];
    const mostGames = [...standings].sort((a, b) => b.totalGames - a.totalGames)[0];
    return { hottestStreak, mostGames };
  }, [standings]);

  const totalPages = Math.max(1, Math.ceil(Math.max(0, standings.length - 3) / PAGE_SIZE));
  // Table rows = rank 4+
  const tableRows = standings.slice(3);
  const pagedRows = tableRows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  if (clubLoading && !clubData) {
    return (
      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "40px 24px" }}>
        <Skeleton active paragraph={{ rows: 8 }} />
      </div>
    );
  }

  const displayName = (s: ClubStanding) => (s.nickname || s.name).toUpperCase();
  const GRID = "70px 1fr 100px 100px 80px";

  return (
    <div style={{ minHeight: "100vh", background: "#fff", fontFamily: "'Inter', system-ui, sans-serif" }}>
      {/* Navbar */}
      <nav style={{ borderBottom: "1px solid #e5e7eb", padding: "0 32px", height: 56, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ width: 32, height: 32, borderRadius: 6, background: "#e11d74", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <span style={{ color: "#fff", fontWeight: 900, fontSize: 14 }}>N</span>
          </div>
          <span style={{ fontSize: 13, fontWeight: 700, color: "#1d1f20" }}>{club?.name ?? "NextQ"}</span>
        </div>
        <div style={{ display: "flex", gap: 28, fontSize: 14, color: "rgba(29,31,32,0.6)" }}>
          <Link href={`/club/${params.clubSlug}`} style={{ color: "inherit", textDecoration: "none" }}>Sessions</Link>
          <span style={{ color: "#e11d74", fontWeight: 600 }}>Standings</span>
        </div>
      </nav>

      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "40px 24px" }}>
        {/* Header */}
        <div style={{ marginBottom: 32 }}>
          {club && (
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "rgba(29,31,32,0.45)", marginBottom: 6 }}>
              {club.name} · {standings.length > 0 ? `${standings.reduce((s, r) => s + r.totalGames, 0)} total games` : "All sessions"}
            </div>
          )}
          <h1 style={{ fontSize: 42, fontWeight: 900, letterSpacing: "-0.02em", textTransform: "uppercase", color: "#1d1f20", margin: 0, fontFamily: "'Barlow Condensed', sans-serif" }}>
            STANDINGS
          </h1>
        </div>

        <div style={{ borderTop: "1px solid #e5e7eb", marginBottom: 32 }} />

        {standingsLoading && !standingsData ? (
          <Skeleton active paragraph={{ rows: 6 }} />
        ) : standings.length === 0 ? (
          <div style={{ padding: 48, textAlign: "center", color: "rgba(29,31,32,0.4)" }}>No standings yet — sessions will appear here once completed.</div>
        ) : (
          <>
            {/* Podium: 2nd | 1st | 3rd */}
            <div style={{ display: "flex", alignItems: "flex-end", gap: 0, marginBottom: 0 }}>
              {/* 2nd */}
              <div style={{ flex: 1, minWidth: 0, paddingRight: 1, borderRight: "1px solid #e5e7eb" }}>
                {p2 && (
                  <>
                    <div style={{ marginBottom: 12 }}>
                      <span style={{ fontSize: 28, fontWeight: 900, fontFamily: "'Barlow Condensed', sans-serif", color: MEDAL_COLOR[2] }}>2 </span>
                      <span style={{ fontSize: 18, fontWeight: 800, fontFamily: "'Barlow Condensed', sans-serif", color: "#1d1f20" }}>{displayName(p2)}</span>
                      <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: MEDAL_COLOR[2], marginLeft: 8 }}>SILVER</span>
                    </div>
                    <div style={{ background: "#fff0f5", border: "1px solid #fbb6ce", borderTop: `4px solid ${MEDAL_COLOR[2]}`, borderRadius: 6, padding: "20px 18px" }}>
                      <div style={{ fontSize: 42, fontWeight: 900, fontFamily: "'Barlow Condensed', sans-serif", color: "#e11d74", lineHeight: 1 }}>{winRateDisplay(p2.winRate)}</div>
                      <div style={{ fontSize: 13, color: "rgba(29,31,32,0.5)", marginTop: 8 }}>{p2.totalGames} games</div>
                    </div>
                  </>
                )}
              </div>

              {/* 1st */}
              <div style={{ flex: 1.2, minWidth: 0, padding: "0 1px", borderRight: "1px solid #e5e7eb" }}>
                {p1 && (
                  <>
                    <div style={{ marginBottom: 12 }}>
                      <span style={{ fontSize: 34, fontWeight: 900, fontFamily: "'Barlow Condensed', sans-serif", color: MEDAL_COLOR[1] }}>1 </span>
                      <span style={{ fontSize: 22, fontWeight: 800, fontFamily: "'Barlow Condensed', sans-serif", color: "#1d1f20" }}>{displayName(p1)}</span>
                      <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: MEDAL_COLOR[1], marginLeft: 8 }}>GOLD</span>
                    </div>
                    <div style={{ background: "#3d0a1e", borderTop: `4px solid ${MEDAL_COLOR[1]}`, borderRadius: 6, padding: "28px 22px" }}>
                      <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.14em", color: "rgba(255,255,255,0.45)", textTransform: "uppercase", marginBottom: 8 }}>CLUB LEADER</div>
                      <div style={{ fontSize: 56, fontWeight: 900, fontFamily: "'Barlow Condensed', sans-serif", color: "#fff", lineHeight: 1 }}>{winRateDisplay(p1.winRate)}</div>
                      <div style={{ fontSize: 13, color: "rgba(255,255,255,0.5)", marginTop: 8 }}>{p1.totalGames} games</div>
                    </div>
                  </>
                )}
              </div>

              {/* 3rd */}
              <div style={{ flex: 1, minWidth: 0, paddingLeft: 1 }}>
                {p3 && (
                  <>
                    <div style={{ marginBottom: 12 }}>
                      <span style={{ fontSize: 28, fontWeight: 900, fontFamily: "'Barlow Condensed', sans-serif", color: MEDAL_COLOR[3] }}>3 </span>
                      <span style={{ fontSize: 18, fontWeight: 800, fontFamily: "'Barlow Condensed', sans-serif", color: "#1d1f20" }}>{displayName(p3)}</span>
                      <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: MEDAL_COLOR[3], marginLeft: 8 }}>BRONZE</span>
                    </div>
                    <div style={{ background: "#fff0f5", border: "1px solid #fbb6ce", borderTop: `4px solid ${MEDAL_COLOR[3]}`, borderRadius: 6, padding: "20px 18px" }}>
                      <div style={{ fontSize: 42, fontWeight: 900, fontFamily: "'Barlow Condensed', sans-serif", color: "#e11d74", lineHeight: 1 }}>{winRateDisplay(p3.winRate)}</div>
                      <div style={{ fontSize: 13, color: "rgba(29,31,32,0.5)", marginTop: 8 }}>{p3.totalGames} games</div>
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Notes strip */}
            {notes && (
              <div style={{ display: "flex", borderTop: "1px solid #e5e7eb", borderBottom: "1px solid #e5e7eb", marginBottom: 36 }}>
                <div style={{ flex: 1, padding: "16px 20px", borderRight: "1px solid #e5e7eb" }}>
                  <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "rgba(29,31,32,0.4)", marginBottom: 4 }}>HOTTEST STREAK</div>
                  <div style={{ fontSize: 20, fontWeight: 800, fontFamily: "'Barlow Condensed', sans-serif", color: "#1d1f20" }}>
                    {(notes.hottestStreak.nickname || notes.hottestStreak.name).split(" ")[0].toUpperCase()} · <span style={{ color: "#e11d74" }}>W{notes.hottestStreak.longestWinStreak}</span>
                  </div>
                  <div style={{ fontSize: 12, color: "rgba(29,31,32,0.45)", marginTop: 2 }}>
                    {notes.hottestStreak.longestWinStreak} straight wins this club
                  </div>
                </div>
                <div style={{ flex: 1, padding: "16px 20px", borderRight: "1px solid #e5e7eb" }}>
                  <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "rgba(29,31,32,0.4)", marginBottom: 4 }}>MOST GAMES</div>
                  <div style={{ fontSize: 20, fontWeight: 800, fontFamily: "'Barlow Condensed', sans-serif", color: "#1d1f20" }}>
                    {(notes.mostGames.nickname || notes.mostGames.name).split(" ")[0].toUpperCase()} · <span style={{ color: "#e11d74" }}>{notes.mostGames.totalGames}</span>
                  </div>
                  <div style={{ fontSize: 12, color: "rgba(29,31,32,0.45)", marginTop: 2 }}>Never sits out a draw</div>
                </div>
                <div style={{ flex: 1, padding: "16px 20px" }}>
                  <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "rgba(29,31,32,0.4)", marginBottom: 4 }}>BIGGEST CLIMB</div>
                  <div style={{ fontSize: 20, fontWeight: 800, fontFamily: "'Barlow Condensed', sans-serif", color: "#1d1f20" }}>
                    <span style={{ color: "rgba(29,31,32,0.35)" }}>—</span>
                  </div>
                  <div style={{ fontSize: 12, color: "rgba(29,31,32,0.45)", marginTop: 2 }}>Cross-session tracking coming soon</div>
                </div>
              </div>
            )}

            {/* Table (rank 4+) */}
            {tableRows.length > 0 && (
              <div style={{ border: "1px solid #e5e7eb", borderRadius: 0, overflow: "hidden" }}>
                {/* Header */}
                <div style={{ display: "grid", gridTemplateColumns: GRID, borderBottom: "1px solid #e5e7eb", background: "#fafafa" }}>
                  {["RANK", "PLAYER", "GAMES", "WIN %", "SESSIONS"].map((h, i) => (
                    <div key={h} style={{
                      fontSize: 10, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase",
                      color: "rgba(29,31,32,0.4)", padding: "12px 16px", userSelect: "none",
                      textAlign: i >= 2 ? "right" : "left",
                    }}>{h}</div>
                  ))}
                </div>

                {pagedRows.map((row, idx) => (
                  <div key={`${row.name}-${row.rank}`} style={{
                    display: "grid", gridTemplateColumns: GRID,
                    borderBottom: idx < pagedRows.length - 1 ? "1px solid #f3f4f6" : "none",
                    alignItems: "center", minHeight: 52,
                    background: "#fff",
                  }}>
                    <div style={{ padding: "0 16px", fontSize: 15, fontWeight: 700, fontFamily: "'Barlow Condensed', sans-serif", color: "#e11d74" }}>{row.rank}</div>
                    <div style={{ padding: "0 16px", fontSize: 14, fontWeight: 500, color: "#1d1f20" }}>
                      {row.nickname
                        ? <>{row.nickname.split(" ")[0]}. {row.name.split(" ").pop()}</>
                        : <>{row.name.split(" ")[0]}. {row.name.split(" ").pop()}</>
                      }
                    </div>
                    <div style={{ padding: "0 16px", fontSize: 14, color: "rgba(29,31,32,0.65)", textAlign: "right" }}>{row.totalGames}</div>
                    <div style={{ padding: "0 16px", fontSize: 14, fontWeight: 600, color: "#1d1f20", textAlign: "right" }}>{winRateDisplay(row.winRate)}</div>
                    <div style={{ padding: "0 16px", fontSize: 13, color: "rgba(29,31,32,0.45)", textAlign: "right" }}>{row.sessionsPlayed}</div>
                  </div>
                ))}
              </div>
            )}

            {/* Pagination */}
            {totalPages > 1 && (
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 0" }}>
                <span style={{ fontSize: 12, color: "rgba(29,31,32,0.4)" }}>
                  Showing {(page - 1) * PAGE_SIZE + 4}–{Math.min(page * PAGE_SIZE + 3, standings.length)} of {standings.length} players
                </span>
                <div style={{ display: "flex", gap: 4 }}>
                  <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}
                    style={{ padding: "4px 12px", fontSize: 13, fontWeight: 600, border: "1px solid #e5e7eb", borderRadius: 4, background: "#fff", color: page === 1 ? "#ccc" : "#1d1f20", cursor: page === 1 ? "default" : "pointer" }}>‹</button>
                  {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                    <button key={p} onClick={() => setPage(p)} style={{
                      padding: "4px 12px", fontSize: 13, fontWeight: 600, border: "1px solid",
                      borderColor: p === page ? "#e11d74" : "#e5e7eb", borderRadius: 4,
                      background: p === page ? "#e11d74" : "#fff",
                      color: p === page ? "#fff" : "#1d1f20", cursor: "pointer",
                    }}>{p}</button>
                  ))}
                  <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages}
                    style={{ padding: "4px 12px", fontSize: 13, fontWeight: 600, border: "1px solid #e5e7eb", borderRadius: 4, background: "#fff", color: page === totalPages ? "#ccc" : "#1d1f20", cursor: page === totalPages ? "default" : "pointer" }}>›</button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

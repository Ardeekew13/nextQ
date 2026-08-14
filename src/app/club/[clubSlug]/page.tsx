"use client";

import { useParams } from "next/navigation";
import Link from "next/link";
import { useQuery } from "@apollo/client";
import { Skeleton, Result } from "antd";
import { PUBLIC_CLUB_QUERY } from "@/graphql/documents/public";

const STATUS_DOT: Record<string, string> = {
  ACTIVE: "#10b981",
  PAUSED: "#f59e0b",
  DRAFT: "#9ca3af",
  COMPLETED: "#6366f1",
  CANCELLED: "#ef4444",
};

export default function PublicClubPage() {
  const params = useParams<{ clubSlug: string }>();
  const { data, loading } = useQuery(PUBLIC_CLUB_QUERY, {
    variables: { slug: params.clubSlug },
    pollInterval: 15000,
  });

  if (loading && !data) {
    return (
      <div style={{ maxWidth: 800, margin: "0 auto", padding: "40px 16px" }}>
        <Skeleton active paragraph={{ rows: 6 }} />
      </div>
    );
  }

  const club = data?.publicClub;
  if (!club) {
    return <Result status="404" title="Club not found" subTitle="Check the link and try again." />;
  }

  return (
    <>
      <style>{`
        @media (max-width: 640px) {
          .club-nav {
            padding: 0 16px !important;
            gap: 12px !important;
          }
          .club-nav-brand {
            font-size: 12px !important;
          }
          .club-nav-links {
            gap: 12px !important;
            font-size: 12px !important;
          }
          .club-heading {
            font-size: 24px !important;
          }
        }
      `}</style>
      <div style={{ minHeight: "100vh", background: "#fff", fontFamily: "'Inter', system-ui, sans-serif" }}>
        {/* Navbar */}
        <nav className="club-nav" style={{ borderBottom: "1px solid #e5e7eb", padding: "0 32px", height: 56, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ width: 32, height: 32, borderRadius: 6, background: "#e11d74", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <span style={{ color: "#fff", fontWeight: 900, fontSize: 14 }}>N</span>
            </div>
            <span className="club-nav-brand" style={{ fontSize: 13, fontWeight: 700, color: "#1d1f20" }}>{club.name}</span>
          </div>
          <div className="club-nav-links" style={{ display: "flex", gap: 28, fontSize: 14, color: "rgba(29,31,32,0.6)" }}>
            <span style={{ color: "#e11d74", fontWeight: 600 }}>Sessions</span>
            <Link href={`/club/${club.slug}/standings`} style={{ color: "inherit", textDecoration: "none" }}>Standings</Link>
          </div>
        </nav>

      <div style={{ maxWidth: 800, margin: "0 auto", padding: "40px 24px" }}>
        {/* Club header */}
        <div style={{ marginBottom: 32 }}>
          {club.location && (
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "rgba(29,31,32,0.4)", marginBottom: 6 }}>{club.location}</div>
          )}
          <h1 style={{ fontSize: 36, fontWeight: 900, letterSpacing: "-0.01em", color: "#1d1f20", margin: 0 }}>{club.name}</h1>
          {club.description && <p style={{ fontSize: 14, color: "rgba(29,31,32,0.55)", marginTop: 8 }}>{club.description}</p>}
        </div>

        <div style={{ borderTop: "1px solid #e5e7eb", marginBottom: 32 }} />

        {/* Active sessions */}
        {club.activeSessions.length > 0 && (
          <div style={{ marginBottom: 36 }}>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "rgba(29,31,32,0.4)", marginBottom: 14 }}>ACTIVE SESSIONS</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {club.activeSessions.map((session: any) => (
                <Link key={session.id} href={`/club/${club.slug}/session/${session.slug}`} style={{ textDecoration: "none" }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 18px", border: "1px solid #e5e7eb", borderRadius: 8, background: "#fff", cursor: "pointer" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <div style={{ width: 8, height: 8, borderRadius: "50%", background: STATUS_DOT[session.status] ?? "#9ca3af", flexShrink: 0 }} />
                      <span style={{ fontSize: 15, fontWeight: 600, color: "#1d1f20" }}>{session.name}</span>
                    </div>
                    <div style={{ fontSize: 13, color: "rgba(29,31,32,0.4)" }}>
                      {new Date(session.sessionDate).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* Completed sessions */}
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "rgba(29,31,32,0.4)", marginBottom: 14 }}>RECENT SESSIONS</div>
          {club.recentCompletedSessions.length === 0 ? (
            <div style={{ fontSize: 14, color: "rgba(29,31,32,0.4)", padding: "16px 0" }}>No completed sessions yet.</div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {club.recentCompletedSessions.map((session: any) => (
                <Link key={session.id} href={`/club/${club.slug}/session/${session.slug}`} style={{ textDecoration: "none" }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 18px", border: "1px solid #e5e7eb", borderRadius: 8, background: "#fff", cursor: "pointer" }}>
                    <span style={{ fontSize: 15, fontWeight: 500, color: "#1d1f20" }}>{session.name}</span>
                    <span style={{ fontSize: 13, color: "rgba(29,31,32,0.4)" }}>
                      {new Date(session.sessionDate).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
      </div>
    </>
  );
}


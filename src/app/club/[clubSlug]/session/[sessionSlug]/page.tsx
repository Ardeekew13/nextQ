"use client";

import { useParams } from "next/navigation";
import { useQuery } from "@apollo/client";
import {
  Row, Col, Card, Tag, Typography, Skeleton, Result,
  Avatar, Space, List,
} from "antd";
import {
  TeamOutlined, TrophyFilled, ThunderboltFilled,
  ClockCircleOutlined, CalendarOutlined, FieldTimeOutlined,
} from "@ant-design/icons";
import { PUBLIC_SESSION_QUERY } from "@/graphql/documents/public";
import { Podium } from "@/components/Podium";
import { StandingsTable } from "@/components/StandingsTable";
import { GameLog } from "@/components/GameLog";

const { Title, Text } = Typography;

const STATUS_META: Record<string, { color: string; label: string }> = {
  DRAFT:     { color: "default", label: "Draft" },
  ACTIVE:    { color: "green",   label: "Live" },
  PAUSED:    { color: "orange",  label: "Paused" },
  COMPLETED: { color: "blue",    label: "Final" },
  CANCELLED: { color: "red",     label: "Cancelled" },
};

const STAT_CARDS = [
  { key: "courts",    label: "Courts",             icon: <FieldTimeOutlined   style={{ color: "#ec4899", fontSize: 20 }} /> },
  { key: "checkedIn", label: "Players checked in", icon: <TeamOutlined        style={{ color: "#6366f1", fontSize: 20 }} /> },
  { key: "games",     label: "Games played",       icon: <ThunderboltFilled   style={{ color: "#f59e0b", fontSize: 20 }} /> },
  { key: "queue",     label: "Waiting",            icon: <ClockCircleOutlined style={{ color: "#10b981", fontSize: 20 }} /> },
];

export default function PublicSessionPage() {
  const params = useParams<{ clubSlug: string; sessionSlug: string }>();
  const { data, loading } = useQuery(PUBLIC_SESSION_QUERY, {
    variables: { clubSlug: params.clubSlug, sessionSlug: params.sessionSlug },
    pollInterval: 8000,
  });

  if (loading && !data) {
    return (
      <div style={{ maxWidth: 960, margin: "40px auto", padding: "0 16px" }}>
        <Skeleton active paragraph={{ rows: 8 }} />
      </div>
    );
  }

  const session = data?.publicSession;
  if (!session) {
    return <Result status="404" title="Session not found" subTitle="This session may not be published yet." />;
  }

  const isFinal = session.status === "COMPLETED";
  const isLive  = session.status === "ACTIVE";
  const meta    = STATUS_META[session.status] ?? { color: "default", label: session.status };

  const statsValues: Record<string, number> = {
    courts:    session.courts.length,
    checkedIn: session.checkedInPlayerCount,
    games:     session.completedGames.length,
    queue:     session.queuedPlayers.length,
  };

  return (
    <main style={{ maxWidth: 960, margin: "0 auto", padding: "0 0 48px" }}>

      {/* ── Hero banner ── */}
      <div
        style={{
          background: "linear-gradient(135deg, #1e1b4b 0%, #312e81 50%, #4c1d95 100%)",
          padding: "32px 24px 28px",
          borderRadius: "0 0 24px 24px",
          color: "#fff",
          marginBottom: 28,
        }}
      >
        <Space align="center" size={12} style={{ marginBottom: 16 }}>
          <Avatar
            size={44}
            src={session.club.logoUrl}
            icon={<TeamOutlined />}
            style={{ background: "rgba(255,255,255,0.15)", border: "2px solid rgba(255,255,255,0.3)" }}
          />
          <Text style={{ color: "rgba(255,255,255,0.75)", fontSize: 14, fontWeight: 500 }}>
            {session.club.name}
          </Text>
        </Space>

        <Title level={2} style={{ margin: "0 0 10px", color: "#fff", lineHeight: 1.2 }}>
          {session.name}
        </Title>

        <Space wrap size={8}>
          <Tag
            style={{
              fontWeight: 700,
              fontSize: 13,
              padding: "3px 12px",
              borderRadius: 20,
              border: "none",
              background: isFinal ? "#3b82f6" : isLive ? "#10b981" : "#6b7280",
              color: "#fff",
            }}
          >
            {isLive && <span style={{ marginRight: 4 }}>●</span>}
            {meta.label}
          </Tag>

          <Space size={4}>
            <CalendarOutlined style={{ color: "rgba(255,255,255,0.6)" }} />
            <Text style={{ color: "rgba(255,255,255,0.75)", fontSize: 13 }}>
              {new Date(session.sessionDate).toLocaleDateString("en-US", {
                weekday: "short", year: "numeric", month: "short", day: "numeric",
              })}
            </Text>
          </Space>

          {session.startTime && (
            <Space size={4}>
              <ClockCircleOutlined style={{ color: "rgba(255,255,255,0.6)" }} />
              <Text style={{ color: "rgba(255,255,255,0.75)", fontSize: 13 }}>
                {session.startTime}{session.endTime ? ` – ${session.endTime}` : ""}
              </Text>
            </Space>
          )}
        </Space>
      </div>

      <div style={{ padding: "0 16px" }}>

        {/* ── Stat cards ── */}
        <Row gutter={[12, 12]} style={{ marginBottom: 32 }}>
          {STAT_CARDS.map(({ key, label, icon }) => (
            <Col xs={12} sm={6} key={key}>
              <Card
                size="small"
                style={{ borderRadius: 12, boxShadow: "0 1px 6px rgba(0,0,0,0.07)", border: "1px solid #f0f0f0" }}
                styles={{ body: { padding: "14px 16px" } }}
              >
                <Space align="center" size={10}>
                  {icon}
                  <div>
                    <div style={{ fontSize: 22, fontWeight: 700, lineHeight: 1.1, color: "#111" }}>
                      {statsValues[key]}
                    </div>
                    <Text type="secondary" style={{ fontSize: 12 }}>{label}</Text>
                  </div>
                </Space>
              </Card>
            </Col>
          ))}
        </Row>

        {/* ── Podium ── */}
        {isFinal && session.podium.length > 0 && (
          <section style={{ marginBottom: 36 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
              <TrophyFilled style={{ color: "#d4af37", fontSize: 20 }} />
              <Title level={4} style={{ margin: 0 }}>Final Podium</Title>
            </div>
            <Podium entries={session.podium} />
          </section>
        )}

        {/* ── Standings ── */}
        <section style={{ marginBottom: 32 }}>
          <Title level={4} style={{ marginBottom: 12 }}>
            {isFinal ? "Final standings" : "Live standings"}
          </Title>
          <StandingsTable standings={session.standings} />
        </section>

        {/* ── Courts (live/paused only) ── */}
        {!isFinal && (
          <section style={{ marginBottom: 32 }}>
            <Title level={4} style={{ marginBottom: 12 }}>Courts</Title>
            <Row gutter={[12, 12]}>
              {session.courts.map((court: any) => (
                <Col xs={24} sm={12} key={court.id}>
                  <Card
                    title={<Text strong style={{ fontSize: 13 }}>{court.name || `Court ${court.courtNumber}`}</Text>}
                    size="small"
                    style={{ borderRadius: 12, border: "1px solid #f0f0f0" }}
                  >
                    {court.currentGame ? (
                      <div style={{ textAlign: "center", padding: "4px 0" }}>
                        <Text strong style={{ fontSize: 14 }}>
                          {court.currentGame.teamA.players.map((p: any) => p.name).join(" & ")}
                        </Text>
                        <div style={{ color: "#9ca3af", fontSize: 12, margin: "4px 0" }}>vs</div>
                        <Text strong style={{ fontSize: 14 }}>
                          {court.currentGame.teamB.players.map((p: any) => p.name).join(" & ")}
                        </Text>
                      </div>
                    ) : (
                      <Text type="secondary" style={{ display: "block", textAlign: "center", padding: "8px 0" }}>
                        No game in progress
                      </Text>
                    )}
                  </Card>
                </Col>
              ))}
            </Row>
          </section>
        )}

        {/* ── Queue (live/paused only) ── */}
        {!isFinal && session.queuedPlayers.length > 0 && (
          <section style={{ marginBottom: 32 }}>
            <Title level={4} style={{ marginBottom: 12 }}>Waiting to play</Title>
            <Card style={{ borderRadius: 12, border: "1px solid #f0f0f0" }}>
              <List
                dataSource={session.queuedPlayers}
                locale={{ emptyText: "No one is waiting right now." }}
                renderItem={(player: any, i: number) => (
                  <List.Item style={{ padding: "8px 0" }}>
                    <Space>
                      <Text type="secondary" style={{ width: 24, textAlign: "right" }}>{i + 1}.</Text>
                      <Text>{player.name}</Text>
                    </Space>
                  </List.Item>
                )}
              />
            </Card>
          </section>
        )}

        {/* ── Game log ── */}
        {session.completedGames.length > 0 && (
          <section>
            <Title level={4} style={{ marginBottom: 12 }}>Game log</Title>
            <GameLog games={session.completedGames} />
          </section>
        )}

      </div>
    </main>
  );
}

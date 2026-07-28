"use client";

import { useParams } from "next/navigation";
import { useQuery } from "@apollo/client";
import { Row, Col, Card, Statistic, Tag, Typography, Skeleton, Result, Avatar, Space, List, Badge } from "antd";
import { TeamOutlined, CheckCircleFilled } from "@ant-design/icons";
import { PUBLIC_SESSION_QUERY } from "@/graphql/documents/public";
import { Podium } from "@/components/Podium";
import { StandingsTable } from "@/components/StandingsTable";
import { GameLog } from "@/components/GameLog";

const { Title, Text } = Typography;

const STATUS_COLORS: Record<string, string> = {
  DRAFT: "default",
  ACTIVE: "green",
  PAUSED: "orange",
  COMPLETED: "blue",
  CANCELLED: "red",
};

export default function PublicSessionPage() {
  const params = useParams<{ clubSlug: string; sessionSlug: string }>();
  const { data, loading } = useQuery(PUBLIC_SESSION_QUERY, {
    variables: { clubSlug: params.clubSlug, sessionSlug: params.sessionSlug },
    pollInterval: 8000,
  });

  if (loading && !data) return <Skeleton active style={{ maxWidth: 960, margin: "40px auto" }} />;

  const session = data?.publicSession;
  if (!session) {
    return <Result status="404" title="Session not found" subTitle="This session may not be published yet." />;
  }

  const isFinal = session.status === "COMPLETED";

  return (
    <main style={{ maxWidth: 960, margin: "0 auto", padding: "24px 16px" }}>
      <Space align="center" size="middle">
        <Avatar size={48} src={session.club.logoUrl} icon={<TeamOutlined />} />
        <div>
          <Text type="secondary">{session.club.name}</Text>
          <Title level={2} style={{ margin: 0 }}>
            {session.name}
          </Title>
        </div>
      </Space>

      <Space wrap style={{ marginTop: 8 }}>
        <Tag color={STATUS_COLORS[session.status]} style={{ fontSize: 14, padding: "4px 10px" }}>
          {session.status}
        </Tag>
        {isFinal && (
          <Badge
            count={
              <span>
                <CheckCircleFilled style={{ marginRight: 4 }} /> Final results
              </span>
            }
            style={{ backgroundColor: "#1677ff", padding: "2px 10px" }}
          />
        )}
        <Text type="secondary">{new Date(session.sessionDate).toLocaleDateString()}</Text>
        {session.startTime && (
          <Text type="secondary">
            {session.startTime}
            {session.endTime ? ` - ${session.endTime}` : ""}
          </Text>
        )}
      </Space>

      <Row gutter={[16, 16]} style={{ marginTop: 24 }}>
        <Col xs={12} sm={6}>
          <Card>
            <Statistic title="Courts" value={session.courts.length} />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card>
            <Statistic title="Checked in" value={session.checkedInPlayerCount} />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card>
            <Statistic title="Games completed" value={session.completedGames.length} />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card>
            <Statistic title="Waiting" value={session.queuedPlayers.length} />
          </Card>
        </Col>
      </Row>

      {session.podium.length > 0 && (
        <>
          <Title level={4} style={{ marginTop: 32 }}>
            Top 3
          </Title>
          <Podium entries={session.podium} />
        </>
      )}

      <Title level={4} style={{ marginTop: 32 }}>
        Current games
      </Title>
      <Row gutter={[16, 16]}>
        {session.courts.map((court: any) => (
          <Col xs={24} sm={12} key={court.id}>
            <Card title={court.name || `Court ${court.courtNumber}`} size="small">
              {court.currentGame ? (
                <Space direction="vertical" size={0}>
                  <Text strong>{court.currentGame.teamA.players.map((p: any) => p.name).join(" & ")}</Text>
                  <Text type="secondary">vs</Text>
                  <Text strong>{court.currentGame.teamB.players.map((p: any) => p.name).join(" & ")}</Text>
                </Space>
              ) : (
                <Text type="secondary">No game in progress</Text>
              )}
            </Card>
          </Col>
        ))}
      </Row>

      <Title level={4} style={{ marginTop: 32 }}>
        Waiting to play
      </Title>
      <Card>
        <List
          dataSource={session.queuedPlayers}
          locale={{ emptyText: "No one is waiting right now." }}
          renderItem={(player: any) => <List.Item>{player.name}</List.Item>}
        />
      </Card>

      <Title level={4} style={{ marginTop: 32 }}>
        Live standings
      </Title>
      <StandingsTable standings={session.standings} />

      <Title level={4} style={{ marginTop: 32 }}>
        Game log
      </Title>
      <GameLog games={session.completedGames} />
    </main>
  );
}

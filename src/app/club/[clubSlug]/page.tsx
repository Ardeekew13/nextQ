"use client";

import { useParams } from "next/navigation";
import Link from "next/link";
import { useQuery } from "@apollo/client";
import { Card, List, Typography, Tag, Skeleton, Result, Avatar, Space } from "antd";
import { TeamOutlined } from "@ant-design/icons";
import { PUBLIC_CLUB_QUERY } from "@/graphql/documents/public";

const { Title, Text, Paragraph } = Typography;

const STATUS_COLORS: Record<string, string> = {
  DRAFT: "default",
  ACTIVE: "green",
  PAUSED: "orange",
  COMPLETED: "blue",
  CANCELLED: "red",
};

export default function PublicClubPage() {
  const params = useParams<{ clubSlug: string }>();
  const { data, loading } = useQuery(PUBLIC_CLUB_QUERY, {
    variables: { slug: params.clubSlug },
    pollInterval: 15000,
  });

  if (loading && !data) return <Skeleton active style={{ maxWidth: 720, margin: "40px auto" }} />;

  const club = data?.publicClub;
  if (!club) {
    return <Result status="404" title="Club not found" subTitle="Check the link and try again." />;
  }

  return (
    <main style={{ maxWidth: 720, margin: "0 auto", padding: "40px 16px" }}>
      <Space align="center" size="large">
        <Avatar size={64} src={club.logoUrl} icon={<TeamOutlined />} />
        <div>
          <Title level={2} style={{ margin: 0 }}>
            {club.name}
          </Title>
          <Text type="secondary">{club.location}</Text>
        </div>
      </Space>
      {club.description && <Paragraph style={{ marginTop: 16 }}>{club.description}</Paragraph>}

      <Title level={4} style={{ marginTop: 32 }}>
        Active sessions
      </Title>
      <List
        dataSource={club.activeSessions}
        locale={{ emptyText: "No active sessions right now." }}
        renderItem={(session: any) => (
          <List.Item>
            <Card style={{ width: "100%" }}>
              <Space style={{ width: "100%", justifyContent: "space-between" }}>
                <Link href={`/club/${club.slug}/session/${session.slug}`}>{session.name}</Link>
                <Tag color={STATUS_COLORS[session.status]}>{session.status}</Tag>
              </Space>
            </Card>
          </List.Item>
        )}
      />

      <Title level={4} style={{ marginTop: 32 }}>
        Recently completed sessions
      </Title>
      <List
        dataSource={club.recentCompletedSessions}
        locale={{ emptyText: "No completed sessions yet." }}
        renderItem={(session: any) => (
          <List.Item>
            <Card style={{ width: "100%" }}>
              <Space style={{ width: "100%", justifyContent: "space-between" }}>
                <Link href={`/club/${club.slug}/session/${session.slug}`}>{session.name}</Link>
                <Text type="secondary">{new Date(session.sessionDate).toLocaleDateString()}</Text>
              </Space>
            </Card>
          </List.Item>
        )}
      />
    </main>
  );
}

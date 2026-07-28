"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery, useMutation } from "@apollo/client";
import { Button, Card, Col, Row, Typography, Tag, Empty, Skeleton, Modal, Form, Input, App } from "antd";
import { PlusOutlined, TeamOutlined, ThunderboltOutlined, FileOutlined, CheckCircleOutlined } from "@ant-design/icons";
import { DASHBOARD_QUERY, CREATE_CLUB } from "@/graphql/documents/organiser";
import { StatTile } from "@/components/StatTile";
import { humanizeStatus } from "@/lib/format";

const { Title, Text } = Typography;

const STATUS_COLORS: Record<string, string> = {
  DRAFT: "default",
  ACTIVE: "green",
  PAUSED: "orange",
  COMPLETED: "blue",
  CANCELLED: "red",
};

export default function DashboardPage() {
  const { data, loading, refetch } = useQuery(DASHBOARD_QUERY);
  const { message } = App.useApp();
  const router = useRouter();
  const [createClubOpen, setCreateClubOpen] = useState(false);
  const [createClub, { loading: creating }] = useMutation(CREATE_CLUB);
  const [form] = Form.useForm();

  async function handleCreateClub(values: { name: string; location?: string }) {
    try {
      await createClub({ variables: { input: values } });
      message.success("Club created");
      setCreateClubOpen(false);
      form.resetFields();
      refetch();
    } catch (error) {
      message.error(error instanceof Error ? error.message : "Could not create club");
    }
  }

  if (loading) return <Skeleton active />;

  const clubs = data?.myClubs ?? [];
  const allSessions = clubs.flatMap((club: any) => club.sessions ?? []);
  const activeCount = allSessions.filter((s: any) => s.status === "ACTIVE" || s.status === "PAUSED").length;
  const draftCount = allSessions.filter((s: any) => s.status === "DRAFT").length;
  const completedCount = allSessions.filter((s: any) => s.status === "COMPLETED").length;

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, flexWrap: "wrap", gap: 8 }}>
        <Title level={4} style={{ margin: 0 }}>
          Dashboard
        </Title>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreateClubOpen(true)}>
          Create club
        </Button>
      </div>

      <Row gutter={[12, 12]} style={{ marginBottom: 4 }}>
        <Col xs={12} sm={12} lg={6}>
          <StatTile icon={<TeamOutlined />} label="Clubs" value={clubs.length} suffix="total" />
        </Col>
        <Col xs={12} sm={12} lg={6}>
          <StatTile
            icon={<ThunderboltOutlined />}
            iconColor="#c2410c"
            iconBg="#fff7ed"
            label="Active sessions"
            value={activeCount}
            suffix="live"
          />
        </Col>
        <Col xs={12} sm={12} lg={6}>
          <StatTile
            icon={<FileOutlined />}
            iconColor="#0369a1"
            iconBg="#f0f9ff"
            label="Drafts"
            value={draftCount}
            suffix="pending"
          />
        </Col>
        <Col xs={12} sm={12} lg={6}>
          <StatTile
            icon={<CheckCircleOutlined />}
            iconColor="#15803d"
            iconBg="#f0fdf4"
            label="Completed"
            value={completedCount}
            suffix="sessions"
          />
        </Col>
      </Row>

      {clubs.length === 0 && (
        <Card style={{ marginTop: 16 }}>
          <Empty description="No clubs yet. Create your first club to start a session.">
            <Button type="primary" onClick={() => setCreateClubOpen(true)}>
              Create club
            </Button>
          </Empty>
        </Card>
      )}

      <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
        {clubs.map((club: any) => {
          const sessions = club.sessions ?? [];
          const active = sessions.filter((s: any) => s.status === "ACTIVE" || s.status === "PAUSED");
          const drafts = sessions.filter((s: any) => s.status === "DRAFT");
          const completed = sessions.filter((s: any) => s.status === "COMPLETED").slice(0, 3);

          return (
            <Col xs={24} sm={24} lg={8} key={club.id}>
                <Card
                  title={club.name}
                  onClick={() => router.push(`/dashboard/clubs/${club.id}`)}
                  style={{ cursor: "pointer" }}
                  styles={{
                    header: {
                      backgroundColor: "#ec4899",
                      borderRadius: "8px 8px 0 0",
                    },
                    title: {
                      color: "white",
                      margin: 0,
                    },
                  }}
                >
                  {sessions.length === 0 && <Text type="secondary">No sessions yet.</Text>}

                  {[...active, ...drafts, ...completed].map((session: any) => (
                    <div
                      key={session.id}
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        padding: "10px 0",
                        borderBottom: "1px solid #f8e1ec",
                      }}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <Link href={`/dashboard/sessions/${session.id}`}>{session.name}</Link>
                      <Tag color={STATUS_COLORS[session.status]}>{humanizeStatus(session.status)}</Tag>
                    </div>
                  ))}
                </Card>
            </Col>
          );
        })}
      </Row>

      <Modal
        title="Create club"
        open={createClubOpen}
        onCancel={() => setCreateClubOpen(false)}
        onOk={() => form.submit()}
        confirmLoading={creating}
      >
        <Form form={form} layout="vertical" onFinish={handleCreateClub} requiredMark={false}>
          <Form.Item label="Club name" name="name" rules={[{ required: true, message: "Enter a club name" }]}>
            <Input size="large" />
          </Form.Item>
          <Form.Item label="Location" name="location">
            <Input size="large" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}

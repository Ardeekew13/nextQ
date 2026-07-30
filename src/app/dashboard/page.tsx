"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useMutation } from "@apollo/client";
import { Button, Card, Modal, Form, Input, App, Skeleton, Typography, Tag, Space, Divider } from "antd";
import { DASHBOARD_QUERY, CREATE_CLUB, JOIN_CLUB } from "@/graphql/documents/organiser";
import { DashboardHeader } from "@/components/Dashboard/DashboardHeader";
import { humanizeStatus } from "@/lib/format";

const { Text } = Typography;

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
  const [joinClubOpen, setJoinClubOpen] = useState(false);
  const [createClub, { loading: creating }] = useMutation(CREATE_CLUB);
  const [joinClub, { loading: joining }] = useMutation(JOIN_CLUB);
  const [form] = Form.useForm();
  const [joinForm] = Form.useForm();

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

  async function handleJoinClub(values: { joinCode: string }) {
    try {
      await joinClub({ variables: { joinCode: values.joinCode.trim().toUpperCase() } });
      message.success("Joined club!");
      setJoinClubOpen(false);
      joinForm.resetFields();
      refetch();
    } catch (error) {
      message.error(error instanceof Error ? error.message : "Invalid join code");
    }
  }

  if (loading) return <Skeleton active />;

  const clubs = data?.myClubs ?? [];
  const allSessions = clubs.flatMap((club: any) => club.sessions ?? []);
  const liveCount = allSessions.filter((s: any) => s.status === "ACTIVE" || s.status === "PAUSED").length;
  const completedCount = allSessions.filter((s: any) => s.status === "COMPLETED").length;
  const draftCount = allSessions.filter((s: any) => s.status === "DRAFT").length;

  return (
    <div>
      <DashboardHeader
        userName="Ron Derick"
        onJoinClub={() => setJoinClubOpen(true)}
        onCreateClub={() => setCreateClubOpen(true)}
        onNewSession={() => clubs.length > 0 && router.push(`/dashboard/clubs/${clubs[0].id}/sessions/new`)}
      />

      {/* Stats Row */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(4, 1fr)",
          gap: 12,
          marginBottom: 26,
          border: "1px solid rgba(138,39,72,0.24)",
          background: "#ffffff",
        }}
      >
        <div style={{ padding: "20px", textAlign: "center", borderRight: "1px solid rgba(29,31,32,0.08)" }}>
          <div style={{ fontSize: 28, fontWeight: 600, fontFamily: "'Barlow Condensed', sans-serif", textTransform: "uppercase", color: "#1d1f20", marginBottom: 4 }}>
            {clubs.length}
          </div>
          <Text style={{ fontSize: 11, fontWeight: 600, color: "rgba(29,31,32,0.5)", letterSpacing: "0.2em", textTransform: "uppercase" }}>
            CLUBS
          </Text>
        </div>
        <div style={{ padding: "20px", textAlign: "center", borderRight: "1px solid rgba(29,31,32,0.08)" }}>
          <div style={{ fontSize: 28, fontWeight: 600, fontFamily: "'Barlow Condensed', sans-serif", textTransform: "uppercase", color: "#1d1f20", marginBottom: 4 }}>
            {liveCount === 0 ? "None" : liveCount}
          </div>
          <Text style={{ fontSize: 11, fontWeight: 600, color: "rgba(29,31,32,0.5)", letterSpacing: "0.2em", textTransform: "uppercase" }}>
            LIVE NOW
          </Text>
        </div>
        <div style={{ padding: "20px", textAlign: "center", borderRight: "1px solid rgba(29,31,32,0.08)" }}>
          <div style={{ fontSize: 28, fontWeight: 600, fontFamily: "'Barlow Condensed', sans-serif", textTransform: "uppercase", color: "#1d1f20", marginBottom: 4 }}>
            {completedCount}
          </div>
          <Text style={{ fontSize: 11, fontWeight: 600, color: "rgba(29,31,32,0.5)", letterSpacing: "0.2em", textTransform: "uppercase" }}>
            COMPLETED
          </Text>
        </div>
        <div style={{ padding: "20px", textAlign: "center", background: "#fff1f5" }}>
          <div style={{ fontSize: 28, fontWeight: 600, fontFamily: "'Barlow Condensed', sans-serif", textTransform: "uppercase", color: "#8d1a3f", marginBottom: 4 }}>
            {draftCount}
          </div>
          <Text style={{ fontSize: 11, fontWeight: 600, color: "#8d1a3f", letterSpacing: "0.2em", textTransform: "uppercase" }}>
            DRAFTS
          </Text>
        </div>
      </div>

      {/* Your Clubs Section */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
          <Text
            style={{
              fontSize: 11,
              fontWeight: 600,
              color: "rgba(29,31,32,0.5)",
              letterSpacing: "0.2em",
              textTransform: "uppercase",
            }}
          >
            YOUR CLUBS
          </Text>
          <div style={{ flex: 1, height: "1px", background: "rgba(138,39,72,0.24)" }} />
          {clubs.length > 0 && (
            <Text
              style={{
                fontSize: 11,
                fontWeight: 600,
                color: "rgba(29,31,32,0.5)",
                letterSpacing: "0.2em",
                textTransform: "uppercase",
              }}
            >
              {clubs.length} CLUBS
            </Text>
          )}
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {clubs.map((club: any) => (
            <Card
              key={club.id}
              style={{ border: "1px solid rgba(138,39,72,0.24)", background: "#ffffff" }}
              styles={{ body: { padding: "16px" } }}
            >
              {/* Club Header */}
              <div style={{ display: "flex", alignItems: "flex-start", gap: 12, marginBottom: 12 }}>
                <div
                  style={{
                    width: 48,
                    height: 48,
                    background: "#f43f75",
                    borderRadius: 0,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "#ffffff",
                    fontWeight: 700,
                    fontSize: 18,
                    fontFamily: "'Barlow Condensed', sans-serif",
                    flexShrink: 0,
                  }}
                >
                  {club.name.substring(0, 2).toUpperCase()}
                </div>
                <div style={{ flex: 1 }}>
                  <div
                    style={{
                      fontSize: 16,
                      fontWeight: 600,
                      fontFamily: "'Barlow Condensed', sans-serif",
                      textTransform: "uppercase",
                      color: "#1d1f20",
                      marginBottom: 2,
                    }}
                  >
                    {club.name}
                  </div>
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    {club.location || "No location set"} · {club.sessions?.length ?? 0} sessions
                  </Text>
                </div>
              </div>

              {/* Sessions List */}
              {(club.sessions ?? []).length === 0 ? (
                <div style={{ padding: "12px 0" }}>
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    No sessions yet. Add courts and a roster, then schedule the first open play.
                  </Text>
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 12 }}>
                  {(club.sessions ?? []).map((session: any, idx: number) => (
                    <div
                      key={session.id}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        paddingBottom: idx < (club.sessions?.length ?? 0) - 1 ? 8 : 0,
                        borderBottom: idx < (club.sessions?.length ?? 0) - 1 ? "1px solid rgba(138,39,72,0.14)" : "none",
                      }}
                    >
                      <div>
                        <Text
                          style={{
                            fontSize: 13,
                            fontWeight: 600,
                            fontFamily: "'Barlow Condensed', sans-serif",
                            textTransform: "uppercase",
                            color: "#1d1f20",
                            display: "block",
                          }}
                        >
                          {session.name}
                        </Text>
                        <Text type="secondary" style={{ fontSize: 12 }}>
                          {session.sessionDate ? new Date(session.sessionDate).toLocaleDateString() : "No date set"} · {session.courts || "0"} courts · {session.queueMode || "queue mode not set"}
                        </Text>
                      </div>
                      <Tag color={STATUS_COLORS[session.status]} style={{ margin: 0 }}>
                        {humanizeStatus(session.status)}
                      </Tag>
                    </div>
                  ))}
                </div>
              )}

              {/* Actions */}
              <Divider style={{ margin: "12px 0" }} />
              <Space>
                <Button size="small" onClick={() => router.push(`/dashboard/sessions/${club.id}/standings`)}>
                  Standings
                </Button>
                <Button size="small" onClick={() => router.push(`/dashboard/clubs/${club.id}`)}>
                  Manage
                </Button>
                {draftCount > 0 && (
                  <Button type="primary" size="small" onClick={() => router.push(`/dashboard/clubs/${club.id}/sessions/${(club.sessions ?? []).find((s: any) => s.status === "DRAFT")?.id}/edit`)}>
                    Finish setup
                  </Button>
                )}
              </Space>
            </Card>
          ))}
        </div>

        {clubs.length === 0 && (
          <Card style={{ border: "1px solid rgba(138,39,72,0.24)", background: "#ffffff", textAlign: "center" }}>
            <Text type="secondary" style={{ display: "block", marginBottom: 12 }}>
              No sessions yet. Add courts and a roster, then schedule the first open play.
            </Text>
            <Button type="primary" onClick={() => setCreateClubOpen(true)}>
              Create first session
            </Button>
          </Card>
        )}
      </div>

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

      <Modal
        title="Join a club"
        open={joinClubOpen}
        onCancel={() => {
          setJoinClubOpen(false);
          joinForm.resetFields();
        }}
        onOk={() => joinForm.submit()}
        okText="Join club"
        confirmLoading={joining}
      >
        <p style={{ color: "#6b7280", marginBottom: 16 }}>
          Ask the club owner for their 6-character join code, then enter it below.
        </p>
        <Form form={joinForm} layout="vertical" onFinish={handleJoinClub} requiredMark={false}>
          <Form.Item
            label="Join code"
            name="joinCode"
            rules={[
              { required: true, message: "Enter the join code" },
              { len: 6, message: "Join code must be 6 characters" },
            ]}
          >
            <Input
              size="large"
              placeholder="ABC123"
              maxLength={6}
              style={{
                textTransform: "uppercase",
                letterSpacing: "0.2em",
                fontWeight: 700,
              }}
            />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}

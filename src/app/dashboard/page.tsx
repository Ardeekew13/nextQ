"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useMutation } from "@apollo/client";
import { Col, Row, Modal, Form, Input, App, Skeleton } from "antd";
import { DASHBOARD_QUERY, CREATE_CLUB, JOIN_CLUB } from "@/graphql/documents/organiser";
import { DashboardHeader } from "@/components/Dashboard/DashboardHeader";
import { UpNextHeroBand } from "@/components/Dashboard/UpNextHeroBand";
import { StatStrip } from "@/components/Dashboard/StatStrip";
import { SessionsSection } from "@/components/Dashboard/SessionsSection";
import { ClubLeaders } from "@/components/Dashboard/ClubLeaders";
import { RecentActivity } from "@/components/Dashboard/RecentActivity";

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
  const firstClub = clubs[0];
  const allSessions = clubs.flatMap((club: any) => club.sessions ?? []);
  const upNextSession = allSessions.find((s: any) => s.status === "DRAFT") || allSessions[0];

  return (
    <div>
      <DashboardHeader
        userName="Ron Derick"
        onJoinClub={() => setJoinClubOpen(true)}
        onCreateClub={() => setCreateClubOpen(true)}
        onNewSession={() => router.push(`/dashboard/clubs/${firstClub?.id}/sessions/new`)}
      />

      <UpNextHeroBand
        sessionName={upNextSession?.name}
        startsInMinutes={48}
        rsvpCount={18}
        checkedInCount={0}
        status={upNextSession?.status}
        onOpenQueue={() => upNextSession && router.push(`/dashboard/sessions/${upNextSession.id}`)}
        onEditSetup={() => upNextSession && router.push(`/dashboard/sessions/${upNextSession.id}`)}
      />

      <StatStrip sessionsRun={14} gamesLogged={312} avgTurnout={17} needsAttention={1} />

      <Row gutter={26}>
        <Col xs={24} lg={14}>
          <SessionsSection
            sessions={allSessions.map((s: any) => ({
              id: s.id,
              name: s.name,
              sessionDate: s.sessionDate,
              status: s.status,
              courts: 2,
              players: 8,
              games: 3,
            }))}
            onViewAll={() => router.push("/dashboard/clubs")}
          />
        </Col>

        <Col xs={24} lg={10}>
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <ClubLeaders
              leaders={[
                { id: "1", name: "M. Santos", wins: 14, losses: 3 },
                { id: "2", name: "L. Yap", wins: 12, losses: 5 },
                { id: "3", name: "J. Lim", wins: 11, losses: 7 },
                { id: "4", name: "R. Cruz", wins: 10, losses: 8 },
                { id: "5", name: "A. Garcia", wins: 9, losses: 10 },
              ]}
            />
            <RecentActivity
              activities={[
                { id: "1", time: "14:22", event: "Wednesday session completed" },
                { id: "2", time: "13:45", event: "New player registered: Ana Garcia" },
                { id: "3", time: "12:30", event: "Friday Open Play moved to 19:00" },
                { id: "4", time: "11:15", event: "Join code regenerated for BPC" },
              ]}
            />
          </div>
        </Col>
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

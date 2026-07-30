"use client";

import React from "react";
import { Table, Button, Tag, Segmented, Typography, Space } from "antd";
import Link from "next/link";

const { Text } = Typography;

interface Session {
  id: string;
  name: string;
  sessionDate: string;
  status: "DRAFT" | "ACTIVE" | "PAUSED" | "COMPLETED" | "CANCELLED";
  courts?: number;
  players?: number;
  games?: number;
  publicUrl?: string;
}

interface SessionsSectionProps {
  sessions?: Session[];
  onViewAll?: () => void;
}

const STATUS_COLORS: Record<string, string> = {
  DRAFT: "default",
  ACTIVE: "green",
  PAUSED: "orange",
  COMPLETED: "blue",
  CANCELLED: "red",
};

export function SessionsSection({ sessions = [], onViewAll }: SessionsSectionProps) {
  const [filter, setFilter] = React.useState<"all" | "drafts" | "done">("all");

  const filtered = sessions.filter((s) => {
    if (filter === "drafts") return s.status === "DRAFT";
    if (filter === "done") return s.status === "COMPLETED";
    return true;
  });

  const columns = [
    {
      title: "Session",
      dataIndex: "name",
      key: "name",
      render: (name: string, record: Session) => (
        <Link href={`/dashboard/sessions/${record.id}`} style={{ color: "#bd2153" }}>
          {name}
        </Link>
      ),
    },
    {
      title: "Date",
      dataIndex: "sessionDate",
      key: "sessionDate",
      render: (date: string) => new Date(date).toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }),
    },
    {
      title: "Courts",
      dataIndex: "courts",
      key: "courts",
      width: 80,
    },
    {
      title: "Players",
      dataIndex: "players",
      key: "players",
      width: 80,
    },
    {
      title: "Games",
      dataIndex: "games",
      key: "games",
      width: 80,
    },
    {
      title: "Status",
      dataIndex: "status",
      key: "status",
      render: (status: string) => <Tag color={STATUS_COLORS[status]}>{status}</Tag>,
    },
  ];

  return (
    <div style={{ flex: 1, minWidth: 0 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flex: 1 }}>
          <Text
            style={{
              fontSize: 11,
              fontWeight: 600,
              color: "rgba(29,31,32,0.5)",
              letterSpacing: "0.2em",
              textTransform: "uppercase",
            }}
          >
            BPC SESSIONS
          </Text>
          <div style={{ flex: 1, height: "1px", background: "rgba(138,39,72,0.24)" }} />
        </div>
      </div>

      <div style={{ marginBottom: 16, display: "flex", justifyContent: "flex-end" }}>
        <Segmented
          value={filter}
          onChange={(val) => setFilter(val as "all" | "drafts" | "done")}
          options={[
            { label: "All", value: "all" },
            { label: "Drafts", value: "drafts" },
            { label: "Done", value: "done" },
          ]}
        />
      </div>

      <Table
        dataSource={filtered}
        columns={columns}
        pagination={false}
        size="small"
        rowKey="id"
        style={{ background: "#ffffff", border: "1px solid rgba(138,39,72,0.24)" }}
      />

      {sessions.length > 0 && (
        <div style={{ marginTop: 12 }}>
          <Button type="link" onClick={onViewAll} style={{ color: "#bd2153", padding: 0 }}>
            View all {sessions.length} sessions →
          </Button>
        </div>
      )}
    </div>
  );
}

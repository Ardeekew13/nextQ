"use client";

import React from "react";
import { Button, Space, Typography } from "antd";
import { PlusOutlined } from "@ant-design/icons";

const { Text } = Typography;

interface DashboardHeaderProps {
  userName: string;
  onJoinClub?: () => void;
  onCreateClub?: () => void;
  onNewSession?: () => void;
}

export function DashboardHeader({
  userName,
  onJoinClub,
  onCreateClub,
  onNewSession,
}: DashboardHeaderProps) {
  const now = new Date();
  const timeStr = now.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });

  return (
    <div style={{ marginBottom: 26, display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
      <div>
        <Text
          style={{
            fontSize: 11,
            fontWeight: 600,
            color: "#bd2153",
            letterSpacing: "0.2em",
            textTransform: "uppercase",
            display: "block",
            marginBottom: 4,
          }}
        >
          {timeStr}
        </Text>
        <h1
          style={{
            fontSize: 40,
            lineHeight: "0.95",
            margin: 0,
            fontFamily: "'Barlow Condensed', sans-serif",
            fontWeight: 600,
            textTransform: "uppercase",
            letterSpacing: "0.03em",
            color: "#1d1f20",
          }}
        >
          Good evening, {userName.split(" ")[0]}
        </h1>
      </div>

      <Space>
        <Button onClick={onJoinClub} style={{ color: "#8d1a3f" }}>
          Join club
        </Button>
        <Button onClick={onCreateClub}>Create club</Button>
        <Button type="primary" icon={<PlusOutlined />} onClick={onNewSession}>
          New session
        </Button>
      </Space>
    </div>
  );
}

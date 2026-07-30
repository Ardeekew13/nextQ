"use client";

import React from "react";
import { Card, Typography, Space } from "antd";

const { Text } = Typography;

interface Activity {
  id: string;
  time: string;
  event: string;
}

interface RecentActivityProps {
  activities?: Activity[];
}

export function RecentActivity({ activities = [] }: RecentActivityProps) {
  return (
    <Card
      style={{
        border: "1px solid rgba(138,39,72,0.24)",
        background: "#ffffff",
        height: "100%",
      }}
      styles={{
        body: {
          padding: "20px",
        },
      }}
    >
      <div style={{ marginBottom: 16 }}>
        <Text
          style={{
            fontSize: 11,
            fontWeight: 600,
            color: "rgba(29,31,32,0.5)",
            letterSpacing: "0.2em",
            textTransform: "uppercase",
            display: "block",
          }}
        >
          RECENT ACTIVITY
        </Text>
      </div>

      <Space direction="vertical" style={{ width: "100%" }} size={12}>
        {activities.length === 0 ? (
          <Text type="secondary" style={{ fontSize: 13 }}>
            No recent activity
          </Text>
        ) : (
          activities.map((activity, idx) => (
            <div
              key={activity.id}
              style={{
                display: "flex",
                gap: 12,
                padding: "8px 0",
                borderBottom: idx < activities.length - 1 ? "1px solid rgba(138,39,72,0.14)" : "none",
              }}
            >
              <Text
                style={{
                  fontSize: 11,
                  fontWeight: 600,
                  color: "#bd2153",
                  flexShrink: 0,
                }}
              >
                {activity.time}
              </Text>
              <Text
                style={{
                  fontSize: 12,
                  color: "rgba(29,31,32,0.7)",
                }}
              >
                {activity.event}
              </Text>
            </div>
          ))
        )}
      </Space>
    </Card>
  );
}

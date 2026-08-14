"use client";

import React from "react";
import { Card, Typography, Space } from "antd";

const { Text } = Typography;

interface Leader {
  id: string;
  name: string;
  wins: number;
  losses: number;
}

interface ClubLeadersProps {
  leaders?: Leader[];
}

export function ClubLeaders({ leaders = [] }: ClubLeadersProps) {
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
          CLUB LEADERS
        </Text>
      </div>

      <Space direction="vertical" style={{ width: "100%" }} size={12}>
        {leaders.length === 0 ? (
          <Text type="secondary" style={{ fontSize: 13 }}>
            No players yet
          </Text>
        ) : (
          leaders.slice(0, 5).map((leader, idx) => (
            <div
              key={leader.id}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "8px 0",
                borderBottom: idx < Math.min(5, leaders.length) - 1 ? "1px solid rgba(138,39,72,0.14)" : "none",
              }}
            >
              <div style={{ flex: 1 }}>
                <Text
                  style={{
                    fontSize: 13,
                    fontWeight: 600,
                    color: "#bd2153",
                    display: "block",
                    marginBottom: 2,
                  }}
                >
                  {(idx + 1).toString().padStart(2, "0")}
                </Text>
                <Text
                  style={{
                    fontSize: 14,
                    fontWeight: 600,
                    fontFamily: "'Barlow Condensed', sans-serif",
                    textTransform: "uppercase",
                    color: "#1d1f20",
                    display: "block",
                  }}
                >
                  {leader.name}
                </Text>
              </div>
              <Text
                style={{
                  fontSize: 11.5,
                  color: "rgba(29,31,32,0.62)",
                }}
              >
                {leader.wins}–{leader.losses}
              </Text>
            </div>
          ))
        )}
      </Space>
    </Card>
  );
}

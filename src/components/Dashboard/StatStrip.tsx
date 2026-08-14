"use client";

import React from "react";
import { Typography } from "antd";

const { Text } = Typography;

interface StatStripProps {
  sessionsRun?: number;
  gamesLogged?: number;
  avgTurnout?: number;
  needsAttention?: number;
}

export function StatStrip({
  sessionsRun = 14,
  gamesLogged = 312,
  avgTurnout = 17,
  needsAttention = 1,
}: StatStripProps) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(4, 1fr)",
        border: "1px solid rgba(138,39,72,0.24)",
        marginBottom: 26,
        background: "#ffffff",
      }}
    >
      {/* Sessions run */}
      <div
        style={{
          padding: "20px 26px",
          textAlign: "center",
          borderRight: "1px solid rgba(29,31,32,0.08)",
        }}
      >
        <div
          style={{
            fontSize: 34,
            fontWeight: 600,
            fontFamily: "'Barlow Condensed', sans-serif",
            textTransform: "uppercase",
            color: "#1d1f20",
            marginBottom: 4,
          }}
        >
          {sessionsRun}
        </div>
        <Text
          style={{
            fontSize: 11,
            fontWeight: 600,
            color: "rgba(29,31,32,0.5)",
            letterSpacing: "0.2em",
            textTransform: "uppercase",
          }}
        >
          Sessions run
        </Text>
      </div>

      {/* Games logged */}
      <div
        style={{
          padding: "20px 26px",
          textAlign: "center",
          borderRight: "1px solid rgba(29,31,32,0.08)",
        }}
      >
        <div
          style={{
            fontSize: 34,
            fontWeight: 600,
            fontFamily: "'Barlow Condensed', sans-serif",
            textTransform: "uppercase",
            color: "#1d1f20",
            marginBottom: 4,
          }}
        >
          {gamesLogged}
        </div>
        <Text
          style={{
            fontSize: 11,
            fontWeight: 600,
            color: "rgba(29,31,32,0.5)",
            letterSpacing: "0.2em",
            textTransform: "uppercase",
          }}
        >
          Games logged
        </Text>
      </div>

      {/* Avg turnout */}
      <div
        style={{
          padding: "20px 26px",
          textAlign: "center",
          borderRight: "1px solid rgba(29,31,32,0.08)",
        }}
      >
        <div
          style={{
            fontSize: 34,
            fontWeight: 600,
            fontFamily: "'Barlow Condensed', sans-serif",
            textTransform: "uppercase",
            color: "#1d1f20",
            marginBottom: 4,
          }}
        >
          {avgTurnout}
        </div>
        <Text
          style={{
            fontSize: 11,
            fontWeight: 600,
            color: "rgba(29,31,32,0.5)",
            letterSpacing: "0.2em",
            textTransform: "uppercase",
          }}
        >
          Avg turnout
        </Text>
      </div>

      {/* Needs attention */}
      <div
        style={{
          padding: "20px 26px",
          textAlign: "center",
          background: "#fff1f5",
        }}
      >
        <div
          style={{
            fontSize: 34,
            fontWeight: 600,
            fontFamily: "'Barlow Condensed', sans-serif",
            textTransform: "uppercase",
            color: "#8d1a3f",
            marginBottom: 4,
          }}
        >
          {needsAttention}
        </div>
        <Text
          style={{
            fontSize: 11,
            fontWeight: 600,
            color: "#8d1a3f",
            letterSpacing: "0.2em",
            textTransform: "uppercase",
          }}
        >
          Needs attention
        </Text>
      </div>
    </div>
  );
}

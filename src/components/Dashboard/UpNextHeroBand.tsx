"use client";

import React from "react";
import { Button, Space, Divider } from "antd";
import { Text } from "antd/es/typography";

interface UpNextHeroBandProps {
  sessionName?: string;
  startsInMinutes?: number;
  rsvpCount?: number;
  checkedInCount?: number;
  status?: string;
  onOpenQueue?: () => void;
  onEditSetup?: () => void;
}

export function UpNextHeroBand({
  sessionName = "No session scheduled",
  startsInMinutes = 0,
  rsvpCount = 0,
  checkedInCount = 0,
  status = "DRAFT",
  onOpenQueue,
  onEditSetup,
}: UpNextHeroBandProps) {
  return (
    <div
      style={{
        background: "#5c1029",
        color: "#ffffff",
        padding: "22px 26px",
        marginBottom: 26,
        display: "grid",
        gridTemplateColumns: "1fr auto 1fr",
        gap: 26,
        alignItems: "center",
      }}
    >
      {/* Left: Session info */}
      <div>
        <Text
          style={{
            fontSize: 12,
            fontWeight: 600,
            color: "#ffb9cd",
            letterSpacing: "0.2em",
            textTransform: "uppercase",
            display: "block",
            marginBottom: 8,
          }}
        >
          UP NEXT · STARTS IN {startsInMinutes} MIN
        </Text>
        <h2
          style={{
            fontSize: 32,
            lineHeight: 1,
            margin: "0 0 8px 0",
            fontFamily: "'Barlow Condensed', sans-serif",
            fontWeight: 600,
            textTransform: "uppercase",
            letterSpacing: "0.03em",
            color: "#ffffff",
          }}
        >
          {sessionName}
        </h2>
        <Text
          style={{
            fontSize: "12.5px",
            color: "rgba(255,255,255,0.72)",
            lineHeight: 1.4,
          }}
        >
          Bataan Pickleball Club · 2 Courts · Open Play
        </Text>
      </div>

      {/* Middle: Stats */}
      <div
        style={{
          display: "flex",
          gap: 28,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <div style={{ textAlign: "center" }}>
          <div
            style={{
              fontSize: 30,
              fontWeight: 600,
              fontFamily: "'Barlow Condensed', sans-serif",
              textTransform: "uppercase",
              color: "#ffffff",
              marginBottom: 2,
            }}
          >
            {rsvpCount}
          </div>
          <Text
            style={{
              fontSize: 10,
              color: "#ffb9cd",
              fontWeight: 600,
              letterSpacing: "0.2em",
              textTransform: "uppercase",
            }}
          >
            RSVP'D
          </Text>
        </div>

        <Divider
          type="vertical"
          style={{
            borderColor: "rgba(255,255,255,0.22)",
            height: 60,
            margin: 0,
          }}
        />

        <div style={{ textAlign: "center" }}>
          <div
            style={{
              fontSize: 30,
              fontWeight: 600,
              fontFamily: "'Barlow Condensed', sans-serif",
              textTransform: "uppercase",
              color: "#ffffff",
              marginBottom: 2,
            }}
          >
            {checkedInCount}
          </div>
          <Text
            style={{
              fontSize: 10,
              color: "#ffb9cd",
              fontWeight: 600,
              letterSpacing: "0.2em",
              textTransform: "uppercase",
            }}
          >
            CHECKED IN
          </Text>
        </div>

        <Divider
          type="vertical"
          style={{
            borderColor: "rgba(255,255,255,0.22)",
            height: 60,
            margin: 0,
          }}
        />

        <div style={{ textAlign: "center" }}>
          <div
            style={{
              fontSize: 30,
              fontWeight: 600,
              fontFamily: "'Barlow Condensed', sans-serif",
              textTransform: "uppercase",
              color: "#ffffff",
              marginBottom: 2,
            }}
          >
            {status}
          </div>
          <Text
            style={{
              fontSize: 10,
              color: "#ffb9cd",
              fontWeight: 600,
              letterSpacing: "0.2em",
              textTransform: "uppercase",
            }}
          >
            STATUS
          </Text>
        </div>
      </div>

      {/* Right: Actions */}
      <div style={{ display: "flex", gap: 12, justifyContent: "flex-end" }}>
        <Button
          type="primary"
          onClick={onOpenQueue}
          style={{
            height: 44,
            fontSize: 15,
            fontWeight: 600,
          }}
        >
          Open the queue
        </Button>
        <Button
          style={{
            height: 36,
            fontSize: 13,
            fontWeight: 600,
            color: "#ffffff",
            borderColor: "rgba(255,255,255,0.3)",
            background: "transparent",
          }}
          onClick={onEditSetup}
        >
          Edit setup
        </Button>
      </div>
    </div>
  );
}

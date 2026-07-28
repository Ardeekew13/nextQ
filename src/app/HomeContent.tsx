"use client";

import Link from "next/link";
import { Button, Typography, Space } from "antd";
import { BURGUNDY } from "@/theme/themeConfig";

const { Title, Paragraph } = Typography;

export default function HomeContent() {
  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#f5f5f5",
      }}
    >
      <main style={{ maxWidth: 640, margin: "0 auto", padding: "80px 24px", textAlign: "center" }}>
        <Title style={{ color: BURGUNDY.primary, fontWeight: 800 }}>NextQ</Title>
        <Paragraph type="secondary" style={{ fontSize: 18 }}>
          Random-partner, random-opponent queueing for pickleball open play. Run fair, fast
          courtside sessions and share live results with anyone via a public link.
        </Paragraph>
        <Space size="middle">
          <Link href="/register">
            <Button type="primary" size="large">
              Create organiser account
            </Button>
          </Link>
          <Link href="/login">
            <Button size="large">Log in</Button>
          </Link>
        </Space>
      </main>
    </div>
  );
}

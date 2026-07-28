"use client";

import Link from "next/link";
import { Button, Typography } from "antd";
import {
  TrophyFilled,
  ThunderboltFilled,
  TeamOutlined,
  ShareAltOutlined,
} from "@ant-design/icons";
import { AppLogo } from "@/components/AppLogo";

const { Title, Paragraph, Text } = Typography;

const FEATURES = [
  {
    icon: <TeamOutlined style={{ fontSize: 24, color: "#ec4899" }} />,
    title: "Random matchmaking",
    desc: "Fair partner & opponent rotation so everyone plays with everyone.",
  },
  {
    icon: <ThunderboltFilled style={{ fontSize: 24, color: "#f59e0b" }} />,
    title: "Instant court queuing",
    desc: "Games auto-fill courts as soon as a slot opens. No clipboard needed.",
  },
  {
    icon: <TrophyFilled style={{ fontSize: 24, color: "#d4af37" }} />,
    title: "Live standings",
    desc: "Win/loss rankings update in real time throughout the session.",
  },
  {
    icon: <ShareAltOutlined style={{ fontSize: 24, color: "#6366f1" }} />,
    title: "Shareable results",
    desc: "One public link lets players follow results on their own phone.",
  },
];

export default function HomeContent() {
  return (
    <div style={{ minHeight: "100vh", background: "#f8f8fb", fontFamily: "inherit" }}>

      {/* ── Navbar ── */}
      <header style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "0 24px", height: 60,
        background: "#fff", borderBottom: "1px solid #f0f0f0",
        position: "sticky", top: 0, zIndex: 100,
      }}>
        <AppLogo size="sm" />
        <div style={{ display: "flex", gap: 8 }}>
          <Link href="/login">
            <Button size="small">Log in</Button>
          </Link>
          <Link href="/register">
            <Button size="small" type="primary"
              style={{ background: "#ec4899", borderColor: "#ec4899" }}>
              Sign up free
            </Button>
          </Link>
        </div>
      </header>

      {/* ── Hero ── */}
      <section style={{
        background: "linear-gradient(135deg, #1e1b4b 0%, #312e81 55%, #4c1d95 100%)",
        padding: "80px 24px 72px",
        textAlign: "center",
        color: "#fff",
      }}>
        <div style={{
          display: "inline-block",
          background: "rgba(236,72,153,0.18)",
          border: "1px solid rgba(236,72,153,0.35)",
          borderRadius: 999,
          padding: "4px 16px",
          fontSize: 13,
          fontWeight: 600,
          color: "#f9a8d4",
          marginBottom: 20,
          letterSpacing: "0.4px",
        }}>
          🏓 Built for pickleball open play
        </div>

        <Title style={{
          color: "#fff", fontWeight: 900, fontSize: "clamp(36px, 6vw, 60px)",
          margin: "0 0 16px", lineHeight: 1.1,
        }}>
          Run your session.<br />
          <span style={{ color: "#f472b6" }}>Not your clipboard.</span>
        </Title>

        <Paragraph style={{
          color: "rgba(255,255,255,0.75)", fontSize: 18,
          maxWidth: 520, margin: "0 auto 36px", lineHeight: 1.6,
        }}>
          NextQ handles fair matchmaking, court queuing, live standings and
          shareable results — so you can just play.
        </Paragraph>

        <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
          <Link href="/register">
            <Button
              type="primary" size="large"
              style={{
                background: "#ec4899", borderColor: "#ec4899",
                height: 48, padding: "0 32px", fontSize: 16, fontWeight: 700,
                borderRadius: 999,
              }}
            >
              Get started free
            </Button>
          </Link>
          <Link href="/login">
            <Button
              size="large"
              style={{
                height: 48, padding: "0 28px", fontSize: 16,
                borderRadius: 999, borderColor: "rgba(255,255,255,0.35)",
                background: "rgba(255,255,255,0.08)", color: "#fff",
              }}
            >
              Log in
            </Button>
          </Link>
        </div>
      </section>

      {/* ── Features ── */}
      <section style={{ maxWidth: 900, margin: "0 auto", padding: "64px 24px" }}>
        <Title level={2} style={{ textAlign: "center", marginBottom: 8, fontWeight: 800 }}>
          Everything you need courtside
        </Title>
        <Paragraph type="secondary" style={{ textAlign: "center", fontSize: 16, marginBottom: 48 }}>
          No spreadsheets. No arguments. Just fair games.
        </Paragraph>

        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
          gap: 20,
        }}>
          {FEATURES.map((f) => (
            <div key={f.title} style={{
              background: "#fff",
              border: "1px solid #f0f0f0",
              borderRadius: 16,
              padding: "24px 20px",
              boxShadow: "0 1px 8px rgba(0,0,0,0.05)",
            }}>
              <div style={{ marginBottom: 12 }}>{f.icon}</div>
              <Text strong style={{ fontSize: 15, display: "block", marginBottom: 6 }}>{f.title}</Text>
              <Text type="secondary" style={{ fontSize: 14, lineHeight: 1.5 }}>{f.desc}</Text>
            </div>
          ))}
        </div>
      </section>

      {/* ── CTA strip ── */}
      <section style={{
        background: "linear-gradient(90deg, #ec4899 0%, #a855f7 100%)",
        padding: "48px 24px",
        textAlign: "center",
      }}>
        <Title level={3} style={{ color: "#fff", margin: "0 0 8px", fontWeight: 800 }}>
          Ready to run your next open play?
        </Title>
        <Paragraph style={{ color: "rgba(255,255,255,0.85)", marginBottom: 24, fontSize: 16 }}>
          Free to use. No credit card required.
        </Paragraph>
        <Link href="/register">
          <Button
            size="large"
            style={{
              height: 48, padding: "0 36px", fontSize: 16, fontWeight: 700,
              borderRadius: 999, background: "#fff", borderColor: "#fff", color: "#ec4899",
            }}
          >
            Create your organiser account
          </Button>
        </Link>
      </section>

      {/* ── Footer ── */}
      <footer style={{
        textAlign: "center", padding: "24px 16px",
        borderTop: "1px solid #f0f0f0",
      }}>
        <Text type="secondary" style={{ fontSize: 13 }}>
          © <span suppressHydrationWarning>{new Date().getFullYear()}</span> NextQ · Built for pickleball open play
        </Text>
      </footer>

    </div>
  );
}

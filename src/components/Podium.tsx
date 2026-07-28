"use client";

import { Typography } from "antd";
import { TrophyFilled } from "@ant-design/icons";

const { Text, Title } = Typography;

export interface PodiumEntryView {
  position: number;
  rank: number;
  wins: number;
  losses: number;
  gamesPlayed: number;
  winRate: number;
  player: { id: string; name: string; nickname?: string | null };
}

const MEDAL_COLORS: Record<number, string> = {
  1: "#d4af37",
  2: "#9ca3af",
  3: "#b06a3d",
};

const MEDAL_EMOJI: Record<number, string> = {
  1: "🥇",
  2: "🥈",
  3: "🥉",
};

// Taller platform bar for 1st, shorter for 2nd and 3rd
const PLATFORM_HEIGHT: Record<number, number> = { 1: 56, 2: 36, 3: 24 };

function PodiumCard({ entry }: { entry: PodiumEntryView }) {
  const color = MEDAL_COLORS[entry.position] ?? "#6b7280";
  const emoji = MEDAL_EMOJI[entry.position] ?? `#${entry.rank}`;

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        flex: "1 1 0",
        minWidth: 0,
        maxWidth: 200,
      }}
    >
      {/* Card */}
      <div
        style={{
          width: "100%",
          background: "#fff",
          border: `1px solid #e5e7eb`,
          borderTop: `4px solid ${color}`,
          borderRadius: 14,
          padding: "16px 10px 12px",
          textAlign: "center",
          boxShadow: entry.position === 1 ? "0 4px 20px rgba(212,175,55,0.18)" : "0 1px 4px rgba(0,0,0,0.06)",
        }}
      >
        {/* Medal */}
        <div style={{ fontSize: entry.position === 1 ? 38 : 30, lineHeight: 1, marginBottom: 6 }}>
          {emoji}
        </div>

        {/* Name */}
        <Title
          level={5}
          style={{ margin: "0 0 2px", fontSize: entry.position === 1 ? 16 : 14, color: "#111" }}
          ellipsis={{ tooltip: true }}
        >
          {entry.player.nickname || entry.player.name}
        </Title>

        {/* W-L */}
        <Text strong style={{ fontSize: 15, color }}>
          {entry.wins}W – {entry.losses}L
        </Text>

        {/* Stats row */}
        <div style={{ marginTop: 6, display: "flex", flexDirection: "column", gap: 1 }}>
          <Text type="secondary" style={{ fontSize: 12 }}>
            {entry.gamesPlayed} games
          </Text>
          <Text type="secondary" style={{ fontSize: 12 }}>
            {entry.winRate.toFixed(0)}% win rate
          </Text>
        </div>
      </div>

      {/* Platform bar */}
      <div
        style={{
          width: "80%",
          height: PLATFORM_HEIGHT[entry.position] ?? 16,
          background: color,
          borderRadius: "0 0 8px 8px",
          opacity: 0.85,
        }}
      />
    </div>
  );
}

export function Podium({ entries }: { entries: PodiumEntryView[] }) {
  if (entries.length === 0) return null;

  const get = (pos: number) => entries.filter((e) => e.position === pos);

  // Desktop: 2nd | 1st | 3rd  — aligned to bottom so platforms look right
  // Mobile: stacked 1st, 2nd, 3rd top-down
  return (
    <>
      {/* Mobile / narrow: vertical stack */}
      <div
        className="podium-mobile"
        style={{ flexDirection: "column", gap: 12 }}
      >
        {[1, 2, 3].flatMap((pos) =>
          get(pos).map((entry) => <PodiumCard key={entry.player.id} entry={entry} />)
        )}
      </div>

      {/* Tablet / desktop: side-by-side aligned to bottom */}
      <div
        className="podium-desktop"
        style={{
          alignItems: "flex-end",
          justifyContent: "center",
          gap: 12,
        }}
      >
        {[2, 1, 3].flatMap((pos) =>
          get(pos).map((entry) => <PodiumCard key={entry.player.id} entry={entry} />)
        )}
      </div>
    </>
  );
}

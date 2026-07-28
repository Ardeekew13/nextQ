"use client";

import { Table, Tag, Card } from "antd";

export interface StandingRowView {
  rank: number;
  gamesPlayed: number;
  wins: number;
  losses: number;
  winRate: number;
  currentStreak: number;
  longestWinStreak: number;
  gamesSatOut: number;
  player: { id: string; name: string; nickname?: string | null };
}

export function StandingsTable({ standings, loading }: { standings: StandingRowView[]; loading?: boolean }) {
  return (
    <Card styles={{ body: { padding: 0 } }}>
    <Table
      rowKey={(row) => row.player.id}
      dataSource={standings}
      loading={loading}
      pagination={false}
      scroll={{ x: true }}
      columns={[
        { title: "Rank", dataIndex: "rank", width: 70, render: (rank: number) => <Tag>{rank}</Tag> },
        {
          title: "Player",
          dataIndex: ["player", "name"],
          render: (_: unknown, row) => row.player.nickname || row.player.name,
        },
        { title: "GP", dataIndex: "gamesPlayed", width: 60 },
        { title: "W", dataIndex: "wins", width: 60 },
        { title: "L", dataIndex: "losses", width: 60 },
        { title: "Win %", dataIndex: "winRate", width: 80, render: (v: number) => `${v.toFixed(0)}%` },
        {
          title: "Streak",
          dataIndex: "currentStreak",
          width: 90,
          render: (v: number) => (v === 0 ? "-" : v > 0 ? `W${v}` : `L${Math.abs(v)}`),
        },
      ]}
    />
    </Card>
  );
}

"use client";

import { useMemo, useState, type ReactNode } from "react";
import { Table, Select, Input, Space, Tag, Card } from "antd";
import { humanizeStatus } from "@/lib/format";

export interface GameLogPlayer {
  id: string;
  name: string;
}

export interface GameLogView {
  id: string;
  gameNumber: number;
  winningTeam?: string | null;
  status: string;
  completedAt?: string | null;
  court?: { id: string; courtNumber: number; name?: string | null } | null;
  teamA: { players: GameLogPlayer[] };
  teamB: { players: GameLogPlayer[] };
}

const STATUS_COLORS: Record<string, string> = {
  QUEUED: "default",
  IN_PROGRESS: "processing",
  COMPLETED: "success",
  CANCELLED: "error",
};

function teamLabel(players: GameLogPlayer[]) {
  return players.map((p) => p.name).join(" & ");
}

export function GameLog({
  games,
  renderActions,
}: {
  games: GameLogView[];
  renderActions?: (game: GameLogView) => ReactNode;
}) {
  const [courtFilter, setCourtFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [playerSearch, setPlayerSearch] = useState("");

  const courtOptions = useMemo(() => {
    const seen = new Map<string, string>();
    for (const game of games) {
      if (game.court) seen.set(game.court.id, game.court.name || `Court ${game.court.courtNumber}`);
    }
    return Array.from(seen.entries()).map(([id, label]) => ({ value: id, label }));
  }, [games]);

  const filtered = games.filter((game) => {
    if (courtFilter !== "all" && game.court?.id !== courtFilter) return false;
    if (statusFilter !== "all" && game.status !== statusFilter) return false;
    if (playerSearch.trim()) {
      const query = playerSearch.trim().toLowerCase();
      const names = [...game.teamA.players, ...game.teamB.players].map((p) => p.name.toLowerCase());
      if (!names.some((name) => name.includes(query))) return false;
    }
    return true;
  });

  return (
    <div>
      <Space wrap style={{ marginBottom: 12 }}>
        <Select
          value={courtFilter}
          onChange={setCourtFilter}
          style={{ width: 160 }}
          options={[{ value: "all", label: "All courts" }, ...courtOptions]}
        />
        <Select
          value={statusFilter}
          onChange={setStatusFilter}
          style={{ width: 160 }}
          options={[
            { value: "all", label: "All statuses" },
            { value: "COMPLETED", label: "Completed games" },
            { value: "CANCELLED", label: "Cancelled games" },
            { value: "IN_PROGRESS", label: "In progress" },
            { value: "QUEUED", label: "Queued" },
          ]}
        />
        <Input.Search
          placeholder="Search by player name"
          allowClear
          value={playerSearch}
          onChange={(e) => setPlayerSearch(e.target.value)}
          style={{ width: 220 }}
        />
      </Space>

      <Card styles={{ body: { padding: 0 } }}>
      <Table
        rowKey="id"
        dataSource={filtered}
        pagination={{ pageSize: 15 }}
        scroll={{ x: true }}
        columns={[
          { title: "#", dataIndex: "gameNumber", width: 60 },
          {
            title: "Court",
            render: (_: unknown, game) => (game.court ? game.court.name || `Court ${game.court.courtNumber}` : "-"),
          },
          { title: "Team A", render: (_: unknown, game) => teamLabel(game.teamA.players) },
          { title: "Team B", render: (_: unknown, game) => teamLabel(game.teamB.players) },
          {
            title: "Winner",
            render: (_: unknown, game) =>
              game.winningTeam ? (game.winningTeam === "A" ? teamLabel(game.teamA.players) : teamLabel(game.teamB.players)) : "-",
          },
          {
            title: "Status",
            dataIndex: "status",
            render: (status: string) => <Tag color={STATUS_COLORS[status]}>{humanizeStatus(status)}</Tag>,
          },
          {
            title: "Completed",
            dataIndex: "completedAt",
            render: (value: string | null) => (value ? new Date(value).toLocaleTimeString() : "-"),
          },
          ...(renderActions
            ? [{ title: "Actions", key: "actions", render: (_: unknown, game: GameLogView) => renderActions(game) }]
            : []),
        ]}
      />
      </Card>
    </div>
  );
}

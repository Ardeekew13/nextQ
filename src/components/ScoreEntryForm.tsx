"use client";

import { useState, useEffect } from "react";
import { Modal, Button, Typography } from "antd";

const { Text, Title } = Typography;

export interface ScoreEntryTeams {
  teamA: { players: { id: string; name: string }[] };
  teamB: { players: { id: string; name: string }[] };
}

export interface ScoreEntryValues {
  winningTeam: "A" | "B";
  notes?: string;
}

export type GameLogView = ScoreEntryTeams & {
  id: string;
  status: string;
};

function teamLabel(team: ScoreEntryTeams["teamA"]) {
  return team.players.map((p) => p.name).join(" & ");
}

export function ScoreEntryForm({
  open,
  game,
  loading,
  onCancel,
  onSubmit,
}: {
  open: boolean;
  game: ScoreEntryTeams | null;
  loading?: boolean;
  onCancel: () => void;
  onSubmit: (values: ScoreEntryValues) => void;
}) {
  const [winner, setWinner] = useState<"A" | "B" | null>(null);

  useEffect(() => {
    if (open) setWinner(null);
  }, [open]);

  if (!game) return null;

  function handleConfirm() {
    if (!winner) return;
    onSubmit({ winningTeam: winner });
  }

  const teamAName = teamLabel(game.teamA);
  const teamBName = teamLabel(game.teamB);

  return (
    <Modal
      title={
        <div>
          <Title level={4} style={{ margin: 0 }}>Record match result</Title>
          <Text type="secondary" style={{ fontWeight: 400, fontSize: 14 }}>Which team won?</Text>
        </div>
      }
      open={open}
      onCancel={onCancel}
      footer={
        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
          <Button onClick={onCancel} style={{ borderRadius: 10, height: 48, padding: "0 24px" }}>Cancel</Button>
          <Button
            type="primary"
            disabled={!winner}
            loading={loading}
            onClick={handleConfirm}
            style={{ borderRadius: 10, height: 48, padding: "0 24px", background: "#ec4899", borderColor: "#ec4899" }}
          >
            Record result
          </Button>
        </div>
      }
      styles={{ header: { paddingBottom: 4 } }}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 8 }}>
        {(["A", "B"] as const).map((team) => {
          const isSelected = winner === team;
          const label = team === "A" ? teamAName : teamBName;
          return (
            <button
              key={team}
              onClick={() => setWinner(team)}
              style={{
                all: "unset",
                cursor: "pointer",
                display: "block",
                border: `2px solid ${isSelected ? "#ec4899" : "#e5e7eb"}`,
                borderRadius: 12,
                padding: "18px 20px",
                background: "#fff",
                transition: "border-color 0.15s",
              }}
            >
              <Text
                strong
                style={{ display: "block", fontSize: 15, color: isSelected ? "#ec4899" : "#111", marginBottom: 6 }}
              >
                Team {team}
              </Text>
              <Text style={{ fontSize: 14, color: isSelected ? "#ec4899" : "#374151" }}>
                {label}
              </Text>
            </button>
          );
        })}
      </div>
    </Modal>
  );
}


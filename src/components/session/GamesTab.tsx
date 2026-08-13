"use client";

import { useState } from "react";
import { useMutation, useQuery } from "@apollo/client";
import { App } from "antd";
import {
  SESSION_GAMES_QUERY,
  UPDATE_GAME_RESULT,
  CANCEL_GAME,
  DELETE_GAME,
} from "@/graphql/documents/organiser";
import { GameLog, type GameLogView, type GameLogStats } from "@/components/GameLog";
import { ScoreEntryForm, type ScoreEntryValues } from "@/components/ScoreEntryForm";

export function GamesTab({
  sessionId,
  onStats,
  scoringLabel,
}: {
  sessionId: string;
  onStats?: (s: GameLogStats) => void;
  scoringLabel?: string;
}) {
  const { message } = App.useApp();
  const { data, refetch } = useQuery(SESSION_GAMES_QUERY, {
    variables: { sessionId },
    pollInterval: 8000,
  });

  const [editingGame, setEditingGame] = useState<GameLogView | null>(null);
  const [updateGameResult, { loading: updating }] = useMutation(UPDATE_GAME_RESULT);
  const [cancelGame] = useMutation(CANCEL_GAME);
  const [deleteGame] = useMutation(DELETE_GAME);

  const games: GameLogView[] = data?.sessionGames ?? [];

  async function handleEditSubmit(values: ScoreEntryValues) {
    if (!editingGame) return;
    try {
      await updateGameResult({ variables: { id: editingGame.id, input: values } });
      message.success("Result updated");
      setEditingGame(null);
      refetch();
    } catch (err) {
      message.error(err instanceof Error ? err.message : "Could not update result");
    }
  }

  async function handleCancel(id: string) {
    try {
      await cancelGame({ variables: { id } });
      message.success("Game voided");
      refetch();
    } catch (err) {
      message.error(err instanceof Error ? err.message : "Could not void game");
    }
  }

  async function handleDelete(id: string) {
    try {
      await deleteGame({ variables: { id } });
      message.success("Game deleted");
      refetch();
    } catch (err) {
      message.error(err instanceof Error ? err.message : "Could not delete game");
    }
  }

  return (
    <div>
      <GameLog
        games={games}
        onStats={onStats}
        scoringLabel={scoringLabel}
        renderActions={(game) => (
          <div style={{ display: "flex", flexDirection: "column" }}>
            {game.status === "COMPLETED" && (
              <button
                onClick={() => setEditingGame(game)}
                style={{ background: "none", border: "none", cursor: "pointer", padding: "8px 16px", textAlign: "left", fontSize: 13, color: "#1d1f20" }}
              >
                Edit result
              </button>
            )}
            {game.status !== "CANCELLED" && (
              <button
                onClick={() => handleCancel(game.id)}
                style={{ background: "none", border: "none", cursor: "pointer", padding: "8px 16px", textAlign: "left", fontSize: 13, color: "#e11d74" }}
              >
                Void game
              </button>
            )}
            <button
              onClick={() => handleDelete(game.id)}
              style={{ background: "none", border: "none", cursor: "pointer", padding: "8px 16px", textAlign: "left", fontSize: 13, color: "#e11d74" }}
            >
              Delete game
            </button>
          </div>
        )}
      />

      <ScoreEntryForm
        open={!!editingGame}
        game={editingGame}
        loading={updating}
        onCancel={() => setEditingGame(null)}
        onSubmit={handleEditSubmit}
      />
    </div>
  );
}


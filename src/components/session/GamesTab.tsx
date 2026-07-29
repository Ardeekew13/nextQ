"use client";

import { useState } from "react";
import { useMutation, useQuery } from "@apollo/client";
import { Button, Space, Popconfirm, App } from "antd";
import { EditOutlined, StopOutlined, DeleteOutlined } from "@ant-design/icons";
import {
  SESSION_GAMES_QUERY,
  UPDATE_GAME_RESULT,
  CANCEL_GAME,
  DELETE_GAME,
} from "@/graphql/documents/organiser";
import { GameLog, type GameLogView } from "@/components/GameLog";
import { ScoreEntryForm, type ScoreEntryValues } from "@/components/ScoreEntryForm";
import { PageHeader } from "@/components/PageHeader";

export function GamesTab({ sessionId }: { sessionId: string }) {
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
      message.success("Result updated and standings recalculated");
      setEditingGame(null);
      refetch();
    } catch (err) {
      message.error(err instanceof Error ? err.message : "Could not update result");
    }
  }

  async function handleCancel(id: string) {
    try {
      await cancelGame({ variables: { id } });
      message.success("Game cancelled");
      refetch();
    } catch (err) {
      message.error(err instanceof Error ? err.message : "Could not cancel game");
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
        renderActions={(game) => (
          <Space>
            {game.status === "COMPLETED" && (
              <Button size="small" icon={<EditOutlined />} onClick={() => setEditingGame(game)} />
            )}
            {game.status !== "CANCELLED" && (
              <Popconfirm title="Cancel this game?" onConfirm={() => handleCancel(game.id)}>
                <Button size="small" danger icon={<StopOutlined />} />
              </Popconfirm>
            )}
            <Popconfirm title="Delete this game permanently?" onConfirm={() => handleDelete(game.id)}>
              <Button size="small" danger icon={<DeleteOutlined />} />
            </Popconfirm>
          </Space>
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

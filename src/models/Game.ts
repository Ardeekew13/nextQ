import mongoose, { type InferSchemaType, type Model } from "mongoose";
import { GameStatus, WinningTeam } from "@/types/enums";

const { Schema, model, models } = mongoose;

const GameSchema = new Schema(
  {
    sessionId: { type: Schema.Types.ObjectId, ref: "Session", required: true, index: true },
    courtId: { type: Schema.Types.ObjectId, ref: "Court", required: true },
    gameNumber: { type: Number, required: true },

    teamAPlayerIds: {
      type: [{ type: Schema.Types.ObjectId, ref: "SessionPlayer" }],
      validate: {
        validator: (v: unknown[]) => v.length === 2,
        message: "Team A must have exactly two players",
      },
    },
    teamBPlayerIds: {
      type: [{ type: Schema.Types.ObjectId, ref: "SessionPlayer" }],
      validate: {
        validator: (v: unknown[]) => v.length === 2,
        message: "Team B must have exactly two players",
      },
    },

    teamAScore: { type: Number, min: 0 },
    teamBScore: { type: Number, min: 0 },
    winningTeam: { type: String, enum: Object.values(WinningTeam) },
    status: {
      type: String,
      enum: Object.values(GameStatus),
      default: GameStatus.QUEUED,
      index: true,
    },

    startedAt: { type: Date },
    completedAt: { type: Date },
    recordedBy: { type: Schema.Types.ObjectId, ref: "User" },
    notes: { type: String },

    /**
     * Players who were eligible but not selected when this game was
     * generated. Persisted so the statistics recalculation service can
     * rebuild `gamesSatOut` purely from completed-game history.
     */
    playersSatOutIds: [{ type: Schema.Types.ObjectId, ref: "SessionPlayer" }],
  },
  { timestamps: true }
);

GameSchema.index({ sessionId: 1, gameNumber: 1 }, { unique: true });
GameSchema.index({ sessionId: 1, status: 1 });

export type GameDoc = InferSchemaType<typeof GameSchema>;

export const Game: Model<GameDoc> = models.Game || model<GameDoc>("Game", GameSchema);

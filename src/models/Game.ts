import mongoose, { type InferSchemaType, type Model } from "mongoose";
import { GameSource, GameStatus, WinningTeam } from "@/types/enums";

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

    /**
     * Id the browser gave this game when it was generated offline. Lets a retried sync
     * return the game it already created instead of making a duplicate.
     */
    clientId: { type: String },

    /** Picked in the browser with no connection. Device-picked games made online (local-first
     * fills) have a clientId but this is false. Missing on games saved before it existed. */
    createdOffline: { type: Boolean },

    /** How the line-up was first chosen: by the queue, by hand, or "Match top 4". Missing on
     * games created before this was tracked. Offline games also have a clientId. */
    source: { type: String, enum: Object.values(GameSource) },

    /** Every change to the teams after the game was created, oldest first: who was on each
     * team before and after the edit. Lets a "why did these two play again?" question be
     * answered from the data. */
    edits: {
      type: [
        new Schema(
          {
            at: { type: Date, required: true },
            fromTeamAPlayerIds: [{ type: Schema.Types.ObjectId, ref: "SessionPlayer" }],
            fromTeamBPlayerIds: [{ type: Schema.Types.ObjectId, ref: "SessionPlayer" }],
            toTeamAPlayerIds: [{ type: Schema.Types.ObjectId, ref: "SessionPlayer" }],
            toTeamBPlayerIds: [{ type: Schema.Types.ObjectId, ref: "SessionPlayer" }],
          },
          { _id: false }
        ),
      ],
      default: [],
    },
  },
  { timestamps: true }
);

GameSchema.index({ sessionId: 1, gameNumber: 1 }, { unique: true });
GameSchema.index({ sessionId: 1, status: 1 });
GameSchema.index({ sessionId: 1, clientId: 1 }, { unique: true, partialFilterExpression: { clientId: { $type: "string" } } });

export type GameDoc = InferSchemaType<typeof GameSchema>;

export const Game: Model<GameDoc> = models.Game || model<GameDoc>("Game", GameSchema);

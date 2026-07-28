import mongoose, { type InferSchemaType, type Model } from "mongoose";
import { SkillLevel } from "@/types/enums";

const { Schema, model, models } = mongoose;

const SessionPlayerSchema = new Schema(
  {
    sessionId: { type: Schema.Types.ObjectId, ref: "Session", required: true, index: true },
    name: { type: String, required: true, trim: true },
    nickname: { type: String, trim: true },
    skillLevel: { type: String, enum: Object.values(SkillLevel) },

    checkedIn: { type: Boolean, default: false },
    checkedInAt: { type: Date },
    active: { type: Boolean, default: true },

    queueEnteredAt: { type: Date, default: () => new Date() },
    queuePosition: { type: Number, default: 0 },

    gamesPlayed: { type: Number, default: 0 },
    wins: { type: Number, default: 0 },
    losses: { type: Number, default: 0 },

    /** Positive = current win streak length, negative = current loss streak length. */
    currentStreak: { type: Number, default: 0 },
    longestWinStreak: { type: Number, default: 0 },
    gamesSatOut: { type: Number, default: 0 },

    /** Maps SessionPlayer id (string) -> number of times partnered/faced. */
    partnerHistory: { type: Map, of: Number, default: () => new Map() },
    opponentHistory: { type: Map, of: Number, default: () => new Map() },

    /** How many games played back-to-back without a break. Reset to 0 when player sits out. */
    consecutiveGames: { type: Number, default: 0 },
  },
  { timestamps: true }
);

SessionPlayerSchema.index({ sessionId: 1, name: 1 });

export type SessionPlayerDoc = InferSchemaType<typeof SessionPlayerSchema>;

export const SessionPlayer: Model<SessionPlayerDoc> =
  models.SessionPlayer || model<SessionPlayerDoc>("SessionPlayer", SessionPlayerSchema);

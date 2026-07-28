import mongoose, { type InferSchemaType, type Model } from "mongoose";
import { SkillLevel } from "@/types/enums";

const { Schema, model, models } = mongoose;

/**
 * A persistent club-level player record that survives across sessions.
 * When a player is added to a session, a ClubMember record is upserted so
 * the same person can be quickly re-imported into future sessions.
 */
const ClubMemberSchema = new Schema(
  {
    clubId: { type: Schema.Types.ObjectId, ref: "Club", required: true, index: true },
    organiserId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    name: { type: String, required: true, trim: true },
    nickname: { type: String, trim: true },
    skillLevel: { type: String, enum: Object.values(SkillLevel) },
    /** Total games played across all sessions in this club */
    totalGames: { type: Number, default: 0 },
    /** Number of sessions attended */
    sessionsPlayed: { type: Number, default: 0 },
    active: { type: Boolean, default: true },
  },
  { timestamps: true }
);

// Unique name per club
ClubMemberSchema.index({ clubId: 1, name: 1 }, { unique: true });

export type ClubMemberDoc = InferSchemaType<typeof ClubMemberSchema>;

export const ClubMember: Model<ClubMemberDoc> =
  models.ClubMember || model<ClubMemberDoc>("ClubMember", ClubMemberSchema);

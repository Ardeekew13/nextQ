import mongoose, { type InferSchemaType, type Model } from "mongoose";
import { SkillLevel } from "@/types/enums";
import { toPlayerName } from "@/lib/playerNames";

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
    /** Stored in UPPERCASE like session names (see toPlayerName). */
    name: { type: String, required: true, trim: true, set: toPlayerName },
    nickname: { type: String, trim: true },
    skillLevel: { type: String, enum: Object.values(SkillLevel) },
    /** Total games played across all sessions in this club */
    totalGames: { type: Number, default: 0 },
    /** Number of sessions attended */
    sessionsPlayed: { type: Number, default: 0 },
    active: { type: Boolean, default: true },
    /** Reclub account, when this member came from (or was matched to) a Reclub event. The user id
     * never changes; username and name can, and are refreshed on every import. */
    reclubUserId: { type: Number, default: null },
    reclubUsername: { type: String, default: null },
    reclubName: { type: String, default: null },
  },
  { timestamps: true }
);

// Names can repeat in a club (two Christians are two members); the account id is who they are.
ClubMemberSchema.index({ clubId: 1, name: 1 });
ClubMemberSchema.index(
  { clubId: 1, reclubUserId: 1 },
  { unique: true, partialFilterExpression: { reclubUserId: { $type: "number" } } }
);

export type ClubMemberDoc = InferSchemaType<typeof ClubMemberSchema>;

export const ClubMember: Model<ClubMemberDoc> =
  models.ClubMember || model<ClubMemberDoc>("ClubMember", ClubMemberSchema);

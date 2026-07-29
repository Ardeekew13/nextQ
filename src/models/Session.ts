import mongoose, { type InferSchemaType, type Model } from "mongoose";
import { SessionStatus, DEFAULT_SESSION_SETTINGS, QueueMode } from "@/types/enums";

const { Schema, model, models } = mongoose;

const ScoringSettingsSchema = new Schema(
  {
    pointsTarget: { type: Number, required: true, default: 11 },
    winByTwo: { type: Boolean, required: true, default: false },
  },
  { _id: false }
);

const SessionSettingsSchema = new Schema(
  {
    scoring: { type: ScoringSettingsSchema, default: () => DEFAULT_SESSION_SETTINGS.scoring },
    rankingOrder: {
      type: [String],
      default: () => DEFAULT_SESSION_SETTINGS.rankingOrder,
    },
    avoidRepeatPartnersWindow: { type: Number, default: DEFAULT_SESSION_SETTINGS.avoidRepeatPartnersWindow },
    avoidRepeatOpponentsWindow: { type: Number, default: DEFAULT_SESSION_SETTINGS.avoidRepeatOpponentsWindow },
    pairingMode: { type: String, enum: ["SMART", "RANDOM"], default: "SMART" },
    matchingStyle: { type: String, enum: ["BALANCED", "WINNERS_LOSERS", "FIXED_PARTNERS"], default: "BALANCED" },
    queueMode: { type: String, enum: Object.values(QueueMode), default: QueueMode.HYBRID },
    maxConsecutiveGames: { type: Number, default: 2 },
  },
  { _id: false }
);

const FinalStandingEntrySchema = new Schema(
  {
    playerId: { type: Schema.Types.ObjectId, ref: "SessionPlayer", required: true },
    rank: { type: Number, required: true },
    name: { type: String, required: true },
    gamesPlayed: { type: Number, required: true },
    wins: { type: Number, required: true },
    losses: { type: Number, required: true },
    winRate: { type: Number, required: true },
  },
  { _id: false }
);

const SessionSchema = new Schema(
  {
    clubId: { type: Schema.Types.ObjectId, ref: "Club", required: true, index: true },
    organiserId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    name: { type: String, required: true, trim: true },
    slug: { type: String, required: true, trim: true, lowercase: true },
    sessionDate: { type: Date, required: true },
    startTime: { type: String },
    endTime: { type: String },
    status: {
      type: String,
      enum: Object.values(SessionStatus),
      default: SessionStatus.DRAFT,
      index: true,
    },
    settings: { type: SessionSettingsSchema, default: () => DEFAULT_SESSION_SETTINGS },
    playerIds: [{ type: Schema.Types.ObjectId, ref: "SessionPlayer" }],
    courtIds: [{ type: Schema.Types.ObjectId, ref: "Court" }],
    publicPublished: { type: Boolean, default: false },
    finalStandings: { type: [FinalStandingEntrySchema], default: [] },
    finalisedAt: { type: Date },
  },
  { timestamps: true }
);

SessionSchema.index({ clubId: 1, slug: 1 }, { unique: true });
SessionSchema.index({ organiserId: 1, status: 1 });
SessionSchema.index({ clubId: 1, status: 1 });

export type SessionDoc = InferSchemaType<typeof SessionSchema>;

export const Session: Model<SessionDoc> = models.Session || model<SessionDoc>("Session", SessionSchema);

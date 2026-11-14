import mongoose, { type InferSchemaType, type Model } from "mongoose";
import { CourtStatus } from "@/types/enums";

const { Schema, model, models } = mongoose;

const CourtSchema = new Schema(
  {
    sessionId: { type: Schema.Types.ObjectId, ref: "Session", required: true, index: true },
    courtNumber: { type: Number, required: true },
    name: { type: String, trim: true },
    /** Where this court sits in the organiser's drag-and-dropped display order (see
     * reorderCourts), lower first. Left unset until the organiser reorders at least once -
     * sortCourtsForDisplay falls back to courtNumber for any court with no displayOrder yet,
     * so courts display exactly as before until someone drags one. */
    displayOrder: { type: Number },
    status: {
      type: String,
      enum: Object.values(CourtStatus),
      default: CourtStatus.AVAILABLE,
    },
    activeGameId: { type: Schema.Types.ObjectId, ref: "Game", default: null },
    previousGameIds: [{ type: Schema.Types.ObjectId, ref: "Game" }],
  },
  { timestamps: true }
);

CourtSchema.index({ sessionId: 1, courtNumber: 1 }, { unique: true });

export type CourtDoc = InferSchemaType<typeof CourtSchema>;

export const Court: Model<CourtDoc> = models.Court || model<CourtDoc>("Court", CourtSchema);

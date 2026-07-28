import mongoose, { type InferSchemaType, type Model } from "mongoose";

const { Schema, model, models } = mongoose;

const ClubSchema = new Schema(
  {
    organiserId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    name: { type: String, required: true, trim: true },
    slug: { type: String, required: true, trim: true, lowercase: true },
    logoUrl: { type: String },
    location: { type: String },
    description: { type: String },
  },
  { timestamps: true }
);

ClubSchema.index({ slug: 1 }, { unique: true });

export type ClubDoc = InferSchemaType<typeof ClubSchema>;

export const Club: Model<ClubDoc> = models.Club || model<ClubDoc>("Club", ClubSchema);

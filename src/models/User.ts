import mongoose, { type InferSchemaType, type Model } from "mongoose";
import { UserRole } from "@/types/enums";

const { Schema, model, models } = mongoose;

const UserSchema = new Schema(
  {
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true },
    name: { type: String, required: true, trim: true },
    role: { type: String, enum: Object.values(UserRole), default: UserRole.ORGANISER },

    /** SHA-256 hash of the current password-reset token, if one has been issued and not yet used/expired. */
    resetPasswordTokenHash: { type: String, default: null },
    resetPasswordExpires: { type: Date, default: null },

    /** Timestamp of this organiser's most recent successful login. Null until their first login after this field shipped. */
    lastLoginAt: { type: Date, default: null },

    /** Whether they've been shown (and dismissed) the fixed-partner feature walkthrough. Defaults to false for every
     * existing account too, since Mongoose applies schema defaults on read for fields missing from older documents —
     * so it naturally shows once to everyone on their first login after this shipped, and never again after that. */
    hasSeenFixedPartnerTour: { type: Boolean, default: false },
  },
  { timestamps: true }
);

export type UserDoc = InferSchemaType<typeof UserSchema>;

export const User: Model<UserDoc> = models.User || model<UserDoc>("User", UserSchema);

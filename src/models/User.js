import mongoose from "mongoose";
import { ROLES } from "./constants.js";
import { generateSlug } from "../utils/slug.js";

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    // `email` is the login alias. For principal-provisioned users this is a
    // generated `<first>.<last>.<uid>@edusphere.app` style address. It is NEVER
    // used to send mail — that's `contactEmail`'s job.
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    contactEmail: {
      type: String,
      default: null,
      lowercase: true,
      trim: true,
      index: true,
    },
    password: {
      type: String,
      required: true,
      select: false,
    },
    role: {
      type: String,
      enum: Object.values(ROLES),
      required: true,
      index: true,
    },
    schoolId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "School",
      default: null,
      index: true,
    },
    // Globally-unique public identifier (e.g. `usr_8a3f9b2c`). Used in URLs
    // and as a stable external id. NEVER used as login.
    slug: {
      type: String,
      unique: true,
      sparse: true,
      index: true,
      default: null,
    },
    // Set on email-verification success. Until then, login is rejected.
    emailVerified: {
      type: Boolean,
      default: false,
      index: true,
    },
    // For STUDENT/TEACHER users this points at the role-specific document
    // (Student or Teacher) once it's created — that happens on verify-email.
    roleProfileId: {
      type: mongoose.Schema.Types.ObjectId,
      refPath: "roleProfileModel",
      default: null,
    },
    roleProfileModel: {
      type: String,
      enum: ["Student", "Teacher", "Staff", null],
      default: null,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    mustChangePassword: {
      type: Boolean,
      default: false,
    },
    // sha256 hash of the raw token; raw value is in the email.
    verificationToken: {
      type: String,
      default: null,
      select: false,
    },
    verificationExpires: {
      type: Date,
      default: null,
    },
    // sha256 hash of the raw token; raw value is in the email.
    resetPasswordTokenHash: {
      type: String,
      default: null,
      select: false,
    },
    resetPasswordExpires: {
      type: Date,
      default: null,
    },
    // Used by principal-invite flow to stash role-specific fields until
    // verify-email runs. Cleared once consumed.
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    lastLogin: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

/**
 * Generate a unique `usr_<8hex>` slug. Retries on E11000 collision.
 * Slugs are NEVER recycled — once allocated, the User row keeps it forever.
 */
userSchema.statics.generateUniqueUserSlug = async function () {
  for (let attempt = 0; attempt < 5; attempt++) {
    const slug = generateSlug("usr");
    // eslint-disable-next-line no-await-in-loop
    const exists = await this.exists({ slug });
    if (!exists) return slug;
  }
  // Fallback: longer suffix for extreme collision pressure.
  return generateSlug("usr") + generateSlug("usr").slice(4);
};

export default mongoose.models.User || mongoose.model("User", userSchema);

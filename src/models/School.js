import mongoose from "mongoose";
import { generateSlug } from "../utils/slug.js";

const schoolSchema = new mongoose.Schema(
  {
    slug: {
      type: String,
      unique: true,
      sparse: true,
      index: true,
      default: null,
    },
    schoolName: {
      type: String,
      required: true,
      trim: true,
    },
    schoolCode: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      trim: true,
    },
    emailDomain: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    phone: {
      type: String,
      default: "",
    },
    address: {
      type: String,
      default: "",
    },
    logo: {
      type: String,
      default: "",
    },
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

schoolSchema.statics.generateUniqueSchoolSlug = async function () {
  for (let attempt = 0; attempt < 5; attempt++) {
    // eslint-disable-next-line no-await-in-loop
    const exists = await this.exists({ slug: generateSlug("sch") });
    if (!exists) return generateSlug("sch");
  }
  return generateSlug("sch") + generateSlug("sch").slice(4);
};

export default mongoose.models.School || mongoose.model("School", schoolSchema);

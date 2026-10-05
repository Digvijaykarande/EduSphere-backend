import mongoose from "mongoose";
import { generateSlug } from "../utils/slug.js";

const MATERIAL_TYPES = ["pdf", "video", "folder", "link"];

const studyMaterialSchema = new mongoose.Schema(
  {
    slug: {
      type: String,
      unique: true,
      sparse: true,
      index: true,
      default: null,
    },
    schoolId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "School",
      required: true,
      index: true,
    },
    sectionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Section",
      required: true,
      index: true,
    },
    subject: {
      type: String,
      default: "",
      trim: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
    },
    type: {
      type: String,
      enum: MATERIAL_TYPES,
      required: true,
    },
    uploadedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Teacher",
      required: true,
    },
    // For pdf/video/folder: real Cloudinary attachment metadata (same shape
    // as Assignment.attachments — name/url/size/type). For link: only `url`
    // is meaningful, pointing at an external resource.
    url: {
      type: String,
      default: "",
    },
    fileSize: {
      type: Number,
      default: 0,
    },
    // Duration string for videos (e.g. "12:40") — free text since it's
    // display-only, not used for playback seeking.
    duration: {
      type: String,
      default: "",
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

studyMaterialSchema.index({ schoolId: 1, sectionId: 1 });

studyMaterialSchema.statics.generateUniqueMaterialSlug = async function () {
  for (let attempt = 0; attempt < 5; attempt++) {
    // eslint-disable-next-line no-await-in-loop
    const exists = await this.exists({ slug: generateSlug("mat") });
    if (!exists) return generateSlug("mat");
  }
  return generateSlug("mat") + generateSlug("mat").slice(4);
};

export const MATERIAL_TYPE_OPTIONS = MATERIAL_TYPES;

export default mongoose.models.StudyMaterial ||
  mongoose.model("StudyMaterial", studyMaterialSchema);

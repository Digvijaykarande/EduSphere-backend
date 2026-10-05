import mongoose from "mongoose";
import { generateSlug } from "../utils/slug.js";

const wingSchema = new mongoose.Schema(
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
    name: {
      type: String,
      required: true,
      trim: true,
    },
    // Free-text summary shown under the wing name (e.g. "Grades 1-5"). Not
    // parsed/validated against gradeClasses — purely a display label the
    // principal controls, since grade-naming conventions vary by school.
    classesLabel: {
      type: String,
      default: "",
      trim: true,
    },
    // Which gradeClass strings belong to this wing (e.g. ["Class 1", ...,
    // "Class 5"]). Used to compute sectionsCount/studentsCount live rather
    // than storing denormalized counts that would drift.
    gradeClasses: {
      type: [String],
      default: [],
    },
    iconName: {
      type: String,
      enum: ["building", "landmark", "shapes"],
      default: "shapes",
    },
    // Drag-to-reorder position — lower sorts first.
    order: {
      type: Number,
      default: 0,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

wingSchema.index({ schoolId: 1, order: 1 });

wingSchema.statics.generateUniqueWingSlug = async function () {
  for (let attempt = 0; attempt < 5; attempt++) {
    // eslint-disable-next-line no-await-in-loop
    const exists = await this.exists({ slug: generateSlug("wng") });
    if (!exists) return generateSlug("wng");
  }
  return generateSlug("wng") + generateSlug("wng").slice(4);
};

export default mongoose.models.Wing || mongoose.model("Wing", wingSchema);

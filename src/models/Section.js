import mongoose from "mongoose";
import { generateSlug } from "../utils/slug.js";

const sectionSchema = new mongoose.Schema(
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
    gradeClass: {
      type: String,
      required: true,
      trim: true,
    },
    section: {
      type: String,
      required: true,
      trim: true,
    },
    // The homeroom / in-charge teacher for this section — approves student
    // leave requests and gets the default "my section" view. Distinct from
    // TeacherAssignment, which governs who may teach/mark which subject.
    classTeacherId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Teacher",
      required: true,
    },
    // Physical room assignment — display/logistics only, not enforced
    // against any room-booking system.
    room: {
      type: String,
      default: "",
      trim: true,
    },
    seatCapacity: {
      type: Number,
      default: 40,
    },
    // Subjects taught in this section overall — a broader list than any
    // single teacher's TeacherAssignment.subjects, used by
    // ClassSubjectMaintenance for the section-level subject chips display.
    // Not authoritative for who may mark attendance/create assignments —
    // that's still governed by TeacherAssignment.
    subjects: {
      type: [String],
      default: [],
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

sectionSchema.index(
  { schoolId: 1, gradeClass: 1, section: 1 },
  { unique: true }
);

sectionSchema.statics.generateUniqueSectionSlug = async function () {
  for (let attempt = 0; attempt < 5; attempt++) {
    // eslint-disable-next-line no-await-in-loop
    const exists = await this.exists({ slug: generateSlug("sec") });
    if (!exists) return generateSlug("sec");
  }
  return generateSlug("sec") + generateSlug("sec").slice(4);
};

export default mongoose.models.Section || mongoose.model("Section", sectionSchema);

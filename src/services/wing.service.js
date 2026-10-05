import AppError from "../utils/AppError.js";
import Wing from "../models/Wing.js";
import Section from "../models/Section.js";
import Student from "../models/Student.js";
import TeacherAssignment from "../models/TeacherAssignment.js";

function targetSchoolId(schoolId) {
  return schoolId?._id || schoolId;
}

export async function createWing(schoolId, data) {
  const sid = targetSchoolId(schoolId);
  const slug = await Wing.generateUniqueWingSlug();

  const maxOrder = await Wing.findOne({ schoolId: sid }).sort({ order: -1 }).select("order");
  const order = maxOrder ? maxOrder.order + 1 : 0;

  return Wing.create({
    slug,
    schoolId: sid,
    name: data.name,
    classesLabel: data.classesLabel,
    gradeClasses: data.gradeClasses,
    iconName: data.iconName,
    order,
  });
}

/**
 * Live-computed counts per wing — sections/students matching any of the
 * wing's gradeClasses, and subjects taught across those sections (via
 * TeacherAssignment, deduplicated). Computed on read rather than stored, so
 * they never drift out of sync as Sections/Students/Assignments change.
 */
async function enrichWithCounts(schoolId, wings) {
  const sid = targetSchoolId(schoolId);

  return Promise.all(
    wings.map(async (wing) => {
      const gradeClasses = wing.gradeClasses || [];
      if (gradeClasses.length === 0) {
        return { ...wing.toObject(), sectionsCount: 0, studentsCount: 0, subjectsCount: 0 };
      }

      const sections = await Section.find({
        schoolId: sid,
        gradeClass: { $in: gradeClasses },
        isActive: true,
      }).select("_id");
      const sectionIds = sections.map((s) => s._id);

      const [studentsCount, assignments] = await Promise.all([
        Student.countDocuments({ schoolId: sid, sectionId: { $in: sectionIds }, status: "ACTIVE" }),
        TeacherAssignment.find({ schoolId: sid, sectionId: { $in: sectionIds }, isActive: true }).select(
          "subjects"
        ),
      ]);

      const subjectSet = new Set();
      for (const a of assignments) for (const sub of a.subjects) subjectSet.add(sub);

      return {
        ...wing.toObject(),
        sectionsCount: sectionIds.length,
        studentsCount,
        subjectsCount: subjectSet.size,
      };
    })
  );
}

export async function getSchoolWings(schoolId) {
  const sid = targetSchoolId(schoolId);
  const wings = await Wing.find({ schoolId: sid, isActive: true }).sort({ order: 1 });
  return enrichWithCounts(sid, wings);
}

export async function updateWing(schoolId, slug, patch) {
  const sid = targetSchoolId(schoolId);
  const wing = await Wing.findOne({ slug, schoolId: sid });
  if (!wing) throw new AppError("Wing not found", 404);

  Object.assign(wing, patch);
  await wing.save();
  return wing;
}

export async function deleteWing(schoolId, slug) {
  const sid = targetSchoolId(schoolId);
  const wing = await Wing.findOneAndUpdate(
    { slug, schoolId: sid },
    { $set: { isActive: false } },
    { new: true }
  );
  if (!wing) throw new AppError("Wing not found", 404);
  return { message: "Wing removed" };
}

/**
 * Persist a new drag-to-reorder sequence. orderedIds is the full front-to-
 * back list of Wing _ids as the principal left them; each gets its `order`
 * field set to its index in that array.
 */
export async function reorderWings(schoolId, orderedIds) {
  const sid = targetSchoolId(schoolId);

  const count = await Wing.countDocuments({ _id: { $in: orderedIds }, schoolId: sid });
  if (count !== orderedIds.length) {
    throw new AppError("One or more wings do not belong to your school", 400);
  }

  await Wing.bulkWrite(
    orderedIds.map((id, index) => ({
      updateOne: { filter: { _id: id, schoolId: sid }, update: { $set: { order: index } } },
    }))
  );

  return getSchoolWings(sid);
}

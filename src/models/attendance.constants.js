// Hardcoded for now, mirroring the frontend's attendance.utils.js. If this
// ever needs to be school-configurable, promote to a SchoolConfig model and
// validate against the school's own list instead of these constants.

export const SUBJECTS = [
  "Mathematics",
  "English",
  "Science",
  "Physics",
  "Chemistry",
  "Biology",
  "History",
  "Geography",
  "Computer Science",
  "Physical Education",
  "Art",
  "Music",
];

export const PERIODS = [
  "Period 1",
  "Period 2",
  "Period 3",
  "Period 4",
  "Period 5",
  "Period 6",
  "Period 7",
  "Period 8",
];

export const ATTENDANCE_STATUSES = ["present", "absent", "late", "not-marked"];

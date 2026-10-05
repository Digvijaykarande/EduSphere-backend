/**
 * Converts a raw score (as a percentage of max marks) into a letter grade.
 * Matches the bands used on the frontend's GradebookTable.getGrade().
 */
export function scoreToGrade(percentage) {
  if (percentage >= 90) return "A+";
  if (percentage >= 80) return "A";
  if (percentage >= 70) return "B";
  if (percentage >= 60) return "C";
  if (percentage >= 40) return "D";
  return "F";
}

/**
 * Computes grade + pass/fail for a single exam result.
 * Returns { grade, isPassed, percentage } or nulls if marksObtained is null.
 */
export function computeResult({ marksObtained, maxMarks, passingMarks }) {
  if (marksObtained === null || marksObtained === undefined) {
    return { grade: null, isPassed: null, percentage: null };
  }
  const percentage = maxMarks > 0 ? (marksObtained / maxMarks) * 100 : 0;
  return {
    grade: scoreToGrade(percentage),
    isPassed: marksObtained >= passingMarks,
    percentage: Math.round(percentage * 10) / 10,
  };
}

/**
 * Derives a human-readable duration string ("1.5 Hours", "3 Hours") from
 * "HH:mm" start/end times, matching the format already used in mockData.
 */
export function computeDuration(startTime, endTime) {
  const [sh, sm] = startTime.split(":").map(Number);
  const [eh, em] = endTime.split(":").map(Number);
  let minutes = eh * 60 + em - (sh * 60 + sm);
  if (minutes <= 0) minutes += 24 * 60; // guard against overnight edge case
  const hours = minutes / 60;
  if (Number.isInteger(hours)) return `${hours} Hour${hours === 1 ? "" : "s"}`;
  return `${hours.toFixed(1)} Hours`;
}

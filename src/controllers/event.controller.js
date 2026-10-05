// src/controllers/event.controller.js
import Event, { CATEGORY_OPTIONS } from "../models/events.js";

// Roles allowed to create/update/delete events. Viewing is open to any
// authenticated user in the school (student, teacher, principal/school, parent).
// Matches the ROLES enum in models/constants.js — "SCHOOL" is the
// principal/school-owner account, confirmed from a live user document.
// If your TEACHER role string differs, update it here.
const MANAGE_ROLES = ["SCHOOL", "TEACHER"];

function canManageEvents(user) {
  return !!user && MANAGE_ROLES.includes(user.role);
}

// `protect` populates req.user.schoolId (into { _id, schoolName, ... }), so
// this pulls the raw ObjectId back out regardless of whether it's populated.
function getSchoolId(user) {
  return user?.schoolId?._id || user?.schoolId;
}

/**
 * GET /api/school/events
 * Optional query: ?from=YYYY-MM-DD&to=YYYY-MM-DD&category=Exam
 * Returns every event for the caller's school within range (all events if
 * no range given — fine at current scale, add pagination later if needed).
 */
export async function getEvents(req, res, next) {
  try {
    const { from, to, category } = req.query;
    const filter = { school: getSchoolId(req.user) };

    if (from || to) {
      filter.date = {};
      if (from) filter.date.$gte = from;
      if (to) filter.date.$lte = to;
    }
    if (category) filter.category = category;

    const events = await Event.find(filter).sort({ date: 1, start: 1 }).lean();

    res.json({ data: events });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/school/events
 * Body: { title, date, start, end, location, category, customCategoryLabel }
 * Principal/teacher only.
 */
export async function createEvent(req, res, next) {
  try {
    if (!canManageEvents(req.user)) {
      return res
        .status(403)
        .json({ message: "Only principals and teachers can create events." });
    }

    const { title, date, start, end, location, category, customCategoryLabel } =
      req.body;

    if (!title || !title.trim()) {
      return res.status(400).json({ message: "Title is required." });
    }
    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return res
        .status(400)
        .json({ message: "A valid date (YYYY-MM-DD) is required." });
    }
    if (category && !CATEGORY_OPTIONS.includes(category)) {
      return res.status(400).json({ message: "Invalid category." });
    }

    const event = await Event.create({
      school: getSchoolId(req.user),
      title: title.trim(),
      date,
      start: start?.trim() || "All day",
      end: end?.trim() || "",
      location: location?.trim() || "TBD",
      category: category || "Other",
      customCategoryLabel:
        category === "Other" ? (customCategoryLabel || "").trim() : "",
      createdBy: req.user._id,
    });

    res.status(201).json({ data: event });
  } catch (err) {
    next(err);
  }
}

/**
 * PATCH /api/school/events/:id
 * Principal/teacher only.
 */
export async function updateEvent(req, res, next) {
  try {
    if (!canManageEvents(req.user)) {
      return res
        .status(403)
        .json({ message: "Only principals and teachers can edit events." });
    }

    const event = await Event.findOne({
      _id: req.params.id,
      school: getSchoolId(req.user),
    });
    if (!event) {
      return res.status(404).json({ message: "Event not found." });
    }

    const { title, date, start, end, location, category, customCategoryLabel } =
      req.body;

    if (category && !CATEGORY_OPTIONS.includes(category)) {
      return res.status(400).json({ message: "Invalid category." });
    }
    if (date && !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return res.status(400).json({ message: "Invalid date format." });
    }

    if (title !== undefined) event.title = title.trim();
    if (date !== undefined) event.date = date;
    if (start !== undefined) event.start = start.trim();
    if (end !== undefined) event.end = end.trim();
    if (location !== undefined) event.location = location.trim();
    if (category !== undefined) event.category = category;
    if (customCategoryLabel !== undefined || category !== undefined) {
      event.customCategoryLabel =
        event.category === "Other" ? (customCategoryLabel || "").trim() : "";
    }

    await event.save();
    res.json({ data: event });
  } catch (err) {
    next(err);
  }
}

/**
 * DELETE /api/school/events/:id
 * Principal/teacher only.
 */
export async function deleteEvent(req, res, next) {
  try {
    if (!canManageEvents(req.user)) {
      return res
        .status(403)
        .json({ message: "Only principals and teachers can delete events." });
    }

    const event = await Event.findOneAndDelete({
      _id: req.params.id,
      school: getSchoolId(req.user),
    });

    if (!event) {
      return res.status(404).json({ message: "Event not found." });
    }

    res.json({ data: { id: req.params.id } });
  } catch (err) {
    next(err);
  }
}

import { z } from "zod";
import { STAFF_TYPES } from "../models/constants.js";

const contactEmail = z
  .string()
  .email("Invalid email address")
  .transform((v) => v.toLowerCase().trim());

// --- Teacher ---

export const createTeacherSchema = z.object({
  contactEmail,
  employeeId: z.string().min(1, "Employee ID is required"),
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  gender: z.enum(["Male", "Female", "Other"]).optional(),
  phone: z.string().optional(),
  qualification: z.string().optional(),
  experience: z.coerce.number().optional(),
  subjects: z.array(z.string()).optional(),
});

export const updateTeacherSchema = createTeacherSchema.partial().extend({
  status: z.enum(["ACTIVE", "INACTIVE"]).optional(),
});

// --- Student ---

export const createStudentSchema = z.object({
  contactEmail,
  rollNumber: z.string().min(1, "Roll number is required"),
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  middleName: z.string().optional(),
  motherName: z.string().optional(),
  gradeClass: z.string().min(1, "Grade / Class is required"),
  section: z.string().optional().default("A"),
  gender: z.enum(["Male", "Female", "Other"]).optional(),
  dateOfBirth: z.string().optional(),
  parentName: z.string().optional(),
  parentPhone: z.string().optional(),
  address: z.string().optional(),
  assignedTeacherId: z.string().optional().nullable(),
});

export const updateStudentSchema = createStudentSchema.partial().extend({
  status: z.enum(["ACTIVE", "INACTIVE"]).optional(),
});

// --- Staff (non-teaching: lab assistant, librarian, cashier, etc.) ---

export const createStaffSchema = z
  .object({
    contactEmail,
    employeeId: z.string().min(1, "Employee ID is required"),
    firstName: z.string().min(1, "First name is required"),
    lastName: z.string().min(1, "Last name is required"),
    staffType: z.enum(Object.values(STAFF_TYPES), {
      errorMap: () => ({ message: "Select a valid staff role" }),
    }),
    customTitle: z.string().optional(),
    gender: z.enum(["Male", "Female", "Other"]).optional(),
    phone: z.string().optional(),
    qualification: z.string().optional(),
    experience: z.coerce.number().min(0).max(60).optional(),
    department: z.string().optional(),
  })
  .refine(
    (data) =>
      data.staffType !== STAFF_TYPES.OTHER ||
      (data.customTitle && data.customTitle.trim().length > 0),
    {
      message: "Please specify the staff title",
      path: ["customTitle"],
    }
  );

export const updateStaffSchema = z.object({
  employeeId: z.string().min(1).optional(),
  firstName: z.string().min(1).optional(),
  lastName: z.string().min(1).optional(),
  staffType: z.enum(Object.values(STAFF_TYPES)).optional(),
  customTitle: z.string().optional(),
  gender: z.enum(["Male", "Female", "Other"]).optional(),
  phone: z.string().optional(),
  qualification: z.string().optional(),
  experience: z.coerce.number().min(0).max(60).optional(),
  department: z.string().optional(),
  status: z.enum(["ACTIVE", "INACTIVE"]).optional(),
});

// --- School profile ---

export const updateSchoolProfileSchema = z.object({
  schoolName: z.string().min(3).optional(),
  phone: z.string().optional(),
  address: z.string().optional(),
  logo: z.string().optional(),
});
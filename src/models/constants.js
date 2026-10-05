export const ROLES = {
  SUPER_ADMIN: "SUPER_ADMIN",
  SCHOOL: "SCHOOL",
  TEACHER: "TEACHER",
  STUDENT: "STUDENT",
  STAFF: "STAFF",
};

// Sub-types for the generic STAFF role (non-teaching staff). Kept separate
// from ROLES because these are all the SAME User.role ("STAFF") — this enum
// only distinguishes the Staff.staffType field.
export const STAFF_TYPES = {
  LAB_ASSISTANT: "LAB_ASSISTANT",
  LIBRARIAN: "LIBRARIAN",
  CASHIER: "CASHIER",
  ACCOUNTANT: "ACCOUNTANT",
  RECEPTIONIST: "RECEPTIONIST",
  OFFICE_CLERK: "OFFICE_CLERK",
  OTHER: "OTHER",
};

export const STAFF_TYPE_LABELS = {
  LAB_ASSISTANT: "Lab Assistant",
  LIBRARIAN: "Librarian",
  CASHIER: "Cashier",
  ACCOUNTANT: "Accountant",
  RECEPTIONIST: "Receptionist",
  OFFICE_CLERK: "Office Clerk",
  OTHER: "Other Staff",
};

export const MESSAGES = {
  LOGIN_SUCCESS: "Login successful",
  REGISTER_SUCCESS: "Registration successful",
  INVALID_CREDENTIALS: "Invalid email or password",
  UNAUTHORIZED: "Unauthorized",
  FORBIDDEN: "Access denied",
};

// Token TTLs are read from env.js so they remain configurable. We expose them
// here as named constants for use in services that don't already import env.
export const VERIFICATION_TTL_MS = 24 * 60 * 60 * 1000; // 24h
export const RESET_TTL_MS = 60 * 60 * 1000; // 1h

import type { Express } from "express";
import type { z } from "zod";

// Every API error carries a stable `code` (and sometimes `params`) next to the
// English `message`. The browser shows the translation of "err.<code>" in the
// user's language (client/src/lib/i18n.tsx); `message` is kept for logs.
//
// Routes keep sending res.status(...).json({ message }); attachErrorCodes()
// adds the code by looking the message up here. tests/errors.test.ts fails if
// a message in server/*.ts is missing from this table, and
// tests/i18n-errors.test.ts fails if a code has no translation.
export const ERROR_CODES: Record<string, string> = {
  "Not authenticated": "not_authenticated",
  "Teachers only": "teachers_only",
  "Admins only": "admins_only",
  "Students only": "students_only",
  "Invalid credentials": "invalid_credentials",
  "Login failed": "login_failed",
  "Registration failed": "registration_failed",
  "Email already registered": "email_taken",
  "Username already taken": "username_taken",
  "Your Google email is not verified": "google_email_unverified",
  "Invalid Google token": "google_failed",
  "Google token missing required claims": "google_failed",
  "Google sign-in failed": "google_failed",
  "Google sign-in is not configured on the server": "google_not_configured",
  "Email is not configured on the server": "email_not_configured",
  "Could not send the reset email. Please try again.": "reset_email_failed",
  "Could not process the request": "generic",
  "This reset link is invalid or has expired": "reset_link_invalid",
  "Could not reset password": "reset_failed",
  "That group is not yours": "group_not_yours",
  "One or more groups are not yours": "group_not_yours",
  "No student found with that email/username": "student_not_found",
  "That user is not a student": "not_a_student",
  "Student is already in this group": "already_in_group",
  "You have used all attempts for this quiz": "no_attempts_left",
  "The deadline for this quiz has passed": "deadline_passed",
  "Failed to create quiz": "save_failed",
  "Failed to update quiz": "save_failed",
  "Failed to create session": "save_failed",
  "Failed to create material": "save_failed",
  "Failed to update material": "save_failed",
  "Failed to submit feedback": "save_failed",
  "Invalid parent folder": "invalid_folder",
  "Material not found": "not_found",
  "File storage is not configured": "storage_not_configured",
  "Could not start the upload": "upload_failed",
  "Could not open the file": "file_open_failed",
  "Upload the file to storage first": "upload_failed",
  "Invalid file": "upload_failed",
  "Links must start with http:// or https://": "invalid_url",
  "The database is not reachable right now. Please try again in a minute.": "db_unavailable",
  "Too many attempts": "too_many_attempts",
  "Not found": "not_found",
  "Invalid score": "invalid_score",
  "Only the person who asked can choose the best answer": "not_your_question",
};

const PATTERNS: { re: RegExp; code: string; params?: (m: RegExpMatchArray) => Record<string, string> }[] = [
  { re: /^\w+ not found$/, code: "not_found" },
  { re: /^Files can be at most (\d+) MB$/, code: "file_too_large", params: (m) => ({ max: m[1] }) },
];

// Custom validation messages from shared/schema.ts.
const ZOD_MESSAGES: Record<string, string> = {
  "Password must be at least 8 characters": "password_too_short",
  "Password needs a special character": "password_needs_special",
  "Title must be at least 5 characters": "title_too_short",
  "Write an answer or add a photo": "answer_empty",
  "Invalid image": "invalid_image",
};

/** Every code the server can send (used to check translations exist). */
export const ALL_ERROR_CODES: string[] = Array.from(
  new Set([
    ...Object.values(ERROR_CODES),
    ...PATTERNS.map((p) => p.code),
    ...Object.values(ZOD_MESSAGES),
    "generic", "invalid_email", "invalid_url", "username_too_short", "field_required", "invalid_field",
  ]),
);

export function codeForMessage(message: string): { code: string; params?: Record<string, string> } {
  const exact = ERROR_CODES[message];
  if (exact) return { code: exact };
  for (const p of PATTERNS) {
    const m = message.match(p.re);
    if (m) return p.params ? { code: p.code, params: p.params(m) } : { code: p.code };
  }
  return { code: "generic" };
}

/** Body for a 400 response from a validation error: { message, code, params? }. */
export function zodErrorBody(e: z.ZodError) {
  const issue = e.errors[0];
  const message = issue?.message ?? "Invalid input";
  const field = String(issue?.path?.[0] ?? "");
  if (ZOD_MESSAGES[message]) return { message, code: ZOD_MESSAGES[message] };
  if (field === "email") return { message, code: "invalid_email" };
  if (field === "meetingUrl" || field === "linkUrl") return { message, code: "invalid_url" };
  if (field === "username" && issue?.code === "too_small") return { message, code: "username_too_short" };
  if (issue?.code === "too_small") return { message, code: "field_required", params: { field } };
  return { message, code: "invalid_field", params: { field } };
}

/** Adds `code` to every JSON error response that doesn't already have one. */
export function attachErrorCodes(app: Express) {
  app.use((_req, res, next) => {
    const json = res.json.bind(res);
    res.json = (body: any) => {
      if (res.statusCode >= 400 && body && typeof body === "object" && typeof body.message === "string" && !body.code) {
        body = { ...body, ...codeForMessage(body.message) };
      }
      return json(body);
    };
    next();
  });
}

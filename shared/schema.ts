import { pgTable, text, integer, serial, bigint } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Epoch-millisecond timestamps exceed PG 32-bit integer range, so they must be
// bigint columns. mode:"number" keeps them as JS numbers (matching Date.now()).
const ts = (name: string) => bigint(name, { mode: "number" });

// ---------------- Users ----------------
// role: "teacher" | "student"
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  email: text("email").notNull().unique(),
  username: text("username").notNull().unique(),
  // Nullable: users who sign up via Google have no local password until they
  // explicitly set one through the reset flow.
  password: text("password"),
  // Google account subject id (the "sub" claim). Null for password-only users.
  googleId: text("google_id").unique(),
  fullName: text("full_name").notNull(),
  role: text("role").notNull().default("student"),
  avatarColor: text("avatar_color").notNull().default("violet"),
});

export const insertUserSchema = createInsertSchema(users)
  .omit({ id: true })
  .extend({
    email: z.string().email(),
    username: z.string().min(2),
    // Local email/password registration requires a strong password.
    password: z
      .string()
      .min(8, "Password must be at least 8 characters")
      .regex(/[^A-Za-z0-9]/, "Password needs a special character"),
    fullName: z.string().min(1),
    role: z.enum(["teacher", "student"]).default("student"),
    googleId: z.string().nullable().optional(),
  });

export const loginSchema = z.object({
  identifier: z.string().min(1), // email or username
  password: z.string().min(1),
});

// Password rule shared by registration and reset, kept in one place.
export const passwordSchema = z
  .string()
  .min(8, "Password must be at least 8 characters")
  .regex(/[^A-Za-z0-9]/, "Password needs a special character");

// Sent from the client after Google Identity Services returns an ID token (JWT).
export const googleAuthSchema = z.object({
  credential: z.string().min(1), // the Google ID token (JWT)
  role: z.enum(["teacher", "student"]).default("student"), // used only on first sign-in
});

export const forgotPasswordSchema = z.object({
  email: z.string().email(),
});

export const resetPasswordSchema = z.object({
  token: z.string().min(1),
  password: passwordSchema,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

// ---------------- Password reset tokens ----------------
// A single-use token emailed to the user. expiresAt is epoch-ms (bigint).
export const passwordResetTokens = pgTable("password_reset_tokens", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  token: text("token").notNull().unique(),
  expiresAt: ts("expires_at").notNull(),
  used: integer("used").notNull().default(0), // 0 = unused, 1 = consumed
});

export type PasswordResetToken = typeof passwordResetTokens.$inferSelect;

// ---------------- Groups ----------------
export const groups = pgTable("groups", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description").notNull().default(""),
  color: text("color").notNull().default("violet"),
  teacherId: integer("teacher_id").notNull(),
  createdAt: ts("created_at").notNull(),
});

export const insertGroupSchema = createInsertSchema(groups)
  .omit({ id: true, createdAt: true })
  .extend({ name: z.string().min(1) });

export type InsertGroup = z.infer<typeof insertGroupSchema>;
export type Group = typeof groups.$inferSelect;

// ---------------- Group members ----------------
export const groupMembers = pgTable("group_members", {
  id: serial("id").primaryKey(),
  groupId: integer("group_id").notNull(),
  studentId: integer("student_id").notNull(),
});

export const insertGroupMemberSchema = createInsertSchema(groupMembers).omit({ id: true });
export type GroupMember = typeof groupMembers.$inferSelect;

// ---------------- Quizzes ----------------
// questions stored as JSON text. Each question:
// { id, type: "mcq"|"open"|"photo", prompt, imageUrl?, options?: string[], correctIndex?, points }
// status: "draft" | "scheduled" | "template"
export const quizzes = pgTable("quizzes", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  description: text("description").notNull().default(""),
  teacherId: integer("teacher_id").notNull(),
  groupId: integer("group_id"), // null when it's a template/library item
  questions: text("questions").notNull().default("[]"),
  durationMinutes: integer("duration_minutes").notNull().default(30),
  maxAttempts: integer("max_attempts").notNull().default(1), // 0 = unlimited
  startAt: ts("start_at"), // epoch ms; null for templates
  isTemplate: integer("is_template").notNull().default(0), // 1 = library/backup item
  createdAt: ts("created_at").notNull(),
});

export const questionSchema = z.object({
  id: z.string(),
  type: z.enum([
    "mcq",
    "open",
    "photo",
    "true_false",
    "fill_blank",
    "numeric",
    "multi_select",
  ]),
  prompt: z.string().min(1),
  imageUrl: z.string().optional().default(""),
  options: z.array(z.string()).optional().default([]),
  correctIndex: z.number().optional(),
  correctIndexes: z.array(z.number()).optional().default([]),
  correctText: z.string().optional().default(""),
  correctNumber: z.number().optional(),
  tolerance: z.number().optional().default(0),
  points: z.number().default(1),
});

export const insertQuizSchema = createInsertSchema(quizzes)
  .omit({ id: true, createdAt: true })
  .extend({
    title: z.string().min(1),
    questions: z.string().default("[]"),
  });

export type Question = z.infer<typeof questionSchema>;
export type InsertQuiz = z.infer<typeof insertQuizSchema>;
export type Quiz = typeof quizzes.$inferSelect;

// ---------------- Quiz submissions ----------------
// answers: JSON text -> { [questionId]: { answer: string|number, awardedPoints?: number } }
export const submissions = pgTable("submissions", {
  id: serial("id").primaryKey(),
  quizId: integer("quiz_id").notNull(),
  studentId: integer("student_id").notNull(),
  answers: text("answers").notNull().default("{}"),
  score: integer("score").notNull().default(0),
  maxScore: integer("max_score").notNull().default(0),
  needsGrading: integer("needs_grading").notNull().default(0),
  // JSON map of questionId -> awarded points, saved when a teacher grades. "{}" until graded.
  gradedPoints: text("graded_points").notNull().default("{}"),
  // 1 if the quiz was auto-submitted (e.g. student switched tabs). Shown to teacher.
  autoSubmitted: integer("auto_submitted").notNull().default(0),
  attemptNumber: integer("attempt_number").notNull().default(1),
  submittedAt: ts("submitted_at").notNull(),
});

export const insertSubmissionSchema = createInsertSchema(submissions).omit({ id: true });
export type InsertSubmission = z.infer<typeof insertSubmissionSchema>;
export type Submission = typeof submissions.$inferSelect;

// ---------------- Online sessions ----------------
export const sessions = pgTable("sessions", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  teacherId: integer("teacher_id").notNull(),
  groupId: integer("group_id"),
  meetingUrl: text("meeting_url").notNull(),
  startAt: ts("start_at").notNull(),
  durationMinutes: integer("duration_minutes").notNull().default(60),
  createdAt: ts("created_at").notNull(),
});

export const insertSessionSchema = createInsertSchema(sessions)
  .omit({ id: true, createdAt: true })
  .extend({
    title: z.string().min(1),
    meetingUrl: z.string().url(),
  });

export type InsertSession = z.infer<typeof insertSessionSchema>;
export type ClassSession = typeof sessions.$inferSelect;

// ---------------- Feedback / suggestions ----------------
export const feedback = pgTable("feedback", {
  id: serial("id").primaryKey(),
  name: text("name").notNull().default(""),
  email: text("email").notNull().default(""),
  category: text("category").notNull().default("suggestion"), // suggestion | bug | other
  message: text("message").notNull(),
  createdAt: ts("created_at").notNull(),
});

export const insertFeedbackSchema = createInsertSchema(feedback)
  .omit({ id: true, createdAt: true })
  .extend({
    message: z.string().min(1),
    email: z.string().email().or(z.literal("")),
  });

export type InsertFeedback = z.infer<typeof insertFeedbackSchema>;
export type Feedback = typeof feedback.$inferSelect;

// ---------------- Materials (folders + files) ----------------
// A single tree of nodes. kind: "folder" | "file".
// - Folders organize files; parentId points to the parent folder (null = root).
// - Files carry content: either an uploaded payload (dataUrl, base64 data URI stored
//   in the DB) OR an external link (linkUrl) for YouTube / web links.
// fileType: "pdf" | "video" | "image" | "audio" | "youtube" | "link" | "other"
// visibility: "public" (all of the teacher's students) | "private" (only selected groups).
// Folders inherit nothing — visibility is per file. Folders are always visible to the
// teacher; students only ever see files they are allowed to access (filtered server-side).
export const materials = pgTable("materials", {
  id: serial("id").primaryKey(),
  teacherId: integer("teacher_id").notNull(),
  kind: text("kind").notNull().default("file"), // "folder" | "file"
  name: text("name").notNull(),
  parentId: integer("parent_id"), // null = root level
  fileType: text("file_type").notNull().default("other"), // for files only
  // For uploaded files: a base64 data URI (data:<mime>;base64,....). Empty for folders/links.
  dataUrl: text("data_url").notNull().default(""),
  // For files kept in object storage (Supabase): the object path in the bucket.
  // When set, dataUrl is empty and the file is served via a signed link.
  storagePath: text("storage_path").notNull().default(""),
  // MIME type of an uploaded file (e.g. "application/pdf"). Empty if unknown.
  mimeType: text("mime_type").notNull().default(""),
  // For YouTube / external links. Empty for folders / uploaded files.
  linkUrl: text("link_url").notNull().default(""),
  // Original size in bytes (uploaded files) for display. 0 for folders/links.
  sizeBytes: integer("size_bytes").notNull().default(0),
  visibility: text("visibility").notNull().default("public"), // "public" | "private"
  createdAt: ts("created_at").notNull(),
});

export const insertMaterialSchema = createInsertSchema(materials)
  .omit({ id: true, createdAt: true })
  .extend({
    name: z.string().min(1),
    kind: z.enum(["folder", "file"]).default("file"),
    fileType: z
      .enum(["pdf", "video", "image", "audio", "youtube", "link", "other"])
      .default("other"),
    visibility: z.enum(["public", "private"]).default("public"),
    parentId: z.number().nullable().optional(),
  });

export type InsertMaterial = z.infer<typeof insertMaterialSchema>;
export type Material = typeof materials.$inferSelect;

// Junction: a private material is shared with one or more groups.
export const materialGroups = pgTable("material_groups", {
  id: serial("id").primaryKey(),
  materialId: integer("material_id").notNull(),
  groupId: integer("group_id").notNull(),
});

export const insertMaterialGroupSchema = createInsertSchema(materialGroups).omit({ id: true });
export type MaterialGroup = typeof materialGroups.$inferSelect;

import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// ---------------- Users ----------------
// role: "teacher" | "student"
export const users = sqliteTable("users", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  email: text("email").notNull().unique(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  fullName: text("full_name").notNull(),
  role: text("role").notNull().default("student"),
  avatarColor: text("avatar_color").notNull().default("violet"),
});

export const insertUserSchema = createInsertSchema(users)
  .omit({ id: true })
  .extend({
    email: z.string().email(),
    username: z.string().min(2),
    password: z.string().min(4),
    fullName: z.string().min(1),
    role: z.enum(["teacher", "student"]).default("student"),
  });

export const loginSchema = z.object({
  identifier: z.string().min(1), // email or username
  password: z.string().min(1),
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

// ---------------- Groups ----------------
export const groups = sqliteTable("groups", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  description: text("description").notNull().default(""),
  color: text("color").notNull().default("violet"),
  teacherId: integer("teacher_id").notNull(),
  createdAt: integer("created_at").notNull(),
});

export const insertGroupSchema = createInsertSchema(groups)
  .omit({ id: true, createdAt: true })
  .extend({ name: z.string().min(1) });

export type InsertGroup = z.infer<typeof insertGroupSchema>;
export type Group = typeof groups.$inferSelect;

// ---------------- Group members ----------------
export const groupMembers = sqliteTable("group_members", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  groupId: integer("group_id").notNull(),
  studentId: integer("student_id").notNull(),
});

export const insertGroupMemberSchema = createInsertSchema(groupMembers).omit({ id: true });
export type GroupMember = typeof groupMembers.$inferSelect;

// ---------------- Quizzes ----------------
// questions stored as JSON text. Each question:
// { id, type: "mcq"|"open"|"photo", prompt, imageUrl?, options?: string[], correctIndex?, points }
// status: "draft" | "scheduled" | "template"
export const quizzes = sqliteTable("quizzes", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  title: text("title").notNull(),
  description: text("description").notNull().default(""),
  teacherId: integer("teacher_id").notNull(),
  groupId: integer("group_id"), // null when it's a template/library item
  questions: text("questions").notNull().default("[]"),
  durationMinutes: integer("duration_minutes").notNull().default(30),
  startAt: integer("start_at"), // epoch ms; null for templates
  isTemplate: integer("is_template").notNull().default(0), // 1 = library/backup item
  createdAt: integer("created_at").notNull(),
});

export const questionSchema = z.object({
  id: z.string(),
  type: z.enum(["mcq", "open", "photo"]),
  prompt: z.string().min(1),
  imageUrl: z.string().optional().default(""),
  options: z.array(z.string()).optional().default([]),
  correctIndex: z.number().optional(),
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
export const submissions = sqliteTable("submissions", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  quizId: integer("quiz_id").notNull(),
  studentId: integer("student_id").notNull(),
  answers: text("answers").notNull().default("{}"),
  score: integer("score").notNull().default(0),
  maxScore: integer("max_score").notNull().default(0),
  needsGrading: integer("needs_grading").notNull().default(0),
  submittedAt: integer("submitted_at").notNull(),
});

export const insertSubmissionSchema = createInsertSchema(submissions).omit({ id: true });
export type InsertSubmission = z.infer<typeof insertSubmissionSchema>;
export type Submission = typeof submissions.$inferSelect;

// ---------------- Online sessions ----------------
export const sessions = sqliteTable("sessions", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  title: text("title").notNull(),
  teacherId: integer("teacher_id").notNull(),
  groupId: integer("group_id"),
  meetingUrl: text("meeting_url").notNull(),
  startAt: integer("start_at").notNull(),
  durationMinutes: integer("duration_minutes").notNull().default(60),
  createdAt: integer("created_at").notNull(),
});

export const insertSessionSchema = createInsertSchema(sessions)
  .omit({ id: true, createdAt: true })
  .extend({
    title: z.string().min(1),
    meetingUrl: z.string().url(),
  });

export type InsertSession = z.infer<typeof insertSessionSchema>;
export type ClassSession = typeof sessions.$inferSelect;

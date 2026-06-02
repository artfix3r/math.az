import {
  users, groups, groupMembers, quizzes, submissions, sessions,
} from "@shared/schema";
import type {
  User, InsertUser, Group, InsertGroup, GroupMember,
  Quiz, InsertQuiz, Submission, InsertSubmission,
  ClassSession, InsertSession,
} from "@shared/schema";
import { drizzle } from "drizzle-orm/better-sqlite3";
import Database from "better-sqlite3";
import { eq, and, inArray } from "drizzle-orm";

// DB path is configurable so production hosts (e.g. Render) can point it at a
// persistent mounted disk via DATABASE_PATH. Defaults to a local file otherwise.
const sqlite = new Database(process.env.DATABASE_PATH || "data.db");
sqlite.pragma("journal_mode = WAL");

// Create tables if they don't exist (template ships no migration runner).
sqlite.exec(`
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT NOT NULL UNIQUE,
  username TEXT NOT NULL UNIQUE,
  password TEXT NOT NULL,
  full_name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'student',
  avatar_color TEXT NOT NULL DEFAULT 'violet'
);
CREATE TABLE IF NOT EXISTS groups (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  color TEXT NOT NULL DEFAULT 'violet',
  teacher_id INTEGER NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS group_members (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  group_id INTEGER NOT NULL,
  student_id INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS quizzes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  teacher_id INTEGER NOT NULL,
  group_id INTEGER,
  questions TEXT NOT NULL DEFAULT '[]',
  duration_minutes INTEGER NOT NULL DEFAULT 30,
  start_at INTEGER,
  is_template INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS submissions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  quiz_id INTEGER NOT NULL,
  student_id INTEGER NOT NULL,
  answers TEXT NOT NULL DEFAULT '{}',
  score INTEGER NOT NULL DEFAULT 0,
  max_score INTEGER NOT NULL DEFAULT 0,
  needs_grading INTEGER NOT NULL DEFAULT 0,
  graded_points TEXT NOT NULL DEFAULT '{}',
  submitted_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS sessions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  teacher_id INTEGER NOT NULL,
  group_id INTEGER,
  meeting_url TEXT NOT NULL,
  start_at INTEGER NOT NULL,
  duration_minutes INTEGER NOT NULL DEFAULT 60,
  created_at INTEGER NOT NULL
);
`);

export const db = drizzle(sqlite);

export interface IStorage {
  // users
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  getUsersByIds(ids: number[]): Promise<User[]>;
  createUser(user: InsertUser): Promise<User>;
  // groups
  createGroup(g: InsertGroup): Promise<Group>;
  getGroupsByTeacher(teacherId: number): Promise<Group[]>;
  getGroupsByStudent(studentId: number): Promise<Group[]>;
  getGroup(id: number): Promise<Group | undefined>;
  deleteGroup(id: number): Promise<void>;
  // members
  addMember(groupId: number, studentId: number): Promise<GroupMember>;
  removeMember(groupId: number, studentId: number): Promise<void>;
  getMembers(groupId: number): Promise<User[]>;
  isMember(groupId: number, studentId: number): Promise<boolean>;
  // quizzes
  createQuiz(q: InsertQuiz): Promise<Quiz>;
  updateQuiz(id: number, q: Partial<InsertQuiz>): Promise<Quiz | undefined>;
  getQuiz(id: number): Promise<Quiz | undefined>;
  getQuizzesByTeacher(teacherId: number): Promise<Quiz[]>;
  getTemplatesByTeacher(teacherId: number): Promise<Quiz[]>;
  getQuizzesForStudent(studentId: number): Promise<Quiz[]>;
  deleteQuiz(id: number): Promise<void>;
  // submissions
  createSubmission(s: InsertSubmission): Promise<Submission>;
  updateSubmission(id: number, s: Partial<Submission>): Promise<Submission | undefined>;
  getSubmissionsByQuiz(quizId: number): Promise<Submission[]>;
  getSubmissionsByStudent(studentId: number): Promise<Submission[]>;
  getSubmission(quizId: number, studentId: number): Promise<Submission | undefined>;
  // sessions
  createSession(s: InsertSession): Promise<ClassSession>;
  getSessionsByTeacher(teacherId: number): Promise<ClassSession[]>;
  getSessionsForStudent(studentId: number): Promise<ClassSession[]>;
  deleteSession(id: number): Promise<void>;
}

export class DatabaseStorage implements IStorage {
  // ---- users ----
  async getUser(id: number) {
    return db.select().from(users).where(eq(users.id, id)).get();
  }
  async getUserByUsername(username: string) {
    return db.select().from(users).where(eq(users.username, username)).get();
  }
  async getUserByEmail(email: string) {
    return db.select().from(users).where(eq(users.email, email)).get();
  }
  async getUsersByIds(ids: number[]) {
    if (ids.length === 0) return [];
    return db.select().from(users).where(inArray(users.id, ids)).all();
  }
  async createUser(insertUser: InsertUser) {
    return db.insert(users).values(insertUser).returning().get();
  }

  // ---- groups ----
  async createGroup(g: InsertGroup) {
    return db.insert(groups).values({ ...g, createdAt: Date.now() }).returning().get();
  }
  async getGroupsByTeacher(teacherId: number) {
    return db.select().from(groups).where(eq(groups.teacherId, teacherId)).all();
  }
  async getGroupsByStudent(studentId: number) {
    const memberships = db.select().from(groupMembers)
      .where(eq(groupMembers.studentId, studentId)).all();
    const gids = memberships.map((m) => m.groupId);
    if (gids.length === 0) return [];
    return db.select().from(groups).where(inArray(groups.id, gids)).all();
  }
  async getGroup(id: number) {
    return db.select().from(groups).where(eq(groups.id, id)).get();
  }
  async deleteGroup(id: number) {
    db.delete(groupMembers).where(eq(groupMembers.groupId, id)).run();
    db.delete(groups).where(eq(groups.id, id)).run();
  }

  // ---- members ----
  async addMember(groupId: number, studentId: number) {
    return db.insert(groupMembers).values({ groupId, studentId }).returning().get();
  }
  async removeMember(groupId: number, studentId: number) {
    db.delete(groupMembers)
      .where(and(eq(groupMembers.groupId, groupId), eq(groupMembers.studentId, studentId)))
      .run();
  }
  async getMembers(groupId: number) {
    const ms = db.select().from(groupMembers).where(eq(groupMembers.groupId, groupId)).all();
    return this.getUsersByIds(ms.map((m) => m.studentId));
  }
  async isMember(groupId: number, studentId: number) {
    const row = db.select().from(groupMembers)
      .where(and(eq(groupMembers.groupId, groupId), eq(groupMembers.studentId, studentId)))
      .get();
    return !!row;
  }

  // ---- quizzes ----
  async createQuiz(q: InsertQuiz) {
    return db.insert(quizzes).values({ ...q, createdAt: Date.now() }).returning().get();
  }
  async updateQuiz(id: number, q: Partial<InsertQuiz>) {
    return db.update(quizzes).set(q).where(eq(quizzes.id, id)).returning().get();
  }
  async getQuiz(id: number) {
    return db.select().from(quizzes).where(eq(quizzes.id, id)).get();
  }
  async getQuizzesByTeacher(teacherId: number) {
    return db.select().from(quizzes)
      .where(and(eq(quizzes.teacherId, teacherId), eq(quizzes.isTemplate, 0))).all();
  }
  async getTemplatesByTeacher(teacherId: number) {
    return db.select().from(quizzes)
      .where(and(eq(quizzes.teacherId, teacherId), eq(quizzes.isTemplate, 1))).all();
  }
  async getQuizzesForStudent(studentId: number) {
    const memberships = db.select().from(groupMembers)
      .where(eq(groupMembers.studentId, studentId)).all();
    const gids = memberships.map((m) => m.groupId);
    if (gids.length === 0) return [];
    return db.select().from(quizzes)
      .where(and(inArray(quizzes.groupId, gids), eq(quizzes.isTemplate, 0))).all();
  }
  async deleteQuiz(id: number) {
    db.delete(quizzes).where(eq(quizzes.id, id)).run();
  }

  // ---- submissions ----
  async createSubmission(s: InsertSubmission) {
    return db.insert(submissions).values(s).returning().get();
  }
  async updateSubmission(id: number, s: Partial<Submission>) {
    return db.update(submissions).set(s).where(eq(submissions.id, id)).returning().get();
  }
  async getSubmissionsByQuiz(quizId: number) {
    return db.select().from(submissions).where(eq(submissions.quizId, quizId)).all();
  }
  async getSubmissionsByStudent(studentId: number) {
    return db.select().from(submissions).where(eq(submissions.studentId, studentId)).all();
  }
  async getSubmission(quizId: number, studentId: number) {
    return db.select().from(submissions)
      .where(and(eq(submissions.quizId, quizId), eq(submissions.studentId, studentId)))
      .get();
  }

  // ---- sessions ----
  async createSession(s: InsertSession) {
    return db.insert(sessions).values({ ...s, createdAt: Date.now() }).returning().get();
  }
  async getSessionsByTeacher(teacherId: number) {
    return db.select().from(sessions).where(eq(sessions.teacherId, teacherId)).all();
  }
  async getSessionsForStudent(studentId: number) {
    const memberships = db.select().from(groupMembers)
      .where(eq(groupMembers.studentId, studentId)).all();
    const gids = memberships.map((m) => m.groupId);
    if (gids.length === 0) return [];
    // teachers of the student's groups
    const myGroups = db.select().from(groups).where(inArray(groups.id, gids)).all();
    const teacherIds = Array.from(new Set(myGroups.map((g) => g.teacherId)));
    const all = db.select().from(sessions).all();
    return all.filter(
      (s) => (s.groupId != null && gids.includes(s.groupId)) ||
             (s.groupId == null && teacherIds.includes(s.teacherId)),
    );
  }
  async deleteSession(id: number) {
    db.delete(sessions).where(eq(sessions.id, id)).run();
  }
}

export const storage = new DatabaseStorage();

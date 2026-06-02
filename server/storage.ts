import {
  users, groups, groupMembers, quizzes, submissions, sessions, feedback,
  materials, materialGroups,
} from "@shared/schema";
import type {
  User, InsertUser, Group, InsertGroup, GroupMember,
  Quiz, InsertQuiz, Submission, InsertSubmission,
  ClassSession, InsertSession, Feedback, InsertFeedback,
  Material, InsertMaterial, MaterialGroup,
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
  max_attempts INTEGER NOT NULL DEFAULT 1,
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
  auto_submitted INTEGER NOT NULL DEFAULT 0,
  attempt_number INTEGER NOT NULL DEFAULT 1,
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
CREATE TABLE IF NOT EXISTS feedback (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL DEFAULT '',
  email TEXT NOT NULL DEFAULT '',
  category TEXT NOT NULL DEFAULT 'suggestion',
  message TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS materials (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  teacher_id INTEGER NOT NULL,
  kind TEXT NOT NULL DEFAULT 'file',
  name TEXT NOT NULL,
  parent_id INTEGER,
  file_type TEXT NOT NULL DEFAULT 'other',
  data_url TEXT NOT NULL DEFAULT '',
  link_url TEXT NOT NULL DEFAULT '',
  size_bytes INTEGER NOT NULL DEFAULT 0,
  visibility TEXT NOT NULL DEFAULT 'public',
  created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS material_groups (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  material_id INTEGER NOT NULL,
  group_id INTEGER NOT NULL
);
`);

// Idempotent migrations for databases created before these columns existed.
// SQLite has no "ADD COLUMN IF NOT EXISTS", so we check the table info first.
function ensureColumn(table: string, column: string, ddl: string) {
  const cols = sqlite.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[];
  if (!cols.some((c) => c.name === column)) {
    sqlite.exec(`ALTER TABLE ${table} ADD COLUMN ${ddl}`);
  }
}
ensureColumn("quizzes", "max_attempts", "max_attempts INTEGER NOT NULL DEFAULT 1");
ensureColumn("submissions", "auto_submitted", "auto_submitted INTEGER NOT NULL DEFAULT 0");
ensureColumn("submissions", "attempt_number", "attempt_number INTEGER NOT NULL DEFAULT 1");

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
  getSubmissionById(id: number): Promise<Submission | undefined>;
  deleteSubmission(id: number): Promise<void>;
  // feedback
  createFeedback(f: InsertFeedback): Promise<Feedback>;
  getAllFeedback(): Promise<Feedback[]>;
  // sessions
  createSession(s: InsertSession): Promise<ClassSession>;
  getSessionsByTeacher(teacherId: number): Promise<ClassSession[]>;
  getSessionsForStudent(studentId: number): Promise<ClassSession[]>;
  deleteSession(id: number): Promise<void>;
  // materials
  createMaterial(m: InsertMaterial): Promise<Material>;
  updateMaterial(id: number, m: Partial<InsertMaterial>): Promise<Material | undefined>;
  getMaterial(id: number): Promise<Material | undefined>;
  getMaterialsByTeacher(teacherId: number): Promise<Material[]>;
  getMaterialsForStudent(studentId: number): Promise<Material[]>;
  deleteMaterial(id: number): Promise<void>;
  setMaterialGroups(materialId: number, groupIds: number[]): Promise<void>;
  getMaterialGroups(materialId: number): Promise<MaterialGroup[]>;
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
  async getSubmissionById(id: number) {
    return db.select().from(submissions).where(eq(submissions.id, id)).get();
  }
  async deleteSubmission(id: number) {
    db.delete(submissions).where(eq(submissions.id, id)).run();
  }

  // ---- feedback ----
  async createFeedback(f: InsertFeedback) {
    return db.insert(feedback).values({ ...f, createdAt: Date.now() }).returning().get();
  }
  async getAllFeedback() {
    return db.select().from(feedback).all();
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

  // ---- materials ----
  async createMaterial(m: InsertMaterial) {
    return db.insert(materials).values({
      ...m,
      parentId: m.parentId ?? null,
      createdAt: Date.now(),
    }).returning().get();
  }
  async updateMaterial(id: number, m: Partial<InsertMaterial>) {
    return db.update(materials).set(m).where(eq(materials.id, id)).returning().get();
  }
  async getMaterial(id: number) {
    return db.select().from(materials).where(eq(materials.id, id)).get();
  }
  async getMaterialsByTeacher(teacherId: number) {
    return db.select().from(materials).where(eq(materials.teacherId, teacherId)).all();
  }
  async getMaterialsForStudent(studentId: number) {
    // Student's groups
    const memberships = db.select().from(groupMembers)
      .where(eq(groupMembers.studentId, studentId)).all();
    const gids = memberships.map((m) => m.groupId);
    // Teachers of the student's groups — student can see those teachers' public materials.
    const myGroups = gids.length
      ? db.select().from(groups).where(inArray(groups.id, gids)).all()
      : [];
    const teacherIds = Array.from(new Set(myGroups.map((g) => g.teacherId)));
    if (teacherIds.length === 0) return [];
    // All file materials belonging to those teachers (folders are reconstructed client-side
    // from parentId chains of the accessible files).
    const all = db.select().from(materials)
      .where(inArray(materials.teacherId, teacherIds)).all();
    // Private material -> group ids it is shared with.
    const mgRows = db.select().from(materialGroups).all();
    const sharedByMaterial = new Map<number, number[]>();
    for (const r of mgRows) {
      const arr = sharedByMaterial.get(r.materialId) || [];
      arr.push(r.groupId);
      sharedByMaterial.set(r.materialId, arr);
    }
    const gidSet = new Set(gids);
    return all.filter((m) => {
      if (m.kind === "folder") return true; // folders are structural; surfaced if they hold accessible files
      if (m.visibility === "public") return true;
      const shared = sharedByMaterial.get(m.id) || [];
      return shared.some((g) => gidSet.has(g));
    });
  }
  async deleteMaterial(id: number) {
    // Cascade: delete this node, all descendant nodes (recursively), and their group links.
    const all = db.select().from(materials).all();
    const toDelete = new Set<number>([id]);
    let grew = true;
    while (grew) {
      grew = false;
      for (const m of all) {
        if (m.parentId != null && toDelete.has(m.parentId) && !toDelete.has(m.id)) {
          toDelete.add(m.id);
          grew = true;
        }
      }
    }
    const ids = Array.from(toDelete);
    db.delete(materialGroups).where(inArray(materialGroups.materialId, ids)).run();
    db.delete(materials).where(inArray(materials.id, ids)).run();
  }
  async setMaterialGroups(materialId: number, groupIds: number[]) {
    db.delete(materialGroups).where(eq(materialGroups.materialId, materialId)).run();
    for (const groupId of groupIds) {
      db.insert(materialGroups).values({ materialId, groupId }).run();
    }
  }
  async getMaterialGroups(materialId: number) {
    return db.select().from(materialGroups)
      .where(eq(materialGroups.materialId, materialId)).all();
  }
}

export const storage = new DatabaseStorage();

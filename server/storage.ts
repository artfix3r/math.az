import {
  users, groups, groupMembers, quizzes, submissions, sessions, feedback,
  materials, materialGroups, passwordResetTokens,
} from "@shared/schema";
import type {
  User, InsertUser, Group, InsertGroup, GroupMember,
  Quiz, InsertQuiz, Submission, InsertSubmission,
  ClassSession, InsertSession, Feedback, InsertFeedback,
  Material, InsertMaterial, MaterialGroup, PasswordResetToken,
} from "@shared/schema";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { eq, and, inArray } from "drizzle-orm";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL is required");

// disable prepared statements — safe for pgbouncer / Vercel serverless
const client = postgres(connectionString, { prepare: false, onnotice: () => {} });
export const db = drizzle(client);

// Auto-create / migrate tables. Runs once per process; if the database is
// unreachable (e.g. a paused or waking Supabase project) the attempt is
// forgotten so the next request retries instead of the process crashing.
let schemaPromise: Promise<void> | null = null;
export function ensureSchema(): Promise<void> {
  if (!schemaPromise) {
    schemaPromise = runSchema().catch((e) => {
      schemaPromise = null;
      throw e;
    });
  }
  return schemaPromise;
}

async function runSchema() {
  await client.unsafe(`
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  username TEXT NOT NULL UNIQUE,
  password TEXT NOT NULL,
  full_name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'student',
  avatar_color TEXT NOT NULL DEFAULT 'violet'
);
CREATE TABLE IF NOT EXISTS groups (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  color TEXT NOT NULL DEFAULT 'violet',
  teacher_id INTEGER NOT NULL,
  created_at BIGINT NOT NULL
);
CREATE TABLE IF NOT EXISTS group_members (
  id SERIAL PRIMARY KEY,
  group_id INTEGER NOT NULL,
  student_id INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS quizzes (
  id SERIAL PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  teacher_id INTEGER NOT NULL,
  group_id INTEGER,
  questions TEXT NOT NULL DEFAULT '[]',
  duration_minutes INTEGER NOT NULL DEFAULT 30,
  max_attempts INTEGER NOT NULL DEFAULT 1,
  start_at BIGINT,
  is_template INTEGER NOT NULL DEFAULT 0,
  created_at BIGINT NOT NULL
);
CREATE TABLE IF NOT EXISTS submissions (
  id SERIAL PRIMARY KEY,
  quiz_id INTEGER NOT NULL,
  student_id INTEGER NOT NULL,
  answers TEXT NOT NULL DEFAULT '{}',
  score INTEGER NOT NULL DEFAULT 0,
  max_score INTEGER NOT NULL DEFAULT 0,
  needs_grading INTEGER NOT NULL DEFAULT 0,
  graded_points TEXT NOT NULL DEFAULT '{}',
  auto_submitted INTEGER NOT NULL DEFAULT 0,
  attempt_number INTEGER NOT NULL DEFAULT 1,
  submitted_at BIGINT NOT NULL
);
CREATE TABLE IF NOT EXISTS sessions (
  id SERIAL PRIMARY KEY,
  title TEXT NOT NULL,
  teacher_id INTEGER NOT NULL,
  group_id INTEGER,
  meeting_url TEXT NOT NULL,
  start_at BIGINT NOT NULL,
  duration_minutes INTEGER NOT NULL DEFAULT 60,
  created_at BIGINT NOT NULL
);
CREATE TABLE IF NOT EXISTS feedback (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL DEFAULT '',
  email TEXT NOT NULL DEFAULT '',
  category TEXT NOT NULL DEFAULT 'suggestion',
  message TEXT NOT NULL,
  created_at BIGINT NOT NULL
);
CREATE TABLE IF NOT EXISTS materials (
  id SERIAL PRIMARY KEY,
  teacher_id INTEGER NOT NULL,
  kind TEXT NOT NULL DEFAULT 'file',
  name TEXT NOT NULL,
  parent_id INTEGER,
  file_type TEXT NOT NULL DEFAULT 'other',
  data_url TEXT NOT NULL DEFAULT '',
  link_url TEXT NOT NULL DEFAULT '',
  size_bytes INTEGER NOT NULL DEFAULT 0,
  visibility TEXT NOT NULL DEFAULT 'public',
  created_at BIGINT NOT NULL
);
CREATE TABLE IF NOT EXISTS material_groups (
  id SERIAL PRIMARY KEY,
  material_id INTEGER NOT NULL,
  group_id INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS password_reset_tokens (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL,
  token TEXT NOT NULL UNIQUE,
  expires_at BIGINT NOT NULL,
  used INTEGER NOT NULL DEFAULT 0
);
ALTER TABLE quizzes ADD COLUMN IF NOT EXISTS max_attempts INTEGER NOT NULL DEFAULT 1;
ALTER TABLE submissions ADD COLUMN IF NOT EXISTS auto_submitted INTEGER NOT NULL DEFAULT 0;
ALTER TABLE submissions ADD COLUMN IF NOT EXISTS attempt_number INTEGER NOT NULL DEFAULT 1;
-- Google sign-in + nullable password (Google-only accounts have no local password).
ALTER TABLE users ADD COLUMN IF NOT EXISTS google_id TEXT;
ALTER TABLE users ALTER COLUMN password DROP NOT NULL;
-- Uploaded materials can live in object storage instead of data_url.
ALTER TABLE materials ADD COLUMN IF NOT EXISTS storage_path TEXT NOT NULL DEFAULT '';
ALTER TABLE materials ADD COLUMN IF NOT EXISTS mime_type TEXT NOT NULL DEFAULT '';
-- Hosts like Supabase expose the public schema through a web API. The app
-- connects as the table owner (which bypasses RLS), so enabling RLS with no
-- policies blocks that API without affecting the app.
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE password_reset_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE group_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE quizzes ENABLE ROW LEVEL SECURITY;
ALTER TABLE submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE feedback ENABLE ROW LEVEL SECURITY;
ALTER TABLE materials ENABLE ROW LEVEL SECURITY;
ALTER TABLE material_groups ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'users_google_id_unique') THEN
    ALTER TABLE users ADD CONSTRAINT users_google_id_unique UNIQUE (google_id);
  END IF;
END $$;
`);
}

export interface IStorage {
  // users
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  getUserByGoogleId(googleId: string): Promise<User | undefined>;
  getUsersByIds(ids: number[]): Promise<User[]>;
  createUser(user: InsertUser): Promise<User>;
  linkGoogleId(userId: number, googleId: string): Promise<User | undefined>;
  updateUserPassword(userId: number, hashedPassword: string): Promise<void>;
  // password reset tokens
  createResetToken(userId: number, token: string, expiresAt: number): Promise<PasswordResetToken>;
  getResetToken(token: string): Promise<PasswordResetToken | undefined>;
  markResetTokenUsed(id: number): Promise<void>;
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
  deleteMaterial(id: number): Promise<string[]>;
  setMaterialGroups(materialId: number, groupIds: number[]): Promise<void>;
  getMaterialGroups(materialId: number): Promise<MaterialGroup[]>;
}

export class DatabaseStorage implements IStorage {
  // ---- users ----
  async getUser(id: number) {
    const rows = await db.select().from(users).where(eq(users.id, id));
    return rows[0];
  }
  async getUserByUsername(username: string) {
    const rows = await db.select().from(users).where(eq(users.username, username));
    return rows[0];
  }
  async getUserByEmail(email: string) {
    const rows = await db.select().from(users).where(eq(users.email, email));
    return rows[0];
  }
  async getUsersByIds(ids: number[]) {
    if (ids.length === 0) return [];
    return db.select().from(users).where(inArray(users.id, ids));
  }
  async getUserByGoogleId(googleId: string) {
    const rows = await db.select().from(users).where(eq(users.googleId, googleId));
    return rows[0];
  }
  async createUser(insertUser: InsertUser) {
    const rows = await db.insert(users).values(insertUser).returning();
    return rows[0];
  }
  async linkGoogleId(userId: number, googleId: string) {
    const rows = await db.update(users).set({ googleId }).where(eq(users.id, userId)).returning();
    return rows[0];
  }
  async updateUserPassword(userId: number, hashedPassword: string) {
    await db.update(users).set({ password: hashedPassword }).where(eq(users.id, userId));
  }

  // ---- password reset tokens ----
  async createResetToken(userId: number, token: string, expiresAt: number) {
    const rows = await db.insert(passwordResetTokens)
      .values({ userId, token, expiresAt, used: 0 }).returning();
    return rows[0];
  }
  async getResetToken(token: string) {
    const rows = await db.select().from(passwordResetTokens)
      .where(eq(passwordResetTokens.token, token));
    return rows[0];
  }
  async markResetTokenUsed(id: number) {
    await db.update(passwordResetTokens).set({ used: 1 })
      .where(eq(passwordResetTokens.id, id));
  }

  // ---- groups ----
  async createGroup(g: InsertGroup) {
    const rows = await db.insert(groups).values({ ...g, createdAt: Date.now() }).returning();
    return rows[0];
  }
  async getGroupsByTeacher(teacherId: number) {
    return db.select().from(groups).where(eq(groups.teacherId, teacherId));
  }
  async getGroupsByStudent(studentId: number) {
    const memberships = await db.select().from(groupMembers)
      .where(eq(groupMembers.studentId, studentId));
    const gids = memberships.map((m) => m.groupId);
    if (gids.length === 0) return [];
    return db.select().from(groups).where(inArray(groups.id, gids));
  }
  async getGroup(id: number) {
    const rows = await db.select().from(groups).where(eq(groups.id, id));
    return rows[0];
  }
  async deleteGroup(id: number) {
    await db.delete(groupMembers).where(eq(groupMembers.groupId, id));
    await db.delete(groups).where(eq(groups.id, id));
  }

  // ---- members ----
  async addMember(groupId: number, studentId: number) {
    const rows = await db.insert(groupMembers).values({ groupId, studentId }).returning();
    return rows[0];
  }
  async removeMember(groupId: number, studentId: number) {
    await db.delete(groupMembers)
      .where(and(eq(groupMembers.groupId, groupId), eq(groupMembers.studentId, studentId)));
  }
  async getMembers(groupId: number) {
    const ms = await db.select().from(groupMembers).where(eq(groupMembers.groupId, groupId));
    return this.getUsersByIds(ms.map((m) => m.studentId));
  }
  async isMember(groupId: number, studentId: number) {
    const rows = await db.select().from(groupMembers)
      .where(and(eq(groupMembers.groupId, groupId), eq(groupMembers.studentId, studentId)));
    return rows.length > 0;
  }

  // ---- quizzes ----
  async createQuiz(q: InsertQuiz) {
    const rows = await db.insert(quizzes).values({ ...q, createdAt: Date.now() }).returning();
    return rows[0];
  }
  async updateQuiz(id: number, q: Partial<InsertQuiz>) {
    const rows = await db.update(quizzes).set(q).where(eq(quizzes.id, id)).returning();
    return rows[0];
  }
  async getQuiz(id: number) {
    const rows = await db.select().from(quizzes).where(eq(quizzes.id, id));
    return rows[0];
  }
  async getQuizzesByTeacher(teacherId: number) {
    return db.select().from(quizzes)
      .where(and(eq(quizzes.teacherId, teacherId), eq(quizzes.isTemplate, 0)));
  }
  async getTemplatesByTeacher(teacherId: number) {
    return db.select().from(quizzes)
      .where(and(eq(quizzes.teacherId, teacherId), eq(quizzes.isTemplate, 1)));
  }
  async getQuizzesForStudent(studentId: number) {
    const memberships = await db.select().from(groupMembers)
      .where(eq(groupMembers.studentId, studentId));
    const gids = memberships.map((m) => m.groupId);
    if (gids.length === 0) return [];
    return db.select().from(quizzes)
      .where(and(inArray(quizzes.groupId, gids), eq(quizzes.isTemplate, 0)));
  }
  async deleteQuiz(id: number) {
    await db.delete(quizzes).where(eq(quizzes.id, id));
  }

  // ---- submissions ----
  async createSubmission(s: InsertSubmission) {
    const rows = await db.insert(submissions).values(s).returning();
    return rows[0];
  }
  async updateSubmission(id: number, s: Partial<Submission>) {
    const rows = await db.update(submissions).set(s).where(eq(submissions.id, id)).returning();
    return rows[0];
  }
  async getSubmissionsByQuiz(quizId: number) {
    return db.select().from(submissions).where(eq(submissions.quizId, quizId));
  }
  async getSubmissionsByStudent(studentId: number) {
    return db.select().from(submissions).where(eq(submissions.studentId, studentId));
  }
  async getSubmission(quizId: number, studentId: number) {
    const rows = await db.select().from(submissions)
      .where(and(eq(submissions.quizId, quizId), eq(submissions.studentId, studentId)));
    return rows[0];
  }
  async getSubmissionById(id: number) {
    const rows = await db.select().from(submissions).where(eq(submissions.id, id));
    return rows[0];
  }
  async deleteSubmission(id: number) {
    await db.delete(submissions).where(eq(submissions.id, id));
  }

  // ---- feedback ----
  async createFeedback(f: InsertFeedback) {
    const rows = await db.insert(feedback).values({ ...f, createdAt: Date.now() }).returning();
    return rows[0];
  }
  async getAllFeedback() {
    return db.select().from(feedback);
  }

  // ---- sessions ----
  async createSession(s: InsertSession) {
    const rows = await db.insert(sessions).values({ ...s, createdAt: Date.now() }).returning();
    return rows[0];
  }
  async getSessionsByTeacher(teacherId: number) {
    return db.select().from(sessions).where(eq(sessions.teacherId, teacherId));
  }
  async getSessionsForStudent(studentId: number) {
    const memberships = await db.select().from(groupMembers)
      .where(eq(groupMembers.studentId, studentId));
    const gids = memberships.map((m) => m.groupId);
    if (gids.length === 0) return [];
    // teachers of the student's groups
    const myGroups = await db.select().from(groups).where(inArray(groups.id, gids));
    const teacherIds = Array.from(new Set(myGroups.map((g) => g.teacherId)));
    const all = await db.select().from(sessions);
    return all.filter(
      (s) => (s.groupId != null && gids.includes(s.groupId)) ||
             (s.groupId == null && teacherIds.includes(s.teacherId)),
    );
  }
  async deleteSession(id: number) {
    await db.delete(sessions).where(eq(sessions.id, id));
  }

  // ---- materials ----
  async createMaterial(m: InsertMaterial) {
    const rows = await db.insert(materials).values({
      ...m,
      parentId: m.parentId ?? null,
      createdAt: Date.now(),
    }).returning();
    return rows[0];
  }
  async updateMaterial(id: number, m: Partial<InsertMaterial>) {
    const rows = await db.update(materials).set(m).where(eq(materials.id, id)).returning();
    return rows[0];
  }
  async getMaterial(id: number) {
    const rows = await db.select().from(materials).where(eq(materials.id, id));
    return rows[0];
  }
  async getMaterialsByTeacher(teacherId: number) {
    return db.select().from(materials).where(eq(materials.teacherId, teacherId));
  }
  async getMaterialsForStudent(studentId: number) {
    // Student's groups
    const memberships = await db.select().from(groupMembers)
      .where(eq(groupMembers.studentId, studentId));
    const gids = memberships.map((m) => m.groupId);
    // Teachers of the student's groups — student can see those teachers' public materials.
    const myGroups = gids.length
      ? await db.select().from(groups).where(inArray(groups.id, gids))
      : [];
    const teacherIds = Array.from(new Set(myGroups.map((g) => g.teacherId)));
    if (teacherIds.length === 0) return [];
    // All file materials belonging to those teachers (folders are reconstructed client-side
    // from parentId chains of the accessible files).
    const all = await db.select().from(materials)
      .where(inArray(materials.teacherId, teacherIds));
    // Private material -> group ids it is shared with.
    const mgRows = await db.select().from(materialGroups);
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
    const all = await db.select().from(materials);
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
    await db.delete(materialGroups).where(inArray(materialGroups.materialId, ids));
    await db.delete(materials).where(inArray(materials.id, ids));
    // Return the storage objects that belonged to the deleted nodes so the
    // caller can remove them from the bucket.
    return all.filter((m) => toDelete.has(m.id) && m.storagePath).map((m) => m.storagePath);
  }
  async setMaterialGroups(materialId: number, groupIds: number[]) {
    await db.delete(materialGroups).where(eq(materialGroups.materialId, materialId));
    for (const groupId of groupIds) {
      await db.insert(materialGroups).values({ materialId, groupId });
    }
  }
  async getMaterialGroups(materialId: number) {
    return db.select().from(materialGroups)
      .where(eq(materialGroups.materialId, materialId));
  }
}

export const storage = new DatabaseStorage();

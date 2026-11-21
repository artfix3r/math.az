import type { Express, Request, Response, NextFunction } from "express";
import { createServer } from "node:http";
import type { Server } from "node:http";
import { storage } from "./storage";
import {
  insertUserSchema, loginSchema, insertGroupSchema,
  insertQuizSchema, insertSessionSchema, questionSchema,
  insertFeedbackSchema, insertMaterialSchema,
  googleAuthSchema, forgotPasswordSchema, resetPasswordSchema,
} from "@shared/schema";
import type { Question, Quiz, User } from "@shared/schema";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { randomBytes } from "node:crypto";
import { OAuth2Client } from "google-auth-library";
import { sendResetEmail, sendReminderEmail, isEmailConfigured } from "./mailer";
import { remindersToSend, REMINDER_WINDOW_MS } from "@shared/deadlines";
import { computeProgress } from "@shared/progress";
import { timingSafeEqual, createHash } from "node:crypto";
import { readSessionUserId, setSession, clearSession } from "./session";
import { attachErrorCodes, zodErrorBody } from "./errors";
import { buildVariant, gradeAnswers, answersToOriginal, variantSeed } from "@shared/quiz-variants";
import {
  isStorageEnabled, publicStorageConfig, createUploadUrl, createDownloadUrl,
  removeFiles, teacherPrefix, MAX_UPLOAD_BYTES,
} from "./file-storage";

const BCRYPT_ROUNDS = 10;
const RESET_TOKEN_TTL_MS = 60 * 60 * 1000; // 1 hour

// Google ID-token verifier. GOOGLE_CLIENT_ID must match the OAuth client used
// by the frontend (the token's audience is checked against it).
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || "";
const googleClient = new OAuth2Client(GOOGLE_CLIENT_ID);

// Where reset links point. On Vercel this is the production URL; locally it is
// the dev server. Falls back to localhost for safety.
const APP_BASE_URL = (process.env.APP_BASE_URL || "http://localhost:5000").replace(/\/$/, "");

// Build a unique, collision-safe username from an email local-part.
async function uniqueUsernameFromEmail(email: string): Promise<string> {
  const base = (email.split("@")[0] || "user").replace(/[^a-zA-Z0-9_]/g, "").slice(0, 24) || "user";
  let candidate = base;
  let n = 0;
  // Try base, base1, base2, ... until free.
  while (await storage.getUserByUsername(candidate)) {
    n += 1;
    candidate = `${base}${n}`;
  }
  return candidate;
}

const COLORS = ["violet", "pink", "amber", "teal", "blue", "green"];
function randColor() {
  return COLORS[Math.floor(Math.random() * COLORS.length)];
}
function sanitize(u: User) {
  const { password, ...rest } = u;
  return rest;
}

// The signed-in user comes only from the signed, httpOnly session cookie
// (see ./session.ts). Nothing the client sends in headers or the body can
// choose which user it is.
async function authUser(req: Request): Promise<User | undefined> {
  const id = readSessionUserId(req);
  if (!id) return undefined;
  return storage.getUser(id);
}

export async function registerRoutes(httpServer: Server, app: Express): Promise<Server> {
  attachErrorCodes(app);
  const requireUser = async (req: Request, res: Response, next: NextFunction) => {
    const user = await authUser(req);
    if (!user) return res.status(401).json({ message: "Not authenticated" });
    (req as any).user = user;
    next();
  };
  const requireTeacher = async (req: Request, res: Response, next: NextFunction) => {
    const user = (req as any).user as User;
    if (user.role !== "teacher") return res.status(403).json({ message: "Teachers only" });
    next();
  };

  // ---- Ownership / access helpers ----
  // Each returns the record when the signed-in user may act on it, otherwise
  // sends a 404 (so we don't reveal whether someone else's record exists).
  const notFound = (res: Response, what: string) =>
    res.status(404).json({ message: `${what} not found` });

  async function ownedGroup(req: Request, res: Response, id: number) {
    const user = (req as any).user as User;
    const g = await storage.getGroup(id);
    if (!g || g.teacherId !== user.id) { notFound(res, "Group"); return undefined; }
    return g;
  }
  async function ownedQuiz(req: Request, res: Response, id: number) {
    const user = (req as any).user as User;
    const q = await storage.getQuiz(id);
    if (!q || q.teacherId !== user.id) { notFound(res, "Quiz"); return undefined; }
    return q;
  }
  // A submission is the teacher's if it belongs to one of their quizzes.
  async function ownedSubmission(req: Request, res: Response, id: number) {
    const user = (req as any).user as User;
    const sub = await storage.getSubmissionById(id);
    const quiz = sub ? await storage.getQuiz(sub.quizId) : undefined;
    if (!sub || !quiz || quiz.teacherId !== user.id) { notFound(res, "Submission"); return undefined; }
    return sub;
  }
  // Students may see a quiz only if it is live (not a template) and assigned
  // to a group they belong to.
  async function studentCanSeeQuiz(user: User, quiz: Quiz) {
    return quiz.isTemplate === 0 && quiz.groupId != null && (await storage.isMember(quiz.groupId, user.id));
  }
  // A teacher may only target their own groups (null = no group).
  async function groupIsMine(user: User, groupId: unknown) {
    if (groupId == null || groupId === "") return true;
    const g = await storage.getGroup(Number(groupId));
    return !!g && g.teacherId === user.id;
  }
  // The questions this student gets (random pick / shuffled), with answers.
  function studentVariant(quiz: Quiz, studentId: number) {
    let questions: Question[] = [];
    try { questions = JSON.parse(quiz.questions || "[]"); } catch { /* keep empty */ }
    const variant = buildVariant(questions, { pickCount: quiz.pickCount ?? 0, shuffle: !!quiz.shuffle }, variantSeed(quiz.id, studentId));
    return { questions, variant };
  }
  // The student's variant with the answer keys removed.
  function quizForStudent(quiz: Quiz, studentId: number) {
    const { variant } = studentVariant(quiz, studentId);
    const safe = variant.map(({ correctIndex, correctIndexes, correctText, correctNumber, tolerance, optionOrder, ...rest }) => rest);
    return { ...quiz, questions: JSON.stringify(safe) };
  }

  // ---------------- Auth ----------------
  app.post("/api/auth/register", async (req, res) => {
    try {
      const data = insertUserSchema.parse({ ...req.body, avatarColor: randColor() });
      if (await storage.getUserByEmail(data.email))
        return res.status(409).json({ message: "Email already registered" });
      if (await storage.getUserByUsername(data.username))
        return res.status(409).json({ message: "Username already taken" });
      const hashedPassword = await bcrypt.hash(data.password, BCRYPT_ROUNDS);
      const user = await storage.createUser({ ...data, password: hashedPassword });
      setSession(res, user.id);
      res.json(sanitize(user));
    } catch (e) {
      if (e instanceof z.ZodError) return res.status(400).json(zodErrorBody(e));
      res.status(500).json({ message: "Registration failed" });
    }
  });

  app.post("/api/auth/login", async (req, res) => {
    try {
      const { identifier, password } = loginSchema.parse(req.body);
      const user = identifier.includes("@")
        ? await storage.getUserByEmail(identifier)
        : await storage.getUserByUsername(identifier);
      if (!user || !user.password || !(await bcrypt.compare(password, user.password)))
        return res.status(401).json({ message: "Invalid credentials" });
      setSession(res, user.id);
      res.json(sanitize(user));
    } catch (e) {
      res.status(400).json({ message: "Login failed" });
    }
  });

  app.get("/api/auth/me", requireUser, async (req, res) => {
    res.json(sanitize((req as any).user));
  });

  app.post("/api/auth/logout", (_req, res) => {
    clearSession(res);
    res.json({ ok: true });
  });

  // Sign in / sign up with Google. The client sends the Google ID token from
  // Google Identity Services; we verify it server-side, then find-or-create a
  // local user keyed on the Google subject id (falling back to email match so
  // an existing password user can link their Google account).
  app.post("/api/auth/google", async (req, res) => {
    try {
      if (!GOOGLE_CLIENT_ID)
        return res.status(503).json({ message: "Google sign-in is not configured on the server" });
      const { credential, role } = googleAuthSchema.parse(req.body);
      let payload;
      try {
        const ticket = await googleClient.verifyIdToken({
          idToken: credential,
          audience: GOOGLE_CLIENT_ID,
        });
        payload = ticket.getPayload();
      } catch {
        return res.status(401).json({ message: "Invalid Google token" });
      }
      if (!payload || !payload.sub || !payload.email)
        return res.status(401).json({ message: "Google token missing required claims" });
      if (payload.email_verified === false)
        return res.status(401).json({ message: "Your Google email is not verified" });

      const googleId = payload.sub;
      const email = payload.email.toLowerCase();
      const fullName = payload.name || email.split("@")[0];

      // 1) Already linked by googleId.
      let user = await storage.getUserByGoogleId(googleId);
      // 2) Existing account with the same email -> link the Google id.
      if (!user) {
        const byEmail = await storage.getUserByEmail(email);
        if (byEmail) {
          user = (await storage.linkGoogleId(byEmail.id, googleId)) ?? byEmail;
        }
      }
      // 3) Brand-new user -> create one (no local password yet).
      if (!user) {
        const username = await uniqueUsernameFromEmail(email);
        user = await storage.createUser({
          email,
          username,
          password: null as any, // Google-only account; password set later via reset
          fullName,
          role,
          avatarColor: randColor(),
          googleId,
        } as any);
      }
      setSession(res, user.id);
      res.json(sanitize(user));
    } catch (e) {
      if (e instanceof z.ZodError) return res.status(400).json(zodErrorBody(e));
      res.status(500).json({ message: "Google sign-in failed" });
    }
  });

  // Request a password reset link by email. Always returns ok (no account
  // enumeration). Sends the email only if a matching user exists.
  app.post("/api/auth/forgot-password", async (req, res) => {
    try {
      const { email } = forgotPasswordSchema.parse(req.body);
      if (!isEmailConfigured())
        return res.status(503).json({ message: "Email is not configured on the server" });
      const user = await storage.getUserByEmail(email.toLowerCase());
      if (user) {
        const token = randomBytes(32).toString("hex");
        await storage.createResetToken(user.id, token, Date.now() + RESET_TOKEN_TTL_MS);
        const resetUrl = `${APP_BASE_URL}/#/reset-password/${token}`;
        try {
          await sendResetEmail(user.email, resetUrl, user.fullName);
        } catch {
          return res.status(500).json({ message: "Could not send the reset email. Please try again." });
        }
      }
      // Uniform response regardless of whether the email exists.
      res.json({ ok: true });
    } catch (e) {
      if (e instanceof z.ZodError) return res.status(400).json(zodErrorBody(e));
      res.status(500).json({ message: "Could not process the request" });
    }
  });

  // Consume a reset token and set a new password.
  app.post("/api/auth/reset-password", async (req, res) => {
    try {
      const { token, password } = resetPasswordSchema.parse(req.body);
      const record = await storage.getResetToken(token);
      if (!record || record.used === 1 || record.expiresAt < Date.now())
        return res.status(400).json({ message: "This reset link is invalid or has expired" });
      const hashed = await bcrypt.hash(password, BCRYPT_ROUNDS);
      await storage.updateUserPassword(record.userId, hashed);
      await storage.markResetTokenUsed(record.id);
      res.json({ ok: true });
    } catch (e) {
      if (e instanceof z.ZodError) return res.status(400).json(zodErrorBody(e));
      res.status(500).json({ message: "Could not reset password" });
    }
  });

  // ---------------- Groups ----------------
  app.get("/api/groups", requireUser, async (req, res) => {
    const user = (req as any).user as User;
    const groups = user.role === "teacher"
      ? await storage.getGroupsByTeacher(user.id)
      : await storage.getGroupsByStudent(user.id);
    const withCounts = await Promise.all(groups.map(async (g) => ({
      ...g, memberCount: (await storage.getMembers(g.id)).length,
    })));
    res.json(withCounts);
  });

  app.post("/api/groups", requireUser, requireTeacher, async (req, res) => {
    const user = (req as any).user as User;
    const data = insertGroupSchema.parse({ ...req.body, teacherId: user.id });
    res.json(await storage.createGroup(data));
  });

  app.get("/api/groups/:id/members", requireUser, async (req, res) => {
    const user = (req as any).user as User;
    const gid = Number(req.params.id);
    if (user.role === "teacher") {
      if (!(await ownedGroup(req, res, gid))) return;
    } else if (!(await storage.isMember(gid, user.id))) {
      return notFound(res, "Group");
    }
    const members = await storage.getMembers(gid);
    res.json(members.map(sanitize));
  });

  app.post("/api/groups/:id/members", requireUser, requireTeacher, async (req, res) => {
    const gid = Number(req.params.id);
    if (!(await ownedGroup(req, res, gid))) return;
    const { identifier } = z.object({ identifier: z.string().min(1) }).parse(req.body);
    const student = identifier.includes("@")
      ? await storage.getUserByEmail(identifier)
      : await storage.getUserByUsername(identifier);
    if (!student) return res.status(404).json({ message: "No student found with that email/username" });
    if (student.role !== "student") return res.status(400).json({ message: "That user is not a student" });
    if (await storage.isMember(gid, student.id))
      return res.status(409).json({ message: "Student is already in this group" });
    await storage.addMember(gid, student.id);
    res.json(sanitize(student));
  });

  app.delete("/api/groups/:id/members/:studentId", requireUser, requireTeacher, async (req, res) => {
    if (!(await ownedGroup(req, res, Number(req.params.id)))) return;
    await storage.removeMember(Number(req.params.id), Number(req.params.studentId));
    res.json({ ok: true });
  });

  app.delete("/api/groups/:id", requireUser, requireTeacher, async (req, res) => {
    if (!(await ownedGroup(req, res, Number(req.params.id)))) return;
    await storage.deleteGroup(Number(req.params.id));
    res.json({ ok: true });
  });

  // ---------------- Quizzes ----------------
  app.get("/api/quizzes", requireUser, async (req, res) => {
    const user = (req as any).user as User;
    if (user.role === "teacher") {
      res.json(await storage.getQuizzesByTeacher(user.id));
    } else {
      // students: only quizzes whose window is open/upcoming, with their submission state
      const quizzes = await storage.getQuizzesForStudent(user.id);
      const withState = await Promise.all(quizzes.map(async (q) => {
        const sub = await storage.getSubmission(q.id, user.id);
        // Never send answer keys to students: use their own variant, stripped.
        return { ...quizForStudent(q, user.id), submission: sub ? { score: sub.score, maxScore: sub.maxScore, needsGrading: sub.needsGrading } : null };
      }));
      res.json(withState);
    }
  });

  app.get("/api/quizzes/templates", requireUser, requireTeacher, async (req, res) => {
    const user = (req as any).user as User;
    res.json(await storage.getTemplatesByTeacher(user.id));
  });

  app.get("/api/quizzes/:id", requireUser, async (req, res) => {
    const user = (req as any).user as User;
    const quiz = await storage.getQuiz(Number(req.params.id));
    if (!quiz) return notFound(res, "Quiz");
    if (user.role === "teacher") {
      if (quiz.teacherId !== user.id) return notFound(res, "Quiz");
      return res.json(quiz);
    }
    if (!(await studentCanSeeQuiz(user, quiz))) return notFound(res, "Quiz");
    res.json(quizForStudent(quiz, user.id));
  });

  function validateQuestions(raw: string): string {
    const parsed = z.array(questionSchema).parse(JSON.parse(raw || "[]"));
    return JSON.stringify(parsed);
  }

  app.post("/api/quizzes", requireUser, requireTeacher, async (req, res) => {
    try {
      const user = (req as any).user as User;
      const body = { ...req.body, teacherId: user.id };
      if (!(await groupIsMine(user, body.groupId)))
        return res.status(400).json({ message: "That group is not yours" });
      if (body.questions) body.questions = validateQuestions(body.questions);
      const data = insertQuizSchema.parse(body);
      res.json(await storage.createQuiz(data));
    } catch (e) {
      if (e instanceof z.ZodError) return res.status(400).json(zodErrorBody(e));
      res.status(500).json({ message: "Failed to create quiz" });
    }
  });

  app.patch("/api/quizzes/:id", requireUser, requireTeacher, async (req, res) => {
    try {
      const user = (req as any).user as User;
      const quiz = await ownedQuiz(req, res, Number(req.params.id));
      if (!quiz) return;
      const { id: _id, teacherId: _t, createdAt: _c, ...body } = req.body ?? {};
      if ("groupId" in body && !(await groupIsMine(user, body.groupId)))
        return res.status(400).json({ message: "That group is not yours" });
      if (body.questions) body.questions = validateQuestions(body.questions);
      const updated = await storage.updateQuiz(quiz.id, body);
      res.json(updated);
    } catch (e) {
      if (e instanceof z.ZodError) return res.status(400).json(zodErrorBody(e));
      res.status(500).json({ message: "Failed to update quiz" });
    }
  });

  // Save as template (backup)
  app.post("/api/quizzes/:id/save-template", requireUser, requireTeacher, async (req, res) => {
    const user = (req as any).user as User;
    const src = await ownedQuiz(req, res, Number(req.params.id));
    if (!src) return;
    const tpl = await storage.createQuiz({
      title: src.title, description: src.description, teacherId: user.id,
      groupId: null, questions: src.questions, durationMinutes: src.durationMinutes,
      startAt: null, isTemplate: 1,
    } as any);
    res.json(tpl);
  });

  // Reuse a template -> creates a new live quiz copy
  app.post("/api/quizzes/:id/reuse", requireUser, requireTeacher, async (req, res) => {
    const user = (req as any).user as User;
    const src = await ownedQuiz(req, res, Number(req.params.id));
    if (!src) return;
    const { groupId, startAt } = req.body;
    if (!(await groupIsMine(user, groupId)))
      return res.status(400).json({ message: "That group is not yours" });
    const copy = await storage.createQuiz({
      title: src.title, description: src.description, teacherId: user.id,
      groupId: groupId ?? null, questions: src.questions,
      durationMinutes: src.durationMinutes, startAt: startAt ?? null, isTemplate: 0,
    } as any);
    res.json(copy);
  });

  app.delete("/api/quizzes/:id", requireUser, requireTeacher, async (req, res) => {
    const quiz = await ownedQuiz(req, res, Number(req.params.id));
    if (!quiz) return;
    await storage.deleteQuiz(quiz.id);
    res.json({ ok: true });
  });

  // ---------------- Submissions ----------------
  // Student submits answers; MCQ auto-graded, open/photo flagged for grading.
  app.post("/api/quizzes/:id/submit", requireUser, async (req, res) => {
    const user = (req as any).user as User;
    const quiz = await storage.getQuiz(Number(req.params.id));
    if (!quiz || user.role !== "student" || !(await studentCanSeeQuiz(user, quiz)))
      return notFound(res, "Quiz");
    if (quiz.dueAt && Date.now() > quiz.dueAt)
      return res.status(409).json({ message: "The deadline for this quiz has passed" });
    const existing = await storage.getSubmission(quiz.id, user.id);
    // maxAttempts: 0 = unlimited. A teacher "reopen" deletes the prior submission,
    // so a fresh attempt is allowed; otherwise enforce the configured limit.
    if (existing && quiz.maxAttempts !== 0 && existing.attemptNumber >= quiz.maxAttempts)
      return res.status(409).json({ message: "You have used all attempts for this quiz" });
    const attemptNumber = existing ? existing.attemptNumber + 1 : 1;
    const autoSubmitted = req.body.autoSubmitted ? 1 : 0;

    const answers = (req.body.answers && typeof req.body.answers === "object" ? req.body.answers : {}) as Record<string, { answer: string | number }>;
    // Grade against this student's variant, then store answers in the
    // original option order so results pages read them directly.
    const { questions, variant } = studentVariant(quiz, user.id);
    const { score, maxScore, needsGrading } = gradeAnswers(variant, answers);
    const stored = answersToOriginal(questions, variant, answers);
    const questionIds = variant.length === questions.length ? "" : JSON.stringify(variant.map((q) => q.id));
    // If a prior attempt exists (e.g. teacher reopened with higher maxAttempts),
    // replace it so the latest attempt is the one of record.
    if (existing) await storage.deleteSubmission(existing.id);
    const sub = await storage.createSubmission({
      quizId: quiz.id, studentId: user.id, answers: JSON.stringify(stored),
      score, maxScore, needsGrading, autoSubmitted, attemptNumber, questionIds, submittedAt: Date.now(),
    });
    res.json(sub);
  });

  // Teacher grades open/photo questions
  app.patch("/api/submissions/:id/grade", requireUser, requireTeacher, async (req, res) => {
    const sub = await ownedSubmission(req, res, Number(req.params.id));
    if (!sub) return;
    const { score, needsGrading, gradedPoints } = req.body;
    const updated = await storage.updateSubmission(sub.id, {
      score, needsGrading: needsGrading ? 1 : 0,
      gradedPoints: typeof gradedPoints === "string" ? gradedPoints : JSON.stringify(gradedPoints ?? {}),
    });
    res.json(updated);
  });

  app.get("/api/quizzes/:id/submissions", requireUser, requireTeacher, async (req, res) => {
    const quiz = await ownedQuiz(req, res, Number(req.params.id));
    if (!quiz) return;
    const subs = await storage.getSubmissionsByQuiz(quiz.id);
    const withNames = await Promise.all(subs.map(async (s) => {
      const student = await storage.getUser(s.studentId);
      return { ...s, studentName: student?.fullName, studentEmail: student?.email };
    }));
    res.json(withNames);
  });

  app.get("/api/my/submissions", requireUser, async (req, res) => {
    const user = (req as any).user as User;
    const subs = await storage.getSubmissionsByStudent(user.id);
    const withQuiz = await Promise.all(subs.map(async (s) => {
      const quiz = await storage.getQuiz(s.quizId);
      return { ...s, quizTitle: quiz?.title };
    }));
    res.json(withQuiz);
  });

  // Teacher analytics: per-group / per-student performance
  app.get("/api/analytics", requireUser, requireTeacher, async (req, res) => {
    const user = (req as any).user as User;
    const quizzes = await storage.getQuizzesByTeacher(user.id);
    const perQuiz = await Promise.all(quizzes.map(async (q) => {
      const subs = await storage.getSubmissionsByQuiz(q.id);
      const pcts = subs.map((s) => (s.maxScore ? (s.score / s.maxScore) * 100 : 0));
      const avg = pcts.length ? pcts.reduce((a, b) => a + b, 0) / pcts.length : 0;
      return {
        quizId: q.id, title: q.title, submissions: subs.length,
        avgPercent: Math.round(avg), needsGrading: subs.filter((s) => s.needsGrading).length,
      };
    }));
    // per-student averages across all teacher quizzes
    const quizIds = new Set(quizzes.map((q) => q.id));
    const studentMap: Record<number, { name: string; scores: number[] }> = {};
    for (const q of quizzes) {
      const subs = await storage.getSubmissionsByQuiz(q.id);
      for (const s of subs) {
        if (!studentMap[s.studentId]) {
          const st = await storage.getUser(s.studentId);
          studentMap[s.studentId] = { name: st?.fullName ?? "Unknown", scores: [] };
        }
        studentMap[s.studentId].scores.push(s.maxScore ? (s.score / s.maxScore) * 100 : 0);
      }
    }
    const perStudent = Object.values(studentMap).map((v) => ({
      name: v.name,
      avgPercent: Math.round(v.scores.reduce((a, b) => a + b, 0) / v.scores.length),
      attempts: v.scores.length,
    }));

    // ----- Class-level aggregates -----
    const allScores: number[] = Object.values(studentMap).flatMap((v) => v.scores);
    const totalSubmissions = perQuiz.reduce((a, q) => a + q.submissions, 0);
    const totalNeedsGrading = perQuiz.reduce((a, q) => a + q.needsGrading, 0);
    const classAvg = allScores.length
      ? Math.round(allScores.reduce((a, b) => a + b, 0) / allScores.length)
      : 0;
    // score distribution across all student attempts
    const distribution = [
      { band: "high", label: "70-100%", count: allScores.filter((s) => s >= 70).length },
      { band: "mid", label: "40-69%", count: allScores.filter((s) => s >= 40 && s < 70).length },
      { band: "low", label: "0-39%", count: allScores.filter((s) => s < 40).length },
    ];
    const classStats = {
      classAvg,
      totalStudents: perStudent.length,
      totalQuizzes: quizzes.length,
      totalSubmissions,
      totalNeedsGrading,
      distribution,
    };
    res.json({ perQuiz, perStudent, classStats });
  });

  // ---------------- Sessions ----------------
  app.get("/api/sessions", requireUser, async (req, res) => {
    const user = (req as any).user as User;
    const sessions = user.role === "teacher"
      ? await storage.getSessionsByTeacher(user.id)
      : await storage.getSessionsForStudent(user.id);
    res.json(sessions);
  });

  app.post("/api/sessions", requireUser, requireTeacher, async (req, res) => {
    try {
      const user = (req as any).user as User;
      if (!(await groupIsMine(user, req.body?.groupId)))
        return res.status(400).json({ message: "That group is not yours" });
      const data = insertSessionSchema.parse({ ...req.body, teacherId: user.id });
      res.json(await storage.createSession(data));
    } catch (e) {
      if (e instanceof z.ZodError) return res.status(400).json(zodErrorBody(e));
      res.status(500).json({ message: "Failed to create session" });
    }
  });

  app.delete("/api/sessions/:id", requireUser, requireTeacher, async (req, res) => {
    const user = (req as any).user as User;
    const id = Number(req.params.id);
    const mine = await storage.getSessionsByTeacher(user.id);
    if (!mine.some((s) => s.id === id)) return notFound(res, "Session");
    await storage.deleteSession(id);
    res.json({ ok: true });
  });

  // Helper: groups list for dropdowns (teacher)
  app.get("/api/teacher/groups-simple", requireUser, requireTeacher, async (req, res) => {
    const user = (req as any).user as User;
    res.json(await storage.getGroupsByTeacher(user.id));
  });

  // Teacher reopens / resets a student's attempt by removing the submission so
  // the student can take the quiz again (works during or after a quiz).
  app.delete("/api/submissions/:id", requireUser, requireTeacher, async (req, res) => {
    const sub = await ownedSubmission(req, res, Number(req.params.id));
    if (!sub) return;
    await storage.deleteSubmission(sub.id);
    res.json({ ok: true });
  });

  // ---------------- Feedback / suggestions ----------------
  // Stores feedback in the DB AND, if FEEDBACK_FORM_ENDPOINT is set (e.g. a
  // Formspree URL), forwards it by email to the site owner. Public route.
  app.post("/api/feedback", async (req, res) => {
    try {
      const data = insertFeedbackSchema.parse(req.body);
      const saved = await storage.createFeedback(data);
      const endpoint = process.env.FEEDBACK_FORM_ENDPOINT;
      if (endpoint) {
        try {
          await fetch(endpoint, {
            method: "POST",
            headers: { "Content-Type": "application/json", Accept: "application/json" },
            body: JSON.stringify({
              name: data.name || "Anonymous",
              email: data.email || "(not provided)",
              category: data.category,
              message: data.message,
              _subject: `math.az feedback: ${data.category}`,
            }),
          });
        } catch {
          // Email forwarding is best-effort; the feedback is already stored.
        }
      }
      res.json({ ok: true, id: saved.id });
    } catch (e) {
      if (e instanceof z.ZodError) return res.status(400).json(zodErrorBody(e));
      res.status(500).json({ message: "Failed to submit feedback" });
    }
  });

  // Only site admins (emails listed in ADMIN_EMAILS, comma-separated) can read
  // feedback, because it contains visitors' names and email addresses.
  const ADMIN_EMAILS = new Set(
    (process.env.ADMIN_EMAILS || "").split(",").map((e) => e.trim().toLowerCase()).filter(Boolean),
  );
  app.get("/api/feedback", requireUser, async (req, res) => {
    const user = (req as any).user as User;
    if (!ADMIN_EMAILS.has(user.email.toLowerCase())) return res.status(403).json({ message: "Admins only" });
    res.json(await storage.getAllFeedback());
  });

  // ---------------- Materials library ----------------
  // Teachers build a nested folder/file tree of learning materials (PDF, video,
  // image, audio, YouTube/links, or any uploaded file as a base64 data URI).
  // Each file is public (all of the teacher's students) or private (only the
  // groups the teacher selects).

  // Never send file contents in list responses (they used to include the whole
  // base64 file). Clients open files through /api/materials/:id/file instead.
  const publicMaterial = (m: any) => {
    const { dataUrl, storagePath, ...rest } = m;
    return { ...rest, dataUrl: "", hasFile: !!(dataUrl || storagePath) };
  };
  // Attach the group ids a private material is shared with.
  const withGroupIds = async (m: any) => ({
    ...publicMaterial(m),
    groupIds: (await storage.getMaterialGroups(m.id)).map((g) => g.groupId),
  });

  // Validate the file fields of a create/update body. Returns an error message
  // or null. Mutates `data` so exactly one of storagePath / dataUrl is used.
  function checkFileFields(user: User, data: any): string | null {
    if (data.linkUrl && !/^https?:\/\//i.test(String(data.linkUrl)))
      return "Links must start with http:// or https://";
    if (data.storagePath) {
      if (!isStorageEnabled()) return "File storage is not configured";
      if (!String(data.storagePath).startsWith(teacherPrefix(user.id)) || String(data.storagePath).includes(".."))
        return "Invalid file";
      data.dataUrl = "";
    } else if (data.dataUrl) {
      // Legacy path: file embedded in the database. Only when storage is off.
      if (isStorageEnabled()) return "Upload the file to storage first";
      if (!/^data:[\w.+-]+\/[\w.+-]+;base64,/.test(String(data.dataUrl))) return "Invalid file";
    }
    return null;
  }

  // Can this user open this material's file?
  async function canOpenMaterial(user: User, m: any) {
    if (m.kind !== "file") return false;
    if (user.role === "teacher") return m.teacherId === user.id;
    const visible = await storage.getMaterialsForStudent(user.id);
    return visible.some((v) => v.id === m.id);
  }

  // Browser needs this to decide how to upload.
  app.get("/api/storage/config", requireUser, (_req, res) => {
    res.json(publicStorageConfig());
  });

  // Step 1 of an upload: get a one-time signed URL to upload straight to storage.
  app.post("/api/materials/upload-url", requireUser, requireTeacher, async (req, res) => {
    try {
      if (!isStorageEnabled()) return res.status(503).json({ message: "File storage is not configured" });
      const user = (req as any).user as User;
      const { fileName, sizeBytes } = z
        .object({ fileName: z.string().min(1).max(300), sizeBytes: z.number().int().nonnegative() })
        .parse(req.body);
      if (sizeBytes > MAX_UPLOAD_BYTES)
        return res.status(413).json({ message: `Files can be at most ${Math.round(MAX_UPLOAD_BYTES / 1024 / 1024)} MB` });
      res.json(await createUploadUrl(user.id, fileName));
    } catch (e) {
      if (e instanceof z.ZodError) return res.status(400).json(zodErrorBody(e));
      console.error("upload-url failed", e);
      res.status(500).json({ message: "Could not start the upload" });
    }
  });

  // Open / download a material's file after an access check.
  app.get("/api/materials/:id/file", requireUser, async (req, res) => {
    const user = (req as any).user as User;
    const m = await storage.getMaterial(Number(req.params.id));
    if (!m || !(await canOpenMaterial(user, m))) return notFound(res, "Material");
    const download = req.query.download === "1";
    res.setHeader("Cache-Control", "private, no-store");
    if (m.storagePath) {
      try {
        return res.redirect(302, await createDownloadUrl(m.storagePath, download ? m.name : undefined));
      } catch (e) {
        console.error("download url failed", e);
        return res.status(502).json({ message: "Could not open the file" });
      }
    }
    const match = /^data:([^;,]+)(;base64)?,([\s\S]*)$/.exec(m.dataUrl || "");
    if (!match) return notFound(res, "File");
    const body = match[2] ? Buffer.from(match[3], "base64") : Buffer.from(decodeURIComponent(match[3]));
    res.setHeader("Content-Type", match[1]);
    res.setHeader("X-Content-Type-Options", "nosniff");
    // Uploaded HTML/SVG must not run scripts on our origin.
    res.setHeader("Content-Security-Policy", "sandbox; default-src 'none'; img-src data:; media-src data:; style-src 'unsafe-inline'");
    res.setHeader(
      "Content-Disposition",
      `${download ? "attachment" : "inline"}; filename*=UTF-8''${encodeURIComponent(m.name)}`,
    );
    res.send(body);
  });

  // GET: teacher sees their full tree; student sees only accessible items.
  app.get("/api/materials", requireUser, async (req, res) => {
    const user = (req as any).user as User;
    if (user.role === "teacher") {
      const items = await storage.getMaterialsByTeacher(user.id);
      res.json(await Promise.all(items.map(withGroupIds)));
    } else {
      const items = await storage.getMaterialsForStudent(user.id);
      // Strip group sharing details for students.
      res.json(items.map(publicMaterial));
    }
  });

  app.post("/api/materials", requireUser, requireTeacher, async (req, res) => {
    try {
      const user = (req as any).user as User;
      const groupIds = Array.isArray(req.body.groupIds)
        ? (req.body.groupIds as unknown[]).map(Number).filter((n) => !Number.isNaN(n))
        : [];
      const data = insertMaterialSchema.parse({ ...req.body, teacherId: user.id });
      const fileErr = checkFileFields(user, data);
      if (fileErr) return res.status(400).json({ message: fileErr });
      // Validate parent belongs to this teacher and is a folder.
      if (data.parentId != null) {
        const parent = await storage.getMaterial(data.parentId);
        if (!parent || parent.teacherId !== user.id || parent.kind !== "folder")
          return res.status(400).json({ message: "Invalid parent folder" });
      }
      // Validate the selected groups belong to this teacher.
      if (groupIds.length) {
        const teacherGroups = await storage.getGroupsByTeacher(user.id);
        const owned = new Set(teacherGroups.map((g) => g.id));
        if (!groupIds.every((g) => owned.has(g)))
          return res.status(400).json({ message: "One or more groups are not yours" });
      }
      const created = await storage.createMaterial(data);
      if (created.kind === "file" && created.visibility === "private")
        await storage.setMaterialGroups(created.id, groupIds);
      res.json(await withGroupIds(created));
    } catch (e) {
      if (e instanceof z.ZodError) return res.status(400).json(zodErrorBody(e));
      res.status(500).json({ message: "Failed to create material" });
    }
  });

  app.patch("/api/materials/:id", requireUser, requireTeacher, async (req, res) => {
    try {
      const user = (req as any).user as User;
      const id = Number(req.params.id);
      const existing = await storage.getMaterial(id);
      if (!existing || existing.teacherId !== user.id)
        return res.status(404).json({ message: "Material not found" });
      const patch = insertMaterialSchema.partial().parse(req.body);
      // Don't allow reassigning ownership.
      delete (patch as any).teacherId;
      const fileErr = checkFileFields(user, patch);
      if (fileErr) return res.status(400).json({ message: fileErr });
      // A new upload replaces the old file entirely.
      const replacingFile = !!(patch.storagePath || patch.dataUrl);
      if (replacingFile) {
        if (!patch.storagePath) (patch as any).storagePath = "";
        if (!patch.dataUrl) (patch as any).dataUrl = "";
      }
      if (patch.parentId != null) {
        const parent = await storage.getMaterial(patch.parentId);
        if (!parent || parent.teacherId !== user.id || parent.kind !== "folder" || parent.id === id)
          return res.status(400).json({ message: "Invalid parent folder" });
      }
      // Validate group sharing before changing anything.
      let groupIds: number[] | null = null;
      if (Array.isArray(req.body.groupIds)) {
        groupIds = (req.body.groupIds as unknown[]).map(Number).filter((n) => !Number.isNaN(n));
        const teacherGroups = await storage.getGroupsByTeacher(user.id);
        const owned = new Set(teacherGroups.map((g) => g.id));
        if (!groupIds.every((g) => owned.has(g)))
          return res.status(400).json({ message: "One or more groups are not yours" });
      }
      const updated = await storage.updateMaterial(id, patch);
      if (groupIds) await storage.setMaterialGroups(id, groupIds);
      if (replacingFile && existing.storagePath && existing.storagePath !== patch.storagePath)
        await removeFiles([existing.storagePath]);
      res.json(await withGroupIds(updated));
    } catch (e) {
      if (e instanceof z.ZodError) return res.status(400).json(zodErrorBody(e));
      res.status(500).json({ message: "Failed to update material" });
    }
  });

  app.delete("/api/materials/:id", requireUser, requireTeacher, async (req, res) => {
    const user = (req as any).user as User;
    const id = Number(req.params.id);
    const existing = await storage.getMaterial(id);
    if (!existing || existing.teacherId !== user.id)
      return res.status(404).json({ message: "Material not found" });
    const paths = await storage.deleteMaterial(id);
    await removeFiles(paths);
    res.json({ ok: true });
  });

  // ---- Progress (scores over time, strengths by topic) ----
  // onlyTeacherId limits it to that teacher's quizzes (a student can be in
  // several teachers' groups; each teacher sees only their own quizzes).
  async function progressFor(studentId: number, onlyTeacherId?: number) {
    const subs = await storage.getSubmissionsByStudent(studentId);
    const quizzes: Quiz[] = [];
    for (const id of Array.from(new Set(subs.map((s) => s.quizId)))) {
      const q = await storage.getQuiz(id);
      if (q && (onlyTeacherId === undefined || q.teacherId === onlyTeacherId)) quizzes.push(q);
    }
    return computeProgress(quizzes, subs);
  }
  // Is this student in one of this teacher's groups?
  async function teachesStudent(teacherId: number, studentId: number) {
    for (const g of await storage.getGroupsByTeacher(teacherId)) if (await storage.isMember(g.id, studentId)) return true;
    return false;
  }

  app.get("/api/progress", requireUser, async (req, res) => {
    const user = (req as any).user as User;
    res.json(await progressFor(user.id));
  });

  app.get("/api/students/:id/progress", requireUser, requireTeacher, async (req, res) => {
    const user = (req as any).user as User;
    const student = await storage.getUser(Number(req.params.id));
    if (!student || student.role !== "student" || !(await teachesStudent(user.id, student.id)))
      return notFound(res, "Student");
    res.json({ student: { id: student.id, fullName: student.fullName }, ...(await progressFor(student.id, user.id)) });
  });

  // ---- Parent links: read-only progress for a parent, no sign-in ----
  const hashToken = (t: string) => createHash("sha256").update(t).digest("hex");
  async function newParentLink(studentId: number, createdBy: number) {
    const token = randomBytes(32).toString("base64url");
    await storage.setParentLink(studentId, hashToken(token), createdBy);
    return { token, url: `${APP_BASE_URL}/#/parent/${token}` };
  }
  const requireStudent = (req: Request, res: Response, next: NextFunction) =>
    ((req as any).user as User).role === "student" ? next() : res.status(403).json({ message: "Students only" });

  app.get("/api/parent-link", requireUser, requireStudent, async (req, res) => {
    const link = await storage.getParentLinkByStudent(((req as any).user as User).id);
    res.json(link ? { active: true, createdAt: link.createdAt } : { active: false });
  });
  app.post("/api/parent-link", requireUser, requireStudent, async (req, res) => {
    const user = (req as any).user as User;
    res.json(await newParentLink(user.id, user.id));
  });
  app.delete("/api/parent-link", requireUser, requireStudent, async (req, res) => {
    await storage.deleteParentLink(((req as any).user as User).id);
    res.json({ ok: true });
  });
  app.post("/api/students/:id/parent-link", requireUser, requireTeacher, async (req, res) => {
    const user = (req as any).user as User;
    const student = await storage.getUser(Number(req.params.id));
    if (!student || student.role !== "student" || !(await teachesStudent(user.id, student.id)))
      return notFound(res, "Student");
    res.json(await newParentLink(student.id, user.id));
  });
  // Public: anyone with the link. Shows the child's name and progress only.
  app.get("/api/parent/:token", async (req, res) => {
    const token = String(req.params.token || "");
    const studentId = token.length >= 40 ? await storage.getStudentIdByParentToken(hashToken(token)) : undefined;
    const student = studentId ? await storage.getUser(studentId) : undefined;
    if (!student) return notFound(res, "Link");
    res.setHeader("Cache-Control", "private, no-store");
    res.setHeader("Referrer-Policy", "no-referrer");
    res.json({ student: { fullName: student.fullName }, ...(await progressFor(student.id)) });
  });

  // ---- Homework reminders ----
  // Called every hour by a scheduled job (Supabase pg_cron) with
  // "Authorization: Bearer $CRON_SECRET". Emails students whose homework is
  // due within 24 hours and who haven't submitted, once per quiz.
  app.post("/api/cron/reminders", async (req, res) => {
    const secret = process.env.CRON_SECRET || "";
    const given = String(req.headers.authorization || "").replace(/^Bearer\s+/i, "");
    const ok = secret.length >= 8 && given.length === secret.length &&
      timingSafeEqual(Buffer.from(given), Buffer.from(secret));
    if (!ok) return res.status(401).json({ message: "Not authenticated" });

    const now = Date.now();
    const quizzes = await storage.getQuizzesDueBetween(now, now + REMINDER_WINDOW_MS);
    const members: Record<number, number[]> = {};
    const users = new Map<number, User>();
    const submitted = new Set<string>();
    for (const q of quizzes) {
      if (q.groupId && !members[q.groupId]) {
        const m = await storage.getMembers(q.groupId);
        members[q.groupId] = m.map((u) => u.id);
        m.forEach((u) => users.set(u.id, u));
      }
      for (const s of await storage.getSubmissionsByQuiz(q.id)) submitted.add(`${q.id}:${s.studentId}`);
    }
    const alreadySent = await storage.getReminderKeys(quizzes.map((q) => q.id));
    const due = remindersToSend({ now, quizzes, members, submitted, alreadySent });

    let emailed = 0;
    const reminders: { quizId: number; studentId: number }[] = [];
    for (const r of due) {
      // Record first, so an overlapping run can't email the same student twice.
      if (!(await storage.logReminder(r.quizId, r.studentId))) continue;
      reminders.push({ quizId: r.quizId, studentId: r.studentId });
      const student = users.get(r.studentId);
      if (student?.email && isEmailConfigured()) {
        try {
          await sendReminderEmail(student.email, student.fullName, r.title, r.dueAt, `${APP_BASE_URL}/#/quizzes/${r.quizId}/take`);
          emailed++;
        } catch (e) {
          console.error("reminder email failed", e);
        }
      }
    }
    res.json({ reminders, emailed });
  });

  // ---- Question bank (teachers only, each teacher sees only their own) ----
  app.get("/api/bank", requireUser, requireTeacher, async (req, res) => {
    const user = (req as any).user as User;
    const topic = typeof req.query.topic === "string" ? req.query.topic : "";
    const difficulty = typeof req.query.difficulty === "string" ? req.query.difficulty : "";
    res.json(await storage.listBank(user.id, { topic, difficulty }));
  });

  app.get("/api/bank/topics", requireUser, requireTeacher, async (req, res) => {
    const user = (req as any).user as User;
    // Topics from the bank and from the teacher's quizzes, for suggestions.
    const topics = new Set<string>();
    for (const b of await storage.listBank(user.id, {})) if (b.topic) topics.add(b.topic);
    for (const quiz of await storage.getQuizzesByTeacher(user.id)) {
      try {
        for (const q of JSON.parse(quiz.questions || "[]") as Question[]) if (q.topic) topics.add(q.topic);
      } catch { /* ignore bad JSON */ }
    }
    res.json(Array.from(topics).sort((a, b) => a.localeCompare(b, "az")));
  });

  app.post("/api/bank", requireUser, requireTeacher, async (req, res) => {
    try {
      const user = (req as any).user as User;
      const question = questionSchema.parse(req.body?.question);
      res.json(await storage.addToBank(user.id, JSON.stringify(question), question.topic ?? "", question.difficulty ?? ""));
    } catch (e) {
      if (e instanceof z.ZodError) return res.status(400).json(zodErrorBody(e));
      res.status(500).json({ message: "Could not process the request" });
    }
  });

  app.delete("/api/bank/:id", requireUser, requireTeacher, async (req, res) => {
    const user = (req as any).user as User;
    const b = await storage.getBankQuestion(Number(req.params.id));
    if (!b || b.teacherId !== user.id) return notFound(res, "Question");
    await storage.deleteBankQuestion(b.id);
    res.json({ ok: true });
  });

  return httpServer;
}

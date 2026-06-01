import type { Express, Request, Response, NextFunction } from "express";
import { createServer } from "node:http";
import type { Server } from "node:http";
import { storage } from "./storage";
import {
  insertUserSchema, loginSchema, insertGroupSchema,
  insertQuizSchema, insertSessionSchema, questionSchema,
} from "@shared/schema";
import type { Question, Quiz, User } from "@shared/schema";
import { z } from "zod";

const COLORS = ["violet", "pink", "amber", "teal", "blue", "green"];
function randColor() {
  return COLORS[Math.floor(Math.random() * COLORS.length)];
}
function sanitize(u: User) {
  const { password, ...rest } = u;
  return rest;
}

// Lightweight auth: client sends x-user-id header. Sandboxed iframe blocks
// cookies/localStorage, so the client keeps the user in React state and
// echoes the id with each request.
async function authUser(req: Request): Promise<User | undefined> {
  const id = Number(req.header("x-user-id"));
  if (!id) return undefined;
  return storage.getUser(id);
}

export async function registerRoutes(httpServer: Server, app: Express): Promise<Server> {
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

  // ---------------- Auth ----------------
  app.post("/api/auth/register", async (req, res) => {
    try {
      const data = insertUserSchema.parse({ ...req.body, avatarColor: randColor() });
      if (await storage.getUserByEmail(data.email))
        return res.status(409).json({ message: "Email already registered" });
      if (await storage.getUserByUsername(data.username))
        return res.status(409).json({ message: "Username already taken" });
      const user = await storage.createUser(data);
      res.json(sanitize(user));
    } catch (e) {
      if (e instanceof z.ZodError) return res.status(400).json({ message: e.errors[0].message });
      res.status(500).json({ message: "Registration failed" });
    }
  });

  app.post("/api/auth/login", async (req, res) => {
    try {
      const { identifier, password } = loginSchema.parse(req.body);
      const user = identifier.includes("@")
        ? await storage.getUserByEmail(identifier)
        : await storage.getUserByUsername(identifier);
      if (!user || user.password !== password)
        return res.status(401).json({ message: "Invalid credentials" });
      res.json(sanitize(user));
    } catch (e) {
      res.status(400).json({ message: "Login failed" });
    }
  });

  // Google sign-in: client posts verified Google profile (email, name).
  // Auto-provisions an account; role chosen by client on first sign-in.
  app.post("/api/auth/google", async (req, res) => {
    try {
      const schema = z.object({
        email: z.string().email(),
        fullName: z.string().min(1),
        role: z.enum(["teacher", "student"]).default("student"),
      });
      const { email, fullName, role } = schema.parse(req.body);
      let user = await storage.getUserByEmail(email);
      if (!user) {
        let username = email.split("@")[0];
        if (await storage.getUserByUsername(username)) username += Math.floor(Math.random() * 1000);
        user = await storage.createUser({
          email, username, fullName, role,
          password: "google-" + Math.random().toString(36).slice(2),
          avatarColor: randColor(),
        });
      }
      res.json(sanitize(user));
    } catch (e) {
      res.status(400).json({ message: "Google sign-in failed" });
    }
  });

  app.get("/api/auth/me", requireUser, async (req, res) => {
    res.json(sanitize((req as any).user));
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
    const members = await storage.getMembers(Number(req.params.id));
    res.json(members.map(sanitize));
  });

  app.post("/api/groups/:id/members", requireUser, requireTeacher, async (req, res) => {
    const gid = Number(req.params.id);
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
    await storage.removeMember(Number(req.params.id), Number(req.params.studentId));
    res.json({ ok: true });
  });

  app.delete("/api/groups/:id", requireUser, requireTeacher, async (req, res) => {
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
        return { ...q, submission: sub ? { score: sub.score, maxScore: sub.maxScore, needsGrading: sub.needsGrading } : null };
      }));
      res.json(withState);
    }
  });

  app.get("/api/quizzes/templates", requireUser, requireTeacher, async (req, res) => {
    const user = (req as any).user as User;
    res.json(await storage.getTemplatesByTeacher(user.id));
  });

  app.get("/api/quizzes/:id", requireUser, async (req, res) => {
    const quiz = await storage.getQuiz(Number(req.params.id));
    if (!quiz) return res.status(404).json({ message: "Quiz not found" });
    res.json(quiz);
  });

  function validateQuestions(raw: string): string {
    const parsed = z.array(questionSchema).parse(JSON.parse(raw || "[]"));
    return JSON.stringify(parsed);
  }

  app.post("/api/quizzes", requireUser, requireTeacher, async (req, res) => {
    try {
      const user = (req as any).user as User;
      const body = { ...req.body, teacherId: user.id };
      if (body.questions) body.questions = validateQuestions(body.questions);
      const data = insertQuizSchema.parse(body);
      res.json(await storage.createQuiz(data));
    } catch (e) {
      if (e instanceof z.ZodError) return res.status(400).json({ message: e.errors[0].message });
      res.status(500).json({ message: "Failed to create quiz" });
    }
  });

  app.patch("/api/quizzes/:id", requireUser, requireTeacher, async (req, res) => {
    const body = { ...req.body };
    if (body.questions) body.questions = validateQuestions(body.questions);
    const updated = await storage.updateQuiz(Number(req.params.id), body);
    res.json(updated);
  });

  // Save as template (backup)
  app.post("/api/quizzes/:id/save-template", requireUser, requireTeacher, async (req, res) => {
    const user = (req as any).user as User;
    const src = await storage.getQuiz(Number(req.params.id));
    if (!src) return res.status(404).json({ message: "Quiz not found" });
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
    const src = await storage.getQuiz(Number(req.params.id));
    if (!src) return res.status(404).json({ message: "Quiz not found" });
    const { groupId, startAt } = req.body;
    const copy = await storage.createQuiz({
      title: src.title, description: src.description, teacherId: user.id,
      groupId: groupId ?? null, questions: src.questions,
      durationMinutes: src.durationMinutes, startAt: startAt ?? null, isTemplate: 0,
    } as any);
    res.json(copy);
  });

  app.delete("/api/quizzes/:id", requireUser, requireTeacher, async (req, res) => {
    await storage.deleteQuiz(Number(req.params.id));
    res.json({ ok: true });
  });

  // ---------------- Submissions ----------------
  // Student submits answers; MCQ auto-graded, open/photo flagged for grading.
  app.post("/api/quizzes/:id/submit", requireUser, async (req, res) => {
    const user = (req as any).user as User;
    const quiz = await storage.getQuiz(Number(req.params.id));
    if (!quiz) return res.status(404).json({ message: "Quiz not found" });
    const existing = await storage.getSubmission(quiz.id, user.id);
    if (existing) return res.status(409).json({ message: "You already submitted this quiz" });

    const answers = req.body.answers as Record<string, { answer: string | number }>;
    const questions: Question[] = JSON.parse(quiz.questions);
    let score = 0, maxScore = 0, needsGrading = 0;
    for (const q of questions) {
      maxScore += q.points;
      const a = answers[q.id];
      if (q.type === "mcq" || q.type === "true_false") {
        // single correct index
        if (a && a.answer !== "" && a.answer !== undefined && Number(a.answer) === q.correctIndex)
          score += q.points;
      } else if (q.type === "multi_select") {
        // answer is a comma-separated list of selected indexes; exact set match
        const selected = new Set(
          a && a.answer !== "" && a.answer !== undefined
            ? String(a.answer).split(",").filter((x) => x !== "").map((x) => Number(x))
            : []
        );
        const correct = new Set((q.correctIndexes ?? []).map((x) => Number(x)));
        if (
          selected.size === correct.size &&
          Array.from(selected).every((x) => correct.has(x))
        )
          score += q.points;
      } else if (q.type === "fill_blank") {
        // case-insensitive trimmed match
        const given = a ? String(a.answer ?? "").trim().toLowerCase() : "";
        if (given && given === String(q.correctText ?? "").trim().toLowerCase())
          score += q.points;
      } else if (q.type === "numeric") {
        // within tolerance of correctNumber
        const given = a && a.answer !== "" && a.answer !== undefined ? Number(a.answer) : NaN;
        const target = q.correctNumber;
        const tol = q.tolerance ?? 0;
        if (!Number.isNaN(given) && target !== undefined && Math.abs(given - target) <= tol)
          score += q.points;
      } else {
        // open / photo -> manual grading
        if (a && String(a.answer ?? "").trim()) needsGrading = 1;
      }
    }
    const sub = await storage.createSubmission({
      quizId: quiz.id, studentId: user.id, answers: JSON.stringify(answers),
      score, maxScore, needsGrading, submittedAt: Date.now(),
    });
    res.json(sub);
  });

  // Teacher grades open/photo questions
  app.patch("/api/submissions/:id/grade", requireUser, requireTeacher, async (req, res) => {
    const { score, needsGrading } = req.body;
    const updated = await storage.updateSubmission(Number(req.params.id), {
      score, needsGrading: needsGrading ? 1 : 0,
    });
    res.json(updated);
  });

  app.get("/api/quizzes/:id/submissions", requireUser, requireTeacher, async (req, res) => {
    const subs = await storage.getSubmissionsByQuiz(Number(req.params.id));
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
      const data = insertSessionSchema.parse({ ...req.body, teacherId: user.id });
      res.json(await storage.createSession(data));
    } catch (e) {
      if (e instanceof z.ZodError) return res.status(400).json({ message: e.errors[0].message });
      res.status(500).json({ message: "Failed to create session" });
    }
  });

  app.delete("/api/sessions/:id", requireUser, requireTeacher, async (req, res) => {
    await storage.deleteSession(Number(req.params.id));
    res.json({ ok: true });
  });

  // Helper: groups list for dropdowns (teacher)
  app.get("/api/teacher/groups-simple", requireUser, requireTeacher, async (req, res) => {
    const user = (req as any).user as User;
    res.json(await storage.getGroupsByTeacher(user.id));
  });

  return httpServer;
}

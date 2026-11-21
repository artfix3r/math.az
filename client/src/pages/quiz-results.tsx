import { useState } from "react";
import { MathText } from "@/components/math-text";
import { PenScore, PenMark } from "@/components/red-pen";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Link } from "wouter";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { useT } from "@/lib/i18n";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { ArrowLeft, Hourglass, CheckCircle2, Pencil, Plus, Minus, RotateCcw, Bot, Loader2 } from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell,
} from "recharts";
import type { Quiz, Question } from "@shared/schema";

type Sub = {
  id: number; studentId: number; studentName: string; studentEmail: string;
  answers: string; score: number; maxScore: number; needsGrading: number;
  gradedPoints?: string; autoSubmitted?: number; attemptNumber?: number; questionIds?: string;
  comments?: string; feedback?: string;
};

export default function QuizResults({ id }: { id: number }) {
  const { toast } = useToast();
  const { t } = useT();
  const { data: quiz } = useQuery<Quiz>({ queryKey: ["/api/quizzes", id] });
  const { data: subs, isLoading } = useQuery<Sub[]>({ queryKey: ["/api/quizzes", id, "submissions"] });
  const questions: Question[] = quiz ? JSON.parse(quiz.questions || "[]") : [];

  const avg = subs && subs.length
    ? Math.round(subs.reduce((s, x) => s + (x.maxScore ? (x.score / x.maxScore) * 100 : 0), 0) / subs.length)
    : 0;

  const chartData = (subs ?? []).map((s) => ({
    name: s.studentName?.split(" ")[0] ?? "—",
    percent: s.maxScore ? Math.round((s.score / s.maxScore) * 100) : 0,
  }));

  return (
    <div className="space-y-6">
      <Link href="/quizzes" className="inline-flex items-center gap-1 text-sm font-bold text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> {t("qr.back")}
      </Link>
      <div>
        <h1 className="text-2xl font-bold sm:text-[28px]">{quiz?.title ?? t("qr.results")}</h1>
        <p className="text-sm text-muted-foreground">{t("qr.submissionsCount", { count: subs?.length ?? 0, avg })}</p>
      </div>

      {isLoading ? (
        <Skeleton className="h-64 rounded-lg" />
      ) : subs && subs.length > 0 ? (
        <>
          <Card className="p-5">
            <h2 className="mb-4 font-bold">{t("qr.scoresByStudent")}</h2>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" vertical={false} />
                  <XAxis dataKey="name" tick={{ fontSize: 12 }} className="fill-muted-foreground" />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 12 }} className="fill-muted-foreground" />
                  <Tooltip
                    contentStyle={{ borderRadius: 12, border: "1px solid hsl(var(--border))", background: "hsl(var(--card))", color: "hsl(var(--foreground))" }}
                    formatter={(v) => [`${v}%`, t("quiz.score")]}
                  />
                  <Bar dataKey="percent" radius={[4, 4, 0, 0]} maxBarSize={48}>
                    {chartData.map((d, i) => (
                      <Cell key={i} fill={d.percent >= 70 ? "hsl(var(--correct))" : d.percent >= 40 ? "hsl(var(--due))" : "hsl(var(--pen))"} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>

          <div className="space-y-2">
            <h2 className="font-bold">{t("qr.submissions")}</h2>
            {subs.map((s) => (
              <SubRow key={s.id} sub={s} questions={questions} onGraded={() => {
                queryClient.invalidateQueries({ queryKey: ["/api/quizzes", id, "submissions"] });
                queryClient.invalidateQueries({ queryKey: ["/api/analytics"] });
                toast({ title: t("qr.gradeSaved") });
              }} onReopened={() => {
                queryClient.invalidateQueries({ queryKey: ["/api/quizzes", id, "submissions"] });
                queryClient.invalidateQueries({ queryKey: ["/api/analytics"] });
                toast({ title: t("qr.reopened") });
              }} />
            ))}
          </div>
        </>
      ) : (
        <Card className="flex items-center justify-center border-dashed p-12 text-sm text-muted-foreground">{t("qr.noSubmissions")}</Card>
      )}
    </div>
  );
}

// Auto-graded correctness for a single question given the student's raw answer.
// Returns true/false for objective types, or null for open/photo (teacher decides).
function isCorrect(q: Question, a: string | number | undefined): boolean | null {
  if (a === undefined || a === "") return q.type === "open" || q.type === "photo" ? null : false;
  if (q.type === "mcq" || q.type === "true_false") return Number(a) === q.correctIndex;
  if (q.type === "multi_select") {
    const selected = String(a).split(",").filter((x) => x !== "").map(Number);
    const correct = new Set((q.correctIndexes ?? []).map(Number));
    return selected.length === correct.size && selected.every((x) => correct.has(x));
  }
  if (q.type === "fill_blank") return String(a).trim().toLowerCase() === String(q.correctText ?? "").trim().toLowerCase();
  if (q.type === "numeric") return q.correctNumber !== undefined && Math.abs(Number(a) - q.correctNumber) <= (q.tolerance ?? 0);
  return null; // open / photo
}

function SubRow({ sub, questions, onGraded, onReopened }: { sub: Sub; questions: Question[]; onGraded: () => void; onReopened: () => void }) {
  const { t } = useT();
  const { toast } = useToast();
  const answers: Record<string, { answer: string | number }> = JSON.parse(sub.answers || "{}");
  // With random questions per student, only show the ones this student got.
  const shownIds: Set<string> | null = (() => {
    try { return sub.questionIds ? new Set<string>(JSON.parse(sub.questionIds)) : null; } catch { return null; }
  })();

  // Per-question awarded points. If this submission was already graded, reload the
  // teacher's saved per-question points so re-opening the dialog shows their work.
  // Otherwise seed objective types from auto-grading and leave open/photo at 0.
  let saved: Record<string, number> = {};
  try { saved = JSON.parse(sub.gradedPoints || "{}") || {}; } catch { saved = {}; }
  const hasSaved = Object.keys(saved).length > 0;
  const seed: Record<string, number> = {};
  for (const q of questions) {
    if (hasSaved) {
      const v = Number(saved[q.id]);
      seed[q.id] = Number.isFinite(v) ? Math.max(0, Math.min(q.points, v)) : 0;
    } else {
      const a = answers[q.id]?.answer;
      seed[q.id] = isCorrect(q, a) === true ? q.points : 0;
    }
  }
  const [points, setPoints] = useState<Record<string, number>>(seed);
  const [comments, setComments] = useState<Record<string, string>>(() => {
    try { return JSON.parse(sub.comments || "{}") || {}; } catch { return {}; }
  });
  const [feedback, setFeedback] = useState(sub.feedback ?? "");
  const [open, setOpen] = useState(false);
  const total = questions.reduce((acc, q) => acc + (Number(points[q.id]) || 0), 0);

  function setQ(id: string, val: number, max: number) {
    const clamped = Math.max(0, Math.min(max, isNaN(val) ? 0 : val));
    setPoints((p) => ({ ...p, [id]: clamped }));
  }

  const tfLabel = (i: number) => (i === 0 ? t("qb.true") : t("qb.false"));
  function renderAnswer(q: Question, a: string | number | undefined) {
    if (a === undefined || a === "") return <p className="mt-2 text-sm text-muted-foreground">{t("qr.noAnswer")}</p>;
    if (q.type === "mcq") {
      const ok = Number(a) === q.correctIndex;
      return (
        <p className={"mt-2 text-sm font-bold " + (ok ? "text-correct dark:text-correct" : "text-pen")}>
          {t("qr.chose")}: <MathText text={(q.options ?? [])[Number(a)] ?? "—"} /> {ok ? null : <>— {t("qr.correctIs")}: <MathText text={(q.options ?? [])[q.correctIndex ?? 0] ?? ""} /></>}
        </p>
      );
    }
    if (q.type === "true_false") {
      const ok = Number(a) === q.correctIndex;
      return (
        <p className={"mt-2 text-sm font-bold " + (ok ? "text-correct dark:text-correct" : "text-pen")}>
          {t("qr.chose")}: {tfLabel(Number(a))} {ok ? "" : `— ${t("qr.correctIs")}: ${tfLabel(q.correctIndex ?? 0)}`}
        </p>
      );
    }
    if (q.type === "multi_select") {
      const selected = String(a).split(",").filter((x) => x !== "").map(Number);
      const correct = new Set((q.correctIndexes ?? []).map(Number));
      const ok = selected.length === correct.size && selected.every((x) => correct.has(x));
      const chosen = selected.map((i) => (q.options ?? [])[i]).filter(Boolean).join(", ") || "—";
      const correctStr = (q.correctIndexes ?? []).map((i) => (q.options ?? [])[i]).filter(Boolean).join(", ");
      return (
        <p className={"mt-2 text-sm font-bold " + (ok ? "text-correct dark:text-correct" : "text-pen")}>
          {t("qr.chose")}: <MathText text={chosen} /> {ok ? null : <>— {t("qr.correctIs")}: <MathText text={correctStr} /></>}
        </p>
      );
    }
    if (q.type === "fill_blank") {
      const ok = String(a).trim().toLowerCase() === String(q.correctText ?? "").trim().toLowerCase();
      return (
        <p className={"mt-2 text-sm font-bold " + (ok ? "text-correct dark:text-correct" : "text-pen")}>
          {t("qr.chose")}: {String(a)} {ok ? "" : `— ${t("qr.correctIs")}: ${q.correctText}`}
        </p>
      );
    }
    if (q.type === "numeric") {
      const ok = q.correctNumber !== undefined && Math.abs(Number(a) - q.correctNumber) <= (q.tolerance ?? 0);
      return (
        <p className={"mt-2 text-sm font-bold " + (ok ? "text-correct dark:text-correct" : "text-pen")}>
          {t("qr.chose")}: {String(a)} {ok ? "" : `— ${t("qr.correctIs")}: ${q.correctNumber}${q.tolerance ? ` (±${q.tolerance})` : ""}`}
        </p>
      );
    }
    return <p className="mt-2 whitespace-pre-wrap rounded-lg bg-muted/50 px-3 py-2 text-sm">{String(a)}</p>;
  }

  const grade = useMutation({
    mutationFn: async () => apiRequest("PATCH", `/api/submissions/${sub.id}/grade`, { score: total, needsGrading: 0, gradedPoints: JSON.stringify(points), comments, feedback }),
    onSuccess: () => { setOpen(false); onGraded(); },
  });

  const reopen = useMutation({
    mutationFn: async () => apiRequest("DELETE", `/api/submissions/${sub.id}`),
    onSuccess: onReopened,
    onError: (e: any) => toast({ title: t("qr.reopenError"), description: e.message, variant: "destructive" }),
  });

  return (
    <Card className="flex items-center gap-3 p-4" data-testid={`submission-${sub.id}`}>
      <div className="min-w-0 flex-1">
        <p className="truncate font-bold">{sub.studentName}</p>
        <p className="truncate text-xs text-muted-foreground">{sub.studentEmail}</p>
      </div>
      <div className="text-right">
        {sub.needsGrading ? (
          <p className="font-semibold tabular-nums">{sub.score} / {sub.maxScore}</p>
        ) : (
          <PenScore score={sub.score} max={sub.maxScore} size="sm" animate={false} label={t("pen.scoreLabel", { score: sub.score, max: sub.maxScore })} />
        )}
        <div className="flex flex-wrap items-center justify-end gap-1">
          {sub.needsGrading ? (
            <Badge variant="outline" className="gap-1 rounded-sm border-due/50 text-due"><Hourglass className="h-3 w-3" /> {t("qr.needsGrading")}</Badge>
          ) : (
            <Badge variant="outline" className="gap-1 rounded-sm border-correct/40 text-correct"><CheckCircle2 className="h-3 w-3" /> {t("qr.graded")}</Badge>
          )}
          {sub.autoSubmitted ? (
            <Badge variant="outline" className="gap-1 rounded-sm border-border text-muted-foreground" data-testid={`badge-auto-${sub.id}`}><Bot className="h-3 w-3" /> {t("qr.autoSubmitted")}</Badge>
          ) : null}
        </div>
      </div>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button variant="outline" size="sm" className="gap-1.5 font-bold" data-testid={`button-grade-${sub.id}`}><Pencil className="h-3.5 w-3.5" /> {t("qr.grade")}</Button>
        </DialogTrigger>
        <DialogContent className="max-h-[80vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{t("qr.grade")} — {sub.studentName}</DialogTitle></DialogHeader>
          <p className="-mt-1 text-sm text-muted-foreground">{t("qr.gradeHint")}</p>
          <div className="space-y-4">
            {questions.filter((q) => shownIds === null || shownIds.has(q.id)).map((q, idx) => {
              const a = answers[q.id]?.answer;
              const c = isCorrect(q, a);
              const isManual = c === null;
              const awarded = Number(points[q.id]) || 0;
              return (
                <div key={q.id} className={"rounded-lg border p-3 " + (isManual ? "border-primary/40 bg-secondary/40" : "")}>
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-xs font-bold text-muted-foreground">Q{idx + 1} · {t(`qtype.${q.type}`)} · {t("qr.maxPoints", { max: q.points })}</p>
                    {c === true && <span className="inline-flex items-center gap-1 text-xs font-medium text-correct"><PenMark correct className="h-5 w-5" label={t("qr.autoCorrect")} />{t("qr.autoCorrect")}</span>}
                    {c === false && <span className="inline-flex items-center gap-1 text-xs font-medium text-pen"><PenMark correct={false} className="h-5 w-5" label={t("qr.autoWrong")} />{t("qr.autoWrong")}</span>}
                    {isManual && <Badge variant="outline" className="rounded-sm border-primary/40 text-primary">{t("qr.manualGrade")}</Badge>}
                  </div>
                  <p className="mt-1 font-bold"><MathText text={q.prompt} /></p>
                  {q.type === "photo" && q.imageUrl && <img src={q.imageUrl} alt="" className="mt-2 max-h-40 rounded-lg border object-contain" />}
                  {isManual ? (
                    <div className="mt-2">
                      <p className="text-sm font-medium text-muted-foreground">{t("qr.studentSolution")}</p>
                      {renderAnswer(q, a)}
                    </div>
                  ) : (
                    renderAnswer(q, a)
                  )}
                  <div className="mt-3 flex flex-wrap items-center gap-2 border-t pt-3">
                    <div className="flex gap-1.5" role="radiogroup" aria-label={t("qr.pointsAwarded")}>
                      <button type="button" role="radio" aria-checked={awarded >= q.points}
                        onClick={() => setQ(q.id, q.points, q.points)} data-testid={`button-mark-right-${sub.id}-${q.id}`}
                        className={"inline-flex min-h-9 items-center gap-1.5 rounded-md border px-2.5 text-sm font-semibold transition-colors " + (awarded >= q.points ? "border-correct bg-correct/10 text-correct" : "text-muted-foreground hover:border-correct/60")}>
                        <PenMark correct className="h-5 w-5" label="" /> {t("pen.correct")}
                      </button>
                      <button type="button" role="radio" aria-checked={awarded === 0}
                        onClick={() => setQ(q.id, 0, q.points)} data-testid={`button-mark-wrong-${sub.id}-${q.id}`}
                        className={"inline-flex min-h-9 items-center gap-1.5 rounded-md border px-2.5 text-sm font-semibold transition-colors " + (awarded === 0 ? "border-pen bg-pen/10 text-pen" : "text-muted-foreground hover:border-pen/60")}>
                        <PenMark correct={false} className="h-5 w-5" label="" /> {t("pen.wrong")}
                      </button>
                    </div>
                    <div className="ml-auto flex items-center gap-1.5">
                      <Button type="button" variant="outline" size="icon" className="h-9 w-9" onClick={() => setQ(q.id, awarded - 1, q.points)} disabled={awarded <= 0} data-testid={`button-minus-${sub.id}-${q.id}`} aria-label="−1"><Minus className="h-4 w-4" /></Button>
                      <Input type="number" min={0} max={q.points} value={awarded} onChange={(e) => setQ(q.id, Number(e.target.value), q.points)} className="h-9 w-14 text-center" data-testid={`input-points-${sub.id}-${q.id}`} aria-label={t("qr.pointsAwarded")} />
                      <Button type="button" variant="outline" size="icon" className="h-9 w-9" onClick={() => setQ(q.id, awarded + 1, q.points)} disabled={awarded >= q.points} data-testid={`button-plus-${sub.id}-${q.id}`} aria-label="+1"><Plus className="h-4 w-4" /></Button>
                      <span className="text-sm text-muted-foreground tabular-nums">/ {q.points}</span>
                    </div>
                  </div>
                  <Textarea
                    value={comments[q.id] ?? ""}
                    onChange={(e) => setComments((c) => ({ ...c, [q.id]: e.target.value }))}
                    placeholder={t("qr.commentPlaceholder")}
                    className="mt-2 min-h-[2.75rem] text-sm"
                    rows={1}
                    data-testid={`input-comment-${sub.id}-${q.id}`}
                  />
                </div>
              );
            })}
          </div>
          <div className="space-y-1.5 border-t pt-3">
            <label htmlFor={`fb-${sub.id}`} className="text-sm font-semibold">{t("qr.feedbackLabel")}</label>
            <Textarea id={`fb-${sub.id}`} value={feedback} onChange={(e) => setFeedback(e.target.value)} placeholder={t("qr.feedbackPlaceholder")} data-testid={`input-feedback-${sub.id}`} />
            <p className="text-xs text-muted-foreground">{t("qr.feedbackHint")}</p>
          </div>
          <DialogFooter className="flex-col gap-2 sm:flex-row sm:items-center">
            <div className="flex items-center gap-2" data-testid={`total-grade-${sub.id}`}>
              <span className="text-sm font-bold">{t("qr.totalScore")}</span>
              <span className="font-bold tabular-nums">{total} / {sub.maxScore}</span>
            </div>
            <Button onClick={() => grade.mutate()} disabled={grade.isPending} className="font-bold sm:ml-auto" data-testid={`button-save-grade-${sub.id}`}>{t("qr.saveGrade")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button variant="ghost" size="sm" className="gap-1.5 font-bold text-muted-foreground hover:text-foreground" data-testid={`button-reopen-${sub.id}`}>
            <RotateCcw className="h-3.5 w-3.5" /> {t("qr.reopen")}
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("qr.reopenTitle")}</AlertDialogTitle>
            <AlertDialogDescription>{t("qr.reopenBody", { name: sub.studentName })}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid={`button-reopen-cancel-${sub.id}`}>{t("common.cancel")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => { e.preventDefault(); reopen.mutate(); }}
              disabled={reopen.isPending}
              data-testid={`button-reopen-confirm-${sub.id}`}
            >
              {reopen.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {t("qr.reopenConfirm")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}

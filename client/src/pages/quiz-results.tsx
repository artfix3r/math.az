import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Link } from "wouter";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { useT } from "@/lib/i18n";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter,
} from "@/components/ui/dialog";
import { ArrowLeft, Hourglass, CheckCircle2, Pencil, Plus, Minus } from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell,
} from "recharts";
import type { Quiz, Question } from "@shared/schema";

type Sub = {
  id: number; studentId: number; studentName: string; studentEmail: string;
  answers: string; score: number; maxScore: number; needsGrading: number;
  gradedPoints?: string;
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
        <h1 className="text-3xl font-black tracking-tight">{quiz?.title ?? t("qr.results")}</h1>
        <p className="text-sm text-muted-foreground">{t("qr.submissionsCount", { count: subs?.length ?? 0, avg })}</p>
      </div>

      {isLoading ? (
        <Skeleton className="h-64 rounded-2xl" />
      ) : subs && subs.length > 0 ? (
        <>
          <Card className="p-5">
            <h2 className="mb-4 font-black">{t("qr.scoresByStudent")}</h2>
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
                  <Bar dataKey="percent" radius={[8, 8, 0, 0]}>
                    {chartData.map((d, i) => (
                      <Cell key={i} fill={d.percent >= 70 ? "hsl(var(--chart-4))" : d.percent >= 40 ? "hsl(var(--chart-3))" : "hsl(var(--destructive))"} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>

          <div className="space-y-2">
            <h2 className="font-black">{t("qr.submissions")}</h2>
            {subs.map((s) => (
              <SubRow key={s.id} sub={s} questions={questions} onGraded={() => {
                queryClient.invalidateQueries({ queryKey: ["/api/quizzes", id, "submissions"] });
                queryClient.invalidateQueries({ queryKey: ["/api/analytics"] });
                toast({ title: t("qr.gradeSaved") });
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

function SubRow({ sub, questions, onGraded }: { sub: Sub; questions: Question[]; onGraded: () => void }) {
  const { t } = useT();
  const answers: Record<string, { answer: string | number }> = JSON.parse(sub.answers || "{}");

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
        <p className={"mt-2 text-sm font-bold " + (ok ? "text-green-600 dark:text-green-400" : "text-destructive")}>
          {t("qr.chose")}: {(q.options ?? [])[Number(a)] ?? "—"} {ok ? "✓" : `— ${t("qr.correctIs")}: ${(q.options ?? [])[q.correctIndex ?? 0]}`}
        </p>
      );
    }
    if (q.type === "true_false") {
      const ok = Number(a) === q.correctIndex;
      return (
        <p className={"mt-2 text-sm font-bold " + (ok ? "text-green-600 dark:text-green-400" : "text-destructive")}>
          {t("qr.chose")}: {tfLabel(Number(a))} {ok ? "✓" : `— ${t("qr.correctIs")}: ${tfLabel(q.correctIndex ?? 0)}`}
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
        <p className={"mt-2 text-sm font-bold " + (ok ? "text-green-600 dark:text-green-400" : "text-destructive")}>
          {t("qr.chose")}: {chosen} {ok ? "✓" : `— ${t("qr.correctIs")}: ${correctStr}`}
        </p>
      );
    }
    if (q.type === "fill_blank") {
      const ok = String(a).trim().toLowerCase() === String(q.correctText ?? "").trim().toLowerCase();
      return (
        <p className={"mt-2 text-sm font-bold " + (ok ? "text-green-600 dark:text-green-400" : "text-destructive")}>
          {t("qr.chose")}: {String(a)} {ok ? "✓" : `— ${t("qr.correctIs")}: ${q.correctText}`}
        </p>
      );
    }
    if (q.type === "numeric") {
      const ok = q.correctNumber !== undefined && Math.abs(Number(a) - q.correctNumber) <= (q.tolerance ?? 0);
      return (
        <p className={"mt-2 text-sm font-bold " + (ok ? "text-green-600 dark:text-green-400" : "text-destructive")}>
          {t("qr.chose")}: {String(a)} {ok ? "✓" : `— ${t("qr.correctIs")}: ${q.correctNumber}${q.tolerance ? ` (±${q.tolerance})` : ""}`}
        </p>
      );
    }
    return <p className="mt-2 whitespace-pre-wrap rounded-lg bg-muted/50 px-3 py-2 text-sm">{String(a)}</p>;
  }

  const grade = useMutation({
    mutationFn: async () => apiRequest("PATCH", `/api/submissions/${sub.id}/grade`, { score: total, needsGrading: 0, gradedPoints: JSON.stringify(points) }),
    onSuccess: onGraded,
  });

  return (
    <Card className="flex items-center gap-3 p-4" data-testid={`submission-${sub.id}`}>
      <div className="min-w-0 flex-1">
        <p className="truncate font-bold">{sub.studentName}</p>
        <p className="truncate text-xs text-muted-foreground">{sub.studentEmail}</p>
      </div>
      <div className="text-right">
        <p className="font-black tabular-nums">{sub.score} / {sub.maxScore}</p>
        {sub.needsGrading ? (
          <Badge className="gap-1 bg-amber-500 text-white"><Hourglass className="h-3 w-3" /> {t("qr.needsGrading")}</Badge>
        ) : (
          <Badge className="gap-1 bg-green-500 text-white"><CheckCircle2 className="h-3 w-3" /> {t("qr.graded")}</Badge>
        )}
      </div>
      <Dialog>
        <DialogTrigger asChild>
          <Button variant="outline" size="sm" className="gap-1.5 font-bold" data-testid={`button-grade-${sub.id}`}><Pencil className="h-3.5 w-3.5" /> {t("qr.grade")}</Button>
        </DialogTrigger>
        <DialogContent className="max-h-[80vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{t("qr.grade")} — {sub.studentName}</DialogTitle></DialogHeader>
          <p className="-mt-1 text-sm text-muted-foreground">{t("qr.gradeHint")}</p>
          <div className="space-y-4">
            {questions.map((q, idx) => {
              const a = answers[q.id]?.answer;
              const c = isCorrect(q, a);
              const isManual = c === null;
              const awarded = Number(points[q.id]) || 0;
              return (
                <div key={q.id} className={"rounded-xl border p-3 " + (isManual ? "border-violet-400/60 bg-violet-50/40 dark:bg-violet-950/20" : "")}>
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-xs font-bold text-muted-foreground">Q{idx + 1} · {t(`qtype.${q.type}`)} · {t("qr.maxPoints", { max: q.points })}</p>
                    {c === true && <Badge className="bg-green-500 text-white">{t("qr.autoCorrect")}</Badge>}
                    {c === false && <Badge variant="destructive">{t("qr.autoWrong")}</Badge>}
                    {isManual && <Badge className="bg-violet-500 text-white">{t("qr.manualGrade")}</Badge>}
                  </div>
                  <p className="mt-1 font-bold">{q.prompt}</p>
                  {q.type === "photo" && q.imageUrl && <img src={q.imageUrl} alt="" className="mt-2 max-h-40 rounded-lg border object-contain" />}
                  {isManual ? (
                    <div className="mt-2">
                      <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">{t("qr.studentSolution")}</p>
                      {renderAnswer(q, a)}
                    </div>
                  ) : (
                    renderAnswer(q, a)
                  )}
                  <div className="mt-3 flex items-center gap-2 border-t pt-3">
                    <span className="mr-auto text-sm font-bold">{t("qr.pointsAwarded")}</span>
                    <Button type="button" variant="outline" size="icon" className="h-8 w-8" onClick={() => setQ(q.id, awarded - 1, q.points)} disabled={awarded <= 0} data-testid={`button-minus-${sub.id}-${q.id}`}><Minus className="h-4 w-4" /></Button>
                    <Input type="number" min={0} max={q.points} value={awarded} onChange={(e) => setQ(q.id, Number(e.target.value), q.points)} className="w-16 text-center" data-testid={`input-points-${sub.id}-${q.id}`} />
                    <Button type="button" variant="outline" size="icon" className="h-8 w-8" onClick={() => setQ(q.id, awarded + 1, q.points)} disabled={awarded >= q.points} data-testid={`button-plus-${sub.id}-${q.id}`}><Plus className="h-4 w-4" /></Button>
                    <span className="text-sm text-muted-foreground">/ {q.points}</span>
                  </div>
                </div>
              );
            })}
          </div>
          <DialogFooter className="flex-col gap-2 sm:flex-row sm:items-center">
            <div className="flex items-center gap-2" data-testid={`total-grade-${sub.id}`}>
              <span className="text-sm font-bold">{t("qr.totalScore")}</span>
              <span className="font-black tabular-nums">{total} / {sub.maxScore}</span>
            </div>
            <Button onClick={() => grade.mutate()} disabled={grade.isPending} className="font-bold sm:ml-auto" data-testid={`button-save-grade-${sub.id}`}>{t("qr.saveGrade")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

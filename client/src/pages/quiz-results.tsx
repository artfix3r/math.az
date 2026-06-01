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
import { QUESTION_TYPE_LABEL } from "@/lib/ui";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter,
} from "@/components/ui/dialog";
import { ArrowLeft, Hourglass, CheckCircle2, Pencil } from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell,
} from "recharts";
import type { Quiz, Question } from "@shared/schema";

type Sub = {
  id: number; studentId: number; studentName: string; studentEmail: string;
  answers: string; score: number; maxScore: number; needsGrading: number;
};

export default function QuizResults({ id }: { id: number }) {
  const { toast } = useToast();
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
        <ArrowLeft className="h-4 w-4" /> Back to quizzes
      </Link>
      <div>
        <h1 className="text-3xl font-black tracking-tight">{quiz?.title ?? "Results"}</h1>
        <p className="text-sm text-muted-foreground">{subs?.length ?? 0} submissions · class average {avg}%</p>
      </div>

      {isLoading ? (
        <Skeleton className="h-64 rounded-2xl" />
      ) : subs && subs.length > 0 ? (
        <>
          <Card className="p-5">
            <h2 className="mb-4 font-black">Scores by student</h2>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" vertical={false} />
                  <XAxis dataKey="name" tick={{ fontSize: 12 }} className="fill-muted-foreground" />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 12 }} className="fill-muted-foreground" />
                  <Tooltip
                    contentStyle={{ borderRadius: 12, border: "1px solid hsl(var(--border))", background: "hsl(var(--card))", color: "hsl(var(--foreground))" }}
                    formatter={(v) => [`${v}%`, "Score"]}
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
            <h2 className="font-black">Submissions</h2>
            {subs.map((s) => (
              <SubRow key={s.id} sub={s} questions={questions} onGraded={() => {
                queryClient.invalidateQueries({ queryKey: ["/api/quizzes", id, "submissions"] });
                queryClient.invalidateQueries({ queryKey: ["/api/analytics"] });
                toast({ title: "Grade saved" });
              }} />
            ))}
          </div>
        </>
      ) : (
        <Card className="flex items-center justify-center border-dashed p-12 text-sm text-muted-foreground">No submissions yet.</Card>
      )}
    </div>
  );
}

function SubRow({ sub, questions, onGraded }: { sub: Sub; questions: Question[]; onGraded: () => void }) {
  const [score, setScore] = useState(sub.score);
  const answers: Record<string, { answer: string | number }> = JSON.parse(sub.answers || "{}");

  const grade = useMutation({
    mutationFn: async () => apiRequest("PATCH", `/api/submissions/${sub.id}/grade`, { score: Number(score), needsGrading: 0 }),
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
          <Badge className="gap-1 bg-amber-500 text-white"><Hourglass className="h-3 w-3" /> Needs grading</Badge>
        ) : (
          <Badge className="gap-1 bg-green-500 text-white"><CheckCircle2 className="h-3 w-3" /> Graded</Badge>
        )}
      </div>
      <Dialog>
        <DialogTrigger asChild>
          <Button variant="outline" size="sm" className="gap-1.5 font-bold" data-testid={`button-grade-${sub.id}`}><Pencil className="h-3.5 w-3.5" /> Grade</Button>
        </DialogTrigger>
        <DialogContent className="max-h-[80vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Grade — {sub.studentName}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            {questions.map((q, idx) => {
              const a = answers[q.id]?.answer;
              const isCorrectMcq = q.type === "mcq" && Number(a) === q.correctIndex;
              return (
                <div key={q.id} className="rounded-xl border p-3">
                  <p className="text-xs font-bold text-muted-foreground">Q{idx + 1} · {QUESTION_TYPE_LABEL[q.type]} · {q.points} pt</p>
                  <p className="mt-1 font-bold">{q.prompt}</p>
                  {q.type === "photo" && q.imageUrl && <img src={q.imageUrl} alt="" className="mt-2 max-h-40 rounded-lg border object-contain" />}
                  {q.type === "mcq" ? (
                    <p className={"mt-2 text-sm font-bold " + (isCorrectMcq ? "text-green-600 dark:text-green-400" : "text-destructive")}>
                      Chose: {(q.options ?? [])[Number(a)] ?? "—"} {isCorrectMcq ? "✓ correct" : `— correct: ${(q.options ?? [])[q.correctIndex ?? 0]}`}
                    </p>
                  ) : (
                    <p className="mt-2 whitespace-pre-wrap rounded-lg bg-muted/50 px-3 py-2 text-sm">{(a as string) || <span className="text-muted-foreground">No answer</span>}</p>
                  )}
                </div>
              );
            })}
          </div>
          <DialogFooter className="flex-col gap-2 sm:flex-row sm:items-center">
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold">Total score</span>
              <Input type="number" min={0} max={sub.maxScore} value={score} onChange={(e) => setScore(Number(e.target.value))} className="w-24" data-testid={`input-grade-${sub.id}`} />
              <span className="text-sm text-muted-foreground">/ {sub.maxScore}</span>
            </div>
            <Button onClick={() => grade.mutate()} disabled={grade.isPending} className="font-bold sm:ml-auto" data-testid={`button-save-grade-${sub.id}`}>Save grade</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

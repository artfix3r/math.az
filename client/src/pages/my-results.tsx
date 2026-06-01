import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from "recharts";
import { Trophy, Hourglass, CheckCircle2 } from "lucide-react";

type Sub = {
  id: number; quizId: number; quizTitle: string;
  score: number; maxScore: number; needsGrading: number; submittedAt: number;
};

export default function MyResults() {
  const { data: subs, isLoading } = useQuery<Sub[]>({ queryKey: ["/api/my/submissions"] });

  const graded = (subs ?? []).filter((s) => !s.needsGrading);
  const avg = graded.length
    ? Math.round(graded.reduce((s, x) => s + (x.maxScore ? (x.score / x.maxScore) * 100 : 0), 0) / graded.length)
    : 0;
  const sorted = [...(subs ?? [])].sort((a, b) => a.submittedAt - b.submittedAt);
  const chartData = sorted.filter((s) => !s.needsGrading).map((s) => ({
    name: s.quizTitle?.slice(0, 12) ?? "Quiz",
    percent: s.maxScore ? Math.round((s.score / s.maxScore) * 100) : 0,
  }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-black tracking-tight">My results</h1>
        <p className="text-sm text-muted-foreground">Track your quiz scores over time.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="flex items-center gap-4 p-5">
          <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-amber-100 text-amber-600 dark:bg-amber-500/15 dark:text-amber-300"><Trophy className="h-6 w-6" /></span>
          <div><p className="text-2xl font-black tabular-nums">{avg}%</p><p className="text-sm font-bold text-muted-foreground">Average score</p></div>
        </Card>
        <Card className="flex items-center gap-4 p-5">
          <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-green-100 text-green-600 dark:bg-green-500/15 dark:text-green-300"><CheckCircle2 className="h-6 w-6" /></span>
          <div><p className="text-2xl font-black tabular-nums">{graded.length}</p><p className="text-sm font-bold text-muted-foreground">Quizzes graded</p></div>
        </Card>
        <Card className="flex items-center gap-4 p-5">
          <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-100 text-blue-600 dark:bg-blue-500/15 dark:text-blue-300"><Hourglass className="h-6 w-6" /></span>
          <div><p className="text-2xl font-black tabular-nums">{(subs ?? []).filter((s) => s.needsGrading).length}</p><p className="text-sm font-bold text-muted-foreground">Awaiting grades</p></div>
        </Card>
      </div>

      {isLoading ? (
        <Skeleton className="h-64 rounded-2xl" />
      ) : subs && subs.length > 0 ? (
        <>
          {chartData.length > 1 && (
            <Card className="p-5">
              <h2 className="mb-4 font-black">Progress over time</h2>
              <div className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" vertical={false} />
                    <XAxis dataKey="name" tick={{ fontSize: 12 }} className="fill-muted-foreground" />
                    <YAxis domain={[0, 100]} tick={{ fontSize: 12 }} className="fill-muted-foreground" />
                    <Tooltip contentStyle={{ borderRadius: 12, border: "1px solid hsl(var(--border))", background: "hsl(var(--card))" }} formatter={(v) => [`${v}%`, "Score"]} />
                    <Line type="monotone" dataKey="percent" stroke="hsl(var(--primary))" strokeWidth={3} dot={{ r: 4, fill: "hsl(var(--primary))" }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </Card>
          )}

          <div className="space-y-2">
            {sorted.slice().reverse().map((s) => (
              <Card key={s.id} className="flex items-center gap-3 p-4" data-testid={`result-${s.id}`}>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-bold">{s.quizTitle}</p>
                  <p className="text-xs text-muted-foreground">{new Date(s.submittedAt).toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}</p>
                </div>
                {s.needsGrading ? (
                  <Badge className="gap-1 bg-amber-500 text-white"><Hourglass className="h-3 w-3" /> Pending</Badge>
                ) : (
                  <p className="font-black tabular-nums">{s.score} / {s.maxScore}</p>
                )}
              </Card>
            ))}
          </div>
        </>
      ) : (
        <Card className="flex flex-col items-center justify-center border-dashed p-12 text-center">
          <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary"><Trophy className="h-7 w-7" /></span>
          <p className="mt-4 font-bold">No results yet</p>
          <p className="mt-1 text-sm text-muted-foreground">Take a quiz and your scores will show up here.</p>
        </Card>
      )}
    </div>
  );
}

import { useQuery } from "@tanstack/react-query";
import { Skeleton } from "@/components/ui/skeleton";
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from "recharts";
import { Hourglass, ChevronRight } from "lucide-react";
import { Link } from "wouter";
import { useT, formatDateTime } from "@/lib/i18n";
import { PenScore } from "@/components/red-pen";

type Sub = {
  id: number; quizId: number; quizTitle: string;
  score: number; maxScore: number; needsGrading: number; submittedAt: number;
};

export default function MyResults() {
  const { t } = useT();
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

  const pending = (subs ?? []).filter((s) => s.needsGrading).length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold sm:text-[28px]">{t("mr.title")}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t("mr.sub")}</p>
      </div>

      <dl className="grid grid-cols-3 divide-x rounded-lg border bg-card shadow-sm">
        {[
          { k: "mr.avgScore", v: `${avg}%` },
          { k: "mr.quizzesGraded", v: graded.length },
          { k: "mr.awaitingGrades", v: pending },
        ].map((x) => (
          <div key={x.k} className="px-4 py-3.5">
            <dt className="text-xs text-muted-foreground">{t(x.k)}</dt>
            <dd className="mt-1 text-2xl font-semibold tabular-nums">{x.v}</dd>
          </div>
        ))}
      </dl>

      {isLoading ? (
        <Skeleton className="h-64 rounded-lg" />
      ) : subs && subs.length > 0 ? (
        <>
          <ul className="divide-y rounded-lg border bg-card shadow-sm">
            {sorted.slice().reverse().map((s, i) => (
              <li key={s.id}>
               <Link href={`/results/${s.id}`} className="flex min-h-[4.5rem] items-center gap-3 px-4 py-2.5 transition-colors hover:bg-muted/60" data-testid={`result-${s.id}`}>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{s.quizTitle}</p>
                  <p className="text-xs text-muted-foreground">{formatDateTime(s.submittedAt)}</p>
                </div>
                {s.needsGrading ? (
                  <span className="inline-flex items-center gap-1.5 text-sm font-medium text-due"><Hourglass className="h-4 w-4" /> {t("mr.pending")}</span>
                ) : (
                  <PenScore score={s.score} max={s.maxScore} size="sm" animate={i === 0} label={t("pen.scoreLabel", { score: s.score, max: s.maxScore })} />
                )}
                <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
               </Link>
              </li>
            ))}
          </ul>

          {chartData.length > 1 && (
            <section className="rounded-lg border bg-card p-4 shadow-sm sm:p-5">
              <h2 className="mb-4 text-[15px] font-semibold">{t("mr.progress")}</h2>
              <div className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                    <CartesianGrid stroke="hsl(var(--border))" vertical={false} />
                    <XAxis dataKey="name" tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }} tickLine={false} axisLine={{ stroke: "hsl(var(--border))" }} />
                    <YAxis domain={[0, 100]} tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }} tickLine={false} axisLine={false} />
                    <Tooltip contentStyle={{ borderRadius: 6, border: "1px solid hsl(var(--border))", background: "hsl(var(--card))", color: "hsl(var(--foreground))" }} formatter={(v) => [`${v}%`, t("quiz.score")]} />
                    <Line type="monotone" dataKey="percent" stroke="hsl(var(--primary))" strokeWidth={2} dot={{ r: 4, fill: "hsl(var(--primary))", stroke: "hsl(var(--card))", strokeWidth: 2 }} activeDot={{ r: 6 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </section>
          )}
        </>
      ) : (
        <div className="rounded-lg border border-dashed bg-card/60 p-8 text-center">
          <p className="font-medium">{t("mr.none")}</p>
          <p className="mt-1 text-sm text-muted-foreground">{t("mr.noneSub")}</p>
        </div>
      )}
    </div>
  );
}

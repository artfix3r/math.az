import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell,
} from "recharts";
import { BarChart3, Users, FileQuestion, Hourglass } from "lucide-react";

type Analytics = {
  perQuiz: { quizId: number; title: string; submissions: number; avgPercent: number; needsGrading: number }[];
  perStudent: { name: string; avgPercent: number; attempts: number }[];
};

export default function Analytics() {
  const { data, isLoading } = useQuery<Analytics>({ queryKey: ["/api/analytics"] });

  const totalSubs = data?.perQuiz.reduce((s, q) => s + q.submissions, 0) ?? 0;
  const pending = data?.perQuiz.reduce((s, q) => s + q.needsGrading, 0) ?? 0;
  const classAvg = data?.perStudent.length
    ? Math.round(data.perStudent.reduce((s, x) => s + x.avgPercent, 0) / data.perStudent.length)
    : 0;

  if (isLoading) return <div className="space-y-4"><Skeleton className="h-24 rounded-2xl" /><Skeleton className="h-72 rounded-2xl" /></div>;

  const hasData = data && (data.perQuiz.length > 0 || data.perStudent.length > 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-black tracking-tight">Analytics</h1>
        <p className="text-sm text-muted-foreground">How your students are performing across all quizzes.</p>
      </div>

      {!hasData ? (
        <Card className="flex flex-col items-center justify-center border-dashed p-12 text-center">
          <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary"><BarChart3 className="h-7 w-7" /></span>
          <p className="mt-4 font-bold">No data yet</p>
          <p className="mt-1 text-sm text-muted-foreground">Once students submit quizzes, performance graphs will appear here.</p>
        </Card>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-3">
            <Stat icon={Users} color="bg-violet-100 text-violet-600 dark:bg-violet-500/15 dark:text-violet-300" value={`${classAvg}%`} label="Class average" />
            <Stat icon={FileQuestion} color="bg-pink-100 text-pink-600 dark:bg-pink-500/15 dark:text-pink-300" value={totalSubs} label="Total submissions" />
            <Stat icon={Hourglass} color="bg-amber-100 text-amber-600 dark:bg-amber-500/15 dark:text-amber-300" value={pending} label="Awaiting grading" />
          </div>

          {data!.perStudent.length > 0 && (
            <Card className="p-5">
              <h2 className="mb-4 font-black">Average score per student</h2>
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data!.perStudent}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" vertical={false} />
                    <XAxis dataKey="name" tick={{ fontSize: 12 }} className="fill-muted-foreground" />
                    <YAxis domain={[0, 100]} tick={{ fontSize: 12 }} className="fill-muted-foreground" />
                    <Tooltip contentStyle={{ borderRadius: 12, border: "1px solid hsl(var(--border))", background: "hsl(var(--card))" }} formatter={(v) => [`${v}%`, "Average"]} />
                    <Bar dataKey="avgPercent" radius={[8, 8, 0, 0]}>
                      {data!.perStudent.map((d, i) => (
                        <Cell key={i} fill={d.avgPercent >= 70 ? "hsl(var(--chart-4))" : d.avgPercent >= 40 ? "hsl(var(--chart-3))" : "hsl(var(--destructive))"} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Card>
          )}

          {data!.perQuiz.length > 0 && (
            <Card className="p-5">
              <h2 className="mb-4 font-black">Average score per quiz</h2>
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data!.perQuiz}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" vertical={false} />
                    <XAxis dataKey="title" tick={{ fontSize: 11 }} className="fill-muted-foreground" interval={0} angle={-12} textAnchor="end" height={50} />
                    <YAxis domain={[0, 100]} tick={{ fontSize: 12 }} className="fill-muted-foreground" />
                    <Tooltip contentStyle={{ borderRadius: 12, border: "1px solid hsl(var(--border))", background: "hsl(var(--card))" }} formatter={(v) => [`${v}%`, "Average"]} />
                    <Bar dataKey="avgPercent" fill="hsl(var(--chart-2))" radius={[8, 8, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Card>
          )}
        </>
      )}
    </div>
  );
}

function Stat({ icon: Icon, color, value, label }: { icon: React.ElementType; color: string; value: React.ReactNode; label: string }) {
  return (
    <Card className="flex items-center gap-4 p-5">
      <span className={"flex h-12 w-12 items-center justify-center rounded-xl " + color}><Icon className="h-6 w-6" /></span>
      <div><p className="text-2xl font-black tabular-nums">{value}</p><p className="text-sm font-bold text-muted-foreground">{label}</p></div>
    </Card>
  );
}

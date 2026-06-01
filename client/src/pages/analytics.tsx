import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Table, TableHeader, TableBody, TableRow, TableHead, TableCell,
} from "@/components/ui/table";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell,
  PieChart, Pie,
} from "recharts";
import { BarChart3, Users, FileQuestion, Hourglass } from "lucide-react";
import { useT } from "@/lib/i18n";

type Analytics = {
  perQuiz: { quizId: number; title: string; submissions: number; avgPercent: number; needsGrading: number }[];
  perStudent: { name: string; avgPercent: number; attempts: number }[];
  classStats?: {
    classAvg: number;
    totalStudents: number;
    totalQuizzes: number;
    totalSubmissions: number;
    totalNeedsGrading: number;
    distribution: { band: string; label: string; count: number }[];
  };
};

const BAND_COLOR: Record<string, string> = {
  high: "hsl(var(--chart-4))",
  mid: "hsl(var(--chart-3))",
  low: "hsl(var(--destructive))",
};

export default function Analytics() {
  const { t } = useT();
  const { data, isLoading } = useQuery<Analytics>({ queryKey: ["/api/analytics"] });

  if (isLoading) return <div className="space-y-4"><Skeleton className="h-24 rounded-2xl" /><Skeleton className="h-72 rounded-2xl" /></div>;

  const cs = data?.classStats;
  const totalSubs = cs?.totalSubmissions ?? data?.perQuiz.reduce((s, q) => s + q.submissions, 0) ?? 0;
  const pending = cs?.totalNeedsGrading ?? data?.perQuiz.reduce((s, q) => s + q.needsGrading, 0) ?? 0;
  const classAvg = cs?.classAvg ?? (data?.perStudent.length
    ? Math.round(data.perStudent.reduce((s, x) => s + x.avgPercent, 0) / data.perStudent.length)
    : 0);
  const activeStudents = cs?.totalStudents ?? data?.perStudent.length ?? 0;

  const hasData = data && (data.perQuiz.length > 0 || data.perStudent.length > 0);

  const distribution = (cs?.distribution ?? []).map((d) => ({
    ...d,
    name: t(`an.band.${d.band}`),
  }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-black tracking-tight">{t("an.title")}</h1>
        <p className="text-sm text-muted-foreground">{t("an.sub")}</p>
      </div>

      {!hasData ? (
        <Card className="flex flex-col items-center justify-center border-dashed p-12 text-center">
          <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary"><BarChart3 className="h-7 w-7" /></span>
          <p className="mt-4 font-bold">{t("an.noData")}</p>
          <p className="mt-1 text-sm text-muted-foreground">{t("an.noDataSub")}</p>
        </Card>
      ) : (
        <Tabs defaultValue="class">
          <TabsList className="grid w-full max-w-md grid-cols-2">
            <TabsTrigger value="class" data-testid="tab-class">{t("an.tabClass")}</TabsTrigger>
            <TabsTrigger value="student" data-testid="tab-student">{t("an.tabStudent")}</TabsTrigger>
          </TabsList>

          {/* ---------------- Class overview ---------------- */}
          <TabsContent value="class" className="mt-5 space-y-6">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Stat icon={Users} color="bg-violet-100 text-violet-600 dark:bg-violet-500/15 dark:text-violet-300" value={`${classAvg}%`} label={t("an.classAverage")} />
              <Stat icon={Users} color="bg-sky-100 text-sky-600 dark:bg-sky-500/15 dark:text-sky-300" value={activeStudents} label={t("an.activeStudents")} />
              <Stat icon={FileQuestion} color="bg-pink-100 text-pink-600 dark:bg-pink-500/15 dark:text-pink-300" value={totalSubs} label={t("an.totalSubmissions")} />
              <Stat icon={Hourglass} color="bg-amber-100 text-amber-600 dark:bg-amber-500/15 dark:text-amber-300" value={pending} label={t("an.awaitingGrading")} />
            </div>

            {distribution.some((d) => d.count > 0) && (
              <Card className="p-5">
                <h2 className="mb-4 font-black">{t("an.distribution")}</h2>
                <div className="grid items-center gap-4 sm:grid-cols-2">
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={distribution} dataKey="count" nameKey="name" cx="50%" cy="50%" outerRadius={90} innerRadius={50} paddingAngle={3}>
                          {distribution.map((d, i) => (
                            <Cell key={i} fill={BAND_COLOR[d.band]} />
                          ))}
                        </Pie>
                        <Tooltip contentStyle={{ borderRadius: 12, border: "1px solid hsl(var(--border))", background: "hsl(var(--card))", color: "hsl(var(--foreground))" }} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="space-y-2">
                    {distribution.map((d) => (
                      <div key={d.band} className="flex items-center gap-3 rounded-xl border bg-card/70 px-3 py-2.5">
                        <span className="h-3 w-3 rounded-full" style={{ background: BAND_COLOR[d.band] }} />
                        <span className="flex-1 text-sm font-bold">{d.name}</span>
                        <span className="text-sm font-black tabular-nums">{d.count}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </Card>
            )}

            {data!.perQuiz.length > 0 && (
              <Card className="p-5">
                <h2 className="mb-4 font-black">{t("an.perQuiz")}</h2>
                <div className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={data!.perQuiz}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-border" vertical={false} />
                      <XAxis dataKey="title" tick={{ fontSize: 11 }} className="fill-muted-foreground" interval={0} angle={-12} textAnchor="end" height={50} />
                      <YAxis domain={[0, 100]} tick={{ fontSize: 12 }} className="fill-muted-foreground" />
                      <Tooltip contentStyle={{ borderRadius: 12, border: "1px solid hsl(var(--border))", background: "hsl(var(--card))", color: "hsl(var(--foreground))" }} formatter={(v) => [`${v}%`, t("an.colAvg")]} />
                      <Bar dataKey="avgPercent" fill="hsl(var(--chart-2))" radius={[8, 8, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </Card>
            )}
          </TabsContent>

          {/* ---------------- By student ---------------- */}
          <TabsContent value="student" className="mt-5 space-y-6">
            {data!.perStudent.length > 0 ? (
              <>
                <Card className="p-5">
                  <h2 className="mb-4 font-black">{t("an.perStudent")}</h2>
                  <div className="h-72">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={data!.perStudent}>
                        <CartesianGrid strokeDasharray="3 3" className="stroke-border" vertical={false} />
                        <XAxis dataKey="name" tick={{ fontSize: 12 }} className="fill-muted-foreground" />
                        <YAxis domain={[0, 100]} tick={{ fontSize: 12 }} className="fill-muted-foreground" />
                        <Tooltip contentStyle={{ borderRadius: 12, border: "1px solid hsl(var(--border))", background: "hsl(var(--card))", color: "hsl(var(--foreground))" }} formatter={(v) => [`${v}%`, t("an.colAvg")]} />
                        <Bar dataKey="avgPercent" radius={[8, 8, 0, 0]}>
                          {data!.perStudent.map((d, i) => (
                            <Cell key={i} fill={d.avgPercent >= 70 ? "hsl(var(--chart-4))" : d.avgPercent >= 40 ? "hsl(var(--chart-3))" : "hsl(var(--destructive))"} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </Card>

                <Card className="p-5">
                  <h2 className="mb-4 font-black">{t("an.studentTable")}</h2>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>{t("an.colStudent")}</TableHead>
                        <TableHead className="text-right">{t("an.colAvg")}</TableHead>
                        <TableHead className="text-right">{t("an.colAttempts")}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {[...data!.perStudent].sort((a, b) => b.avgPercent - a.avgPercent).map((s, i) => (
                        <TableRow key={i} data-testid={`student-row-${i}`}>
                          <TableCell className="font-bold">{s.name}</TableCell>
                          <TableCell className="text-right">
                            <span className={"font-black tabular-nums " + (s.avgPercent >= 70 ? "text-green-600 dark:text-green-400" : s.avgPercent >= 40 ? "text-amber-600 dark:text-amber-400" : "text-destructive")}>
                              {s.avgPercent}%
                            </span>
                          </TableCell>
                          <TableCell className="text-right tabular-nums">{s.attempts}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </Card>
              </>
            ) : (
              <Card className="flex items-center justify-center border-dashed p-12 text-sm text-muted-foreground">{t("an.noDataSub")}</Card>
            )}
          </TabsContent>
        </Tabs>
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

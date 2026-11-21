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
  high: "hsl(var(--correct))",
  mid: "hsl(var(--due))",
  low: "hsl(var(--destructive))",
};

export default function Analytics() {
  const { t } = useT();
  const { data, isLoading } = useQuery<Analytics>({ queryKey: ["/api/analytics"] });

  if (isLoading) return <div className="space-y-4"><Skeleton className="h-24 rounded-lg" /><Skeleton className="h-72 rounded-lg" /></div>;

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
        <h1 className="text-2xl font-bold sm:text-[28px]">{t("an.title")}</h1>
        <p className="text-sm text-muted-foreground">{t("an.sub")}</p>
      </div>

      {!hasData ? (
        <Card className="flex flex-col items-center justify-center border-dashed p-12 text-center">
          <span className="flex h-14 w-14 items-center justify-center rounded-lg bg-primary/10 text-primary"><BarChart3 className="h-7 w-7" /></span>
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
            <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border bg-border shadow-sm lg:grid-cols-4">
              <Stat icon={Users} color="" value={`${classAvg}%`} label={t("an.classAverage")} />
              <Stat icon={Users} color="" value={activeStudents} label={t("an.activeStudents")} />
              <Stat icon={FileQuestion} color="" value={totalSubs} label={t("an.totalSubmissions")} />
              <Stat icon={Hourglass} color="text-due" value={pending} label={t("an.awaitingGrading")} />
            </dl>

            {distribution.some((d) => d.count > 0) && (
              <Card className="p-5">
                <h2 className="mb-4 font-bold">{t("an.distribution")}</h2>
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
                      <div key={d.band} className="flex items-center gap-3 rounded-lg border bg-card/70 px-3 py-2.5">
                        <span className="h-3 w-3 rounded-full" style={{ background: BAND_COLOR[d.band] }} />
                        <span className="flex-1 text-sm font-bold">{d.name}</span>
                        <span className="text-sm font-bold tabular-nums">{d.count}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </Card>
            )}

            {data!.perQuiz.length > 0 && (
              <Card className="p-5">
                <h2 className="mb-4 font-bold">{t("an.perQuiz")}</h2>
                <div className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={data!.perQuiz}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-border" vertical={false} />
                      <XAxis dataKey="title" tick={{ fontSize: 11 }} className="fill-muted-foreground" interval={0} angle={-12} textAnchor="end" height={50} />
                      <YAxis domain={[0, 100]} tick={{ fontSize: 12 }} className="fill-muted-foreground" />
                      <Tooltip contentStyle={{ borderRadius: 12, border: "1px solid hsl(var(--border))", background: "hsl(var(--card))", color: "hsl(var(--foreground))" }} formatter={(v) => [`${v}%`, t("an.colAvg")]} />
                      <Bar dataKey="avgPercent" fill="hsl(var(--chart-1))" radius={[4, 4, 0, 0]} maxBarSize={48} />
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
                  <h2 className="mb-4 font-bold">{t("an.perStudent")}</h2>
                  <div className="h-72">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={data!.perStudent}>
                        <CartesianGrid strokeDasharray="3 3" className="stroke-border" vertical={false} />
                        <XAxis dataKey="name" tick={{ fontSize: 12 }} className="fill-muted-foreground" />
                        <YAxis domain={[0, 100]} tick={{ fontSize: 12 }} className="fill-muted-foreground" />
                        <Tooltip contentStyle={{ borderRadius: 12, border: "1px solid hsl(var(--border))", background: "hsl(var(--card))", color: "hsl(var(--foreground))" }} formatter={(v) => [`${v}%`, t("an.colAvg")]} />
                        <Bar dataKey="avgPercent" radius={[4, 4, 0, 0]} maxBarSize={48}>
                          {data!.perStudent.map((d, i) => (
                            <Cell key={i} fill={d.avgPercent >= 70 ? "hsl(var(--correct))" : d.avgPercent >= 40 ? "hsl(var(--due))" : "hsl(var(--pen))"} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </Card>

                <Card className="p-5">
                  <h2 className="mb-4 font-bold">{t("an.studentTable")}</h2>
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
                            <span className={"font-bold tabular-nums " + (s.avgPercent >= 70 ? "text-correct dark:text-correct" : s.avgPercent >= 40 ? "text-due dark:text-due" : "text-destructive")}>
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
    <div className="bg-card px-4 py-3.5">
      <dt className="flex items-center gap-1.5 text-xs text-muted-foreground"><Icon className={"h-3.5 w-3.5 " + color} />{label}</dt>
      <dd className="mt-1 text-2xl font-semibold tabular-nums">{value}</dd>
    </div>
  );
}

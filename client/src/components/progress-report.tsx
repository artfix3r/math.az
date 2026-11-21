import { useState } from "react";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useT, formatDateTime } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { TrendingUp, TrendingDown, Minus, CheckCircle2, AlertTriangle, CircleDot, ChevronDown } from "lucide-react";
import type { ProgressReport, TopicProgress } from "@shared/progress";

// One series over time -> single-hue line, no legend (the title names it),
// hover tooltip, and a table view for screen readers / exact numbers.
const LINE = "hsl(var(--primary))";
const tooltipStyle = { borderRadius: 12, border: "1px solid hsl(var(--border))", background: "hsl(var(--card))", color: "hsl(var(--foreground))" };

function LevelBadge({ level }: { level: TopicProgress["level"] }) {
  const { t } = useT();
  const cfg = {
    strong: { icon: CheckCircle2, cls: "border-correct/40 bg-correct/10 text-correct dark:text-correct" },
    ok: { icon: CircleDot, cls: "border-primary/40 bg-primary/10 text-primary dark:text-primary" },
    weak: { icon: AlertTriangle, cls: "border-due/40 bg-due/10 text-due dark:text-due" },
  }[level];
  const Icon = cfg.icon;
  return <Badge variant="outline" className={cn("gap-1 font-bold", cfg.cls)}><Icon className="h-3 w-3" /> {t(`prog.level.${level}`)}</Badge>;
}

function TrendMark({ trend }: { trend: TopicProgress["trend"] }) {
  const { t } = useT();
  const Icon = trend === "up" ? TrendingUp : trend === "down" ? TrendingDown : Minus;
  return (
    <span className={cn("inline-flex items-center gap-1 text-xs font-bold text-muted-foreground")}>
      <Icon className="h-3.5 w-3.5" /> {t(`prog.trend.${trend}`)}
    </span>
  );
}

export function ProgressReportView({ report }: { report: ProgressReport }) {
  const { t } = useT();
  const [showTable, setShowTable] = useState(false);
  const data = report.timeline.map((x) => ({ ...x, label: formatDateTime(x.submittedAt) }));
  const pending = report.timeline.filter((x) => x.pending).length;

  if (report.quizCount === 0) {
    return <Card className="flex items-center justify-center border-dashed p-10 text-sm text-muted-foreground">{t("prog.empty")}</Card>;
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="p-5">
          <p className="text-sm font-medium text-muted-foreground">{t("prog.average")}</p>
          <p className="mt-1 text-4xl font-bold" data-testid="text-average">{report.averagePercent}%</p>
        </Card>
        <Card className="p-5">
          <p className="text-sm font-medium text-muted-foreground">{t("prog.quizzesDone")}</p>
          <p className="mt-1 text-4xl font-bold">{report.quizCount}</p>
        </Card>
        <Card className="p-5">
          <p className="text-sm font-medium text-muted-foreground">{t("prog.needsWork")}</p>
          <p className="mt-1 truncate text-lg font-bold">
            {report.topics.filter((x) => x.level === "weak").map((x) => x.topic || t("prog.noTopic")).join(", ") || t("prog.nothingWeak")}
          </p>
        </Card>
      </div>

      <Card className="p-5">
        <h2 className="font-bold">{t("prog.chartTitle")}</h2>
        {pending > 0 && <p className="text-xs text-muted-foreground">{t("prog.pendingNote", { n: pending })}</p>}
        <div className="mt-4 h-64">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data} margin={{ top: 8, right: 16, left: -16, bottom: 8 }}>
              <CartesianGrid vertical={false} className="stroke-border" strokeOpacity={0.6} />
              <XAxis dataKey="label" tick={false} axisLine={false} height={1} />
              <YAxis domain={[0, 100]} ticks={[0, 50, 100]} tickFormatter={(v) => `${v}%`} tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
              <Tooltip
                contentStyle={tooltipStyle}
                labelFormatter={(_, p) => (p?.[0] ? `${p[0].payload.title} · ${p[0].payload.label}` : "")}
                formatter={(v) => [`${v}%`, t("prog.score")]}
              />
              <Line type="monotone" dataKey="percent" stroke={LINE} strokeWidth={2} dot={{ r: 4, strokeWidth: 2, stroke: "hsl(var(--card))", fill: LINE }} activeDot={{ r: 6 }} isAnimationActive={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
        <button type="button" onClick={() => setShowTable((v) => !v)} className="mt-3 inline-flex items-center gap-1 text-xs font-bold text-primary">
          <ChevronDown className={cn("h-3.5 w-3.5 transition", showTable && "rotate-180")} /> {showTable ? t("prog.hideTable") : t("prog.showTable")}
        </button>
        {showTable && (
          <table className="mt-2 w-full text-sm">
            <thead><tr className="text-left text-xs text-muted-foreground"><th className="py-1">{t("prog.colQuiz")}</th><th>{t("prog.colDate")}</th><th className="text-right">{t("prog.score")}</th></tr></thead>
            <tbody>
              {data.map((x, i) => (
                <tr key={i} className="border-t"><td className="py-1.5 font-semibold">{x.title}</td><td className="text-muted-foreground">{x.label}</td><td className="text-right font-bold">{x.percent}%{x.pending ? " *" : ""}</td></tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      <Card className="p-5">
        <h2 className="font-bold">{t("prog.topicsTitle")}</h2>
        <p className="text-xs text-muted-foreground">{t("prog.topicsHint")}</p>
        <ul className="mt-4 space-y-4">
          {report.topics.map((tp) => (
            <li key={tp.topic} data-testid="topic-row">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-bold">{tp.topic || t("prog.noTopic")}</span>
                <LevelBadge level={tp.level} />
                <TrendMark trend={tp.trend} />
                <span className="ml-auto text-sm font-bold">{tp.percent}% <span className="font-normal text-muted-foreground">({tp.earned}/{tp.possible})</span></span>
              </div>
              <div className="mt-1.5 h-2.5 overflow-hidden rounded-full bg-muted" role="img" aria-label={`${tp.topic}: ${tp.percent}%`}>
                <div className="h-full rounded-full" style={{ width: `${Math.max(tp.percent, 2)}%`, background: LINE }} />
              </div>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}

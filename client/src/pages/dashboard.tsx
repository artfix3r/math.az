import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useT, formatDateTime } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { DueBadge } from "@/components/due-badge";
import { PenScore, PenRemark, remarkKey } from "@/components/red-pen";
import { nextUp, latestResult, teacherAgenda } from "@shared/dashboard";
import { Plus, ArrowRight, Video, Clock, ListChecks, ChevronRight } from "lucide-react";
import type { Group, Quiz, ClassSession } from "@shared/schema";

type GroupWithCount = Group & { memberCount: number };
type StudentQuiz = Quiz & { submission: { score: number; maxScore: number; needsGrading: number } | null };
type MySubmission = { id: number; quizId: number; quizTitle?: string; score: number; maxScore: number; needsGrading: number; submittedAt: number };
type Analytics = { perQuiz: { quizId: number; title: string; submissions: number; needsGrading: number }[] };

function questionCount(q: Quiz): number {
  try { return (JSON.parse(q.questions || "[]") as unknown[]).length; } catch { return 0; }
}

export default function Dashboard() {
  const { user } = useAuth();
  const { t } = useT();
  const isTeacher = user?.role === "teacher";

  const greeting = (() => {
    const h = new Date().getHours();
    return h < 12 ? t("dash.morning") : h < 18 ? t("dash.afternoon") : t("dash.evening");
  })();
  const firstName = (user?.fullName ?? "").split(" ")[0];

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <h1 className="text-2xl font-bold sm:text-[28px]" data-testid="text-greeting">
          {greeting}, {firstName}
        </h1>
        {isTeacher && (
          <div className="flex gap-2">
            <Link href="/groups"><Button variant="outline">{t("dash.manageGroups")}</Button></Link>
            <Link href="/quizzes/new"><Button className="gap-1.5" data-testid="button-new-quiz"><Plus className="h-4 w-4" /> {t("dash.newQuiz")}</Button></Link>
          </div>
        )}
      </header>

      {isTeacher ? <TeacherFirst /> : <StudentFirst />}
      <Schedule />
    </div>
  );
}

/* ----------------------------- Student ----------------------------- */

function StudentFirst() {
  const { t } = useT();
  const { data: quizzes } = useQuery<StudentQuiz[]>({ queryKey: ["/api/quizzes"] });
  const { data: subs } = useQuery<MySubmission[]>({ queryKey: ["/api/my/submissions"] });
  const now = Date.now();
  const next = quizzes ? nextUp(quizzes, now) : null;
  const latest = subs ? latestResult(subs) : null;

  return (
    <div className="grid gap-4 lg:grid-cols-5">
      <section aria-labelledby="h-next" className="lg:col-span-3">
        <h2 id="h-next" className="mb-2 text-sm font-semibold text-muted-foreground">{t("dash.nextUp")}</h2>
        {!quizzes ? (
          <Skeleton className="h-44 w-full rounded-lg" />
        ) : next ? (
          <article className="rounded-lg border bg-card p-5 shadow-sm sm:p-6" data-testid="card-next-up">
            <h3 className="text-xl font-semibold leading-snug">{next.title}</h3>
            {next.description && <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{next.description}</p>}
            <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-muted-foreground">
              {next.dueAt ? <DueBadge dueAt={next.dueAt} /> : <span>{t("dash.noDeadline")}</span>}
              <span className="inline-flex items-center gap-1.5"><ListChecks className="h-4 w-4" />{t("dash.questions", { n: questionCount(next) })}</span>
              <span className="inline-flex items-center gap-1.5"><Clock className="h-4 w-4" />{t("dash.minutes", { n: next.durationMinutes })}</span>
            </div>
            <Link href={`/quizzes/${next.id}/take`}>
              <Button size="lg" className="mt-5 w-full gap-2 sm:w-auto" data-testid="button-start-next">
                {t("dash.start")} <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </article>
        ) : (
          <div className="rounded-lg border border-dashed bg-card/60 p-6 text-sm text-muted-foreground">
            {t("dash.noHomework")}{" "}
            <Link href="/quizzes" className="font-medium text-primary underline-offset-4 hover:underline">{t("nav.quizzes")}</Link>
          </div>
        )}
      </section>

      <section aria-labelledby="h-latest" className="lg:col-span-2">
        <h2 id="h-latest" className="mb-2 text-sm font-semibold text-muted-foreground">{t("dash.latestResult")}</h2>
        {!subs ? (
          <Skeleton className="h-44 w-full rounded-lg" />
        ) : latest ? (
          <Link href="/results" className="block">
            <article className="paper-margin flex h-full min-h-[8.5rem] flex-col rounded-lg border bg-card py-5 pl-14 pr-5 shadow-sm transition-colors hover:border-primary/40 sm:pl-16" data-testid="card-latest-result">
              <h3 className="font-semibold leading-snug">{latest.quizTitle}</h3>
              <p className="mt-0.5 text-xs text-muted-foreground">{formatDateTime(latest.submittedAt)}</p>
              <div className="mt-auto flex items-end justify-between gap-3 pt-4">
                {latest.needsGrading ? (
                  <p className="text-sm text-due">{t("dash.pendingGrade")}</p>
                ) : (
                  <>
                    <PenRemark animate delay={900}>{t(remarkKey(latest.maxScore ? (latest.score / latest.maxScore) * 100 : 0))}</PenRemark>
                    <PenScore score={latest.score} max={latest.maxScore} delay={250} label={t("pen.scoreLabel", { score: latest.score, max: latest.maxScore })} />
                  </>
                )}
              </div>
            </article>
          </Link>
        ) : (
          <div className="rounded-lg border border-dashed bg-card/60 p-6 text-sm text-muted-foreground">{t("dash.noResults")}</div>
        )}
      </section>
    </div>
  );
}

/* ----------------------------- Teacher ----------------------------- */

function TeacherFirst() {
  const { t } = useT();
  const { data: quizzes } = useQuery<Quiz[]>({ queryKey: ["/api/quizzes"] });
  const { data: groups } = useQuery<GroupWithCount[]>({ queryKey: ["/api/groups"] });
  const { data: analytics } = useQuery<Analytics>({ queryKey: ["/api/analytics"] });
  const agenda = quizzes && groups && analytics
    ? teacherAgenda({ quizzes, perQuiz: analytics.perQuiz, groups, now: Date.now() })
    : null;

  return (
    <div className="grid items-start gap-4 lg:grid-cols-2">
      <Panel title={t("dash.toGrade")} id="h-grade">
        {!agenda ? <RowsSkeleton /> : agenda.toGrade.length === 0 ? (
          <Empty>{t("dash.nothingToGrade")}</Empty>
        ) : agenda.toGrade.slice(0, 6).map((x) => (
          <Row key={x.id} href={`/quizzes/${x.id}/results`} testId={`row-grade-${x.id}`}>
            <span className="min-w-0 flex-1 truncate font-medium">{x.title}</span>
            <span className="shrink-0 rounded-sm bg-secondary px-2 py-0.5 text-xs font-semibold text-secondary-foreground tabular-nums">
              {t("dash.toGradeCount", { n: x.count })}
            </span>
          </Row>
        ))}
      </Panel>

      <Panel title={t("dash.dueThisWeek")} id="h-due">
        {!agenda ? <RowsSkeleton /> : agenda.dueThisWeek.length === 0 ? (
          <Empty>{t("dash.nothingDue")}</Empty>
        ) : agenda.dueThisWeek.slice(0, 6).map((x) => (
          <Row key={x.id} href={`/quizzes/${x.id}/results`} testId={`row-due-${x.id}`}>
            <span className="min-w-0 flex-1">
              <span className="block truncate font-medium">{x.title}</span>
              <span className="block truncate text-xs text-muted-foreground">
                {x.groupName}{x.groupName ? ", " : ""}{formatDateTime(x.dueAt)}
              </span>
            </span>
            <span className="shrink-0 text-right text-xs tabular-nums">
              <span className="block text-muted-foreground">{t("dash.handedIn", { n: x.submitted })}</span>
              {x.missing > 0 && <span className="block font-semibold text-due">{t("dash.missing", { n: x.missing })}</span>}
            </span>
          </Row>
        ))}
      </Panel>
    </div>
  );
}

function Panel({ title, id, children }: { title: string; id: string; children: React.ReactNode }) {
  return (
    <section aria-labelledby={id} className="rounded-lg border bg-card shadow-sm">
      <h2 id={id} className="border-b px-4 py-3 text-[15px] font-semibold">{title}</h2>
      <ul className="divide-y">{children}</ul>
    </section>
  );
}

function Row({ href, testId, children }: { href: string; testId?: string; children: React.ReactNode }) {
  return (
    <li>
      <Link href={href} data-testid={testId} className="flex min-h-14 items-center gap-3 px-4 py-2.5 text-sm transition-colors hover:bg-muted/60">
        {children}
        <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
      </Link>
    </li>
  );
}

function RowsSkeleton() {
  return <li className="space-y-2 p-4"><Skeleton className="h-5 w-3/4" /><Skeleton className="h-5 w-1/2" /></li>;
}

function Empty({ children }: { children: React.ReactNode }) {
  return <li className="px-4 py-6 text-sm text-muted-foreground">{children}</li>;
}

/* ----------------------------- Schedule ----------------------------- */

function Schedule() {
  const { t } = useT();
  const { data: sessions } = useQuery<ClassSession[]>({ queryKey: ["/api/sessions"] });
  const now = Date.now();
  const endOfToday = (() => { const d = new Date(); d.setHours(23, 59, 59, 999); return d.getTime(); })();
  const upcoming = (sessions ?? [])
    .filter((s) => !s.startAt || s.startAt >= now - 60 * 60 * 1000)
    .sort((a, b) => (a.startAt ?? Infinity) - (b.startAt ?? Infinity))
    .slice(0, 5);

  return (
    <section aria-labelledby="h-schedule">
      <div className="mb-2 flex items-center justify-between">
        <h2 id="h-schedule" className="text-sm font-semibold text-muted-foreground">{t("dash.todaySchedule")}</h2>
        <Link href="/sessions" className="text-sm font-medium text-primary underline-offset-4 hover:underline">{t("dash.viewAll")}</Link>
      </div>
      {!sessions ? (
        <Skeleton className="h-20 w-full rounded-lg" />
      ) : upcoming.length === 0 ? (
        <div className="rounded-lg border border-dashed bg-card/60 p-5 text-sm text-muted-foreground">{t("dash.noSchedule")}</div>
      ) : (
        <ul className="divide-y rounded-lg border bg-card shadow-sm">
          {upcoming.map((s) => {
            const today = !!s.startAt && s.startAt <= endOfToday;
            return (
              <li key={s.id} className="flex min-h-14 items-center gap-3 px-4 py-2.5" data-testid={`card-session-${s.id}`}>
                <Video className={cn("h-[18px] w-[18px] shrink-0", today ? "text-primary" : "text-muted-foreground")} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{s.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {today && <span className="font-semibold text-primary">{t("dash.today")} </span>}
                    {s.startAt ? formatDateTime(s.startAt) : t("quiz.anytime")}
                  </p>
                </div>
                <a href={s.meetingUrl} target="_blank" rel="noopener noreferrer">
                  <Button size="sm" variant={today ? "default" : "outline"}>{t("dash.join")}</Button>
                </a>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

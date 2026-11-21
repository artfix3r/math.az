import { useQuery } from "@tanstack/react-query";
import { AlarmClock } from "lucide-react";
import { formatDue } from "@/components/due-badge";
import { deadlineState } from "@shared/deadlines";
import { Link } from "wouter";
import { useAuth } from "@/lib/auth";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { colorOf } from "@/lib/ui";
import { cn } from "@/lib/utils";
import { useT } from "@/lib/i18n";
import { Users, FileQuestion, Video, Trophy, Plus, ArrowRight, CalendarClock } from "lucide-react";
import type { Group, Quiz, ClassSession } from "@shared/schema";

type GroupWithCount = Group & { memberCount: number };
type StudentQuiz = Quiz & { submission: { score: number; maxScore: number; needsGrading: number } | null };

export default function Dashboard() {
  const { user } = useAuth();
  const { t } = useT();
  const isTeacher = user?.role === "teacher";

  const fmt = (ts?: number | null) => {
    if (!ts) return t("quiz.anytime");
    return new Date(ts).toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
  };

  const { data: groups } = useQuery<GroupWithCount[]>({ queryKey: ["/api/groups"] });
  const { data: quizzes } = useQuery<(Quiz | StudentQuiz)[]>({ queryKey: ["/api/quizzes"] });
  const { data: sessions } = useQuery<ClassSession[]>({ queryKey: ["/api/sessions"] });

  const greeting = (() => {
    const h = new Date().getHours();
    return h < 12 ? t("dash.morning") : h < 18 ? t("dash.afternoon") : t("dash.evening");
  })();

  // Split sessions into today vs. upcoming for the schedule view
  const now = Date.now();
  const endOfToday = (() => { const d = new Date(); d.setHours(23, 59, 59, 999); return d.getTime(); })();
  const futureSessions = (sessions ?? [])
    .filter((s) => !s.startAt || s.startAt >= now - 60 * 60 * 1000)
    .sort((a, b) => (a.startAt ?? Infinity) - (b.startAt ?? Infinity));
  const todaySessions = futureSessions.filter((s) => s.startAt && s.startAt <= endOfToday);
  const laterSessions = futureSessions.filter((s) => !s.startAt || s.startAt > endOfToday);
  const timeOnly = (ts?: number | null) =>
    ts ? new Date(ts).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" }) : t("quiz.anytime");

  // Homework due within a day that the student hasn't handed in yet.
  const dueSoon = isTeacher ? [] : (quizzes ?? []).filter(
    (q) => !(q as StudentQuiz).submission && deadlineState(q.dueAt, now) === "soon",
  );

  return (
    <div className="space-y-8">
      {dueSoon.length > 0 && (
        <div className="rounded-2xl border border-amber-500/50 bg-amber-500/10 p-4" data-testid="banner-due-soon">
          <p className="flex items-center gap-2 font-bold text-amber-800 dark:text-amber-300">
            <AlarmClock className="h-4 w-4" /> {t("due.bannerTitle", { n: dueSoon.length })}
          </p>
          <ul className="mt-2 space-y-1">
            {dueSoon.map((q) => (
              <li key={q.id} className="flex flex-wrap items-center gap-2 text-sm">
                <Link href={`/quizzes/${q.id}/take`} className="font-bold text-primary underline-offset-2 hover:underline">{q.title}</Link>
                <span className="text-muted-foreground">{t("due.by", { date: formatDue(q.dueAt!) })}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
      <div className="rounded-2xl border bg-gradient-to-br from-primary/10 via-card to-pink-500/10 p-6 sm:p-8">
        <p className="text-sm font-bold text-primary">{greeting} 👋</p>
        <h1 className="mt-1 text-3xl font-black tracking-tight" data-testid="text-greeting">
          {t("dash.helloRole", { role: isTeacher ? t("landing.teacher") : t("landing.student"), name: user?.fullName ?? "" })}
        </h1>
        <p className="mt-2 max-w-lg text-sm text-muted-foreground">
          {isTeacher ? t("dash.teacherSub") : t("dash.studentSub")}
        </p>
        <div className="mt-5 flex flex-wrap gap-3">
          {isTeacher ? (
            <>
              <Link href="/quizzes/new"><Button className="gap-2 font-bold" data-testid="button-new-quiz"><Plus className="h-4 w-4" /> {t("dash.newQuiz")}</Button></Link>
              <Link href="/groups"><Button variant="outline" className="gap-2 font-bold">{t("dash.manageGroups")}</Button></Link>
            </>
          ) : (
            <>
              <Link href="/quizzes"><Button className="gap-2 font-bold">{t("dash.takeQuiz")} <ArrowRight className="h-4 w-4" /></Button></Link>
              <Link href="/sessions"><Button variant="outline" className="gap-2 font-bold">{t("dash.joinSession")}</Button></Link>
            </>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-3">
        {isTeacher && (
          <StatCard icon={Users} label={t("dash.stat.groups")} value={groups?.length} color="violet" href="/groups" />
        )}
        <StatCard icon={FileQuestion} label={isTeacher ? t("dash.stat.quizzes") : t("dash.stat.availableQuizzes")} value={quizzes?.length} color="pink" href="/quizzes" />
        <StatCard icon={Video} label={t("dash.stat.sessions")} value={sessions?.length} color="teal" href="/sessions" />
        {!isTeacher && (
          <StatCard icon={Trophy} label={t("dash.stat.myResults")} value={(quizzes as StudentQuiz[] | undefined)?.filter((q) => q.submission).length} color="amber" href="/results" />
        )}
      </div>

      {/* Today's schedule + upcoming */}
      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-black">{t("dash.todaySchedule")}</h2>
          <Link href="/sessions" className="text-sm font-bold text-primary hover:underline">{t("dash.viewAll")}</Link>
        </div>
        {!sessions ? (
          <Skeleton className="h-24 w-full rounded-2xl" />
        ) : futureSessions.length === 0 ? (
          <EmptyRow text={t("dash.noSchedule")} />
        ) : (
          <div className="space-y-5">
            {/* Today */}
            <div>
              <p className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-muted-foreground" data-testid="label-today">
                <span className="flex h-2 w-2 rounded-full bg-pink-500" /> {t("dash.today")}
              </p>
              {todaySessions.length === 0 ? (
                <EmptyRow text={t("dash.nothingToday")} />
              ) : (
                <div className="grid gap-3 sm:grid-cols-2">
                  {todaySessions.map((s) => (
                    <SessionRow key={s.id} s={s} time={timeOnly(s.startAt)} joinLabel={t("dash.join")} highlight />
                  ))}
                </div>
              )}
            </div>
            {/* Later / upcoming */}
            {laterSessions.length > 0 && (
              <div>
                <p className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-muted-foreground" data-testid="label-upcoming">
                  <span className="flex h-2 w-2 rounded-full bg-violet-500" /> {t("dash.upcoming")}
                </p>
                <div className="grid gap-3 sm:grid-cols-2">
                  {laterSessions.slice(0, 4).map((s) => (
                    <SessionRow key={s.id} s={s} time={fmt(s.startAt)} joinLabel={t("dash.join")} />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </section>
    </div>
  );
}

function StatCard({ icon: Icon, label, value, color, href }: { icon: React.ElementType; label: string; value?: number; color: string; href: string }) {
  const c = colorOf(color);
  return (
    <Link href={href}>
      <Card className="flex items-center gap-4 p-5 hover-elevate">
        <span className={cn("flex h-12 w-12 items-center justify-center rounded-xl", c.bg, c.text)}>
          <Icon className="h-6 w-6" />
        </span>
        <div>
          <p className="text-2xl font-black tabular-nums">{value ?? "—"}</p>
          <p className="text-sm font-bold text-muted-foreground">{label}</p>
        </div>
      </Card>
    </Link>
  );
}

function SessionRow({ s, time, joinLabel, highlight }: { s: ClassSession; time: string; joinLabel: string; highlight?: boolean }) {
  return (
    <Card className={cn("flex items-center gap-3 p-4", highlight && "border-pink-500/40 bg-pink-500/5")} data-testid={`card-session-${s.id}`}>
      <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-teal-100 text-teal-600 dark:bg-teal-500/15 dark:text-teal-300">
        <Video className="h-5 w-5" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate font-bold">{s.title}</p>
        <p className="flex items-center gap-1 text-xs text-muted-foreground"><CalendarClock className="h-3 w-3" /> {time}</p>
      </div>
      <a href={s.meetingUrl} target="_blank" rel="noopener noreferrer">
        <Button size="sm" className="font-bold">{joinLabel}</Button>
      </a>
    </Card>
  );
}

function EmptyRow({ text }: { text: string }) {
  return (
    <Card className="flex items-center justify-center border-dashed p-8 text-sm text-muted-foreground">{text}</Card>
  );
}

import { useQuery } from "@tanstack/react-query";
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

  return (
    <div className="space-y-8">
      <div className="rounded-2xl border bg-gradient-to-br from-primary/10 via-card to-pink-500/10 p-6 sm:p-8">
        <p className="text-sm font-bold text-primary">{greeting} 👋</p>
        <h1 className="mt-1 text-3xl font-black tracking-tight">{user?.fullName}</h1>
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

      {/* Upcoming sessions */}
      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-black">{t("dash.upcomingSessions")}</h2>
          <Link href="/sessions" className="text-sm font-bold text-primary hover:underline">{t("dash.viewAll")}</Link>
        </div>
        {!sessions ? (
          <Skeleton className="h-24 w-full rounded-2xl" />
        ) : sessions.length === 0 ? (
          <EmptyRow text={t("dash.noSessions")} />
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {sessions.slice(0, 4).map((s) => (
              <Card key={s.id} className="flex items-center gap-3 p-4">
                <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-teal-100 text-teal-600 dark:bg-teal-500/15 dark:text-teal-300">
                  <Video className="h-5 w-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-bold">{s.title}</p>
                  <p className="flex items-center gap-1 text-xs text-muted-foreground"><CalendarClock className="h-3 w-3" /> {fmt(s.startAt)}</p>
                </div>
                <a href={s.meetingUrl} target="_blank" rel="noopener noreferrer">
                  <Button size="sm" className="font-bold">{t("dash.join")}</Button>
                </a>
              </Card>
            ))}
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

function EmptyRow({ text }: { text: string }) {
  return (
    <Card className="flex items-center justify-center border-dashed p-8 text-sm text-muted-foreground">{text}</Card>
  );
}

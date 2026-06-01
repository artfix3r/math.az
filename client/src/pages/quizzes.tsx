import { useQuery, useMutation } from "@tanstack/react-query";
import { Link } from "wouter";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useAuth } from "@/lib/auth";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  FileQuestion, Plus, Clock, CalendarClock, BarChart3, Pencil, Trash2,
  Archive, Play, CheckCircle2, Hourglass,
} from "lucide-react";
import { useT } from "@/lib/i18n";
import type { Quiz, Question } from "@shared/schema";

type StudentQuiz = Quiz & { submission: { score: number; maxScore: number; needsGrading: number } | null };
type TFn = (key: string, vars?: Record<string, string | number>) => string;

function fmt(ts: number | null | undefined, t: TFn) {
  if (!ts) return t("quiz.notScheduled");
  return new Date(ts).toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}
function windowState(q: Quiz): "upcoming" | "open" | "closed" | "unscheduled" {
  if (!q.startAt) return "unscheduled";
  const now = Date.now();
  const end = q.startAt + q.durationMinutes * 60_000;
  if (now < q.startAt) return "upcoming";
  if (now <= end) return "open";
  return "closed";
}

export default function Quizzes() {
  const { user } = useAuth();
  const isTeacher = user?.role === "teacher";
  return isTeacher ? <TeacherQuizzes /> : <StudentQuizzes />;
}

function TeacherQuizzes() {
  const { toast } = useToast();
  const { t } = useT();
  const { data: quizzes, isLoading } = useQuery<Quiz[]>({ queryKey: ["/api/quizzes"] });

  const saveTemplate = useMutation({
    mutationFn: async (id: number) => apiRequest("POST", `/api/quizzes/${id}/save-template`),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/quizzes/templates"] }); toast({ title: t("quiz.savedToLibrary"), description: t("quiz.savedToLibrarySub") }); },
  });
  const del = useMutation({
    mutationFn: async (id: number) => apiRequest("DELETE", `/api/quizzes/${id}`),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/quizzes"] }); toast({ title: t("quiz.deleted") }); },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-black tracking-tight">{t("quiz.title")}</h1>
          <p className="text-sm text-muted-foreground">{t("quiz.teacherSub")}</p>
        </div>
        <Link href="/quizzes/new"><Button className="gap-2 font-bold" data-testid="button-new-quiz"><Plus className="h-4 w-4" /> {t("quiz.newQuiz")}</Button></Link>
      </div>

      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2"><Skeleton className="h-40 rounded-2xl" /><Skeleton className="h-40 rounded-2xl" /></div>
      ) : quizzes && quizzes.length > 0 ? (
        <div className="grid gap-4 sm:grid-cols-2">
          {quizzes.map((q) => {
            const qs: Question[] = JSON.parse(q.questions || "[]");
            const st = windowState(q);
            return (
              <Card key={q.id} className="flex flex-col p-5" data-testid={`card-quiz-${q.id}`}>
                <div className="flex items-start justify-between gap-2">
                  <h3 className="text-lg font-black">{q.title}</h3>
                  <StateBadge state={st} t={t} />
                </div>
                {q.description && <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{q.description}</p>}
                <div className="mt-3 flex flex-wrap gap-3 text-xs font-bold text-muted-foreground">
                  <span className="flex items-center gap-1"><FileQuestion className="h-3.5 w-3.5" /> {qs.length} {t("common.questions")}</span>
                  <span className="flex items-center gap-1"><Clock className="h-3.5 w-3.5" /> {q.durationMinutes} {t("common.min")}</span>
                  <span className="flex items-center gap-1"><CalendarClock className="h-3.5 w-3.5" /> {fmt(q.startAt, t)}</span>
                </div>
                <div className="mt-4 flex flex-wrap gap-2 border-t pt-4">
                  <Link href={`/quizzes/${q.id}/results`}><Button size="sm" variant="outline" className="gap-1.5 font-bold" data-testid={`button-results-${q.id}`}><BarChart3 className="h-3.5 w-3.5" /> {t("quiz.results")}</Button></Link>
                  <Link href={`/quizzes/${q.id}/edit`}><Button size="sm" variant="outline" className="gap-1.5 font-bold"><Pencil className="h-3.5 w-3.5" /> {t("common.edit")}</Button></Link>
                  <Button size="sm" variant="outline" className="gap-1.5 font-bold" onClick={() => saveTemplate.mutate(q.id)} data-testid={`button-backup-${q.id}`}><Archive className="h-3.5 w-3.5" /> {t("quiz.backup")}</Button>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button size="sm" variant="ghost" className="ml-auto text-muted-foreground hover:text-destructive"><Trash2 className="h-3.5 w-3.5" /></Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader><AlertDialogTitle>{t("quiz.deleteConfirm", { title: q.title })}</AlertDialogTitle><AlertDialogDescription>{t("quiz.deleteConfirmDesc")}</AlertDialogDescription></AlertDialogHeader>
                      <AlertDialogFooter><AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel><AlertDialogAction onClick={() => del.mutate(q.id)} className="bg-destructive text-destructive-foreground">{t("common.delete")}</AlertDialogAction></AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </Card>
            );
          })}
        </div>
      ) : (
        <EmptyState isTeacher t={t} />
      )}
    </div>
  );
}

function StudentQuizzes() {
  const { t } = useT();
  const { data: quizzes, isLoading } = useQuery<StudentQuiz[]>({ queryKey: ["/api/quizzes"] });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-black tracking-tight">{t("quiz.title")}</h1>
        <p className="text-sm text-muted-foreground">{t("quiz.studentSub")}</p>
      </div>
      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2"><Skeleton className="h-36 rounded-2xl" /><Skeleton className="h-36 rounded-2xl" /></div>
      ) : quizzes && quizzes.length > 0 ? (
        <div className="grid gap-4 sm:grid-cols-2">
          {quizzes.map((q) => {
            const qs: Question[] = JSON.parse(q.questions || "[]");
            const st = windowState(q);
            const done = !!q.submission;
            const canTake = !done && (st === "open" || st === "unscheduled");
            return (
              <Card key={q.id} className="flex flex-col p-5" data-testid={`card-quiz-${q.id}`}>
                <div className="flex items-start justify-between gap-2">
                  <h3 className="text-lg font-black">{q.title}</h3>
                  {done ? <Badge className="gap-1 bg-green-500 text-white"><CheckCircle2 className="h-3 w-3" /> {t("quiz.done")}</Badge> : <StateBadge state={st} t={t} />}
                </div>
                {q.description && <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{q.description}</p>}
                <div className="mt-3 flex flex-wrap gap-3 text-xs font-bold text-muted-foreground">
                  <span className="flex items-center gap-1"><FileQuestion className="h-3.5 w-3.5" /> {qs.length} {t("common.questions")}</span>
                  <span className="flex items-center gap-1"><Clock className="h-3.5 w-3.5" /> {q.durationMinutes} {t("common.min")}</span>
                  <span className="flex items-center gap-1"><CalendarClock className="h-3.5 w-3.5" /> {fmt(q.startAt, t)}</span>
                </div>
                <div className="mt-4 border-t pt-4">
                  {done ? (
                    <p className="text-sm font-bold">
                      {q.submission!.needsGrading ? (
                        <span className="flex items-center gap-1.5 text-amber-600 dark:text-amber-400"><Hourglass className="h-4 w-4" /> {t("quiz.awaitingGrading")}</span>
                      ) : (
                        <span className="text-green-600 dark:text-green-400">{t("quiz.score")}: {q.submission!.score} / {q.submission!.maxScore}</span>
                      )}
                    </p>
                  ) : canTake ? (
                    <Link href={`/quizzes/${q.id}/take`}><Button className="w-full gap-2 font-bold" data-testid={`button-take-${q.id}`}><Play className="h-4 w-4" /> {t("quiz.startQuiz")}</Button></Link>
                  ) : (
                    <Button className="w-full font-bold" disabled variant="outline">{st === "upcoming" ? t("quiz.opens") + " " + fmt(q.startAt, t) : t("quiz.closed")}</Button>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      ) : (
        <EmptyState t={t} />
      )}
    </div>
  );
}

function StateBadge({ state, t }: { state: string; t: TFn }) {
  const map: Record<string, { label: string; cls: string }> = {
    open: { label: t("quiz.openNow"), cls: "bg-green-500 text-white" },
    upcoming: { label: t("quiz.upcoming"), cls: "bg-blue-500 text-white" },
    closed: { label: t("quiz.closed"), cls: "bg-muted text-muted-foreground" },
    unscheduled: { label: t("quiz.anytime"), cls: "bg-violet-500 text-white" },
  };
  const m = map[state] ?? map.unscheduled;
  return <Badge className={m.cls}>{m.label}</Badge>;
}

function EmptyState({ isTeacher, t }: { isTeacher?: boolean; t: TFn }) {
  return (
    <Card className="flex flex-col items-center justify-center border-dashed p-12 text-center">
      <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary"><FileQuestion className="h-7 w-7" /></span>
      <p className="mt-4 font-bold">{t("quiz.noneTitle")}</p>
      <p className="mt-1 text-sm text-muted-foreground">{isTeacher ? t("quiz.noneTeacherSub") : t("quiz.noneStudentSub")}</p>
    </Card>
  );
}

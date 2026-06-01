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
import type { Quiz, Question } from "@shared/schema";

type StudentQuiz = Quiz & { submission: { score: number; maxScore: number; needsGrading: number } | null };

function fmt(ts?: number | null) {
  if (!ts) return "Not scheduled";
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
  const { data: quizzes, isLoading } = useQuery<Quiz[]>({ queryKey: ["/api/quizzes"] });

  const saveTemplate = useMutation({
    mutationFn: async (id: number) => apiRequest("POST", `/api/quizzes/${id}/save-template`),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/quizzes/templates"] }); toast({ title: "Saved to library", description: "You can reuse this quiz anytime." }); },
  });
  const del = useMutation({
    mutationFn: async (id: number) => apiRequest("DELETE", `/api/quizzes/${id}`),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/quizzes"] }); toast({ title: "Quiz deleted" }); },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-black tracking-tight">Quizzes</h1>
          <p className="text-sm text-muted-foreground">Create, schedule, and grade quizzes.</p>
        </div>
        <Link href="/quizzes/new"><Button className="gap-2 font-bold" data-testid="button-new-quiz"><Plus className="h-4 w-4" /> New quiz</Button></Link>
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
                  <StateBadge state={st} />
                </div>
                {q.description && <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{q.description}</p>}
                <div className="mt-3 flex flex-wrap gap-3 text-xs font-bold text-muted-foreground">
                  <span className="flex items-center gap-1"><FileQuestion className="h-3.5 w-3.5" /> {qs.length} questions</span>
                  <span className="flex items-center gap-1"><Clock className="h-3.5 w-3.5" /> {q.durationMinutes} min</span>
                  <span className="flex items-center gap-1"><CalendarClock className="h-3.5 w-3.5" /> {fmt(q.startAt)}</span>
                </div>
                <div className="mt-4 flex flex-wrap gap-2 border-t pt-4">
                  <Link href={`/quizzes/${q.id}/results`}><Button size="sm" variant="outline" className="gap-1.5 font-bold" data-testid={`button-results-${q.id}`}><BarChart3 className="h-3.5 w-3.5" /> Results</Button></Link>
                  <Link href={`/quizzes/${q.id}/edit`}><Button size="sm" variant="outline" className="gap-1.5 font-bold"><Pencil className="h-3.5 w-3.5" /> Edit</Button></Link>
                  <Button size="sm" variant="outline" className="gap-1.5 font-bold" onClick={() => saveTemplate.mutate(q.id)} data-testid={`button-backup-${q.id}`}><Archive className="h-3.5 w-3.5" /> Back up</Button>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button size="sm" variant="ghost" className="ml-auto text-muted-foreground hover:text-destructive"><Trash2 className="h-3.5 w-3.5" /></Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader><AlertDialogTitle>Delete "{q.title}"?</AlertDialogTitle><AlertDialogDescription>This also removes student submissions for this quiz.</AlertDialogDescription></AlertDialogHeader>
                      <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={() => del.mutate(q.id)} className="bg-destructive text-destructive-foreground">Delete</AlertDialogAction></AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </Card>
            );
          })}
        </div>
      ) : (
        <EmptyState isTeacher />
      )}
    </div>
  );
}

function StudentQuizzes() {
  const { data: quizzes, isLoading } = useQuery<StudentQuiz[]>({ queryKey: ["/api/quizzes"] });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-black tracking-tight">Quizzes</h1>
        <p className="text-sm text-muted-foreground">Take quizzes assigned to your groups.</p>
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
                  {done ? <Badge className="gap-1 bg-green-500 text-white"><CheckCircle2 className="h-3 w-3" /> Done</Badge> : <StateBadge state={st} />}
                </div>
                {q.description && <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{q.description}</p>}
                <div className="mt-3 flex flex-wrap gap-3 text-xs font-bold text-muted-foreground">
                  <span className="flex items-center gap-1"><FileQuestion className="h-3.5 w-3.5" /> {qs.length} questions</span>
                  <span className="flex items-center gap-1"><Clock className="h-3.5 w-3.5" /> {q.durationMinutes} min</span>
                  <span className="flex items-center gap-1"><CalendarClock className="h-3.5 w-3.5" /> {fmt(q.startAt)}</span>
                </div>
                <div className="mt-4 border-t pt-4">
                  {done ? (
                    <p className="text-sm font-bold">
                      {q.submission!.needsGrading ? (
                        <span className="flex items-center gap-1.5 text-amber-600 dark:text-amber-400"><Hourglass className="h-4 w-4" /> Awaiting grading</span>
                      ) : (
                        <span className="text-green-600 dark:text-green-400">Score: {q.submission!.score} / {q.submission!.maxScore}</span>
                      )}
                    </p>
                  ) : canTake ? (
                    <Link href={`/quizzes/${q.id}/take`}><Button className="w-full gap-2 font-bold" data-testid={`button-take-${q.id}`}><Play className="h-4 w-4" /> Start quiz</Button></Link>
                  ) : (
                    <Button className="w-full font-bold" disabled variant="outline">{st === "upcoming" ? "Opens " + fmt(q.startAt) : "Closed"}</Button>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      ) : (
        <EmptyState />
      )}
    </div>
  );
}

function StateBadge({ state }: { state: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    open: { label: "Open now", cls: "bg-green-500 text-white" },
    upcoming: { label: "Upcoming", cls: "bg-blue-500 text-white" },
    closed: { label: "Closed", cls: "bg-muted text-muted-foreground" },
    unscheduled: { label: "Anytime", cls: "bg-violet-500 text-white" },
  };
  const m = map[state] ?? map.unscheduled;
  return <Badge className={m.cls}>{m.label}</Badge>;
}

function EmptyState({ isTeacher }: { isTeacher?: boolean }) {
  return (
    <Card className="flex flex-col items-center justify-center border-dashed p-12 text-center">
      <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary"><FileQuestion className="h-7 w-7" /></span>
      <p className="mt-4 font-bold">No quizzes yet</p>
      <p className="mt-1 text-sm text-muted-foreground">{isTeacher ? "Create your first quiz to get started." : "Quizzes assigned to your groups will appear here."}</p>
    </Card>
  );
}

import { useState, useEffect, useRef } from "react";
import { MathText } from "@/components/math-text";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { useT } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { ArrowLeft, Clock, Send, Loader2, Check } from "lucide-react";
import type { Quiz, Question } from "@shared/schema";

type Answer = { answer: string | number };

export default function TakeQuiz({ id }: { id: number }) {
  const { toast } = useToast();
  const { t } = useT();
  const [, navigate] = useLocation();
  const { data: quiz, isLoading } = useQuery<Quiz>({ queryKey: ["/api/quizzes", id] });
  const [answers, setAnswers] = useState<Record<string, Answer>>({});
  const [remaining, setRemaining] = useState<number | null>(null);
  const submittedRef = useRef(false);
  const tabWarnedRef = useRef(false);
  const autoSubmitRef = useRef(false);

  const questions: Question[] = quiz ? JSON.parse(quiz.questions || "[]") : [];

  const submit = useMutation({
    mutationFn: async (autoSubmitted: boolean = false) =>
      (await apiRequest("POST", `/api/quizzes/${id}/submit`, { answers, autoSubmitted })).json(),
    onSuccess: () => {
      submittedRef.current = true;
      queryClient.invalidateQueries({ queryKey: ["/api/quizzes"] });
      queryClient.invalidateQueries({ queryKey: ["/api/my/submissions"] });
      if (autoSubmitRef.current) {
        toast({ title: t("tq.autoSubmitTitle"), description: t("tq.autoSubmitBody"), variant: "destructive" });
      } else {
        toast({ title: t("tq.submitted"), description: t("tq.submittedSub") });
      }
      navigate("/results");
    },
    onError: (e: any) => toast({ title: t("tq.cantSubmit"), description: e.message, variant: "destructive" }),
  });

  // countdown timer
  useEffect(() => {
    if (!quiz) return;
    const end = (quiz.startAt && quiz.startAt > Date.now() - quiz.durationMinutes * 60000)
      ? (quiz.startAt + quiz.durationMinutes * 60000)
      : Date.now() + quiz.durationMinutes * 60000;
    const tick = () => {
      const r = Math.max(0, Math.floor((end - Date.now()) / 1000));
      setRemaining(r);
      if (r <= 0 && !submittedRef.current && !submit.isPending) {
        submittedRef.current = true;
        submit.mutate(false);
      }
    };
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quiz]);

  // tab-switch guard: warn once, auto-submit on the second switch away
  useEffect(() => {
    if (!quiz) return;
    const handleLeave = () => {
      if (!document.hidden) return;
      if (submittedRef.current || submit.isPending) return;
      if (!tabWarnedRef.current) {
        tabWarnedRef.current = true;
        toast({ title: t("tq.tabWarn"), description: t("tq.tabWarnBody"), variant: "destructive" });
        return;
      }
      autoSubmitRef.current = true;
      submittedRef.current = true;
      submit.mutate(true);
    };
    document.addEventListener("visibilitychange", handleLeave);
    return () => document.removeEventListener("visibilitychange", handleLeave);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quiz]);

  const setAns = (qid: string, answer: string | number) =>
    setAnswers((a) => ({ ...a, [qid]: { answer } }));

  const toggleMultiAns = (qid: string, oi: number) =>
    setAnswers((a) => {
      const cur = String(a[qid]?.answer ?? "").split(",").filter((x) => x !== "");
      const key = String(oi);
      const next = cur.includes(key) ? cur.filter((x) => x !== key) : [...cur, key];
      next.sort((x, y) => Number(x) - Number(y));
      return { ...a, [qid]: { answer: next.join(",") } };
    });

  if (isLoading) return <Skeleton className="h-96 rounded-lg" />;
  if (!quiz) return <p>{t("tq.notFound")}</p>;

  const mm = remaining != null ? String(Math.floor(remaining / 60)).padStart(2, "0") : "--";
  const ss = remaining != null ? String(remaining % 60).padStart(2, "0") : "--";
  const lowTime = remaining != null && remaining < 60;

  const isAnswered = (q: Question) => {
    const v = answers[q.id]?.answer;
    return v !== undefined && String(v) !== "";
  };
  const answeredCount = questions.filter(isAnswered).length;
  const LETTERS = "ABCDEFGH";

  const optionCls = (selected: boolean) =>
    cn("flex min-h-12 w-full items-center gap-3 rounded-md border bg-card px-3 py-2.5 text-left text-[15px] transition-colors",
      selected ? "border-primary ring-1 ring-primary" : "border-input hover:border-primary/50");

  return (
    <div className="-mx-4 sm:mx-0">
      {/* Timer and progress stay in view while working */}
      <div className="sticky top-14 z-20 flex items-center gap-3 border-b bg-background/95 px-4 py-2 backdrop-blur-sm sm:rounded-b-md sm:border-x lg:top-16">
        <Link href="/quizzes" className="inline-flex min-h-10 items-center gap-1 text-sm font-medium text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> {t("tq.leave")}
        </Link>
        <div className="flex min-w-0 flex-1 flex-col items-center gap-1">
          <ol className="flex items-center" aria-hidden="true">
            {questions.map((q, i) => (
              <li key={q.id} className="flex items-center">
                {i > 0 && <span className={cn("h-[3px] w-3 sm:w-5", isAnswered(q) ? "bg-primary" : "bg-border")} />}
                <span className={cn("h-2.5 w-2.5 rounded-full border-2", isAnswered(q) ? "border-primary bg-primary" : "border-muted-foreground/50 bg-card")} />
              </li>
            ))}
          </ol>
          <span className="text-[11px] text-muted-foreground tabular-nums" aria-live="polite">
            {t("tq.answered", { n: answeredCount, total: questions.length })}
          </span>
        </div>
        <div
          role="timer"
          aria-label={t("tq.timeLeft")}
          className={cn("flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm font-semibold tabular-nums",
            lowTime ? "border-pen bg-pen text-white motion-safe:animate-pulse" : "border-border bg-card text-foreground")}
        >
          <Clock className="h-4 w-4" /> {mm}:{ss}
        </div>
      </div>

      <article className="paper-grid paper-margin mt-4 border-y shadow-sm sm:rounded-lg sm:border">
        <header className="border-b border-[hsl(var(--grid-line))] py-5 pl-12 pr-4 sm:pl-16 sm:pr-6">
          <h1 className="text-2xl font-bold sm:text-[28px]">{quiz.title}</h1>
          {quiz.description && <p className="mt-1 text-sm text-muted-foreground">{quiz.description}</p>}
        </header>

        <ol>
          {questions.map((q, idx) => (
            <li key={q.id} className="relative border-b border-[hsl(var(--grid-line))] py-5 pl-12 pr-4 last:border-b-0 sm:pl-16 sm:pr-6" data-testid={`take-question-${idx}`}>
              <span className={cn("station top-5 tabular-nums", isAnswered(q) ? "!bg-primary text-primary-foreground" : "text-foreground")} aria-hidden="true">
                {idx + 1}
              </span>
              <div className="flex items-start gap-3">
                <p className="min-w-0 flex-1 text-[17px] font-medium leading-relaxed">
                  <span className="sr-only">{idx + 1}. </span><MathText text={q.prompt} />
                </p>
                <span className="shrink-0 pt-1 text-xs text-muted-foreground tabular-nums">{q.points} {t("common.points_short")}</span>
              </div>
              <p className="mt-0.5 text-xs text-muted-foreground">{t(`qtype.${q.type}`)}</p>

              {q.type === "photo" && q.imageUrl && (
                <img src={q.imageUrl} alt="" className="mt-3 max-h-72 rounded-md border bg-card object-contain" />
              )}

              {q.type === "mcq" && (
                <div className="mt-4 grid gap-2 sm:grid-cols-2" role="radiogroup">
                  {(q.options ?? []).map((opt, oi) => {
                    const selected = answers[q.id]?.answer === oi;
                    return (
                      <button key={oi} type="button" role="radio" aria-checked={selected} onClick={() => setAns(q.id, oi)} data-testid={`answer-${idx}-${oi}`} className={optionCls(selected)}>
                        <span className={cn("flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-xs font-semibold",
                          selected ? "border-primary bg-primary text-primary-foreground" : "border-input text-muted-foreground")}>
                          {LETTERS[oi] ?? oi + 1}
                        </span>
                        <MathText text={opt} />
                      </button>
                    );
                  })}
                </div>
              )}

              {q.type === "true_false" && (
                <div className="mt-4 grid grid-cols-2 gap-2" role="radiogroup">
                  {[t("qb.true"), t("qb.false")].map((lbl, oi) => {
                    const selected = answers[q.id]?.answer === oi;
                    return (
                      <button key={oi} type="button" role="radio" aria-checked={selected} onClick={() => setAns(q.id, oi)} data-testid={`answer-${idx}-${oi}`} className={cn(optionCls(selected), "justify-center font-medium")}>
                        {lbl}
                      </button>
                    );
                  })}
                </div>
              )}

              {q.type === "multi_select" && (
                <div className="mt-4 grid gap-2 sm:grid-cols-2">
                  {(q.options ?? []).map((opt, oi) => {
                    const selectedSet = String(answers[q.id]?.answer ?? "").split(",").filter((x) => x !== "");
                    const selected = selectedSet.includes(String(oi));
                    return (
                      <button key={oi} type="button" role="checkbox" aria-checked={selected} onClick={() => toggleMultiAns(q.id, oi)} data-testid={`answer-${idx}-${oi}`} className={optionCls(selected)}>
                        <span className={cn("flex h-6 w-6 shrink-0 items-center justify-center rounded-sm border", selected ? "border-primary bg-primary text-primary-foreground" : "border-input text-transparent")}>
                          <Check className="h-4 w-4" />
                        </span>
                        <MathText text={opt} />
                      </button>
                    );
                  })}
                </div>
              )}

              {q.type === "fill_blank" && (
                <Input className="mt-4 h-12 max-w-sm text-base" placeholder={t("tq.typeAnswer")} value={(answers[q.id]?.answer as string) ?? ""} onChange={(e) => setAns(q.id, e.target.value)} data-testid={`answer-open-${idx}`} />
              )}

              {q.type === "numeric" && (
                <Input type="number" inputMode="decimal" step="any" className="mt-4 h-12 max-w-[12rem] text-base tabular-nums" placeholder={t("tq.typeNumber")} value={(answers[q.id]?.answer as string) ?? ""} onChange={(e) => setAns(q.id, e.target.value)} data-testid={`answer-open-${idx}`} />
              )}

              {(q.type === "open" || q.type === "photo") && (
                <Textarea className="mt-4 min-h-28 text-base" placeholder={t("tq.typeAnswer")} value={(answers[q.id]?.answer as string) ?? ""} onChange={(e) => setAns(q.id, e.target.value)} data-testid={`answer-open-${idx}`} />
              )}
            </li>
          ))}
        </ol>

        <footer className="border-t border-[hsl(var(--grid-line))] py-5 pl-12 pr-4 sm:pl-16 sm:pr-6">
          <Button onClick={() => submit.mutate(false)} disabled={submit.isPending} className="w-full gap-2 sm:w-auto" size="lg" data-testid="button-submit-quiz">
            {submit.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} {t("tq.submitQuiz")}
          </Button>
        </footer>
      </article>
    </div>
  );
}

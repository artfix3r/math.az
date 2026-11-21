import { useState, useEffect, useRef } from "react";
import { MathText } from "@/components/math-text";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
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

  if (isLoading) return <Skeleton className="h-96 rounded-2xl" />;
  if (!quiz) return <p>{t("tq.notFound")}</p>;

  const mm = remaining != null ? String(Math.floor(remaining / 60)).padStart(2, "0") : "--";
  const ss = remaining != null ? String(remaining % 60).padStart(2, "0") : "--";
  const lowTime = remaining != null && remaining < 60;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Link href="/quizzes" className="inline-flex items-center gap-1 text-sm font-bold text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> {t("tq.leave")}
        </Link>
        <div className={cn("flex items-center gap-2 rounded-full px-4 py-2 font-black tabular-nums",
          lowTime ? "bg-destructive text-destructive-foreground animate-pulse" : "bg-primary/15 text-primary")}>
          <Clock className="h-4 w-4" /> {mm}:{ss}
        </div>
      </div>

      <div>
        <h1 className="text-3xl font-black tracking-tight">{quiz.title}</h1>
        {quiz.description && <p className="text-sm text-muted-foreground">{quiz.description}</p>}
      </div>

      <div className="space-y-4">
        {questions.map((q, idx) => (
          <Card key={q.id} className="p-5" data-testid={`take-question-${idx}`}>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="font-bold">Q{idx + 1}</Badge>
              <Badge className="bg-primary/15 text-primary">{t(`qtype.${q.type}`)}</Badge>
              <span className="ml-auto text-xs font-bold text-muted-foreground">{q.points} {t("common.points_short")}{q.points > 1 ? "s" : ""}</span>
            </div>
            <p className="mt-3 font-bold"><MathText text={q.prompt} /></p>

            {q.type === "photo" && q.imageUrl && (
              <img src={q.imageUrl} alt="Question diagram" className="mt-3 max-h-72 rounded-xl border object-contain" />
            )}

            {q.type === "mcq" && (
              <div className="mt-4 space-y-2">
                {(q.options ?? []).map((opt, oi) => {
                  const selected = answers[q.id]?.answer === oi;
                  return (
                    <button
                      key={oi}
                      type="button"
                      onClick={() => setAns(q.id, oi)}
                      data-testid={`answer-${idx}-${oi}`}
                      className={cn("flex w-full items-center gap-3 rounded-xl border-2 px-4 py-3 text-left font-bold transition",
                        selected ? "border-primary bg-primary/10" : "border-border hover-elevate")}
                    >
                      <span className={cn("flex h-6 w-6 items-center justify-center rounded-full border-2", selected ? "border-primary bg-primary text-primary-foreground" : "border-input text-transparent")}>
                        <Check className="h-3.5 w-3.5" />
                      </span>
                      <MathText text={opt} />
                    </button>
                  );
                })}
              </div>
            )}

            {q.type === "true_false" && (
              <div className="mt-4 flex gap-2">
                {[t("qb.true"), t("qb.false")].map((lbl, oi) => {
                  const selected = answers[q.id]?.answer === oi;
                  return (
                    <button
                      key={oi}
                      type="button"
                      onClick={() => setAns(q.id, oi)}
                      data-testid={`answer-${idx}-${oi}`}
                      className={cn("flex-1 rounded-xl border-2 px-4 py-3 text-sm font-bold transition",
                        selected ? "border-primary bg-primary/10" : "border-border hover-elevate")}
                    >
                      {lbl}
                    </button>
                  );
                })}
              </div>
            )}

            {q.type === "multi_select" && (
              <div className="mt-4 space-y-2">
                {(q.options ?? []).map((opt, oi) => {
                  const selectedSet = String(answers[q.id]?.answer ?? "").split(",").filter((x) => x !== "");
                  const selected = selectedSet.includes(String(oi));
                  return (
                    <button
                      key={oi}
                      type="button"
                      onClick={() => toggleMultiAns(q.id, oi)}
                      data-testid={`answer-${idx}-${oi}`}
                      className={cn("flex w-full items-center gap-3 rounded-xl border-2 px-4 py-3 text-left font-bold transition",
                        selected ? "border-primary bg-primary/10" : "border-border hover-elevate")}
                    >
                      <span className={cn("flex h-6 w-6 items-center justify-center rounded-md border-2", selected ? "border-primary bg-primary text-primary-foreground" : "border-input text-transparent")}>
                        <Check className="h-3.5 w-3.5" />
                      </span>
                      <MathText text={opt} />
                    </button>
                  );
                })}
              </div>
            )}

            {q.type === "fill_blank" && (
              <Input
                className="mt-4"
                placeholder={t("tq.typeAnswer")}
                value={(answers[q.id]?.answer as string) ?? ""}
                onChange={(e) => setAns(q.id, e.target.value)}
                data-testid={`answer-open-${idx}`}
              />
            )}

            {q.type === "numeric" && (
              <Input
                type="number"
                step="any"
                className="mt-4"
                placeholder={t("tq.typeNumber")}
                value={(answers[q.id]?.answer as string) ?? ""}
                onChange={(e) => setAns(q.id, e.target.value)}
                data-testid={`answer-open-${idx}`}
              />
            )}

            {(q.type === "open" || q.type === "photo") && (
              <Textarea
                className="mt-4"
                placeholder={t("tq.typeAnswer")}
                value={(answers[q.id]?.answer as string) ?? ""}
                onChange={(e) => setAns(q.id, e.target.value)}
                data-testid={`answer-open-${idx}`}
              />
            )}
          </Card>
        ))}
      </div>

      <Button onClick={() => submit.mutate(false)} disabled={submit.isPending} className="w-full gap-2 font-bold" size="lg" data-testid="button-submit-quiz">
        {submit.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} {t("tq.submitQuiz")}
      </Button>
    </div>
  );
}

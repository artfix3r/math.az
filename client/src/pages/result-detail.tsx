import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Skeleton } from "@/components/ui/skeleton";
import { MathText } from "@/components/math-text";
import { PenScore, PenMark, PenRemark } from "@/components/red-pen";
import { DrawingView } from "@/components/handwriting-pad";
import { useT, formatDateTime } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { ArrowLeft, Hourglass } from "lucide-react";
import type { ReviewItem } from "@shared/review";

type Review = {
  id: number; quizTitle: string; score: number; maxScore: number; needsGrading: number;
  submittedAt: number; gradedAt: number | null; feedback: string; revealed: boolean; items: ReviewItem[];
};

/** A student's marked work, returned like an exercise book with the teacher's red pen on it. */
export default function ResultDetail({ id }: { id: number }) {
  const { t } = useT();
  const { data, isLoading, error } = useQuery<Review>({ queryKey: ["/api/my/submissions", id] });

  const answerText = (q: ReviewItem, a: string | number) => {
    if (a === "" || a === undefined) return null;
    if (q.type === "mcq") return q.options[Number(a)] ?? "";
    if (q.type === "true_false") return Number(a) === 0 ? t("qb.true") : t("qb.false");
    if (q.type === "multi_select") return String(a).split(",").filter(Boolean).map((i) => q.options[Number(i)] ?? "").join("; ");
    return String(a);
  };
  const correctText = (q: ReviewItem) => {
    const c = q.correct;
    if (!c) return null;
    if (c.index !== undefined) return q.type === "true_false" ? (c.index === 0 ? t("qb.true") : t("qb.false")) : q.options[c.index] ?? "";
    if (c.indexes) return c.indexes.map((i) => q.options[i] ?? "").join("; ");
    if (c.text !== undefined) return c.text;
    if (c.number !== undefined) return `${c.number}${c.tolerance ? ` (±${c.tolerance})` : ""}`;
    return null;
  };

  return (
    <div className="-mx-4 sm:mx-0">
      <div className="px-4 sm:px-0">
        <Link href="/results" className="inline-flex min-h-10 items-center gap-1 text-sm font-medium text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> {t("rv.back")}
        </Link>
      </div>

      {isLoading ? (
        <Skeleton className="mt-3 h-96 rounded-lg" />
      ) : error || !data ? (
        <p className="mt-6 px-4 text-sm text-muted-foreground">{t("rv.notFound")}</p>
      ) : (
        <article className="paper-grid paper-margin mt-3 border-y shadow-sm sm:rounded-lg sm:border" data-testid="result-detail">
          <header className="flex flex-wrap items-start justify-between gap-4 border-b border-[hsl(var(--grid-line))] py-5 pl-12 pr-4 sm:pl-16 sm:pr-6">
            <div className="min-w-0">
              <h1 className="text-2xl font-bold sm:text-[28px]">{data.quizTitle}</h1>
              <p className="mt-1 text-sm text-muted-foreground">{t("rv.handedIn", { date: formatDateTime(data.submittedAt) })}</p>
            </div>
            {data.needsGrading ? (
              <span className="inline-flex items-center gap-1.5 rounded-md border border-due/40 bg-card px-3 py-1.5 text-sm font-medium text-due">
                <Hourglass className="h-4 w-4" /> {t("dash.pendingGrade")}
              </span>
            ) : (
              <PenScore score={data.score} max={data.maxScore} size="lg" delay={200} label={t("pen.scoreLabel", { score: data.score, max: data.maxScore })} />
            )}
          </header>

          {data.feedback && (
            <section className="border-b border-[hsl(var(--grid-line))] py-4 pl-12 pr-4 sm:pl-16 sm:pr-6" aria-label={t("rv.teacherNote")} data-testid="teacher-feedback">
              <p className="text-xs font-medium text-muted-foreground">{t("rv.teacherNote")}</p>
              <PenRemark animate delay={900} className="mt-1 whitespace-pre-line text-2xl">{data.feedback}</PenRemark>
            </section>
          )}

          <ol>
            {data.items.map((q, idx) => {
              const ans = answerText(q, q.answer);
              const right = correctText(q);
              return (
                <li key={q.id} className="relative border-b border-[hsl(var(--grid-line))] py-5 pl-12 pr-4 last:border-b-0 sm:pl-16 sm:pr-6" data-testid={`review-item-${idx}`}>
                  <span className="absolute left-0 top-5 w-8 text-right text-[15px] font-semibold tabular-nums text-muted-foreground sm:w-12" aria-hidden="true">{idx + 1}.</span>
                  <div className="flex items-start gap-3">
                    <p className="min-w-0 flex-1 text-[17px] font-medium leading-relaxed"><MathText text={q.prompt} /></p>
                    <span className={cn("shrink-0 pt-1 text-sm font-semibold tabular-nums",
                      q.status === "correct" ? "text-correct" : q.status === "pending" ? "text-due" : q.status === "partial" ? "text-due" : "text-pen")}>
                      {q.status === "pending" ? "—" : q.awarded}/{q.points}
                    </span>
                  </div>
                  {q.imageUrl && <img src={q.imageUrl} alt="" className="mt-3 max-h-64 rounded-md border bg-card object-contain" />}

                  <div className="mt-3 flex items-start gap-2.5">
                    <div className={cn("min-w-0 flex-1 rounded-md border bg-card px-3 py-2 text-[15px]",
                      q.status === "wrong" ? "border-pen/40" : q.status === "correct" ? "border-correct/40" : "border-input")}>
                      <span className="block text-xs text-muted-foreground">{t("rv.yourAnswer")}</span>
                      {ans === null
                        ? (!q.drawing && <span className="text-muted-foreground">{t("qr.noAnswer")}</span>)
                        : <span className="whitespace-pre-wrap"><MathText text={ans} /></span>}
                      {(q.drawing || q.annotation) && (
                        <DrawingView drawing={q.drawing} annotation={q.annotation} alt={t("qr.studentDrawing")} className={ans === null ? "mt-1" : "mt-2"} />
                      )}
                    </div>
                    <div className="pt-2">
                      {q.status === "pending"
                        ? <Hourglass className="h-6 w-6 text-due" aria-label={t("dash.pendingGrade")} />
                        : <PenMark correct={q.status === "correct"} animate delay={500 + idx * 250} className={cn("h-7 w-7", q.status === "partial" && "text-due")}
                            label={q.status === "correct" ? t("pen.correct") : q.status === "partial" ? t("rv.partly") : t("pen.wrong")} />}
                    </div>
                  </div>

                  {q.status !== "correct" && right !== null && (
                    <p className="mt-2 text-sm text-correct">{t("qr.correctIs")}: <MathText text={right} /></p>
                  )}
                  {q.comment && (
                    <p className="mt-2" data-testid={`review-comment-${idx}`}>
                      <PenRemark animate delay={700 + idx * 250} className="whitespace-pre-line">{q.comment}</PenRemark>
                    </p>
                  )}
                </li>
              );
            })}
          </ol>
          {!data.revealed && !data.needsGrading && (
            <p className="border-t border-[hsl(var(--grid-line))] py-3 pl-12 pr-4 text-xs text-muted-foreground sm:pl-16">{t("rv.answersLater")}</p>
          )}
        </article>
      )}
    </div>
  );
}

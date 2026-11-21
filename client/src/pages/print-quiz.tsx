import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { MathText } from "@/components/math-text";
import { useT } from "@/lib/i18n";
import { buildPrintModel } from "@/lib/print-quiz";
import { ArrowLeft, Printer } from "lucide-react";
import type { Quiz, Question } from "@shared/schema";

// A paper version of a quiz. The browser's print dialog turns it into a PDF
// ("Save as PDF") or prints it. The toolbar is hidden when printing.
export default function PrintQuiz({ id }: { id: number }) {
  const { t } = useT();
  const [withKey, setWithKey] = useState(true);
  const { data: quiz, isLoading } = useQuery<Quiz>({ queryKey: ["/api/quizzes", id] });

  const model = useMemo(() => {
    let qs: Question[] = [];
    try { qs = JSON.parse(quiz?.questions || "[]"); } catch { /* empty */ }
    return buildPrintModel(qs, { true: t("qb.true"), false: t("qb.false") });
  }, [quiz, t]);

  if (isLoading || !quiz) {
    return <div className="mx-auto max-w-3xl p-8"><Skeleton className="h-96 w-full" /></div>;
  }

  return (
    <div className="print-page min-h-screen bg-muted/40 py-6 print:bg-white print:py-0">
      <div className="no-print mx-auto mb-4 flex max-w-[210mm] flex-wrap items-center gap-3 px-4">
        <Link href="/quizzes">
          <Button variant="ghost" className="gap-2 font-bold"><ArrowLeft className="h-4 w-4" /> {t("print.back")}</Button>
        </Link>
        <div className="ml-auto flex items-center gap-2">
          <Checkbox id="with-key" checked={withKey} onCheckedChange={(v) => setWithKey(v === true)} />
          <Label htmlFor="with-key" className="font-bold">{t("print.includeKey")}</Label>
        </div>
        <Button className="gap-2 font-bold" onClick={() => window.print()} data-testid="button-print">
          <Printer className="h-4 w-4" /> {t("print.print")}
        </Button>
        <p className="w-full text-xs text-muted-foreground">{t("print.hint")}</p>
      </div>

      <article className="paper mx-auto max-w-[210mm] bg-white p-[14mm] text-black shadow print:max-w-none print:p-0 print:shadow-none">
        <header className="border-b-2 border-black pb-3">
          <h1 className="text-2xl font-extrabold">{quiz.title}</h1>
          {quiz.description && <p className="mt-1 text-sm">{quiz.description}</p>}
          <div className="mt-4 grid grid-cols-3 gap-6 text-sm">
            <span>{t("print.name")}: ________________</span>
            <span>{t("print.class")}: ________</span>
            <span>{t("print.date")}: ____________</span>
          </div>
          <p className="mt-2 text-sm">
            {t("print.summary", { count: model.items.length, points: model.totalPoints, minutes: quiz.durationMinutes })}
          </p>
        </header>

        <ol className="mt-5 space-y-5">
          {model.items.map((it) => (
            <li key={it.number} className="break-inside-avoid">
              <div className="flex gap-2">
                <span className="font-extrabold">{it.number}.</span>
                <div className="flex-1">
                  <MathText text={it.prompt} />
                  <span className="ml-2 text-xs text-neutral-500">({t("print.points", { n: it.points })})</span>
                  {it.imageUrl && <img src={it.imageUrl} alt="" className="mt-2 max-h-56 object-contain" />}
                  {it.options.length > 0 && (
                    <ul className="mt-2 grid grid-cols-2 gap-x-6 gap-y-1">
                      {it.options.map((o) => (
                        <li key={o.letter} className="flex gap-2">
                          <span className="font-bold">{o.letter})</span>
                          <MathText text={o.text} />
                        </li>
                      ))}
                    </ul>
                  )}
                  {Array.from({ length: it.answerLines }).map((_, i) => (
                    <div key={i} className="mt-5 border-b border-neutral-400" />
                  ))}
                </div>
              </div>
            </li>
          ))}
        </ol>

        {withKey && (
          <section className="answer-key mt-10 border-t-2 border-dashed border-black pt-4 print:mt-0 print:border-0 print:pt-0">
            <h2 className="text-xl font-extrabold">{t("print.keyTitle", { title: quiz.title })}</h2>
            <ol className="mt-3 grid grid-cols-4 gap-x-6 gap-y-1 text-sm">
              {model.answerKey.map((k) => (
                <li key={k.number}><span className="font-bold">{k.number}.</span> <MathText text={k.answer} /></li>
              ))}
            </ol>
          </section>
        )}
      </article>
    </div>
  );
}

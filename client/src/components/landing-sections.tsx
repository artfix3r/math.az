import { useState } from "react";
import { Button } from "@/components/ui/button";
import { MathText } from "@/components/math-text";
import { PenMark, PenScore, PenRemark, remarkKey } from "@/components/red-pen";
import { useT } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import {
  Languages, Sigma, ScanText, PenLine, Shuffle, AlarmClock, BarChart3, Link2, GraduationCap, BookOpen, ArrowRight,
} from "lucide-react";

/** Everything below the sign-in area on the landing page. */
export function LandingSections({ onStart }: { onStart: (role: "teacher" | "student") => void }) {
  return (
    <>
      <HowItWorks />
      <DemoVideo />
      <TryIt />
      <WhyMathAz />
      <WhatFor />
      <FinalCall onStart={onStart} />
    </>
  );
}

function Section({ id, title, sub, children, className }: { id: string; title: string; sub?: string; children: React.ReactNode; className?: string }) {
  return (
    <section id={id} aria-labelledby={`${id}-h`} className={cn("mx-auto max-w-6xl px-5 py-14 sm:py-20 lg:px-8", className)}>
      <h2 id={`${id}-h`} className="max-w-2xl text-[1.75rem] font-bold leading-tight sm:text-[2.1rem]">{title}</h2>
      {sub && <p className="mt-3 max-w-2xl text-[17px] leading-relaxed text-muted-foreground">{sub}</p>}
      <div className="mt-8 sm:mt-10">{children}</div>
    </section>
  );
}

/* ---------------- How it works: three real steps with real screens ---------------- */

function HowItWorks() {
  const { t } = useT();
  const steps = [
    { k: "build", img: "landing/teacher-builds.webp", w: 1180, h: 760, phone: false },
    { k: "solve", img: "landing/student-writes.webp", w: 520, h: 1040, phone: true },
    { k: "marked", img: "landing/marked-work.webp", w: 520, h: 1040, phone: true },
  ];
  return (
    <Section id="how" title={t("lp.how.title")} sub={t("lp.how.sub")}>
      <ol className="grid gap-10 lg:grid-cols-3 lg:gap-8">
        {steps.map((s, i) => (
          <li key={s.k} className="flex flex-col">
            <div className="flex items-baseline gap-3">
              <span className="font-hand text-[2.4rem] leading-none text-pen" aria-hidden="true">{i + 1}</span>
              <h3 className="text-xl font-semibold">{t(`lp.how.${s.k}.title`)}</h3>
            </div>
            <p className="mt-2 text-[15px] leading-relaxed text-muted-foreground">{t(`lp.how.${s.k}.text`)}</p>
            <div className={cn("mt-5 flex flex-1 items-start justify-center rounded-lg border bg-muted/40 p-4", s.phone && "pb-0")}>
              <img
                src={s.img}
                width={s.w}
                height={s.h}
                loading="lazy"
                decoding="async"
                alt={t(`lp.how.${s.k}.alt`)}
                className={cn("h-auto shadow-md", s.phone ? "w-[62%] max-w-[240px] rounded-t-[1.4rem] border-x-[6px] border-t-[6px] border-[#1C2433]" : "w-full rounded-md border")}
              />
            </div>
          </li>
        ))}
      </ol>
    </Section>
  );
}

/* ---------------- One-minute demo ---------------- */

function DemoVideo() {
  const { t } = useT();
  return (
    <Section id="demo" title={t("lp.demo.title")} sub={t("lp.demo.sub")} className="pt-0 sm:pt-0">
      <figure className="overflow-hidden rounded-lg border bg-card shadow-md">
        <video
          controls
          playsInline
          preload="none"
          poster="landing/demo-poster.webp"
          className="aspect-[16/10] w-full bg-[#EEF1F6]"
          aria-label={t("lp.demo.title")}
        >
          <source src="landing/demo.mp4" type="video/mp4" />
        </video>
        <figcaption className="border-t px-4 py-3 text-sm text-muted-foreground">{t("lp.demo.caption")}</figcaption>
      </figure>
    </Section>
  );
}

/* ---------------- A real sample test, marked in the browser ---------------- */

type Sample = { id: string; prompt: string; kind: "mcq" | "num" | "tf"; options?: string[]; correct: number | string };

function TryIt() {
  const { t } = useT();
  const questions: Sample[] = [
    { id: "s1", kind: "mcq", prompt: `${t("lp.try.q1")} $\\frac{3}{4}+\\frac{1}{2}$`, options: ["$\\frac{5}{4}$", "$\\frac{4}{6}$", "$1$"], correct: 0 },
    { id: "s2", kind: "num", prompt: `${t("lp.try.q2")} $2x+7=3x-5$`, correct: "12" },
    { id: "s3", kind: "tf", prompt: `${t("lp.try.q3")} $(-3)^{2}=-9$`, options: [t("qb.true"), t("qb.false")], correct: 1 },
  ];
  const [ans, setAns] = useState<Record<string, number | string>>({});
  const [checked, setChecked] = useState(false);
  const right = (q: Sample) => String(ans[q.id] ?? "").trim().replace(",", ".") === String(q.correct);
  const score = questions.filter(right).length;
  const reset = () => { setAns({}); setChecked(false); };

  const optionCls = (sel: boolean) =>
    cn("flex min-h-12 items-center gap-3 rounded-md border bg-card px-3 text-left text-[15px] transition-colors disabled:cursor-default",
      sel ? "border-primary ring-1 ring-primary" : "border-input hover:border-primary/50");

  return (
    <Section id="try" title={t("lp.try.title")} sub={t("lp.try.sub")}>
      <div className="paper-grid paper-margin mx-auto max-w-3xl overflow-hidden rounded-lg border shadow-md" data-testid="landing-sample-test">
        <div className="flex items-start justify-between gap-3 border-b border-[hsl(var(--grid-line))] bg-card/70 py-4 pl-12 pr-4 sm:pl-16 sm:pr-6">
          <p className="pt-1 font-semibold">{t("lp.try.sheet")}</p>
          {checked && <PenScore score={score} max={questions.length} size="sm" label={t("pen.scoreLabel", { score, max: questions.length })} />}
        </div>
        <ol>
          {questions.map((q, i) => (
            <li key={q.id} className="relative border-b border-[hsl(var(--grid-line))] py-5 pl-12 pr-4 last:border-b-0 sm:pl-16 sm:pr-6">
              <span className="absolute left-0 top-5 w-8 text-right font-semibold tabular-nums text-muted-foreground sm:w-12" aria-hidden="true">{i + 1}.</span>
              <div className="flex items-start gap-3">
                <p className="min-w-0 flex-1 text-[17px] font-medium leading-relaxed"><MathText text={q.prompt} /></p>
                {checked && <PenMark correct={right(q)} animate delay={150 + i * 250} className="h-7 w-7" label={right(q) ? t("pen.correct") : t("pen.wrong")} />}
              </div>
              {q.kind === "num" ? (
                <input
                  type="text"
                  inputMode="decimal"
                  disabled={checked}
                  value={String(ans[q.id] ?? "")}
                  onChange={(e) => setAns((a) => ({ ...a, [q.id]: e.target.value }))}
                  placeholder={t("tq.typeNumber")}
                  aria-label={t("tq.typeNumber")}
                  className="mt-3 h-12 w-40 rounded-md border border-input bg-card px-3 text-base tabular-nums focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  data-testid={`sample-answer-${i}`}
                />
              ) : (
                <div className={cn("mt-3 grid gap-2", q.kind === "tf" ? "grid-cols-2 sm:max-w-sm" : "sm:grid-cols-3")} role="radiogroup">
                  {q.options!.map((o, oi) => (
                    <button key={oi} type="button" role="radio" aria-checked={ans[q.id] === oi} disabled={checked}
                      onClick={() => setAns((a) => ({ ...a, [q.id]: oi }))} className={cn(optionCls(ans[q.id] === oi), q.kind === "tf" && "justify-center")}
                      data-testid={`sample-answer-${i}-${oi}`}>
                      <MathText text={o} />
                    </button>
                  ))}
                </div>
              )}
              {checked && !right(q) && (
                <p className="mt-2"><PenRemark animate delay={400 + i * 250}>{t("lp.try.answerIs")} {q.kind === "num" ? q.correct : q.kind === "tf" ? q.options![q.correct as number] : ""}{q.kind === "mcq" && <MathText text={q.options![q.correct as number]} />}</PenRemark></p>
              )}
            </li>
          ))}
        </ol>
        <div className="flex flex-wrap items-center gap-3 border-t border-[hsl(var(--grid-line))] bg-card/70 py-4 pl-12 pr-4 sm:pl-16 sm:pr-6">
          {checked ? (
            <>
              <PenRemark className="text-2xl">{t(remarkKey((score / questions.length) * 100))}</PenRemark>
              <Button variant="outline" onClick={reset} className="ml-auto">{t("lp.try.again")}</Button>
            </>
          ) : (
            <Button onClick={() => setChecked(true)} disabled={Object.keys(ans).length === 0} data-testid="sample-check">{t("lp.try.check")}</Button>
          )}
        </div>
      </div>
    </Section>
  );
}

/* ---------------- Why math.az ---------------- */

function WhyMathAz() {
  const { t } = useT();
  const items = [
    { k: "lang", icon: Languages },
    { k: "formulas", icon: Sigma },
    { k: "import", icon: ScanText },
    { k: "pen", icon: PenLine },
    { k: "variants", icon: Shuffle },
    { k: "deadlines", icon: AlarmClock },
    { k: "analytics", icon: BarChart3 },
    { k: "parents", icon: Link2 },
  ];
  return (
    <Section id="why" title={t("lp.why.title")} sub={t("lp.why.sub")}>
      <ul className="grid gap-x-10 gap-y-7 sm:grid-cols-2">
        {items.map(({ k, icon: Icon }) => (
          <li key={k} className="flex gap-4">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md border bg-card text-primary"><Icon className="h-5 w-5" /></span>
            <div>
              <h3 className="font-semibold">{t(`lp.why.${k}.title`)}</h3>
              <p className="mt-1 text-[15px] leading-relaxed text-muted-foreground">{t(`lp.why.${k}.text`)}</p>
            </div>
          </li>
        ))}
      </ul>
    </Section>
  );
}

/* ---------------- What it's for: grades, question types, topics ---------------- */

function WhatFor() {
  const { t } = useT();
  const types = ["mcq", "multi_select", "true_false", "fill_blank", "numeric", "open", "photo"];
  const topics = t("lp.for.topicsList").split("|");
  return (
    <Section id="for" title={t("lp.for.title")} sub={t("lp.for.sub")}>
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="rounded-lg border bg-card p-5">
          <h3 className="flex items-center gap-2 font-semibold"><GraduationCap className="h-5 w-5 text-primary" /> {t("lp.for.gradesTitle")}</h3>
          <p className="mt-2 text-[15px] leading-relaxed text-muted-foreground">{t("lp.for.grades")}</p>
        </div>
        <div className="rounded-lg border bg-card p-5">
          <h3 className="flex items-center gap-2 font-semibold"><BookOpen className="h-5 w-5 text-primary" /> {t("lp.for.typesTitle")}</h3>
          <ul className="mt-3 flex flex-wrap gap-2">
            {types.map((ty) => <li key={ty} className="rounded-sm border bg-muted/50 px-2.5 py-1 text-sm">{t(`qtype.${ty}`)}</li>)}
          </ul>
        </div>
        <div className="rounded-lg border bg-card p-5">
          <h3 className="flex items-center gap-2 font-semibold"><Sigma className="h-5 w-5 text-primary" /> {t("lp.for.topicsTitle")}</h3>
          <ul className="mt-3 flex flex-wrap gap-2">
            {topics.map((x) => <li key={x} className="rounded-sm border bg-muted/50 px-2.5 py-1 text-sm">{x}</li>)}
          </ul>
          <p className="mt-3 text-xs text-muted-foreground">{t("lp.for.topicsNote")}</p>
        </div>
      </div>
    </Section>
  );
}

/* ---------------- Final call to action ---------------- */

function FinalCall({ onStart }: { onStart: (role: "teacher" | "student") => void }) {
  const { t } = useT();
  return (
    <section className="border-t bg-sidebar text-sidebar-foreground" aria-labelledby="cta-h">
      <div className="mx-auto flex max-w-6xl flex-col items-start gap-6 px-5 py-14 sm:flex-row sm:items-center sm:justify-between lg:px-8">
        <div>
          <h2 id="cta-h" className="text-[1.6rem] font-bold leading-tight text-white sm:text-[2rem]">{t("lp.cta.title")}</h2>
          <p className="mt-2 max-w-xl text-white/75">{t("lp.cta.sub")}</p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Button size="lg" className="gap-2 bg-white text-primary hover:bg-white/90" onClick={() => onStart("teacher")} data-testid="cta-teacher-bottom">
            {t("lp.cta.teacher")} <ArrowRight className="h-4 w-4" />
          </Button>
          <Button size="lg" variant="outline" className="bg-transparent text-white [border-color:rgba(255,255,255,0.55)] hover:bg-white/10" onClick={() => onStart("student")} data-testid="cta-student-bottom">
            {t("lp.cta.student")}
          </Button>
        </div>
      </div>
    </section>
  );
}

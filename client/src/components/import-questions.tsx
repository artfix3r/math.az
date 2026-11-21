import { useRef, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Progress as Bar } from "@/components/ui/progress";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { MathEditor, MathOptionInput } from "@/components/math-text";
import { useT } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { extractText, compressImage, type Progress } from "@/lib/extract-text";
import { splitQuestions, mathify } from "@shared/import-questions";
import { Camera, FileUp, ClipboardPaste, Check, Plus, Trash2, Loader2, ArrowLeft, ImageIcon } from "lucide-react";
import type { Question } from "@shared/schema";

type Draft = {
  key: string;
  include: boolean;
  type: "mcq" | "open";
  prompt: string;
  options: string[];
  correctIndex?: number;
  attachPhoto: boolean;
};

type Step = "pick" | "paste" | "working" | "review";

const uid = () => Math.random().toString(36).slice(2, 10);

/**
 * Import questions from a photo, a scan or PDF, a Word file, or pasted text.
 * Text is recognised in the browser, split into questions, and shown for
 * checking and correcting before anything is added to the quiz.
 */
export function ImportQuestionsDialog({
  open,
  onOpenChange,
  onAdd,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onAdd: (questions: Question[]) => void;
}) {
  const { t } = useT();
  const [step, setStep] = useState<Step>("pick");
  const [progress, setProgress] = useState<Progress | null>(null);
  const [error, setError] = useState("");
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [raw, setRaw] = useState("");
  const [photo, setPhoto] = useState<{ blob: Blob; url: string } | null>(null);
  const [adding, setAdding] = useState(false);
  const camera = useRef<HTMLInputElement>(null);
  const picker = useRef<HTMLInputElement>(null);

  const reset = () => {
    setStep("pick"); setProgress(null); setError(""); setDrafts([]); setRaw("");
    if (photo) URL.revokeObjectURL(photo.url);
    setPhoto(null); setAdding(false);
  };

  const fromText = (text: string, hasPhoto: boolean) => {
    const found = splitQuestions(text).map<Draft>((q) => ({
      key: uid(),
      include: true,
      type: q.type,
      prompt: mathify(q.prompt),
      options: q.type === "mcq" ? q.options.map(mathify) : [],
      attachPhoto: hasPhoto && q.prompt.length < 12,
    }));
    setRaw(text);
    setDrafts(found.length ? found : [{ key: uid(), include: true, type: "open", prompt: "", options: [], attachPhoto: hasPhoto }]);
    setStep("review");
  };

  const handleFile = async (file?: File | null) => {
    if (!file) return;
    setError("");
    setStep("working");
    setProgress({ stage: "loading", percent: 0 });
    try {
      const { text, image } = await extractText(file, setProgress);
      if (image) setPhoto({ blob: image, url: URL.createObjectURL(image) });
      fromText(text, !!image);
    } catch (e: any) {
      setError(e?.message === "unsupported_file" ? t("imp.unsupported") : t("imp.failed"));
      setStep("pick");
    }
  };

  const update = (key: string, patch: Partial<Draft>) =>
    setDrafts((ds) => ds.map((d) => (d.key === key ? { ...d, ...patch } : d)));

  const chosen = drafts.filter((d) => d.include && (d.prompt.trim() || d.attachPhoto));
  const unmarked = chosen.filter((d) => d.type === "mcq" && d.correctIndex === undefined).length;

  const add = async () => {
    setAdding(true);
    try {
      const photoUrl = photo && chosen.some((d) => d.attachPhoto) ? await compressImage(photo.blob) : "";
      const qs: Question[] = chosen.map((d) => {
        const withPhoto = d.attachPhoto && !!photoUrl;
        const base = {
          id: uid(), prompt: d.prompt.trim() || t("imp.seePhoto"), imageUrl: withPhoto ? photoUrl : "",
          points: 1, topic: "", difficulty: "" as const, correctIndexes: [], correctText: "", tolerance: 0,
        };
        if (d.type === "mcq") {
          const options = d.options.filter((o) => o.trim());
          return { ...base, type: "mcq", options, correctIndex: Math.min(d.correctIndex ?? 0, Math.max(0, options.length - 1)) };
        }
        return { ...base, type: withPhoto ? "photo" : "open", options: [] };
      });
      onAdd(qs);
      onOpenChange(false);
      reset();
    } finally {
      setAdding(false);
    }
  };

  const stageText = progress
    ? progress.stage === "recognizing"
      ? (progress.pages ? t("imp.recognizingPage", { page: progress.page ?? 1, pages: progress.pages }) : t("imp.recognizing"))
      : progress.stage === "reading" ? t("imp.reading") : t("imp.loading")
    : "";

  return (
    <Dialog open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) reset(); }}>
      <DialogContent className={cn("max-h-[92vh] gap-4 overflow-y-auto p-4 sm:p-6", step === "review" ? "max-w-4xl" : "max-w-lg")}>
        <DialogHeader>
          <DialogTitle>{t("imp.title")}</DialogTitle>
          <DialogDescription>
            {step === "review" ? t("imp.reviewHint") : t("imp.subtitle")}
          </DialogDescription>
        </DialogHeader>

        <input ref={camera} type="file" accept="image/*" capture="environment" className="sr-only" onChange={(e) => { handleFile(e.target.files?.[0]); e.target.value = ""; }} data-testid="input-import-camera" />
        <input ref={picker} type="file" accept="image/*,.pdf,.docx,.txt,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document" className="sr-only" onChange={(e) => { handleFile(e.target.files?.[0]); e.target.value = ""; }} data-testid="input-import-file" />

        {step === "pick" && (
          <div className="grid gap-2.5">
            <SourceButton icon={Camera} title={t("imp.takePhoto")} sub={t("imp.takePhotoSub")} onClick={() => camera.current?.click()} testId="button-import-camera" primary />
            <SourceButton icon={FileUp} title={t("imp.chooseFile")} sub={t("imp.chooseFileSub")} onClick={() => picker.current?.click()} testId="button-import-file" />
            <SourceButton icon={ClipboardPaste} title={t("imp.pasteText")} sub={t("imp.pasteTextSub")} onClick={() => setStep("paste")} testId="button-import-paste" />
            {error && <p className="text-sm text-pen" role="alert">{error}</p>}
          </div>
        )}

        {step === "paste" && (
          <div className="space-y-3">
            <Textarea value={raw} onChange={(e) => setRaw(e.target.value)} className="min-h-48" placeholder={t("imp.pastePlaceholder")} data-testid="input-import-text" autoFocus />
            <div className="flex justify-between gap-2">
              <Button variant="ghost" className="gap-1.5" onClick={() => setStep("pick")}><ArrowLeft className="h-4 w-4" /> {t("imp.back")}</Button>
              <Button disabled={!raw.trim()} onClick={() => fromText(raw, false)} data-testid="button-import-split">{t("imp.findQuestions")}</Button>
            </div>
          </div>
        )}

        {step === "working" && (
          <div className="space-y-3 py-6" aria-live="polite">
            <p className="flex items-center gap-2 text-sm font-medium"><Loader2 className="h-4 w-4 animate-spin" /> {stageText}</p>
            <Bar value={Math.round((progress?.percent ?? 0) * 100)} />
            <p className="text-xs text-muted-foreground">{t("imp.firstTime")}</p>
          </div>
        )}

        {step === "review" && (
          <div className={cn("grid gap-5", photo && "lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]")}>
            {photo && (
              <figure className="lg:sticky lg:top-0 lg:self-start">
                <img src={photo.url} alt={t("imp.yourPhoto")} className="max-h-64 w-full rounded-md border bg-card object-contain lg:max-h-[70vh]" />
                <figcaption className="mt-1.5 text-xs text-muted-foreground">{t("imp.compareHint")}</figcaption>
              </figure>
            )}
            <div className="space-y-4">
              <p className="text-sm font-medium" data-testid="text-import-found">{t("imp.found", { n: drafts.length })}</p>
              {drafts.map((d, i) => (
                <section key={d.key} className={cn("rounded-lg border bg-card p-3 sm:p-4", !d.include && "opacity-60")} data-testid={`import-draft-${i}`}>
                  <div className="mb-2 flex flex-wrap items-center gap-2">
                    <label className="flex min-h-9 items-center gap-2 text-sm font-semibold">
                      <input type="checkbox" className="h-4 w-4 accent-[hsl(var(--primary))]" checked={d.include} onChange={(e) => update(d.key, { include: e.target.checked })} data-testid={`check-import-${i}`} />
                      {t("imp.question", { n: i + 1 })}
                    </label>
                    <div className="ml-auto flex rounded-md border p-0.5 text-xs font-medium" role="radiogroup">
                      {(["mcq", "open"] as const).map((ty) => (
                        <button key={ty} type="button" role="radio" aria-checked={d.type === ty}
                          onClick={() => update(d.key, { type: ty, options: ty === "mcq" && d.options.length < 2 ? [...d.options, "", ""].slice(0, Math.max(2, d.options.length)) : d.options })}
                          className={cn("min-h-8 rounded-sm px-2.5", d.type === ty ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground")}>
                          {t(`qtype.${ty}`)}
                        </button>
                      ))}
                    </div>
                  </div>

                  {d.include && (
                    <>
                      <MathEditor value={d.prompt} onChange={(v) => update(d.key, { prompt: v })} placeholder={t("qb.promptPlaceholder")} testId={`input-import-prompt-${i}`} />
                      {d.type === "mcq" && (
                        <div className="mt-3 space-y-2">
                          <p className="text-xs text-muted-foreground">{t("imp.markCorrect")}</p>
                          {d.options.map((o, oi) => (
                            <div key={oi} className="flex items-center gap-2">
                              <button type="button" aria-label={t("imp.markCorrect")} onClick={() => update(d.key, { correctIndex: oi })}
                                className={cn("flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2", d.correctIndex === oi ? "border-correct bg-correct text-white" : "border-input text-transparent")}>
                                <Check className="h-4 w-4" />
                              </button>
                              <MathOptionInput value={o} onChange={(v) => update(d.key, { options: d.options.map((x, xi) => (xi === oi ? v : x)) })} />
                              <Button variant="ghost" size="icon" className="text-muted-foreground" aria-label={t("common.delete")}
                                onClick={() => update(d.key, { options: d.options.filter((_, xi) => xi !== oi), correctIndex: undefined })}>
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          ))}
                          <Button variant="outline" size="sm" className="gap-1.5" onClick={() => update(d.key, { options: [...d.options, ""] })}>
                            <Plus className="h-4 w-4" /> {t("qb.addOption")}
                          </Button>
                        </div>
                      )}
                      {photo && (
                        <div className="mt-3 flex items-center gap-2">
                          <Switch id={`ph-${d.key}`} checked={d.attachPhoto} onCheckedChange={(v) => update(d.key, { attachPhoto: v })} />
                          <Label htmlFor={`ph-${d.key}`} className="flex items-center gap-1.5 text-sm font-normal"><ImageIcon className="h-4 w-4 text-muted-foreground" /> {t("imp.attachPhoto")}</Label>
                        </div>
                      )}
                    </>
                  )}
                </section>
              ))}
              <Button variant="outline" size="sm" className="gap-1.5"
                onClick={() => setDrafts((ds) => [...ds, { key: uid(), include: true, type: "open", prompt: "", options: [], attachPhoto: false }])}>
                <Plus className="h-4 w-4" /> {t("imp.addEmpty")}
              </Button>
              {raw && (
                <details className="rounded-md border bg-muted/40 px-3 py-2 text-sm">
                  <summary className="cursor-pointer font-medium text-muted-foreground">{t("imp.rawText")}</summary>
                  <pre className="mt-2 max-h-48 overflow-auto whitespace-pre-wrap font-sans text-xs">{raw}</pre>
                </details>
              )}
            </div>
          </div>
        )}

        {step === "review" && (
          <DialogFooter className="sticky bottom-0 -mx-4 -mb-4 flex-row gap-2 border-t bg-background px-4 py-3 sm:-mx-6 sm:-mb-6 sm:justify-between sm:px-6">
            <div className="flex min-w-0 items-center gap-3">
              <Button variant="ghost" onClick={reset}>{t("imp.startOver")}</Button>
              {unmarked > 0 && <p className="hidden text-xs text-due sm:block">{t("imp.unmarked", { n: unmarked })}</p>}
            </div>
            <Button onClick={add} disabled={!chosen.length || adding} className="gap-1.5" data-testid="button-import-add">
              {adding && <Loader2 className="h-4 w-4 animate-spin" />} {t("imp.addN", { n: chosen.length })}
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}

function SourceButton({ icon: Icon, title, sub, onClick, testId, primary }: {
  icon: React.ElementType; title: string; sub: string; onClick: () => void; testId: string; primary?: boolean;
}) {
  return (
    <button type="button" onClick={onClick} data-testid={testId}
      className={cn("flex min-h-16 items-center gap-3 rounded-lg border px-4 py-3 text-left transition-colors",
        primary ? "border-primary/40 bg-secondary hover:border-primary" : "bg-card hover:border-primary/50")}>
      <Icon className={cn("h-6 w-6 shrink-0", primary ? "text-primary" : "text-muted-foreground")} />
      <span>
        <span className="block font-semibold">{title}</span>
        <span className="block text-sm text-muted-foreground">{sub}</span>
      </span>
    </button>
  );
}

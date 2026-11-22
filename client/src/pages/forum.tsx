import { useEffect, useRef, useState } from "react";
import { Link, useLocation } from "wouter";
import { useInfiniteQuery, useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useT, formatDateTime } from "@/lib/i18n";
import { colorOf } from "@/lib/ui";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { compressImage } from "@/lib/extract-text";
import { MathEditor, MathText } from "@/components/math-text";
import { PenMark } from "@/components/red-pen";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  ArrowLeft, Camera, Check, ImageIcon, Loader2, MessageCircle, Plus, Search, Trash2, X,
} from "lucide-react";
import { FORUM_TOPICS, MAX_FORUM_IMAGE_CHARS } from "@shared/forum";

type Author = { name: string; role: string; color: string } | null;
type ListItem = {
  id: number; title: string; topic: string; acceptedAnswerId: number | null; answerCount: number;
  createdAt: number; excerpt: string; hasImage: boolean; author: Author; mine: boolean;
};
type Answer = { id: number; body: string; image: string; createdAt: number; author: Author; mine: boolean };
type Detail = {
  id: number; title: string; body: string; image: string; topic: string; acceptedAnswerId: number | null;
  answerCount: number; createdAt: number; author: Author; mine: boolean; answers: Answer[];
};

function Byline({ author, at }: { author: Author; at: number }) {
  const { t } = useT();
  const c = colorOf(author?.color);
  return (
    <span className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-0.5 text-sm text-muted-foreground">
      <span className={cn("flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold", c.bg, c.text)}>
        {author?.name?.[0]?.toUpperCase() ?? "?"}
      </span>
      <span className="font-medium text-foreground">{author?.name ?? t("qa.deletedUser")}</span>
      {author?.role === "teacher" && (
        <span className="shrink-0 rounded-sm border border-primary/40 px-1.5 text-xs font-medium text-primary">{t("qa.teacherBadge")}</span>
      )}
      <span>{formatDateTime(at)}</span>
    </span>
  );
}

/** Pick a photo (camera on phones) and shrink it before it is sent. */
function PhotoPicker({ value, onChange, testId }: { value: string; onChange: (v: string) => void; testId: string }) {
  const { t } = useT();
  const { toast } = useToast();
  const ref = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const pick = async (f?: File) => {
    if (!f) return;
    setBusy(true);
    try {
      const url = await compressImage(f, 1400, 0.8);
      if (url.length > MAX_FORUM_IMAGE_CHARS) throw new Error("big");
      onChange(url);
    } catch {
      toast({ title: t("qa.photoFailed"), variant: "destructive" });
    } finally {
      setBusy(false);
      if (ref.current) ref.current.value = "";
    }
  };
  return (
    <div>
      <input ref={ref} type="file" accept="image/*" className="hidden" onChange={(e) => pick(e.target.files?.[0])} data-testid={`${testId}-file`} />
      {value ? (
        <div className="relative inline-block">
          <img src={value} alt="" className="max-h-48 rounded-md border object-contain" />
          <Button type="button" size="icon" variant="secondary" className="absolute right-1 top-1 h-8 w-8" onClick={() => onChange("")} aria-label={t("qa.removePhoto")}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      ) : (
        <Button type="button" variant="outline" size="sm" className="gap-1.5" onClick={() => ref.current?.click()} disabled={busy} data-testid={`${testId}-button`}>
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />} {t("qa.addPhoto")}
        </Button>
      )}
    </div>
  );
}

// ---------------- list ----------------
export function ForumList() {
  const { t } = useT();
  const [q, setQ] = useState("");
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<"all" | "unanswered" | "mine">("all");
  const [topic, setTopic] = useState("all");

  useEffect(() => { const id = window.setTimeout(() => setQuery(q.trim()), 300); return () => window.clearTimeout(id); }, [q]);

  const params = new URLSearchParams();
  if (query) params.set("q", query);
  if (filter !== "all") params.set("filter", filter);
  if (topic !== "all") params.set("topic", topic);
  const base = `/api/forum/questions?${params.toString()}`;

  const list = useInfiniteQuery<{ items: ListItem[]; hasMore: boolean }>({
    queryKey: ["/api/forum/questions", base],
    initialPageParam: 0,
    queryFn: async ({ pageParam }) => (await apiRequest("GET", `${base}&page=${pageParam}`)).json(),
    getNextPageParam: (last, all) => (last.hasMore ? all.length : undefined),
  });
  const items = list.data?.pages.flatMap((p) => p.items) ?? [];

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold sm:text-[28px]">{t("qa.title")}</h1>
          <p className="mt-1 max-w-prose text-sm text-muted-foreground">{t("qa.sub")}</p>
        </div>
        <Button asChild className="gap-1.5 font-semibold">
          <Link href="/forum/ask" data-testid="button-ask"><Plus className="h-4 w-4" />{t("qa.ask")}</Link>
        </Button>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("qa.search")} className="pl-9" aria-label={t("qa.search")} data-testid="input-forum-search" />
        </div>
        <Select value={topic} onValueChange={setTopic}>
          <SelectTrigger className="sm:w-48" aria-label={t("qa.topic")} data-testid="select-forum-topic"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("qa.allTopics")}</SelectItem>
            {FORUM_TOPICS.map((tp) => <SelectItem key={tp} value={tp}>{t(`qa.topic.${tp}`)}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <div className="flex flex-wrap gap-1.5" role="tablist">
        {(["all", "unanswered", "mine"] as const).map((f) => (
          <button key={f} role="tab" aria-selected={filter === f} onClick={() => setFilter(f)} data-testid={`forum-filter-${f}`}
            className={cn("h-9 rounded-md border px-3 text-sm font-medium transition-colors",
              filter === f ? "border-primary bg-primary text-primary-foreground" : "bg-card hover:bg-muted")}>
            {t(`qa.filter.${f}`)}
          </button>
        ))}
      </div>

      {list.isLoading ? (
        <div className="space-y-2">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-24 rounded-lg" />)}</div>
      ) : items.length ? (
        <ul className="divide-y rounded-lg border bg-card shadow-sm" data-testid="forum-list">
          {items.map((it) => (
            <li key={it.id}>
              <Link href={`/forum/${it.id}`} className="flex gap-4 px-4 py-3.5 transition-colors hover:bg-muted/60" data-testid={`forum-q-${it.id}`}>
                <div className={cn("flex w-14 shrink-0 flex-col items-center justify-center rounded-md border py-1.5 text-center",
                  it.acceptedAnswerId ? "border-correct/50 bg-correct/10 text-correct" : it.answerCount ? "text-foreground" : "text-muted-foreground")}>
                  <span className="text-lg font-semibold leading-none tabular-nums">{it.answerCount}</span>
                  <span className="mt-1 text-[11px] leading-none">{t("qa.answersShort", { n: it.answerCount })}</span>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold leading-snug"><MathText text={it.title} /></p>
                  {it.excerpt && <p className="mt-1 line-clamp-2 text-sm text-muted-foreground"><MathText text={it.excerpt} /></p>}
                  <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1">
                    <Byline author={it.author} at={it.createdAt} />
                    <span className="rounded-sm bg-secondary px-1.5 py-0.5 text-xs text-secondary-foreground">{t(`qa.topic.${it.topic}`)}</span>
                    {it.hasImage && <ImageIcon className="h-4 w-4 text-muted-foreground" aria-label={t("qa.hasPhoto")} />}
                  </div>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <div className="rounded-lg border border-dashed bg-card px-6 py-12 text-center">
          <MessageCircle className="mx-auto h-8 w-8 text-muted-foreground" />
          <p className="mt-3 font-semibold">{query || filter !== "all" || topic !== "all" ? t("qa.noMatches") : t("qa.empty")}</p>
          <p className="mt-1 text-sm text-muted-foreground">{t("qa.emptyHint")}</p>
        </div>
      )}
      {list.hasNextPage && (
        <div className="flex justify-center">
          <Button variant="outline" onClick={() => list.fetchNextPage()} disabled={list.isFetchingNextPage}>
            {list.isFetchingNextPage && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{t("qa.more")}
          </Button>
        </div>
      )}
    </div>
  );
}

// ---------------- ask ----------------
export function ForumAsk() {
  const { t } = useT();
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [image, setImage] = useState("");
  const [topic, setTopic] = useState<string>("other");
  const save = useMutation({
    mutationFn: async () => (await apiRequest("POST", "/api/forum/questions", { title, body, image, topic })).json(),
    onSuccess: (r: { id: number }) => {
      queryClient.invalidateQueries({ queryKey: ["/api/forum/questions"] });
      navigate(`/forum/${r.id}`);
    },
    onError: (e: Error) => toast({ title: t("qa.postFailed"), description: e.message, variant: "destructive" }),
  });
  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <Link href="/forum" className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> {t("qa.back")}
      </Link>
      <h1 className="text-2xl font-bold sm:text-[28px]">{t("qa.askTitle")}</h1>
      <form className="space-y-4 rounded-lg border bg-card p-5 shadow-sm" onSubmit={(e) => { e.preventDefault(); save.mutate(); }}>
        <div className="space-y-1.5">
          <Label htmlFor="qa-title" className="font-semibold">{t("qa.qTitle")}</Label>
          <Input id="qa-title" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={160} placeholder={t("qa.qTitlePh")} data-testid="input-question-title" />
          <p className="text-xs text-muted-foreground">{t("qa.qTitleHint")}</p>
        </div>
        <div className="space-y-1.5">
          <Label className="font-semibold">{t("qa.details")}</Label>
          <MathEditor value={body} onChange={setBody} placeholder={t("qa.detailsPh")} testId="input-question-body" />
        </div>
        <div className="flex flex-wrap items-end gap-4">
          <div className="space-y-1.5">
            <Label className="font-semibold">{t("qa.topic")}</Label>
            <Select value={topic} onValueChange={setTopic}>
              <SelectTrigger className="w-52" data-testid="select-question-topic"><SelectValue /></SelectTrigger>
              <SelectContent>{FORUM_TOPICS.map((tp) => <SelectItem key={tp} value={tp}>{t(`qa.topic.${tp}`)}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <PhotoPicker value={image} onChange={setImage} testId="question-photo" />
        </div>
        <div className="flex justify-end gap-2 border-t pt-4">
          <Button type="button" variant="ghost" asChild><Link href="/forum">{t("common.cancel")}</Link></Button>
          <Button type="submit" className="font-semibold" disabled={save.isPending || title.trim().length < 5} data-testid="button-post-question">
            {save.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{t("qa.post")}
          </Button>
        </div>
      </form>
    </div>
  );
}

// ---------------- one question ----------------
export function ForumQuestion({ id }: { id: number }) {
  const { t } = useT();
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const key = [`/api/forum/questions/${id}`];
  // New answers show up without a reload while the page is open.
  const { data, isLoading, error } = useQuery<Detail>({ queryKey: key, refetchInterval: 20_000, refetchOnWindowFocus: true, staleTime: 0 });
  const [body, setBody] = useState("");
  const [image, setImage] = useState("");
  const [editorKey, setEditorKey] = useState(0);

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: key });
    queryClient.invalidateQueries({ queryKey: ["/api/forum/questions"] });
  };
  const fail = (e: Error) => toast({ title: t("qa.actionFailed"), description: e.message, variant: "destructive" });

  const answer = useMutation({
    mutationFn: () => apiRequest("POST", `/api/forum/questions/${id}/answers`, { body, image }),
    onSuccess: () => { setBody(""); setImage(""); setEditorKey((k) => k + 1); refresh(); },
    onError: fail,
  });
  const accept = useMutation({
    mutationFn: (answerId: number | null) => apiRequest("POST", `/api/forum/questions/${id}/accept`, { answerId }),
    onSuccess: refresh, onError: fail,
  });
  const delAnswer = useMutation({
    mutationFn: (aid: number) => apiRequest("DELETE", `/api/forum/answers/${aid}`),
    onSuccess: refresh, onError: fail,
  });
  const delQuestion = useMutation({
    mutationFn: () => apiRequest("DELETE", `/api/forum/questions/${id}`),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/forum/questions"] }); navigate("/forum"); },
    onError: fail,
  });

  if (isLoading) return <div className="space-y-3"><Skeleton className="h-8 w-2/3" /><Skeleton className="h-40 rounded-lg" /></div>;
  if (error || !data) {
    return (
      <div className="space-y-4">
        <Link href="/forum" className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground"><ArrowLeft className="h-4 w-4" /> {t("qa.back")}</Link>
        <p className="text-muted-foreground">{t("qa.notFound")}</p>
      </div>
    );
  }

  // The chosen answer goes first; the rest stay in the order they were written.
  const answers = [...data.answers].sort((a, b) => Number(b.id === data.acceptedAnswerId) - Number(a.id === data.acceptedAnswerId));

  const ConfirmDelete = ({ onYes, testId }: { onYes: () => void; testId: string }) => (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant="ghost" size="sm" className="gap-1.5 text-muted-foreground hover:text-destructive" data-testid={testId}>
          <Trash2 className="h-4 w-4" /> {t("qa.delete")}
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t("qa.deleteTitle")}</AlertDialogTitle>
          <AlertDialogDescription>{t("qa.deleteBody")}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
          <AlertDialogAction onClick={onYes} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">{t("qa.delete")}</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <Link href="/forum" className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground" data-testid="link-forum-back">
        <ArrowLeft className="h-4 w-4" /> {t("qa.back")}
      </Link>

      <article className="rounded-lg border bg-card p-5 shadow-sm">
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-sm bg-secondary px-1.5 py-0.5 text-xs text-secondary-foreground">{t(`qa.topic.${data.topic}`)}</span>
        </div>
        <h1 className="mt-2 text-xl font-bold leading-snug sm:text-2xl" data-testid="text-question-title"><MathText text={data.title} /></h1>
        <div className="mt-2"><Byline author={data.author} at={data.createdAt} /></div>
        {data.body && <div className="mt-4 text-[15px] leading-relaxed"><MathText text={data.body} /></div>}
        {data.image && <img src={data.image} alt={t("qa.photo")} className="mt-4 max-h-96 rounded-md border object-contain" />}
        {data.mine && <div className="mt-3 flex justify-end"><ConfirmDelete onYes={() => delQuestion.mutate()} testId="button-delete-question" /></div>}
      </article>

      <h2 className="text-lg font-semibold">{t("qa.answersCount", { n: data.answers.length })}</h2>
      {answers.length === 0 && <p className="text-sm text-muted-foreground">{t("qa.noAnswers")}</p>}
      <ul className="space-y-3">
        {answers.map((a) => {
          const best = a.id === data.acceptedAnswerId;
          return (
            <li key={a.id} className={cn("rounded-lg border bg-card p-4 shadow-sm", best && "border-correct/60")} data-testid={`answer-${a.id}`}>
              <div className="flex items-start gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <Byline author={a.author} at={a.createdAt} />
                    {best && <span className="inline-flex items-center gap-1 text-sm font-semibold text-correct"><PenMark correct className="h-5 w-5" label={t("qa.best")} />{t("qa.best")}</span>}
                  </div>
                  {a.body && <div className="mt-2 text-[15px] leading-relaxed"><MathText text={a.body} /></div>}
                  {a.image && <img src={a.image} alt={t("qa.photo")} className="mt-3 max-h-80 rounded-md border object-contain" />}
                </div>
              </div>
              {(data.mine || a.mine) && (
                <div className="mt-2 flex flex-wrap justify-end gap-1 border-t pt-2">
                  {data.mine && (
                    <Button variant="ghost" size="sm" className={cn("gap-1.5", best ? "text-muted-foreground" : "text-correct")}
                      onClick={() => accept.mutate(best ? null : a.id)} disabled={accept.isPending} data-testid={`button-accept-${a.id}`}>
                      <Check className="h-4 w-4" /> {best ? t("qa.unmarkBest") : t("qa.markBest")}
                    </Button>
                  )}
                  {a.mine && <ConfirmDelete onYes={() => delAnswer.mutate(a.id)} testId={`button-delete-answer-${a.id}`} />}
                </div>
              )}
            </li>
          );
        })}
      </ul>

      <form className="space-y-3 rounded-lg border bg-card p-5 shadow-sm" onSubmit={(e) => { e.preventDefault(); answer.mutate(); }}>
        <h2 className="font-semibold">{t("qa.yourAnswer")}</h2>
        <MathEditor key={editorKey} value={body} onChange={setBody} placeholder={t("qa.answerPh")} testId="input-answer-body" />
        <div className="flex flex-wrap items-end justify-between gap-3">
          <PhotoPicker value={image} onChange={setImage} testId="answer-photo" />
          <Button type="submit" className="font-semibold" disabled={answer.isPending || (!body.trim() && !image)} data-testid="button-post-answer">
            {answer.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{t("qa.postAnswer")}
          </Button>
        </div>
      </form>
    </div>
  );
}

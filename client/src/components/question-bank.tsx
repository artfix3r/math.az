import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useT } from "@/lib/i18n";
import { MathText } from "@/components/math-text";
import { Library, Trash2, BookmarkPlus, Loader2 } from "lucide-react";
import type { BankQuestion, Question } from "@shared/schema";

const DIFFICULTIES = ["easy", "medium", "hard"] as const;
const ALL = "__all";

const newId = () => Math.random().toString(36).slice(2, 9);

export function useBankTopics() {
  return useQuery<string[]>({ queryKey: ["/api/bank/topics"] });
}

/** Topic + difficulty fields for one question, plus "save to bank". */
export function QuestionMetaRow({ q, onChange, index }: { q: Question; onChange: (p: Partial<Question>) => void; index: number }) {
  const { t } = useT();
  const { toast } = useToast();
  const { data: topics } = useBankTopics();
  const listId = `topics-${index}`;
  const save = useMutation({
    mutationFn: async () => (await apiRequest("POST", "/api/bank", { question: q })).json(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/bank"] });
      queryClient.invalidateQueries({ queryKey: ["/api/bank/topics"] });
      toast({ title: t("bank.saved") });
    },
    onError: (e: Error) => toast({ title: t("bank.saveFailed"), description: e.message, variant: "destructive" }),
  });

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-lg bg-muted/40 px-3 py-2">
      <Input
        list={listId}
        value={q.topic ?? ""}
        onChange={(e) => onChange({ topic: e.target.value.slice(0, 80) })}
        placeholder={t("bank.topicPlaceholder")}
        className="h-8 w-48 bg-background"
        data-testid={`input-topic-${index}`}
      />
      <datalist id={listId}>{topics?.map((tp) => <option key={tp} value={tp} />)}</datalist>
      <Select value={q.difficulty || "none"} onValueChange={(v) => onChange({ difficulty: (v === "none" ? "" : v) as Question["difficulty"] })}>
        <SelectTrigger className="h-8 w-36 bg-background" data-testid={`select-difficulty-${index}`}><SelectValue /></SelectTrigger>
        <SelectContent>
          <SelectItem value="none">{t("bank.noDifficulty")}</SelectItem>
          {DIFFICULTIES.map((d) => <SelectItem key={d} value={d}>{t(`bank.${d}`)}</SelectItem>)}
        </SelectContent>
      </Select>
      <Button
        type="button" size="sm" variant="ghost" className="ml-auto h-8 gap-1.5 font-bold"
        disabled={!q.prompt.trim() || save.isPending}
        onClick={() => save.mutate()}
        data-testid={`button-save-bank-${index}`}
      >
        {save.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <BookmarkPlus className="h-3.5 w-3.5" />}
        {t("bank.saveToBank")}
      </Button>
    </div>
  );
}

/** "Add from bank" button + dialog. Adds copies of the chosen questions. */
export function AddFromBank({ onAdd }: { onAdd: (qs: Question[]) => void }) {
  const { t } = useT();
  const [open, setOpen] = useState(false);
  const [topic, setTopic] = useState(ALL);
  const [difficulty, setDifficulty] = useState(ALL);
  const [picked, setPicked] = useState<Set<number>>(new Set());
  const { data: topics } = useBankTopics();
  const params = new URLSearchParams();
  if (topic !== ALL) params.set("topic", topic);
  if (difficulty !== ALL) params.set("difficulty", difficulty);
  const qs = params.toString();
  const { data: items, isLoading } = useQuery<BankQuestion[]>({
    queryKey: [qs ? `/api/bank?${qs}` : "/api/bank"],
    enabled: open,
  });
  const del = useMutation({
    mutationFn: async (id: number) => apiRequest("DELETE", `/api/bank/${id}`),
    onSuccess: () => queryClient.invalidateQueries({ predicate: (q) => String(q.queryKey[0]).startsWith("/api/bank") }),
  });

  const parse = (b: BankQuestion): Question | null => { try { return JSON.parse(b.question); } catch { return null; } };
  const toggle = (id: number) => setPicked((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const add = () => {
    const chosen = (items ?? []).filter((b) => picked.has(b.id)).map(parse).filter((q): q is Question => !!q);
    onAdd(chosen.map((q) => ({ ...q, id: newId() })));
    setPicked(new Set());
    setOpen(false);
  };

  return (
    <>
      <Button variant="outline" className="gap-2 font-bold" onClick={() => setOpen(true)} data-testid="button-add-from-bank">
        <Library className="h-4 w-4" /> {t("bank.addFromBank")}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[85vh] max-w-2xl overflow-hidden">
          <DialogHeader>
            <DialogTitle>{t("bank.title")}</DialogTitle>
            <DialogDescription>{t("bank.description")}</DialogDescription>
          </DialogHeader>
          <div className="flex flex-wrap gap-2">
            <Select value={topic} onValueChange={setTopic}>
              <SelectTrigger className="w-52" data-testid="filter-topic"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>{t("bank.allTopics")}</SelectItem>
                {topics?.map((tp) => <SelectItem key={tp} value={tp}>{tp}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={difficulty} onValueChange={setDifficulty}>
              <SelectTrigger className="w-40" data-testid="filter-difficulty"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>{t("bank.allDifficulties")}</SelectItem>
                {DIFFICULTIES.map((d) => <SelectItem key={d} value={d}>{t(`bank.${d}`)}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="-mx-1 max-h-[50vh] space-y-2 overflow-y-auto px-1">
            {isLoading && <Loader2 className="mx-auto my-6 h-6 w-6 animate-spin text-primary" />}
            {!isLoading && (items?.length ?? 0) === 0 && (
              <p className="py-8 text-center text-sm text-muted-foreground">{t("bank.empty")}</p>
            )}
            {items?.map((b) => {
              const q = parse(b);
              if (!q) return null;
              return (
                <label key={b.id} className="flex cursor-pointer items-start gap-3 rounded-lg border p-3 hover:border-primary/50">
                  <Checkbox checked={picked.has(b.id)} onCheckedChange={() => toggle(b.id)} className="mt-1" data-testid={`bank-pick-${b.id}`} />
                  <div className="min-w-0 flex-1">
                    <MathText text={q.prompt} className="text-sm font-semibold" />
                    <div className="mt-1 flex flex-wrap gap-1.5">
                      <Badge variant="outline">{t(`qtype.${q.type}`)}</Badge>
                      {b.topic && <Badge className="bg-primary/15 text-primary">{b.topic}</Badge>}
                      {b.difficulty && <Badge variant="secondary">{t(`bank.${b.difficulty}`)}</Badge>}
                    </div>
                  </div>
                  <Button
                    type="button" variant="ghost" size="icon" className="text-muted-foreground hover:text-destructive"
                    onClick={(e) => { e.preventDefault(); del.mutate(b.id); }}
                    aria-label={t("bank.delete")}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </label>
              );
            })}
          </div>
          <DialogFooter>
            <Button onClick={add} disabled={picked.size === 0} className="font-bold" data-testid="button-bank-add">
              {t("bank.addSelected", { n: picked.size })}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

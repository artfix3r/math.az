import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { QUESTION_TYPE_LABEL } from "@/lib/ui";
import { cn } from "@/lib/utils";
import {
  ArrowLeft, Plus, Trash2, GripVertical, ListChecks, FileText, ImageIcon,
  Loader2, Check, Save,
} from "lucide-react";
import type { Quiz, Question, Group } from "@shared/schema";

type QType = "mcq" | "open" | "photo";
function uid() { return Math.random().toString(36).slice(2, 9); }
function blank(type: QType): Question {
  return { id: uid(), type, prompt: "", imageUrl: "", options: type === "mcq" ? ["", ""] : [], correctIndex: type === "mcq" ? 0 : undefined, points: 1 };
}
function toLocalInput(ts?: number | null) {
  if (!ts) return "";
  const d = new Date(ts - new Date().getTimezoneOffset() * 60000);
  return d.toISOString().slice(0, 16);
}

export default function QuizBuilder({ id }: { id?: number }) {
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const editing = id != null;

  const { data: existing } = useQuery<Quiz>({ queryKey: ["/api/quizzes", id], enabled: editing });
  const { data: groups } = useQuery<Group[]>({ queryKey: ["/api/teacher/groups-simple"] });

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [groupId, setGroupId] = useState<string>("none");
  const [duration, setDuration] = useState(30);
  const [startAt, setStartAt] = useState("");
  const [questions, setQuestions] = useState<Question[]>([blank("mcq")]);

  useEffect(() => {
    if (existing) {
      setTitle(existing.title);
      setDescription(existing.description);
      setGroupId(existing.groupId ? String(existing.groupId) : "none");
      setDuration(existing.durationMinutes);
      setStartAt(toLocalInput(existing.startAt));
      const qs: Question[] = JSON.parse(existing.questions || "[]");
      if (qs.length) setQuestions(qs);
    }
  }, [existing]);

  const update = (qid: string, patch: Partial<Question>) =>
    setQuestions((qs) => qs.map((q) => (q.id === qid ? { ...q, ...patch } : q)));
  const remove = (qid: string) => setQuestions((qs) => qs.filter((q) => q.id !== qid));
  const addQ = (type: QType) => setQuestions((qs) => [...qs, blank(type)]);

  const totalPoints = questions.reduce((s, q) => s + (Number(q.points) || 0), 0);

  const save = useMutation({
    mutationFn: async () => {
      const payload = {
        title, description,
        groupId: groupId === "none" ? null : Number(groupId),
        durationMinutes: Number(duration),
        startAt: startAt ? new Date(startAt).getTime() : null,
        questions: JSON.stringify(questions.map((q) => ({ ...q, points: Number(q.points) || 1 }))),
        isTemplate: 0,
      };
      if (editing) return (await apiRequest("PATCH", `/api/quizzes/${id}`, payload)).json();
      return (await apiRequest("POST", "/api/quizzes", payload)).json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/quizzes"] });
      toast({ title: editing ? "Quiz updated!" : "Quiz created!" });
      navigate("/quizzes");
    },
    onError: (e: any) => toast({ title: "Couldn't save", description: e.message, variant: "destructive" }),
  });

  function validate(): string | null {
    if (!title.trim()) return "Give your quiz a title.";
    if (questions.length === 0) return "Add at least one question.";
    for (const q of questions) {
      if (!q.prompt.trim()) return "Every question needs a prompt.";
      if (q.type === "mcq") {
        if ((q.options ?? []).filter((o) => o.trim()).length < 2) return "MCQ questions need at least 2 options.";
      }
    }
    return null;
  }
  function handleSave() {
    const err = validate();
    if (err) { toast({ title: "Almost there", description: err, variant: "destructive" }); return; }
    save.mutate();
  }

  return (
    <div className="space-y-6">
      <Link href="/quizzes" className="inline-flex items-center gap-1 text-sm font-bold text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Back to quizzes
      </Link>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-3xl font-black tracking-tight">{editing ? "Edit quiz" : "New quiz"}</h1>
        <Button onClick={handleSave} disabled={save.isPending} className="gap-2 font-bold" data-testid="button-save-quiz">
          {save.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          {editing ? "Save changes" : "Create quiz"}
        </Button>
      </div>

      {/* Meta */}
      <Card className="space-y-4 p-5">
        <div className="space-y-1.5">
          <Label className="font-bold">Quiz title</Label>
          <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Chapter 3 — Fractions" data-testid="input-quiz-title" />
        </div>
        <div className="space-y-1.5">
          <Label className="font-bold">Description (optional)</Label>
          <Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Covers adding and simplifying fractions." />
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="space-y-1.5">
            <Label className="font-bold">Assign to group</Label>
            <Select value={groupId} onValueChange={setGroupId}>
              <SelectTrigger data-testid="select-group"><SelectValue placeholder="Choose group" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No group (draft)</SelectItem>
                {groups?.map((g) => <SelectItem key={g.id} value={String(g.id)}>{g.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="font-bold">Starts at</Label>
            <Input type="datetime-local" value={startAt} onChange={(e) => setStartAt(e.target.value)} data-testid="input-start-at" />
          </div>
          <div className="space-y-1.5">
            <Label className="font-bold">Duration (minutes)</Label>
            <Input type="number" min={1} value={duration} onChange={(e) => setDuration(Number(e.target.value))} data-testid="input-duration" />
          </div>
        </div>
        <p className="text-xs text-muted-foreground">Leave "Starts at" empty to make this quiz available anytime. {totalPoints} total points across {questions.length} questions.</p>
      </Card>

      {/* Questions */}
      <div className="space-y-4">
        {questions.map((q, idx) => (
          <Card key={q.id} className="p-5" data-testid={`question-${idx}`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <GripVertical className="h-4 w-4 text-muted-foreground" />
                <Badge variant="outline" className="font-bold">Q{idx + 1}</Badge>
                <Badge className="bg-primary/15 text-primary">{QUESTION_TYPE_LABEL[q.type]}</Badge>
              </div>
              <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-destructive" onClick={() => remove(q.id)} data-testid={`button-remove-q-${idx}`}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>

            <div className="mt-3 space-y-3">
              <Textarea value={q.prompt} onChange={(e) => update(q.id, { prompt: e.target.value })} placeholder="Write the question…" data-testid={`input-prompt-${idx}`} />

              {q.type === "photo" && (
                <div className="space-y-1.5">
                  <Label className="text-sm font-bold">Image URL</Label>
                  <Input value={q.imageUrl} onChange={(e) => update(q.id, { imageUrl: e.target.value })} placeholder="https://…/diagram.png" data-testid={`input-image-${idx}`} />
                  {q.imageUrl ? (
                    <img src={q.imageUrl} alt="" className="mt-2 max-h-48 rounded-xl border object-contain" />
                  ) : (
                    <p className="text-xs text-muted-foreground">Paste a link to a diagram or photo students should analyze.</p>
                  )}
                </div>
              )}

              {q.type === "mcq" && (
                <div className="space-y-2">
                  <Label className="text-sm font-bold">Options (tap the circle to mark the correct answer)</Label>
                  {(q.options ?? []).map((opt, oi) => (
                    <div key={oi} className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => update(q.id, { correctIndex: oi })}
                        data-testid={`option-correct-${idx}-${oi}`}
                        className={cn("flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 transition", q.correctIndex === oi ? "border-green-500 bg-green-500 text-white" : "border-input text-transparent")}
                        aria-label="Mark correct"
                      >
                        <Check className="h-3.5 w-3.5" />
                      </button>
                      <Input
                        value={opt}
                        onChange={(e) => update(q.id, { options: (q.options ?? []).map((o, i) => (i === oi ? e.target.value : o)) })}
                        placeholder={`Option ${oi + 1}`}
                        data-testid={`input-option-${idx}-${oi}`}
                      />
                      {(q.options?.length ?? 0) > 2 && (
                        <Button variant="ghost" size="icon" className="text-muted-foreground" onClick={() => update(q.id, { options: (q.options ?? []).filter((_, i) => i !== oi), correctIndex: 0 })}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  ))}
                  <Button variant="outline" size="sm" className="gap-1.5 font-bold" onClick={() => update(q.id, { options: [...(q.options ?? []), ""] })} data-testid={`button-add-option-${idx}`}>
                    <Plus className="h-3.5 w-3.5" /> Add option
                  </Button>
                </div>
              )}

              {q.type !== "mcq" && (
                <p className="rounded-lg bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
                  {q.type === "open" ? "Students type a free-form answer. You'll grade it manually." : "Students answer based on the image. You'll grade it manually."}
                </p>
              )}

              <div className="flex items-center gap-2">
                <Label className="text-sm font-bold">Points</Label>
                <Input type="number" min={1} value={q.points} onChange={(e) => update(q.id, { points: Number(e.target.value) })} className="w-24" data-testid={`input-points-${idx}`} />
              </div>
            </div>
          </Card>
        ))}
      </div>

      {/* Add buttons */}
      <Card className="flex flex-wrap items-center gap-3 border-dashed p-5">
        <span className="text-sm font-bold text-muted-foreground">Add question:</span>
        <Button variant="outline" className="gap-2 font-bold" onClick={() => addQ("mcq")} data-testid="button-add-mcq"><ListChecks className="h-4 w-4" /> Multiple choice</Button>
        <Button variant="outline" className="gap-2 font-bold" onClick={() => addQ("open")} data-testid="button-add-open"><FileText className="h-4 w-4" /> Open question</Button>
        <Button variant="outline" className="gap-2 font-bold" onClick={() => addQ("photo")} data-testid="button-add-photo"><ImageIcon className="h-4 w-4" /> Photo-based</Button>
      </Card>
    </div>
  );
}

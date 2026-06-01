import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Library as LibraryIcon, FileQuestion, Clock, RotateCcw, Trash2 } from "lucide-react";
import type { Quiz, Question, Group } from "@shared/schema";

export default function Library() {
  const { toast } = useToast();
  const { data: templates, isLoading } = useQuery<Quiz[]>({ queryKey: ["/api/quizzes/templates"] });

  const del = useMutation({
    mutationFn: async (id: number) => apiRequest("DELETE", `/api/quizzes/${id}`),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/quizzes/templates"] }); toast({ title: "Removed from library" }); },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-black tracking-tight">Quiz library</h1>
        <p className="text-sm text-muted-foreground">Your backed-up quizzes. Reuse any of them with a new schedule and group.</p>
      </div>

      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2"><Skeleton className="h-40 rounded-2xl" /><Skeleton className="h-40 rounded-2xl" /></div>
      ) : templates && templates.length > 0 ? (
        <div className="grid gap-4 sm:grid-cols-2">
          {templates.map((t) => {
            const qs: Question[] = JSON.parse(t.questions || "[]");
            return (
              <Card key={t.id} className="flex flex-col p-5" data-testid={`template-${t.id}`}>
                <div className="flex items-start justify-between">
                  <h3 className="text-lg font-black">{t.title}</h3>
                  <Badge className="bg-violet-500 text-white">Saved</Badge>
                </div>
                {t.description && <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{t.description}</p>}
                <div className="mt-3 flex flex-wrap gap-3 text-xs font-bold text-muted-foreground">
                  <span className="flex items-center gap-1"><FileQuestion className="h-3.5 w-3.5" /> {qs.length} questions</span>
                  <span className="flex items-center gap-1"><Clock className="h-3.5 w-3.5" /> {t.durationMinutes} min</span>
                </div>
                <div className="mt-4 flex gap-2 border-t pt-4">
                  <ReuseDialog template={t} />
                  <Button variant="ghost" size="icon" className="ml-auto text-muted-foreground hover:text-destructive" onClick={() => del.mutate(t.id)} data-testid={`button-del-template-${t.id}`}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </Card>
            );
          })}
        </div>
      ) : (
        <Card className="flex flex-col items-center justify-center border-dashed p-12 text-center">
          <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary"><LibraryIcon className="h-7 w-7" /></span>
          <p className="mt-4 font-bold">Your library is empty</p>
          <p className="mt-1 text-sm text-muted-foreground">Open any quiz and tap "Back up" to save a reusable copy here.</p>
        </Card>
      )}
    </div>
  );
}

function ReuseDialog({ template }: { template: Quiz }) {
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const [open, setOpen] = useState(false);
  const [groupId, setGroupId] = useState("none");
  const [startAt, setStartAt] = useState("");
  const { data: groups } = useQuery<Group[]>({ queryKey: ["/api/teacher/groups-simple"], enabled: open });

  const reuse = useMutation({
    mutationFn: async () => (await apiRequest("POST", `/api/quizzes/${template.id}/reuse`, {
      groupId: groupId === "none" ? null : Number(groupId),
      startAt: startAt ? new Date(startAt).getTime() : null,
    })).json(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/quizzes"] });
      setOpen(false);
      toast({ title: "Quiz cloned!", description: "A fresh copy is live in Quizzes." });
      navigate("/quizzes");
    },
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" className="gap-1.5 font-bold" data-testid={`button-reuse-${template.id}`}><RotateCcw className="h-3.5 w-3.5" /> Reuse</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Reuse "{template.title}"</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label className="font-bold">Assign to group</Label>
            <Select value={groupId} onValueChange={setGroupId}>
              <SelectTrigger><SelectValue placeholder="Choose group" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No group (draft)</SelectItem>
                {groups?.map((g) => <SelectItem key={g.id} value={String(g.id)}>{g.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="font-bold">Starts at (optional)</Label>
            <Input type="datetime-local" value={startAt} onChange={(e) => setStartAt(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button onClick={() => reuse.mutate()} disabled={reuse.isPending} className="font-bold">Create live copy</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

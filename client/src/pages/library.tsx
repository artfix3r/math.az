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
import { useT } from "@/lib/i18n";
import type { Quiz, Question, Group } from "@shared/schema";

export default function Library() {
  const { toast } = useToast();
  const { t } = useT();
  const { data: templates, isLoading } = useQuery<Quiz[]>({ queryKey: ["/api/quizzes/templates"] });

  const del = useMutation({
    mutationFn: async (id: number) => apiRequest("DELETE", `/api/quizzes/${id}`),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/quizzes/templates"] }); toast({ title: t("lib.removed") }); },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold sm:text-[28px]">{t("lib.title")}</h1>
        <p className="text-sm text-muted-foreground">{t("lib.sub")}</p>
      </div>

      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2"><Skeleton className="h-40 rounded-lg" /><Skeleton className="h-40 rounded-lg" /></div>
      ) : templates && templates.length > 0 ? (
        <div className="grid gap-4 sm:grid-cols-2">
          {templates.map((tpl) => {
            const qs: Question[] = JSON.parse(tpl.questions || "[]");
            return (
              <Card key={tpl.id} className="flex flex-col p-5" data-testid={`template-${tpl.id}`}>
                <div className="flex items-start justify-between">
                  <h3 className="text-lg font-bold">{tpl.title}</h3>
                  <Badge className="bg-primary text-primary-foreground">{t("lib.saved")}</Badge>
                </div>
                {tpl.description && <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{tpl.description}</p>}
                <div className="mt-3 flex flex-wrap gap-3 text-xs font-bold text-muted-foreground">
                  <span className="flex items-center gap-1"><FileQuestion className="h-3.5 w-3.5" /> {qs.length} {t("common.questions")}</span>
                  <span className="flex items-center gap-1"><Clock className="h-3.5 w-3.5" /> {tpl.durationMinutes} {t("common.min")}</span>
                </div>
                <div className="mt-4 flex gap-2 border-t pt-4">
                  <ReuseDialog template={tpl} />
                  <Button variant="ghost" size="icon" className="ml-auto text-muted-foreground hover:text-destructive" onClick={() => del.mutate(tpl.id)} data-testid={`button-del-template-${tpl.id}`}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </Card>
            );
          })}
        </div>
      ) : (
        <Card className="flex flex-col items-center justify-center border-dashed p-12 text-center">
          <span className="flex h-14 w-14 items-center justify-center rounded-lg bg-primary/10 text-primary"><LibraryIcon className="h-7 w-7" /></span>
          <p className="mt-4 font-bold">{t("lib.empty")}</p>
          <p className="mt-1 text-sm text-muted-foreground">{t("lib.emptySub")}</p>
        </Card>
      )}
    </div>
  );
}

function ReuseDialog({ template }: { template: Quiz }) {
  const { toast } = useToast();
  const { t } = useT();
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
      toast({ title: t("lib.cloned"), description: t("lib.clonedSub") });
      navigate("/quizzes");
    },
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" className="gap-1.5 font-bold" data-testid={`button-reuse-${template.id}`}><RotateCcw className="h-3.5 w-3.5" /> {t("lib.reuse")}</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>{t("lib.reuseTitle", { title: template.title })}</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label className="font-bold">{t("qb.assignGroup")}</Label>
            <Select value={groupId} onValueChange={setGroupId}>
              <SelectTrigger><SelectValue placeholder={t("qb.chooseGroup")} /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">{t("qb.noGroup")}</SelectItem>
                {groups?.map((g) => <SelectItem key={g.id} value={String(g.id)}>{g.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="font-bold">{t("lib.startsAtOpt")}</Label>
            <Input type="datetime-local" value={startAt} onChange={(e) => setStartAt(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button onClick={() => reuse.mutate()} disabled={reuse.isPending} className="font-bold">{t("lib.createCopy")}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

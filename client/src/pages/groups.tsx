import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Link } from "wouter";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth";
import { COLOR_MAP, colorOf } from "@/lib/ui";
import { cn } from "@/lib/utils";
import { Users, Plus, ArrowRight, Loader2 } from "lucide-react";
import { useT } from "@/lib/i18n";
import type { Group } from "@shared/schema";

type GroupWithCount = Group & { memberCount: number };

export default function Groups() {
  const { user } = useAuth();
  const { toast } = useToast();
  const { t } = useT();
  const { data: groups, isLoading } = useQuery<GroupWithCount[]>({ queryKey: ["/api/groups"] });
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [color, setColor] = useState("violet");
  const isTeacher = user?.role === "teacher";

  const create = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/groups", { name, description, color });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/groups"] });
      setOpen(false); setName(""); setDescription(""); setColor("violet");
      toast({ title: t("groups.created") });
    },
    onError: (e: any) => toast({ title: t("groups.cantCreate"), description: e.message, variant: "destructive" }),
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold sm:text-[28px]">{t("groups.title")}</h1>
          <p className="text-sm text-muted-foreground">{isTeacher ? t("groups.teacherSub") : t("groups.studentSub")}</p>
        </div>
        {isTeacher && (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2 font-bold" data-testid="button-create-group"><Plus className="h-4 w-4" /> {t("groups.newGroup")}</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>{t("groups.createGroup")}</DialogTitle></DialogHeader>
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <Label className="font-bold">{t("groups.name")}</Label>
                  <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Algebra 101" data-testid="input-group-name" />
                </div>
                <div className="space-y-1.5">
                  <Label className="font-bold">{t("groups.description")}</Label>
                  <Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Morning section, Fall term" />
                </div>
                <div className="space-y-1.5">
                  <Label className="font-bold">{t("groups.color")}</Label>
                  <div className="flex gap-2">
                    {Object.keys(COLOR_MAP).map((k) => (
                      <button key={k} type="button" onClick={() => setColor(k)} data-testid={`color-${k}`}
                        className={cn("h-8 w-8 rounded-full ring-2 ring-offset-2 ring-offset-background transition", COLOR_MAP[k].solid, color === k ? "ring-foreground" : "ring-transparent")} />
                    ))}
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button onClick={() => create.mutate()} disabled={!name || create.isPending} className="font-bold" data-testid="button-save-group">
                  {create.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} {t("groups.createGroup")}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2].map((i) => <Skeleton key={i} className="h-36 rounded-lg" />)}
        </div>
      ) : groups && groups.length > 0 ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {groups.map((g) => {
            const c = colorOf(g.color);
            return (
              <Link key={g.id} href={`/groups/${g.id}`}>
                <Card className="group h-full p-5 hover-elevate" data-testid={`card-group-${g.id}`}>
                  <div className="flex items-start justify-between">
                    <span className={cn("flex h-11 w-11 items-center justify-center rounded-lg", c.bg, c.text)}>
                      <Users className="h-5 w-5" />
                    </span>
                    <ArrowRight className="h-4 w-4 text-muted-foreground opacity-0 transition group-hover:opacity-100" />
                  </div>
                  <h3 className="mt-4 text-lg font-bold">{g.name}</h3>
                  {g.description && <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{g.description}</p>}
                  <p className="mt-3 text-xs font-bold text-muted-foreground">{g.memberCount} {g.memberCount === 1 ? t("groups.student") : t("groups.students")}</p>
                </Card>
              </Link>
            );
          })}
        </div>
      ) : (
        <Card className="flex flex-col items-center justify-center border-dashed p-12 text-center">
          <span className="flex h-14 w-14 items-center justify-center rounded-lg bg-primary/10 text-primary"><Users className="h-7 w-7" /></span>
          <p className="mt-4 font-bold">{isTeacher ? t("groups.noneTeacher") : t("groups.noneStudent")}</p>
          <p className="mt-1 text-sm text-muted-foreground">{isTeacher ? t("groups.noneTeacherSub") : t("groups.noneStudentSub")}</p>
        </Card>
      )}
    </div>
  );
}

import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useAuth } from "@/lib/auth";
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
import { Video, Plus, CalendarClock, Clock, Trash2, Loader2, ExternalLink } from "lucide-react";
import type { ClassSession, Group } from "@shared/schema";

function fmt(ts: number) {
  return new Date(ts).toLocaleString(undefined, { weekday: "short", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}
function status(s: ClassSession): "live" | "upcoming" | "ended" {
  const now = Date.now();
  const end = s.startAt + s.durationMinutes * 60000;
  if (now < s.startAt) return "upcoming";
  if (now <= end) return "live";
  return "ended";
}

export default function Sessions() {
  const { user } = useAuth();
  const { toast } = useToast();
  const isTeacher = user?.role === "teacher";
  const { data: sessions, isLoading } = useQuery<ClassSession[]>({ queryKey: ["/api/sessions"] });

  const del = useMutation({
    mutationFn: async (id: number) => apiRequest("DELETE", `/api/sessions/${id}`),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/sessions"] }); toast({ title: "Session removed" }); },
  });

  const sorted = [...(sessions ?? [])].sort((a, b) => a.startAt - b.startAt);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-black tracking-tight">Live sessions</h1>
          <p className="text-sm text-muted-foreground">{isTeacher ? "Schedule online classes with a meeting link." : "Join your scheduled online classes."}</p>
        </div>
        {isTeacher && <NewSessionDialog />}
      </div>

      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2"><Skeleton className="h-32 rounded-2xl" /><Skeleton className="h-32 rounded-2xl" /></div>
      ) : sorted.length > 0 ? (
        <div className="grid gap-4 sm:grid-cols-2">
          {sorted.map((s) => {
            const st = status(s);
            return (
              <Card key={s.id} className="flex flex-col p-5" data-testid={`session-${s.id}`}>
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-3">
                    <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-teal-100 text-teal-600 dark:bg-teal-500/15 dark:text-teal-300"><Video className="h-5 w-5" /></span>
                    <h3 className="text-lg font-black">{s.title}</h3>
                  </div>
                  {st === "live" ? <Badge className="animate-pulse bg-green-500 text-white">Live now</Badge>
                    : st === "upcoming" ? <Badge className="bg-blue-500 text-white">Upcoming</Badge>
                    : <Badge className="bg-muted text-muted-foreground">Ended</Badge>}
                </div>
                <div className="mt-3 flex flex-wrap gap-3 text-xs font-bold text-muted-foreground">
                  <span className="flex items-center gap-1"><CalendarClock className="h-3.5 w-3.5" /> {fmt(s.startAt)}</span>
                  <span className="flex items-center gap-1"><Clock className="h-3.5 w-3.5" /> {s.durationMinutes} min</span>
                </div>
                <div className="mt-4 flex gap-2 border-t pt-4">
                  <a href={s.meetingUrl} target="_blank" rel="noopener noreferrer" className="flex-1">
                    <Button className="w-full gap-2 font-bold" disabled={st === "ended"} data-testid={`button-join-${s.id}`}>
                      <ExternalLink className="h-4 w-4" /> {st === "ended" ? "Session ended" : "Join meeting"}
                    </Button>
                  </a>
                  {isTeacher && (
                    <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-destructive" onClick={() => del.mutate(s.id)} data-testid={`button-del-session-${s.id}`}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      ) : (
        <Card className="flex flex-col items-center justify-center border-dashed p-12 text-center">
          <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary"><Video className="h-7 w-7" /></span>
          <p className="mt-4 font-bold">No sessions scheduled</p>
          <p className="mt-1 text-sm text-muted-foreground">{isTeacher ? "Schedule a session and share the meeting link with a group." : "Your teacher's scheduled classes will appear here."}</p>
        </Card>
      )}
    </div>
  );
}

function NewSessionDialog() {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [meetingUrl, setMeetingUrl] = useState("");
  const [startAt, setStartAt] = useState("");
  const [duration, setDuration] = useState(60);
  const [groupId, setGroupId] = useState("none");
  const { data: groups } = useQuery<Group[]>({ queryKey: ["/api/teacher/groups-simple"], enabled: open });

  const create = useMutation({
    mutationFn: async () => (await apiRequest("POST", "/api/sessions", {
      title, meetingUrl,
      startAt: startAt ? new Date(startAt).getTime() : Date.now(),
      durationMinutes: Number(duration),
      groupId: groupId === "none" ? null : Number(groupId),
    })).json(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/sessions"] });
      setOpen(false); setTitle(""); setMeetingUrl(""); setStartAt(""); setGroupId("none");
      toast({ title: "Session scheduled!" });
    },
    onError: (e: any) => toast({ title: "Couldn't schedule", description: e.message, variant: "destructive" }),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="gap-2 font-bold" data-testid="button-new-session"><Plus className="h-4 w-4" /> Schedule session</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Schedule a live session</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label className="font-bold">Title</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Live review — Geometry" data-testid="input-session-title" />
          </div>
          <div className="space-y-1.5">
            <Label className="font-bold">Meeting link</Label>
            <Input value={meetingUrl} onChange={(e) => setMeetingUrl(e.target.value)} placeholder="https://meet.google.com/… or Zoom/Jitsi link" data-testid="input-meeting-url" />
            <p className="text-xs text-muted-foreground">Paste a Google Meet, Zoom, or Jitsi link. Students click "Join" to open it.</p>
          </div>
          <div className="space-y-1.5">
            <Label className="font-bold">Assign to group</Label>
            <Select value={groupId} onValueChange={setGroupId}>
              <SelectTrigger><SelectValue placeholder="Choose group" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">All my students (no group)</SelectItem>
                {groups?.map((g) => <SelectItem key={g.id} value={String(g.id)}>{g.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="font-bold">Starts at</Label>
              <Input type="datetime-local" value={startAt} onChange={(e) => setStartAt(e.target.value)} data-testid="input-session-start" />
            </div>
            <div className="space-y-1.5">
              <Label className="font-bold">Duration (min)</Label>
              <Input type="number" min={1} value={duration} onChange={(e) => setDuration(Number(e.target.value))} />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button onClick={() => create.mutate()} disabled={!title || !meetingUrl || create.isPending} className="font-bold" data-testid="button-save-session">
            {create.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Schedule
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

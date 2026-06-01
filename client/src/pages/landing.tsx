import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useAuth, AuthUser } from "@/lib/auth";
import { apiRequest } from "@/lib/queryClient";
import { Logo, MathBackdrop } from "@/lib/ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { GraduationCap, Users, FileQuestion, Video, BarChart3, Loader2 } from "lucide-react";
import { SiGoogle } from "react-icons/si";

type Role = "teacher" | "student";

export default function Landing() {
  const { user, login } = useAuth();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [mode, setMode] = useState<"signin" | "register">("signin");
  const [role, setRole] = useState<Role>("student");
  const [loading, setLoading] = useState(false);
  const [showGoogle, setShowGoogle] = useState(false);

  // sign in
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  // register
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [regPassword, setRegPassword] = useState("");
  // google
  const [gEmail, setGEmail] = useState("");
  const [gName, setGName] = useState("");

  useEffect(() => {
    if (user) navigate("/dashboard");
  }, [user, navigate]);

  const finish = (u: AuthUser) => {
    login(u);
    navigate("/dashboard");
  };

  async function handleSignIn(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await apiRequest("POST", "/api/auth/login", { identifier, password });
      finish(await res.json());
    } catch (err: any) {
      toast({ title: "Couldn't sign in", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await apiRequest("POST", "/api/auth/register", {
        fullName, email, username, password: regPassword, role,
      });
      finish(await res.json());
      toast({ title: "Welcome to math.az!", description: `Account created as a ${role}.` });
    } catch (err: any) {
      toast({ title: "Couldn't register", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }

  async function handleGoogle(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await apiRequest("POST", "/api/auth/google", {
        email: gEmail, fullName: gName || gEmail.split("@")[0], role,
      });
      finish(await res.json());
    } catch (err: any) {
      toast({ title: "Google sign-in failed", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-gradient-to-br from-violet-50 via-background to-pink-50 dark:from-violet-950/30 dark:via-background dark:to-pink-950/20">
      <MathBackdrop />
      <div className="relative mx-auto grid min-h-screen max-w-6xl items-center gap-10 px-5 py-10 lg:grid-cols-2 lg:gap-16 lg:px-8">
        {/* Left: pitch */}
        <div className="order-2 lg:order-1">
          <Logo className="text-2xl" />
          <h1 className="mt-6 text-4xl font-black leading-tight tracking-tight sm:text-5xl">
            Make math class{" "}
            <span className="bg-gradient-to-r from-violet-600 to-pink-500 bg-clip-text text-transparent">
              fun and effortless
            </span>
          </h1>
          <p className="mt-4 max-w-md text-base text-muted-foreground">
            math.az gives teachers groups, smart quizzes, live sessions, and crystal-clear analytics — and gives students a delightful place to learn and track progress.
          </p>
          <ul className="mt-8 grid max-w-md gap-3 sm:grid-cols-2">
            {[
              { icon: Users, t: "Class groups" },
              { icon: FileQuestion, t: "MCQ, open & photo quizzes" },
              { icon: Video, t: "Live online sessions" },
              { icon: BarChart3, t: "Performance graphs" },
            ].map((f) => (
              <li key={f.t} className="flex items-center gap-3 rounded-xl border bg-card/70 px-3 py-2.5 backdrop-blur">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <f.icon className="h-4 w-4" />
                </span>
                <span className="text-sm font-bold">{f.t}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Right: auth card */}
        <div className="order-1 lg:order-2">
          <Card className="mx-auto w-full max-w-md border-2 p-6 shadow-xl sm:p-8">
            <Tabs value={mode} onValueChange={(v) => setMode(v as any)}>
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="signin" data-testid="tab-signin">Sign in</TabsTrigger>
                <TabsTrigger value="register" data-testid="tab-register">Register</TabsTrigger>
              </TabsList>

              {/* Role selector (shown for register + google) */}
              <RolePicker role={role} setRole={setRole} className="mt-5" />

              <TabsContent value="signin" className="mt-4">
                {!showGoogle ? (
                  <form onSubmit={handleSignIn} className="space-y-3">
                    <Field label="Email or username">
                      <Input value={identifier} onChange={(e) => setIdentifier(e.target.value)} placeholder="you@email.com" data-testid="input-identifier" required />
                    </Field>
                    <Field label="Password">
                      <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} data-testid="input-password" required />
                    </Field>
                    <Button type="submit" className="w-full font-bold" disabled={loading} data-testid="button-signin">
                      {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Sign in
                    </Button>
                  </form>
                ) : (
                  <GoogleForm onSubmit={handleGoogle} gEmail={gEmail} setGEmail={setGEmail} gName={gName} setGName={setGName} loading={loading} />
                )}
              </TabsContent>

              <TabsContent value="register" className="mt-4">
                <form onSubmit={handleRegister} className="space-y-3">
                  <Field label="Full name">
                    <Input value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Ada Lovelace" data-testid="input-fullname" required />
                  </Field>
                  <Field label="Email">
                    <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@email.com" data-testid="input-email" required />
                  </Field>
                  <Field label="Username">
                    <Input value={username} onChange={(e) => setUsername(e.target.value)} placeholder="ada" data-testid="input-username" required />
                  </Field>
                  <Field label="Password">
                    <Input type="password" value={regPassword} onChange={(e) => setRegPassword(e.target.value)} data-testid="input-regpassword" required />
                  </Field>
                  <Button type="submit" className="w-full font-bold" disabled={loading} data-testid="button-register">
                    {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Create {role} account
                  </Button>
                </form>
              </TabsContent>
            </Tabs>

            <div className="my-4 flex items-center gap-3 text-xs text-muted-foreground">
              <span className="h-px flex-1 bg-border" /> or <span className="h-px flex-1 bg-border" />
            </div>
            <Button
              variant="outline"
              className="w-full gap-2 font-bold"
              onClick={() => { setMode("signin"); setShowGoogle((s) => !s); }}
              data-testid="button-google-toggle"
            >
              <SiGoogle className="h-4 w-4" />
              {showGoogle ? "Use email instead" : "Continue with Google"}
            </Button>
            <p className="mt-3 text-center text-xs text-muted-foreground">
              Signing in as a <span className="font-bold capitalize text-foreground">{role}</span>
            </p>
          </Card>
        </div>
      </div>
    </div>
  );
}

function RolePicker({ role, setRole, className }: { role: Role; setRole: (r: Role) => void; className?: string }) {
  return (
    <div className={className}>
      <Label className="mb-2 block text-xs font-bold uppercase tracking-wide text-muted-foreground">I am a</Label>
      <div className="grid grid-cols-2 gap-2">
        {(["student", "teacher"] as Role[]).map((r) => (
          <button
            key={r}
            type="button"
            onClick={() => setRole(r)}
            data-testid={`role-${r}`}
            className={
              "flex items-center justify-center gap-2 rounded-xl border-2 px-3 py-2.5 text-sm font-bold capitalize transition-colors " +
              (role === r ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover-elevate")
            }
          >
            <GraduationCap className="h-4 w-4" /> {r}
          </button>
        ))}
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-sm font-bold">{label}</Label>
      {children}
    </div>
  );
}

function GoogleForm({ onSubmit, gEmail, setGEmail, gName, setGName, loading }: any) {
  return (
    <form onSubmit={onSubmit} className="space-y-3">
      <div className="rounded-xl border border-dashed bg-muted/40 p-3 text-xs text-muted-foreground">
        Live Google OAuth plugs in once your Google Cloud credentials are configured. For now, enter your Gmail to sign in instantly.
      </div>
      <Field label="Gmail address">
        <Input type="email" value={gEmail} onChange={(e) => setGEmail(e.target.value)} placeholder="you@gmail.com" data-testid="input-gemail" required />
      </Field>
      <Field label="Your name (first time only)">
        <Input value={gName} onChange={(e) => setGName(e.target.value)} placeholder="Ada Lovelace" data-testid="input-gname" />
      </Field>
      <Button type="submit" className="w-full gap-2 font-bold" disabled={loading} data-testid="button-google-signin">
        {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        <SiGoogle className="h-4 w-4" /> Continue with Google
      </Button>
    </form>
  );
}

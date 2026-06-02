import { useState, useEffect } from "react";
import { useLocation, Link } from "wouter";
import { useAuth, AuthUser } from "@/lib/auth";
import { apiRequest } from "@/lib/queryClient";
import { Logo, MathBackdrop } from "@/lib/ui";
import { useT } from "@/lib/i18n";
import { LanguageSwitcher } from "@/pages/shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { GraduationCap, Users, FileQuestion, Video, BarChart3, Loader2 } from "lucide-react";

type Role = "teacher" | "student";

export default function Landing() {
  const { user, login } = useAuth();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const { t } = useT();
  const [mode, setMode] = useState<"signin" | "register">("signin");
  const [role, setRole] = useState<Role>("student");
  const [loading, setLoading] = useState(false);

  // sign in
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  // register
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [regPassword, setRegPassword] = useState("");

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
      toast({ title: t("landing.cantSignIn"), description: err.message, variant: "destructive" });
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
      toast({ title: t("landing.welcome"), description: t("landing.accountCreated", { role: t(`landing.${role}`) }) });
    } catch (err: any) {
      toast({ title: t("landing.cantRegister"), description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-gradient-to-br from-violet-50 via-background to-pink-50 dark:from-violet-950/30 dark:via-background dark:to-pink-950/20">
      <MathBackdrop />
      <div className="absolute right-4 top-4 z-20">
        <LanguageSwitcher />
      </div>
      <div className="relative mx-auto grid min-h-screen max-w-6xl items-center gap-10 px-5 py-10 lg:grid-cols-2 lg:gap-16 lg:px-8">
        {/* Left: pitch */}
        <div className="order-2 lg:order-1">
          <Logo className="text-2xl" />
          <h1 className="mt-6 text-4xl font-black leading-tight tracking-tight sm:text-5xl">
            {t("landing.headlinePrefix")}{" "}
            <span className="bg-gradient-to-r from-violet-600 to-pink-500 bg-clip-text text-transparent">
              {t("landing.fun")}
            </span>
          </h1>
          <p className="mt-4 max-w-md text-base text-muted-foreground">
            {t("landing.pitch")}
          </p>
          <ul className="mt-8 grid max-w-md gap-3 sm:grid-cols-2">
            {[
              { icon: Users, k: "landing.feat.groups" },
              { icon: FileQuestion, k: "landing.feat.quizzes" },
              { icon: Video, k: "landing.feat.sessions" },
              { icon: BarChart3, k: "landing.feat.graphs" },
            ].map((f) => (
              <li key={f.k} className="flex items-center gap-3 rounded-xl border bg-card/70 px-3 py-2.5 backdrop-blur">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <f.icon className="h-4 w-4" />
                </span>
                <span className="text-sm font-bold">{t(f.k)}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Right: auth card */}
        <div className="order-1 lg:order-2">
          <Card className="mx-auto w-full max-w-md border-2 p-6 shadow-xl sm:p-8">
            <Tabs value={mode} onValueChange={(v) => setMode(v as any)}>
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="signin" data-testid="tab-signin">{t("landing.signin")}</TabsTrigger>
                <TabsTrigger value="register" data-testid="tab-register">{t("landing.register")}</TabsTrigger>
              </TabsList>

              <TabsContent value="signin" className="mt-4">
                <form onSubmit={handleSignIn} className="space-y-3">
                  <Field label={t("landing.emailOrUsername")}>
                    <Input value={identifier} onChange={(e) => setIdentifier(e.target.value)} placeholder="you@email.com" data-testid="input-identifier" required />
                  </Field>
                  <Field label={t("landing.password")}>
                    <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} data-testid="input-password" required />
                  </Field>
                  <Button type="submit" className="w-full font-bold" disabled={loading} data-testid="button-signin">
                    {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} {t("landing.signin")}
                  </Button>
                </form>
              </TabsContent>

              <TabsContent value="register" className="mt-4">
                <form onSubmit={handleRegister} className="space-y-3">
                  <RolePicker role={role} setRole={setRole} />
                  <Field label={t("landing.fullName")}>
                    <Input value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder={t("landing.fullNamePlaceholder")} data-testid="input-fullname" required />
                  </Field>
                  <Field label={t("landing.email")}>
                    <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@email.com" data-testid="input-email" required />
                  </Field>
                  <Field label={t("landing.username")}>
                    <Input value={username} onChange={(e) => setUsername(e.target.value)} placeholder={t("landing.usernamePlaceholder")} data-testid="input-username" required />
                  </Field>
                  <Field label={t("landing.password")}>
                    <Input type="password" value={regPassword} onChange={(e) => setRegPassword(e.target.value)} data-testid="input-regpassword" required />
                    <p className="text-xs text-muted-foreground">{t("landing.passwordHint")}</p>
                  </Field>
                  <Button type="submit" className="w-full font-bold" disabled={loading} data-testid="button-register">
                    {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} {t("landing.createAccount", { role: t(`landing.${role}`) })}
                  </Button>
                </form>
              </TabsContent>
            </Tabs>

            {mode === "register" && (
              <p className="mt-4 text-center text-xs text-muted-foreground">
                {t("landing.signingInAs")} <span className="font-bold text-foreground">{t(`landing.${role}`)}</span>
              </p>
            )}
          </Card>
          <p className="mt-4 text-center text-sm text-muted-foreground">
            <Link href="/feedback" data-testid="link-feedback" className="font-bold text-primary hover:underline">
              {t("nav.feedback")}
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}

function RolePicker({ role, setRole, className }: { role: Role; setRole: (r: Role) => void; className?: string }) {
  const { t } = useT();
  return (
    <div className={className}>
      <Label className="mb-2 block text-xs font-bold uppercase tracking-wide text-muted-foreground">{t("landing.iAmA")}</Label>
      <div className="grid grid-cols-2 gap-2">
        {(["student", "teacher"] as Role[]).map((r) => (
          <button
            key={r}
            type="button"
            onClick={() => setRole(r)}
            data-testid={`role-${r}`}
            className={
              "flex items-center justify-center gap-2 rounded-xl border-2 px-3 py-2.5 text-sm font-bold transition-colors " +
              (role === r ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover-elevate")
            }
          >
            <GraduationCap className="h-4 w-4" /> {t(`landing.${r}`)}
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


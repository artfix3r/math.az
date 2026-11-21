import { useState, useEffect } from "react";
import { useLocation, Link } from "wouter";
import { useAuth, AuthUser } from "@/lib/auth";
import { apiRequest } from "@/lib/queryClient";
import { Logo } from "@/lib/ui";
import { MathText } from "@/components/math-text";
import { PenScore, PenMark, PenRemark } from "@/components/red-pen";
import { cn } from "@/lib/utils";
import { useT } from "@/lib/i18n";
import { LanguageSwitcher, ThemeToggle } from "@/pages/shell";
import { GoogleSignInButton } from "@/lib/google-signin";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { GraduationCap, BookOpen, Loader2, Check } from "lucide-react";

const FACTS = ["landing.fact.formulas", "landing.fact.variants", "landing.fact.deadlines", "landing.fact.languages"];

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
  // forgot password
  const [forgotOpen, setForgotOpen] = useState(false);

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
    <div className="relative min-h-screen bg-background">
      <header className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5 lg:px-8">
        <Logo className="text-lg" />
        <div className="flex items-center gap-1">
          <LanguageSwitcher />
          <ThemeToggle />
        </div>
      </header>
      <div className="mx-auto grid max-w-6xl gap-x-16 gap-y-8 px-5 pb-16 pt-4 lg:grid-cols-[1.1fr_1fr] lg:px-8 lg:pt-10">
        {/* Pitch */}
        <div className="lg:row-span-2">
          <h1 className="max-w-xl text-[2.1rem] font-bold leading-[1.1] sm:text-5xl sm:leading-[1.05]">
            {t("landing.headline")}
          </h1>
          <p className="mt-4 max-w-lg text-[17px] leading-relaxed text-muted-foreground">
            {t("landing.pitch2")}
          </p>
          <SampleSheet className="mt-8 hidden lg:block" />
          <ul className="mt-8 hidden max-w-lg gap-x-6 gap-y-2.5 text-sm lg:grid lg:grid-cols-2">
            {FACTS.map((k) => (
              <li key={k} className="flex gap-2.5"><Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />{t(k)}</li>
            ))}
          </ul>
        </div>

        {/* Right: auth card */}
        <div className="lg:pt-2">
          <Card className="mx-auto w-full max-w-md p-5 shadow-lg sm:p-7">
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
                  <div className="flex justify-end">
                    <button
                      type="button"
                      onClick={() => setForgotOpen(true)}
                      data-testid="link-forgot-password"
                      className="text-sm font-medium text-primary underline-offset-4 hover:underline"
                    >
                      {t("landing.forgotPassword")}
                    </button>
                  </div>
                  <Button type="submit" className="w-full" disabled={loading} data-testid="button-signin">
                    {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} {t("landing.signin")}
                  </Button>
                </form>
                <OrDivider />
                <GoogleSignInButton role={role} onSuccess={finish} />
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
                  <Button type="submit" className="w-full" disabled={loading} data-testid="button-register">
                    {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} {t("landing.createAccount", { role: t(`landing.${role}`) })}
                  </Button>
                </form>
                <OrDivider />
                <GoogleSignInButton role={role} onSuccess={finish} />
              </TabsContent>
            </Tabs>

            {mode === "register" && (
              <p className="mt-4 text-center text-xs text-muted-foreground">
                {t("landing.signingInAs")} <span className="font-bold text-foreground">{t(`landing.${role}`)}</span>
              </p>
            )}
          </Card>
          <p className="mt-4 text-center text-sm text-muted-foreground">
            <Link href="/feedback" data-testid="link-feedback" className="font-medium text-primary underline-offset-4 hover:underline">
              {t("nav.feedback")}
            </Link>
          </p>
        </div>

        {/* Phone: the sample sheet after sign-in */}
        <div className="lg:hidden">
          <SampleSheet />
          <ul className="mt-6 grid gap-2.5 text-sm">
            {FACTS.map((k) => (
              <li key={k} className="flex gap-2.5"><Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />{t(k)}</li>
            ))}
          </ul>
        </div>
      </div>

      <ForgotPasswordDialog open={forgotOpen} onOpenChange={setForgotOpen} />
    </div>
  );
}

function OrDivider() {
  const { t } = useT();
  return (
    <div className="my-4 flex items-center gap-3">
      <span className="h-px flex-1 bg-border" />
      <span className="text-xs text-muted-foreground">{t("landing.or")}</span>
      <span className="h-px flex-1 bg-border" />
    </div>
  );
}

function ForgotPasswordDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const { t } = useT();
  const { toast } = useToast();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      await apiRequest("POST", "/api/auth/forgot-password", { email });
      setSent(true);
    } catch (err: any) {
      toast({ title: t("landing.resetRequestFailed"), description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }

  // Reset internal state when the dialog closes so reopening starts fresh.
  useEffect(() => {
    if (!open) {
      setSent(false);
      setEmail("");
      setLoading(false);
    }
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("landing.forgotTitle")}</DialogTitle>
          <DialogDescription>
            {sent ? t("landing.resetSentDesc") : t("landing.forgotDesc")}
          </DialogDescription>
        </DialogHeader>
        {sent ? (
          <DialogFooter>
            <Button onClick={() => onOpenChange(false)} className="w-full" data-testid="button-reset-sent-close">
              {t("landing.gotIt")}
            </Button>
          </DialogFooter>
        ) : (
          <form onSubmit={submit} className="space-y-3">
            <div className="space-y-1.5">
              <Label className="text-sm font-medium">{t("landing.email")}</Label>
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@email.com"
                data-testid="input-forgot-email"
                required
              />
            </div>
            <Button type="submit" className="w-full" disabled={loading} data-testid="button-send-reset">
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} {t("landing.sendResetLink")}
            </Button>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

function RolePicker({ role, setRole, className }: { role: Role; setRole: (r: Role) => void; className?: string }) {
  const { t } = useT();
  return (
    <div className={className}>
      <Label className="mb-2 block text-sm font-medium">{t("landing.iAmA")}</Label>
      <div className="grid grid-cols-2 gap-2">
        {(["student", "teacher"] as Role[]).map((r) => (
          <button
            key={r}
            type="button"
            onClick={() => setRole(r)}
            data-testid={`role-${r}`}
            aria-pressed={role === r}
            className={
              "flex min-h-11 items-center justify-center gap-2 rounded-md border px-3 text-sm font-medium transition-colors " +
              (role === r ? "border-primary bg-secondary text-primary ring-1 ring-primary" : "border-input text-muted-foreground hover:bg-muted")
            }
          >
            {r === "student" ? <BookOpen className="h-4 w-4" /> : <GraduationCap className="h-4 w-4" />} {t(`landing.${r}`)}
          </button>
        ))}
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-sm font-medium">{label}</Label>
      {children}
    </div>
  );
}


/** A worksheet specimen: the product's real output, marked in red pen. */
function SampleSheet({ className }: { className?: string }) {
  const { t } = useT();
  const rows = [
    { q: t("landing.sampleQ1"), f: "$\\frac{x}{3} + 2 = 5$", a: "x = 9", ok: true },
    { q: t("landing.sampleQ2"), f: "$\\sqrt{49} - 2^{3}$", a: "-2", ok: false, fix: "-1" },
    { q: t("landing.sampleQ3"), f: "$\\frac{6a^{2}}{2a}$", a: "3a", ok: true },
  ];
  return (
    <figure className={cn("max-w-lg", className)} aria-label={t("landing.sample")}>
      <div className="paper-grid paper-margin overflow-hidden rounded-lg border shadow-md">
        <div className="flex items-start justify-between gap-3 border-b border-[hsl(var(--grid-line))] bg-card/80 py-3 pl-12 pr-4 sm:pl-16">
          <p className="pt-1 text-sm font-semibold">{t("landing.sampleTitle")}</p>
          <PenScore score={2} max={3} size="sm" label={t("pen.scoreLabel", { score: 2, max: 3 })} />
        </div>
        <ol className="space-y-0 py-2 pl-12 pr-4 sm:pl-16">
          {rows.map((r, i) => (
            <li key={i} className="flex min-h-[60px] items-center gap-3 text-[15px]">
              <span className="w-5 shrink-0 tabular-nums text-muted-foreground">{i + 1}.</span>
              <span className="min-w-0 flex-1">
                <span className="block text-muted-foreground sm:inline">{r.q}</span>{" "}
                <MathText text={r.f} className="inline-block whitespace-nowrap" />
              </span>
              <span className={cn("relative rounded-sm border bg-card px-2.5 py-1 font-medium tabular-nums", r.ok ? "border-border" : "border-pen/40")}>
                {r.a}
                {!r.ok && <span aria-hidden="true" className="absolute inset-x-1.5 top-1/2 h-[2px] -rotate-6 bg-pen" />}
              </span>
              <PenMark correct={r.ok} label={r.ok ? t("pen.correct") : t("pen.wrong")} />
              {r.fix && <PenRemark className="-ml-1 w-8">{r.fix}</PenRemark>}
              {!r.fix && <span className="-ml-1 w-8" aria-hidden="true" />}
            </li>
          ))}
        </ol>
      </div>
    </figure>
  );
}

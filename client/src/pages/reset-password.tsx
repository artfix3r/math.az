import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { apiRequest } from "@/lib/queryClient";
import { Logo, MathBackdrop } from "@/lib/ui";
import { useT } from "@/lib/i18n";
import { LanguageSwitcher } from "@/pages/shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { CheckCircle2, Loader2, AlertTriangle } from "lucide-react";

// The reset token is carried in the hash route path itself, e.g.
// https://site/#/reset-password/<token>. Using a path segment (not a query
// string) keeps it compatible with wouter's hash router, which treats anything
// after a "?" as part of the unmatched location.
export default function ResetPassword({ token: tokenProp = "" }: { token?: string }) {
  const { t } = useT();
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const [token] = useState<string>(() => {
    try {
      return tokenProp ? decodeURIComponent(tokenProp) : "";
    } catch {
      return tokenProp;
    }
  });
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  // No token in the link -> show an invalid-link state.
  const missingToken = !token;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (password !== confirm) {
      toast({ title: t("reset.mismatchTitle"), description: t("reset.mismatchDesc"), variant: "destructive" });
      return;
    }
    setLoading(true);
    try {
      await apiRequest("POST", "/api/auth/reset-password", { token, password });
      setDone(true);
    } catch (err: any) {
      toast({ title: t("reset.failedTitle"), description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }

  // After success, auto-redirect to the sign-in page shortly.
  useEffect(() => {
    if (!done) return;
    const id = setTimeout(() => navigate("/"), 2500);
    return () => clearTimeout(id);
  }, [done, navigate]);

  return (
    <div className="relative min-h-screen overflow-hidden bg-gradient-to-br from-violet-50 via-background to-pink-50 dark:from-violet-950/30 dark:via-background dark:to-pink-950/20">
      <MathBackdrop />
      <div className="absolute right-4 top-4 z-20">
        <LanguageSwitcher />
      </div>
      <div className="relative mx-auto flex min-h-screen max-w-md items-center px-5 py-10">
        <Card className="w-full border-2 p-6 shadow-xl sm:p-8">
          <div className="mb-6 flex justify-center">
            <Logo className="text-2xl" />
          </div>

          {missingToken ? (
            <div className="text-center" data-testid="reset-invalid">
              <AlertTriangle className="mx-auto mb-3 h-10 w-10 text-amber-500" />
              <h1 className="text-xl font-black">{t("reset.invalidTitle")}</h1>
              <p className="mt-2 text-sm text-muted-foreground">{t("reset.invalidDesc")}</p>
              <Button className="mt-5 w-full font-bold" onClick={() => navigate("/")} data-testid="button-back-signin">
                {t("reset.backToSignin")}
              </Button>
            </div>
          ) : done ? (
            <div className="text-center" data-testid="reset-success">
              <CheckCircle2 className="mx-auto mb-3 h-10 w-10 text-green-500" />
              <h1 className="text-xl font-black">{t("reset.successTitle")}</h1>
              <p className="mt-2 text-sm text-muted-foreground">{t("reset.successDesc")}</p>
              <Button className="mt-5 w-full font-bold" onClick={() => navigate("/")} data-testid="button-go-signin">
                {t("reset.goToSignin")}
              </Button>
            </div>
          ) : (
            <>
              <h1 className="text-center text-xl font-black">{t("reset.title")}</h1>
              <p className="mt-1 text-center text-sm text-muted-foreground">{t("reset.subtitle")}</p>
              <form onSubmit={submit} className="mt-5 space-y-3">
                <div className="space-y-1.5">
                  <Label className="text-sm font-bold">{t("reset.newPassword")}</Label>
                  <Input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    data-testid="input-new-password"
                    required
                  />
                  <p className="text-xs text-muted-foreground">{t("landing.passwordHint")}</p>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-sm font-bold">{t("reset.confirmPassword")}</Label>
                  <Input
                    type="password"
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                    data-testid="input-confirm-password"
                    required
                  />
                </div>
                <Button type="submit" className="w-full font-bold" disabled={loading} data-testid="button-reset-password">
                  {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} {t("reset.submit")}
                </Button>
              </form>
            </>
          )}
        </Card>
      </div>
    </div>
  );
}

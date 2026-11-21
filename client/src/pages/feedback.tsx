import { useState } from "react";
import { Link } from "wouter";
import { apiRequest } from "@/lib/queryClient";
import { Logo } from "@/lib/ui";
import { useT } from "@/lib/i18n";
import { LanguageSwitcher } from "@/pages/shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Loader2, CheckCircle2, Mail, ArrowLeft, MessageSquareHeart } from "lucide-react";

const CONTACT_EMAIL = "yusifimam2019@gmail.com";
type Category = "suggestion" | "bug" | "other";

export default function Feedback() {
  const { t } = useT();
  const { toast } = useToast();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [category, setCategory] = useState<Category>("suggestion");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!message.trim()) return;
    setLoading(true);
    try {
      await apiRequest("POST", "/api/feedback", {
        name: name.trim(),
        email: email.trim(),
        category,
        message: message.trim(),
      });
      setSent(true);
    } catch (err: any) {
      toast({ title: t("fb.error"), description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }

  function reset() {
    setName("");
    setEmail("");
    setCategory("suggestion");
    setMessage("");
    setSent(false);
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-background">
      <div className="absolute right-4 top-4 z-20">
        <LanguageSwitcher />
      </div>

      <div className="relative mx-auto flex min-h-screen max-w-2xl flex-col justify-center px-5 py-12">
        <Link href="/" data-testid="link-back-home" className="mb-6 inline-flex items-center gap-1.5 text-sm font-bold text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> {t("fb.back")}
        </Link>

        <div className="mb-6">
          <Logo className="text-2xl" />
        </div>

        <Card className="border-2 p-6 shadow-xl sm:p-8">
          {sent ? (
            <div className="flex flex-col items-center py-6 text-center" data-testid="feedback-success">
              <CheckCircle2 className="mb-3 h-12 w-12 text-correct" />
              <h2 className="text-xl font-bold">{t("fb.thanks")}</h2>
              <p className="mt-2 max-w-sm text-sm text-muted-foreground">{t("fb.thanksBody")}</p>
              <Button className="mt-6 font-bold" onClick={reset} data-testid="button-send-another">
                {t("fb.sendAnother")}
              </Button>
            </div>
          ) : (
            <>
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <MessageSquareHeart className="h-5 w-5" />
                </span>
                <div>
                  <h1 className="text-xl font-bold leading-tight">{t("fb.title")}</h1>
                </div>
              </div>
              <p className="mt-3 text-sm text-muted-foreground">{t("fb.subtitle")}</p>

              <form onSubmit={handleSubmit} className="mt-6 space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label className="text-sm font-bold">{t("fb.name")}</Label>
                    <Input value={name} onChange={(e) => setName(e.target.value)} placeholder={t("fb.namePlaceholder")} data-testid="input-feedback-name" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-sm font-bold">{t("fb.email")}</Label>
                    <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder={t("fb.emailPlaceholder")} data-testid="input-feedback-email" />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-sm font-bold">{t("fb.category")}</Label>
                  <Select value={category} onValueChange={(v) => setCategory(v as Category)}>
                    <SelectTrigger data-testid="select-feedback-category">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="suggestion" data-testid="category-suggestion">{t("fb.cat.suggestion")}</SelectItem>
                      <SelectItem value="bug" data-testid="category-bug">{t("fb.cat.bug")}</SelectItem>
                      <SelectItem value="other" data-testid="category-other">{t("fb.cat.other")}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-sm font-bold">{t("fb.message")}</Label>
                  <Textarea
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder={t("fb.messagePlaceholder")}
                    rows={5}
                    required
                    data-testid="input-feedback-message"
                  />
                </div>

                <Button type="submit" className="w-full font-bold" disabled={loading || !message.trim()} data-testid="button-submit-feedback">
                  {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {loading ? t("fb.sending") : t("fb.send")}
                </Button>
              </form>
            </>
          )}
        </Card>

        {/* Contact details (#4) */}
        <Card className="mt-4 border-2 p-5">
          <p className="text-sm font-medium text-muted-foreground">{t("fb.contactTitle")}</p>
          <div className="mt-3 flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Mail className="h-4 w-4" />
            </span>
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground">{t("fb.contactEmail")}</p>
              <a
                href={`mailto:${CONTACT_EMAIL}`}
                className="break-all text-sm font-bold text-foreground hover:text-primary"
                data-testid="link-contact-email"
              >
                {CONTACT_EMAIL}
              </a>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}

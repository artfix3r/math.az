import { useEffect, useRef, useState } from "react";
import { useAuth, AuthUser } from "@/lib/auth";
import { apiRequest } from "@/lib/queryClient";
import { useT } from "@/lib/i18n";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";

// Frontend OAuth client id. Must be set as VITE_GOOGLE_CLIENT_ID at build time
// and must match the GOOGLE_CLIENT_ID the server verifies against.
const CLIENT_ID = (import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined) || "";

declare global {
  interface Window {
    google?: any;
  }
}

// Wait for the Google Identity Services script (loaded in index.html) to be ready.
function useGisReady(): boolean {
  const [ready, setReady] = useState<boolean>(() => Boolean(window.google?.accounts?.id));
  useEffect(() => {
    if (ready) return;
    let cancelled = false;
    const start = Date.now();
    const tick = () => {
      if (cancelled) return;
      if (window.google?.accounts?.id) {
        setReady(true);
        return;
      }
      // Give up after ~8s; the button will show a disabled fallback.
      if (Date.now() - start > 8000) return;
      setTimeout(tick, 120);
    };
    tick();
    return () => {
      cancelled = true;
    };
  }, [ready]);
  return ready;
}

/**
 * Renders Google's official "Sign in with Google" button. On success it verifies
 * the ID token with the backend, then calls `onSuccess` with the authenticated
 * user. `role` is only applied when the Google account signs in for the first time.
 */
export function GoogleSignInButton({
  role,
  teacherCode,
  onSuccess,
}: {
  role: "teacher" | "student";
  teacherCode?: string;
  onSuccess: (u: AuthUser) => void;
}) {
  const { t } = useT();
  const { toast } = useToast();
  const ready = useGisReady();
  const containerRef = useRef<HTMLDivElement>(null);
  const [submitting, setSubmitting] = useState(false);
  // Keep the latest role/handlers in refs so the GIS callback (registered once)
  // always reads current values.
  const roleRef = useRef(role);
  roleRef.current = role;
  const teacherCodeRef = useRef(teacherCode);
  teacherCodeRef.current = teacherCode;
  const onSuccessRef = useRef(onSuccess);
  onSuccessRef.current = onSuccess;

  useEffect(() => {
    if (!ready || !CLIENT_ID || !containerRef.current) return;
    const handleCredential = async (response: { credential?: string }) => {
      if (!response?.credential) return;
      setSubmitting(true);
      try {
        const res = await apiRequest("POST", "/api/auth/google", {
          credential: response.credential,
          role: roleRef.current,
          ...(roleRef.current === "teacher" && teacherCodeRef.current
            ? { teacherCode: teacherCodeRef.current }
            : {}),
        });
        const user = (await res.json()) as AuthUser;
        onSuccessRef.current(user);
      } catch (err: any) {
        toast({ title: t("landing.googleFailed"), description: err.message, variant: "destructive" });
      } finally {
        setSubmitting(false);
      }
    };

    try {
      window.google.accounts.id.initialize({
        client_id: CLIENT_ID,
        callback: handleCredential,
      });
      containerRef.current.innerHTML = "";
      window.google.accounts.id.renderButton(containerRef.current, {
        theme: "outline",
        size: "large",
        width: 320,
        text: "continue_with",
        shape: "pill",
        logo_alignment: "center",
      });
    } catch {
      // Rendering can fail if the script is partially loaded; the fallback below covers it.
    }
  }, [ready]);

  // No client id configured at build time — show a clear, non-blocking hint.
  if (!CLIENT_ID) {
    return (
      <div
        className="flex w-full items-center justify-center rounded-full border-2 border-dashed border-border px-4 py-2.5 text-center text-xs text-muted-foreground"
        data-testid="google-unconfigured"
      >
        {t("landing.googleUnconfigured")}
      </div>
    );
  }

  return (
    <div className="relative flex w-full flex-col items-center">
      {/* GIS renders its own button into this container */}
      <div
        ref={containerRef}
        className="flex w-full justify-center [color-scheme:light]"
        data-testid="button-google"
      />
      {!ready && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Loader2 className="h-3.5 w-3.5 animate-spin" /> {t("landing.googleLoading")}
        </div>
      )}
      {submitting && (
        <div className="absolute inset-0 flex items-center justify-center rounded-full bg-background/70 backdrop-blur-sm">
          <Loader2 className="h-4 w-4 animate-spin text-primary" />
        </div>
      )}
    </div>
  );
}

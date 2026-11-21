import { Link, useLocation } from "wouter";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import { Logo, colorOf } from "@/lib/ui";
import { useT, LANGUAGES, Lang } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import {
  Home, Users, FileQuestion, Library, BarChart3, Video, Trophy, LogOut, Moon, Sun,
  Globe, MessageSquareHeart, FolderOpen, TrendingUp, MoreHorizontal, Check,
} from "lucide-react";

type NavItem = { href: string; key: string; icon: React.ElementType };

const TEACHER_NAV: NavItem[] = [
  { href: "/dashboard", key: "nav.home", icon: Home },
  { href: "/groups", key: "nav.groups", icon: Users },
  { href: "/quizzes", key: "nav.quizzes", icon: FileQuestion },
  { href: "/analytics", key: "nav.analytics", icon: BarChart3 },
  { href: "/library", key: "nav.library", icon: Library },
  { href: "/materials", key: "nav.materials", icon: FolderOpen },
  { href: "/sessions", key: "nav.sessions", icon: Video },
  { href: "/feedback", key: "nav.feedback", icon: MessageSquareHeart },
];

const STUDENT_NAV: NavItem[] = [
  { href: "/dashboard", key: "nav.home", icon: Home },
  { href: "/quizzes", key: "nav.quizzes", icon: FileQuestion },
  { href: "/progress", key: "nav.progress", icon: TrendingUp },
  { href: "/materials", key: "nav.materials", icon: FolderOpen },
  { href: "/results", key: "nav.results", icon: Trophy },
  { href: "/sessions", key: "nav.sessions", icon: Video },
  { href: "/feedback", key: "nav.feedback", icon: MessageSquareHeart },
];

/** How many items fit in the phone tab bar before "More". */
const TABS = 4;

export function LanguageSwitcher({ className }: { className?: string }) {
  const { lang, setLang, t } = useT();
  const cur = LANGUAGES.find((l) => l.code === lang) ?? LANGUAGES[0];
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className={cn("gap-1.5 px-2.5", className)} aria-label={t("common.language")} data-testid="button-language">
          <Globe className="h-4 w-4" />
          <span className="uppercase">{cur.code}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-40">
        {LANGUAGES.map((l) => (
          <DropdownMenuItem
            key={l.code}
            onClick={() => setLang(l.code as Lang)}
            className="gap-3"
            data-testid={`language-${l.code}`}
          >
            <span className="w-6 text-xs font-semibold uppercase text-muted-foreground">{l.code}</span>
            <span className="flex-1">{l.label}</span>
            {l.code === lang && <Check className="h-4 w-4 text-primary" />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function useTheme() {
  const [dark, setDark] = useState(() => document.documentElement.classList.contains("dark"));
  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
    const meta = document.querySelector('meta[name="theme-color"]');
    meta?.setAttribute("content", dark ? "#0D121D" : "#EEF1F6");
    try { localStorage.setItem("mathaz-theme", dark ? "dark" : "light"); } catch { /* storage unavailable */ }
  }, [dark]);
  return { dark, toggle: () => setDark((d) => !d) };
}

export function ThemeToggle({ className }: { className?: string }) {
  const { toggle } = useTheme();
  return (
    <Button variant="ghost" size="icon" onClick={toggle} aria-label="Toggle theme" data-testid="button-theme" className={className}>
      <Sun className="h-[18px] w-[18px] dark:hidden" />
      <Moon className="hidden h-[18px] w-[18px] dark:block" />
    </Button>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuth();
  const { t } = useT();
  const [location, navigate] = useLocation();
  const [moreOpen, setMoreOpen] = useState(false);
  const nav = user?.role === "teacher" ? TEACHER_NAV : STUDENT_NAV;
  const tabs = nav.slice(0, TABS);
  const overflow = nav.slice(TABS);
  const c = colorOf(user?.avatarColor);

  const isActive = (href: string) =>
    location === href || (href !== "/dashboard" && location.startsWith(href));
  const overflowActive = overflow.some((i) => isActive(i.href));

  const signOut = () => { logout(); navigate("/"); };

  const Avatar = ({ size = "h-9 w-9" }: { size?: string }) => (
    <span className={cn("flex shrink-0 items-center justify-center rounded-full text-sm font-semibold", size, c.bg, c.text)}>
      {user?.fullName?.[0]?.toUpperCase()}
    </span>
  );

  return (
    <div className="min-h-screen bg-background">
      {/* Desktop: the notebook's ink-blue cover */}
      <aside className="fixed inset-y-0 left-0 hidden w-60 flex-col bg-sidebar text-sidebar-foreground lg:flex">
        <div className="px-5 pb-6 pt-6">
          <Link href="/dashboard" aria-label="math.az"><Logo inverted className="text-[17px]" /></Link>
        </div>
        <nav className="flex flex-col gap-0.5 px-3" aria-label="Main">
          {nav.map((item) => {
            const active = isActive(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                data-testid={`nav-${item.href.slice(1)}`}
                className={cn(
                  "flex min-h-10 items-center gap-3 rounded-md px-3 text-sm font-medium transition-colors",
                  active
                    ? "bg-card text-primary shadow-sm"
                    : "text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-white",
                )}
              >
                <item.icon className="h-[18px] w-[18px]" strokeWidth={active ? 2.2 : 1.8} />
                {t(item.key)}
              </Link>
            );
          })}
        </nav>
        <div className="mt-auto border-t border-sidebar-border p-3">
          <div className="flex items-center gap-3 px-2 py-2">
            <Avatar />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-white" data-testid="text-username">{user?.fullName}</p>
              <p className="truncate text-xs text-sidebar-foreground/70">{t(`common.role_${user?.role}`)}</p>
            </div>
          </div>
          <button
            onClick={signOut}
            data-testid="button-logout"
            className="mt-1 flex min-h-10 w-full items-center gap-3 rounded-md px-3 text-sm font-medium text-sidebar-foreground/80 transition-colors hover:bg-sidebar-accent hover:text-white"
          >
            <LogOut className="h-4 w-4" /> {t("nav.signout")}
          </button>
        </div>
      </aside>

      <div className="lg:pl-60">
        <header className="sticky top-0 z-30 flex h-14 items-center gap-1 border-b bg-background/90 px-3 backdrop-blur-sm supports-[backdrop-filter]:bg-background/75 lg:h-16 lg:px-8">
          <Link href="/dashboard" className="lg:hidden" aria-label="math.az"><Logo className="text-[16px]" /></Link>
          <div className="flex-1" />
          <LanguageSwitcher />
          <ThemeToggle />
        </header>
        <main key={location} className="page-in mx-auto max-w-5xl px-4 pb-28 pt-5 sm:px-6 lg:px-8 lg:pb-12 lg:pt-8">{children}</main>
      </div>

      {/* Phone: fixed tab bar */}
      <nav
        aria-label="Main"
        className="fixed inset-x-0 bottom-0 z-40 border-t bg-card/95 backdrop-blur-sm lg:hidden"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        <ul className="mx-auto grid max-w-md grid-cols-5">
          {tabs.map((item) => {
            const active = isActive(item.href);
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  data-testid={`tab-${item.href.slice(1)}`}
                  className={cn(
                    "flex h-16 flex-col items-center justify-center gap-1 text-[11px] font-medium leading-none",
                    active ? "text-primary" : "text-muted-foreground",
                  )}
                >
                  <item.icon className="h-[22px] w-[22px]" strokeWidth={active ? 2.3 : 1.8} />
                  <span className="max-w-full truncate px-1">{t(item.key)}</span>
                </Link>
              </li>
            );
          })}
          <li>
            <button
              onClick={() => setMoreOpen(true)}
              data-testid="button-menu"
              className={cn(
                "flex h-16 w-full flex-col items-center justify-center gap-1 text-[11px] font-medium leading-none",
                overflowActive ? "text-primary" : "text-muted-foreground",
              )}
            >
              <MoreHorizontal className="h-[22px] w-[22px]" strokeWidth={overflowActive ? 2.3 : 1.8} />
              {t("nav.more")}
            </button>
          </li>
        </ul>
      </nav>

      <Sheet open={moreOpen} onOpenChange={setMoreOpen}>
        <SheetContent side="bottom" className="rounded-t-lg px-3 pb-[max(1rem,env(safe-area-inset-bottom))] pt-4 lg:hidden">
          <SheetHeader className="px-3 pb-2 text-left">
            <SheetTitle className="flex items-center gap-3 text-base">
              <Avatar size="h-10 w-10" />
              <span className="min-w-0">
                <span className="block truncate">{user?.fullName}</span>
                <span className="block text-xs font-normal text-muted-foreground">{t(`common.role_${user?.role}`)}</span>
              </span>
            </SheetTitle>
          </SheetHeader>
          <ul className="flex flex-col">
            {overflow.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  onClick={() => setMoreOpen(false)}
                  data-testid={`nav-${item.href.slice(1)}`}
                  className={cn(
                    "flex min-h-12 items-center gap-3 rounded-md px-3 text-[15px] font-medium",
                    isActive(item.href) ? "bg-secondary text-primary" : "hover:bg-muted",
                  )}
                >
                  <item.icon className="h-5 w-5" /> {t(item.key)}
                </Link>
              </li>
            ))}
            <li className="mt-2 border-t pt-2">
              <button onClick={signOut} data-testid="button-logout-mobile" className="flex min-h-12 w-full items-center gap-3 rounded-md px-3 text-[15px] font-medium text-muted-foreground hover:bg-muted">
                <LogOut className="h-5 w-5" /> {t("nav.signout")}
              </button>
            </li>
          </ul>
        </SheetContent>
      </Sheet>
    </div>
  );
}

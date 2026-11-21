import { Link, useLocation } from "wouter";
import { useState } from "react";
import { useAuth } from "@/lib/auth";
import { Logo, colorOf } from "@/lib/ui";
import { useT, LANGUAGES, Lang } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  LayoutDashboard, Users, FileQuestion, Library, BarChart3,
  Video, Trophy, LogOut, Moon, Sun, Menu, Globe, MessageSquareHeart, FolderOpen, TrendingUp } from "lucide-react";

type NavItem = { href: string; key: string; icon: React.ElementType };

const TEACHER_NAV: NavItem[] = [
  { href: "/dashboard", key: "nav.dashboard", icon: LayoutDashboard },
  { href: "/groups", key: "nav.groups", icon: Users },
  { href: "/quizzes", key: "nav.quizzes", icon: FileQuestion },
  { href: "/library", key: "nav.library", icon: Library },
  { href: "/materials", key: "nav.materials", icon: FolderOpen },
  { href: "/analytics", key: "nav.analytics", icon: BarChart3 },
  { href: "/sessions", key: "nav.sessions", icon: Video },
  { href: "/feedback", key: "nav.feedback", icon: MessageSquareHeart },
];

const STUDENT_NAV: NavItem[] = [
  { href: "/dashboard", key: "nav.dashboard", icon: LayoutDashboard },
  { href: "/quizzes", key: "nav.quizzes", icon: FileQuestion },
  { href: "/materials", key: "nav.materials", icon: FolderOpen },
  { href: "/sessions", key: "nav.sessions", icon: Video },
  { href: "/results", key: "nav.results", icon: Trophy },
  { href: "/progress", key: "nav.progress", icon: TrendingUp },
  { href: "/feedback", key: "nav.feedback", icon: MessageSquareHeart },
];

export function LanguageSwitcher() {
  const { lang, setLang, t } = useT();
  const cur = LANGUAGES.find((l) => l.code === lang) ?? LANGUAGES[0];
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="gap-2 font-bold" aria-label={t("common.language")} data-testid="button-language">
          <Globe className="h-4 w-4" />
          <span className="hidden sm:inline">{cur.flag} {cur.label}</span>
          <span className="sm:hidden">{cur.flag}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {LANGUAGES.map((l) => (
          <DropdownMenuItem
            key={l.code}
            onClick={() => setLang(l.code as Lang)}
            className={cn("gap-2 font-bold", l.code === lang && "bg-primary/10 text-primary")}
            data-testid={`language-${l.code}`}
          >
            <span>{l.flag}</span> {l.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuth();
  const { t } = useT();
  const [, navigate] = useLocation();
  const [location] = useLocation();
  const [open, setOpen] = useState(false);
  const nav = user?.role === "teacher" ? TEACHER_NAV : STUDENT_NAV;
  const c = colorOf(user?.avatarColor);

  const toggleDark = () =>
    document.documentElement.classList.toggle("dark");

  const isActive = (href: string) =>
    location === href || (href !== "/dashboard" && location.startsWith(href));

  const SidebarBody = (
    <div className="flex h-full flex-col gap-1 p-3">
      <div className="px-2 py-3">
        <Logo className="text-lg" />
      </div>
      <nav className="mt-2 flex flex-col gap-1" role="list">
        {nav.map((item) => {
          const Active = isActive(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setOpen(false)}
              data-testid={`nav-${item.href.slice(1)}`}
              className={cn(
                "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-bold transition-colors",
                Active
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover-elevate",
              )}
            >
              <item.icon className="h-[18px] w-[18px]" />
              {t(item.key)}
            </Link>
          );
        })}
      </nav>
      <div className="mt-auto rounded-xl border bg-card p-3">
        <div className="flex items-center gap-3">
          <div className={cn("flex h-10 w-10 items-center justify-center rounded-full font-extrabold ring-2", c.bg, c.text, c.ring)}>
            {user?.fullName?.[0]?.toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-bold" data-testid="text-username">{user?.fullName}</p>
            <p className="truncate text-xs capitalize text-muted-foreground">{t(`common.role_${user?.role}`)}</p>
          </div>
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="mt-2 w-full justify-start gap-2 text-muted-foreground"
          onClick={() => { logout(); navigate("/"); }}
          data-testid="button-logout"
        >
          <LogOut className="h-4 w-4" /> {t("nav.signout")}
        </Button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-background">
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 hidden w-64 border-r bg-sidebar lg:block">
        {SidebarBody}
      </aside>

      {/* Mobile drawer */}
      {open && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/40" onClick={() => setOpen(false)} />
          <div className="absolute inset-y-0 left-0 w-64 border-r bg-sidebar">{SidebarBody}</div>
        </div>
      )}

      <div className="lg:pl-64">
        <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b bg-background/80 px-4 backdrop-blur lg:px-8">
          <Button variant="ghost" size="icon" className="lg:hidden" onClick={() => setOpen(true)} data-testid="button-menu">
            <Menu className="h-5 w-5" />
          </Button>
          <div className="flex-1" />
          <LanguageSwitcher />
          <Button variant="ghost" size="icon" onClick={toggleDark} aria-label="Toggle theme" data-testid="button-theme">
            <Sun className="h-5 w-5 dark:hidden" />
            <Moon className="hidden h-5 w-5 dark:block" />
          </Button>
        </header>
        <main className="mx-auto max-w-6xl px-4 py-6 lg:px-8 lg:py-8">{children}</main>
      </div>
    </div>
  );
}

import { Switch, Route, Router, useLocation } from "wouter";
import { useHashLocation } from "wouter/use-hash-location";
import { useEffect } from "react";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "./lib/auth";
import { LanguageProvider } from "./lib/i18n";
import NotFound from "@/pages/not-found";
import Landing from "@/pages/landing";
import Dashboard from "@/pages/dashboard";
import Groups from "@/pages/groups";
import GroupDetail from "@/pages/group-detail";
import Quizzes from "@/pages/quizzes";
import QuizBuilder from "@/pages/quiz-builder";
import QuizResults from "@/pages/quiz-results";
import Library from "@/pages/library";
import Materials from "@/pages/materials";
import Analytics from "@/pages/analytics";
import Sessions from "@/pages/sessions";
import TakeQuiz from "@/pages/take-quiz";
import MyResults from "@/pages/my-results";
import Feedback from "@/pages/feedback";
import ResetPassword from "@/pages/reset-password";
import { AppShell } from "@/pages/shell";
import PrintQuiz from "@/pages/print-quiz";
import { MyProgress, StudentProgress } from "@/pages/progress";
import { Loader2 } from "lucide-react";

function ThemeInit() {
  useEffect(() => {
    const dark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    document.documentElement.classList.toggle("dark", dark);
  }, []);
  return null;
}

function Protected({ children, bare = false }: { children: React.ReactNode; bare?: boolean }) {
  const { user, loading } = useAuth();
  const [, navigate] = useLocation();
  useEffect(() => {
    // Wait until session restoration finishes before redirecting, so a page
    // refresh on a protected route does not bounce the user to the login page.
    if (!loading && !user) navigate("/");
  }, [user, loading, navigate]);
  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }
  if (!user) return null;
  return bare ? <>{children}</> : <AppShell>{children}</AppShell>;
}

function AppRouter() {
  return (
    <Switch>
      <Route path="/" component={Landing} />
      <Route path="/dashboard">{() => <Protected><Dashboard /></Protected>}</Route>
      <Route path="/groups">{() => <Protected><Groups /></Protected>}</Route>
      <Route path="/groups/:id">{(p) => <Protected><GroupDetail id={Number(p.id)} /></Protected>}</Route>
      <Route path="/quizzes">{() => <Protected><Quizzes /></Protected>}</Route>
      <Route path="/quizzes/new">{() => <Protected><QuizBuilder /></Protected>}</Route>
      <Route path="/quizzes/:id/edit">{(p) => <Protected><QuizBuilder id={Number(p.id)} /></Protected>}</Route>
      <Route path="/quizzes/:id/results">{(p) => <Protected><QuizResults id={Number(p.id)} /></Protected>}</Route>
      <Route path="/quizzes/:id/print">{(p) => <Protected bare><PrintQuiz id={Number(p.id)} /></Protected>}</Route>
      <Route path="/quizzes/:id/take">{(p) => <Protected><TakeQuiz id={Number(p.id)} /></Protected>}</Route>
      <Route path="/library">{() => <Protected><Library /></Protected>}</Route>
      <Route path="/materials">{() => <Protected><Materials /></Protected>}</Route>
      <Route path="/analytics">{() => <Protected><Analytics /></Protected>}</Route>
      <Route path="/sessions">{() => <Protected><Sessions /></Protected>}</Route>
      <Route path="/progress">{() => <Protected><MyProgress /></Protected>}</Route>
      <Route path="/students/:id/progress">{(p) => <Protected><StudentProgress id={Number(p.id)} /></Protected>}</Route>
      <Route path="/results">{() => <Protected><MyResults /></Protected>}</Route>
      <Route path="/feedback" component={Feedback} />
      <Route path="/reset-password/:token">{(p) => <ResetPassword token={p.token} />}</Route>
      <Route path="/reset-password">{() => <ResetPassword token="" />}</Route>
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <LanguageProvider>
        <AuthProvider>
          <TooltipProvider>
            <ThemeInit />
            <Toaster />
            <Router hook={useHashLocation}>
              <AppRouter />
            </Router>
          </TooltipProvider>
        </AuthProvider>
      </LanguageProvider>
    </QueryClientProvider>
  );
}

export default App;

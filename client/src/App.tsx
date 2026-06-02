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
import { AppShell } from "@/pages/shell";
import { Loader2 } from "lucide-react";

function ThemeInit() {
  useEffect(() => {
    const dark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    document.documentElement.classList.toggle("dark", dark);
  }, []);
  return null;
}

function Protected({ children }: { children: React.ReactNode }) {
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
  return <AppShell>{children}</AppShell>;
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
      <Route path="/quizzes/:id/take">{(p) => <Protected><TakeQuiz id={Number(p.id)} /></Protected>}</Route>
      <Route path="/library">{() => <Protected><Library /></Protected>}</Route>
      <Route path="/materials">{() => <Protected><Materials /></Protected>}</Route>
      <Route path="/analytics">{() => <Protected><Analytics /></Protected>}</Route>
      <Route path="/sessions">{() => <Protected><Sessions /></Protected>}</Route>
      <Route path="/results">{() => <Protected><MyResults /></Protected>}</Route>
      <Route path="/feedback" component={Feedback} />
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

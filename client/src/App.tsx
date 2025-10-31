import { Switch, Route, Redirect } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { ThemeProvider } from "@/contexts/ThemeProvider";
import { ChatProvider } from "@/contexts/ChatContext";
import { ThemeToggle } from "@/components/ThemeToggle";
import { AppSidebar } from "@/components/AppSidebar";
import { NotificationProvider } from "@/contexts/NotificationContext";
import { NotificationBell } from "@/components/NotificationBell";
import Home from "@/pages/Home";
import Login from "@/pages/Login";
import Chat from "@/pages/Chat";
import Tasks from "@/pages/Tasks";
import Personalization from "@/pages/Personalization";
import Settings from "@/pages/Settings";
import Website from "@/pages/Website";
import NotFound from "@/pages/not-found";

function ProtectedRoute({ component: Component }: { component: React.ComponentType }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin h-8 w-8 border-2 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!user) {
    return <Redirect to="/login" />;
  }

  return <Component />;
}

function Router() {
  return (
    <Switch>
      <Route path="/login" component={Login} />
      <Route path="/">
        <ProtectedRoute component={Home} />
      </Route>
      <Route path="/chat">
        <ProtectedRoute component={Chat} />
      </Route>
      <Route path="/tasks">
        <ProtectedRoute component={Tasks} />
      </Route>
      <Route path="/personalization">
        <ProtectedRoute component={Personalization} />
      </Route>
      <Route path="/settings">
        <ProtectedRoute component={Settings} />
      </Route>
      <Route path="/website">
        <ProtectedRoute component={Website} />
      </Route>
      <Route component={NotFound} />
    </Switch>
  );
}

function AppContent() {
  const { user, loading } = useAuth();
  const style = {
    "--sidebar-width": "16rem",
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin h-8 w-8 border-2 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!user) {
    return <Router />;
  }

  return (
    <NotificationProvider>
      <SidebarProvider style={style as React.CSSProperties}>
        <div className="flex h-screen w-full">
          <AppSidebar />
          <div className="flex flex-col flex-1">
            <header className="flex items-center justify-between gap-2 p-2 border-b">
              <SidebarTrigger data-testid="button-sidebar-toggle" />
              <SidebarTrigger data-testid="button-sidebar-toggle" />
              <NotificationBell />
              <ThemeToggle />
            </header>
            <main className="flex-1 overflow-hidden">
              <Router />
            </main>
          </div>
        </div>
      </SidebarProvider>
      <Toaster />
    </NotificationProvider>
  );
}



export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <ThemeProvider>
          <AuthProvider>
            <ChatProvider>
              <AppContent />
            </ChatProvider>
          </AuthProvider>
        </ThemeProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { MessageSquare, CheckSquare, Sparkles, ArrowRight } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { Link } from "wouter";

export default function Home() {
  const { user } = useAuth();

  const quickActions = [
    {
      title: "Start Chat",
      description: "Talk with your AI assistant",
      icon: MessageSquare,
      href: "/chat",
      color: "text-chart-1",
    },
    {
      title: "View Tasks",
      description: "Manage your daily tasks",
      icon: CheckSquare,
      href: "/tasks",
      color: "text-chart-3",
    },
  ];

  return (
    <div className="h-full overflow-auto">
      <div className="max-w-5xl mx-auto p-6 space-y-8">
        <div className="space-y-2">
          <h1 className="text-3xl font-semibold" data-testid="text-greeting">
            Welcome back, {user?.displayName?.split(" ")[0] || "there"}
          </h1>
          <p className="text-muted-foreground">
            Your personal AI assistant is ready to help you stay organized and productive.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {quickActions.map((action) => (
            <Link key={action.href} href={action.href}>
              <Card className="p-6 hover-elevate cursor-pointer transition-all" data-testid={`card-${action.title.toLowerCase().replace(" ", "-")}`}>
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-2">
                    <div className={`h-10 w-10 rounded-lg bg-muted flex items-center justify-center ${action.color}`}>
                      <action.icon className="h-5 w-5" />
                    </div>
                    <h3 className="text-lg font-medium">{action.title}</h3>
                    <p className="text-sm text-muted-foreground">
                      {action.description}
                    </p>
                  </div>
                  <ArrowRight className="h-5 w-5 text-muted-foreground shrink-0" />
                </div>
              </Card>
            </Link>
          ))}
        </div>

        <Card className="p-6">
          <div className="flex items-center gap-3 mb-4">
            <Sparkles className="h-5 w-5 text-primary" />
            <h2 className="text-xl font-semibold">About Coolie</h2>
          </div>
          <p className="text-muted-foreground leading-relaxed">
            Coolie is your intelligent personal assistant with context retention. 
            It helps you manage conversations, organize tasks from Gmail and WhatsApp, 
            and remembers your preferences to provide personalized assistance.
          </p>
          <div className="mt-6 flex gap-3">
            <Link href="/personalization">
              <Button variant="outline" data-testid="button-personalize">
                Personalize Assistant
              </Button>
            </Link>
            <Link href="/settings">
              <Button variant="outline" data-testid="button-settings">
                Settings
              </Button>
            </Link>
          </div>
        </Card>
      </div>
    </div>
  );
}

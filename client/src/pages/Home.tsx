import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { MessageSquare, CheckSquare, Sparkles, ArrowRight, Zap, Shield, Clock } from "lucide-react";
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
      gradient: "from-chart-1 to-chart-2",
      iconBg: "bg-gradient-to-br from-chart-1/20 to-chart-2/20",
      iconColor: "text-chart-1",
    },
    {
      title: "View Tasks",
      description: "Manage your daily tasks",
      icon: CheckSquare,
      href: "/tasks",
      gradient: "from-chart-3 to-chart-4",
      iconBg: "bg-gradient-to-br from-chart-3/20 to-chart-4/20",
      iconColor: "text-chart-3",
    },
  ];

  const features = [
    {
      icon: Zap,
      title: "Lightning Fast",
      description: "Get instant responses and real-time task updates",
      gradient: "from-chart-1/10 to-chart-1/5",
    },
    {
      icon: Shield,
      title: "Secure & Private",
      description: "Your data is encrypted and always protected",
      gradient: "from-chart-3/10 to-chart-3/5",
    },
    {
      icon: Clock,
      title: "Context Retention",
      description: "Remembers your preferences and conversation history",
      gradient: "from-chart-2/10 to-chart-2/5",
    },
  ];

  return (
    <div className="h-full overflow-auto bg-gradient-to-br from-background via-primary/5 to-chart-2/5">
      <div className="max-w-6xl mx-auto p-6 space-y-12">
        <div className="space-y-6 text-center py-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/20 text-primary text-sm font-medium mb-2 animate-in zoom-in duration-500 delay-150">
            <Sparkles className="h-4 w-4 animate-pulse" />
            <span>AI-Powered Personal Assistant</span>
          </div>
          
          <h1 className="text-5xl md:text-6xl font-bold bg-gradient-to-r from-primary via-chart-2 to-primary bg-clip-text text-transparent animate-in fade-in slide-in-from-top-4 duration-700 delay-200" data-testid="text-greeting">
            Welcome back, {user?.displayName?.split(" ")[0] || "there"}
          </h1>
          
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto animate-in fade-in duration-700 delay-300">
            Your personal AI assistant is ready to help you stay organized and productive. Experience the power of context-aware conversations.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-in fade-in slide-in-from-bottom-4 duration-700 delay-400">
          {quickActions.map((action, index) => (
            <Link key={action.href} href={action.href}>
              <Card className="group relative p-8 hover-elevate cursor-pointer transition-all duration-500 hover:shadow-2xl hover:scale-[1.02] border-2 overflow-hidden" 
                    data-testid={`card-${action.title.toLowerCase().replace(" ", "-")}`}
                    style={{ animationDelay: `${450 + index * 100}ms` }}>
                <div className={`absolute inset-0 bg-gradient-to-br ${action.gradient} opacity-0 group-hover:opacity-5 transition-opacity duration-500`} />
                <div className={`absolute -top-10 -right-10 w-40 h-40 bg-gradient-to-br ${action.gradient} opacity-10 rounded-full blur-2xl group-hover:opacity-20 transition-opacity duration-500`} />
                
                <div className="relative flex items-start justify-between gap-4">
                  <div className="space-y-4 flex-1">
                    <div className={`h-14 w-14 rounded-2xl ${action.iconBg} flex items-center justify-center ${action.iconColor} group-hover:scale-110 transition-transform duration-300 shadow-lg`}>
                      <action.icon className="h-7 w-7" />
                    </div>
                    <div>
                      <h3 className="text-2xl font-semibold mb-2 group-hover:text-primary transition-colors duration-300">{action.title}</h3>
                      <p className="text-muted-foreground">
                        {action.description}
                      </p>
                    </div>
                  </div>
                  <ArrowRight className="h-6 w-6 text-muted-foreground group-hover:text-primary group-hover:translate-x-1 transition-all duration-300 shrink-0" />
                </div>
              </Card>
            </Link>
          ))}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 animate-in fade-in slide-in-from-bottom-4 duration-700 delay-600">
          {features.map((feature, index) => (
            <Card key={feature.title} className="p-6 hover-elevate transition-all duration-300 hover:shadow-lg border" 
                  style={{ animationDelay: `${650 + index * 100}ms` }}>
              <div className={`absolute inset-0 bg-gradient-to-br ${feature.gradient} rounded-lg`} />
              <div className="relative">
                <feature.icon className="h-10 w-10 text-primary mb-4" />
                <h3 className="font-semibold text-lg mb-2">{feature.title}</h3>
                <p className="text-sm text-muted-foreground">{feature.description}</p>
              </div>
            </Card>
          ))}
        </div>

        <Card className="p-8 relative overflow-hidden border-2 hover-elevate transition-all duration-500 animate-in fade-in slide-in-from-bottom-4 duration-700 delay-800">
          <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-chart-2/5" />
          <div className="absolute -bottom-10 -left-10 w-60 h-60 bg-primary/10 rounded-full blur-3xl" />
          <div className="absolute -top-10 -right-10 w-60 h-60 bg-chart-2/10 rounded-full blur-3xl" />
          
          <div className="relative">
            <div className="flex items-center gap-3 mb-4">
              <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-primary to-chart-2 flex items-center justify-center shadow-lg">
                <Sparkles className="h-6 w-6 text-primary-foreground" />
              </div>
              <h2 className="text-2xl font-bold">About Coolie</h2>
            </div>
            <p className="text-muted-foreground leading-relaxed mb-6">
              Coolie is your intelligent personal assistant with context retention. 
              It helps you manage conversations, organize tasks from Gmail and WhatsApp, 
              and remembers your preferences to provide personalized assistance.
            </p>
            <div className="flex gap-3 flex-wrap">
              <Link href="/personalization">
                <Button variant="default" className="bg-gradient-to-r from-primary to-chart-2 hover:shadow-lg hover:shadow-primary/30 transition-all duration-300" data-testid="button-personalize">
                  <Sparkles className="h-4 w-4 mr-2" />
                  Personalize Assistant
                </Button>
              </Link>
              <Link href="/settings">
                <Button variant="outline" className="hover:border-primary/50 transition-all duration-300" data-testid="button-settings">
                  Settings
                </Button>
              </Link>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}

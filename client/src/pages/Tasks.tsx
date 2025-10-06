import { useState } from "react";
import { TaskCard } from "@/components/TaskCard";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Mail, MessageCircle, AlertCircle, CheckCircle2 } from "lucide-react";
import type { Task } from "@shared/schema";

export default function Tasks() {
  const [filter, setFilter] = useState<"all" | "gmail" | "whatsapp" | "reminder">("all");
  
  const [tasks, setTasks] = useState<Task[]>([
    {
      id: "1",
      title: "Review project proposal from client",
      description: "Check the attached documents and provide feedback by EOD",
      type: "gmail",
      priority: "high",
      completed: false,
      dueDate: new Date(Date.now() + 86400000),
      createdAt: new Date(),
    },
    {
      id: "2",
      title: "Follow up with Sarah about meeting",
      type: "whatsapp",
      priority: "medium",
      completed: false,
      createdAt: new Date(),
    },
    {
      id: "3",
      title: "Team standup at 10 AM",
      description: "Daily sync with the development team",
      type: "reminder",
      priority: "low",
      completed: false,
      dueDate: new Date(Date.now() + 3600000),
      createdAt: new Date(),
    },
    {
      id: "4",
      title: "Submit monthly report",
      description: "Compile data from last month",
      type: "reminder",
      priority: "low",
      completed: true,
      createdAt: new Date(Date.now() - 86400000),
    },
    {
      id: "5",
      title: "Reply to customer inquiry",
      description: "Answer questions about the new features",
      type: "gmail",
      priority: "medium",
      completed: false,
      createdAt: new Date(),
    },
  ]);

  const handleToggle = (id: string) => {
    setTasks((prev) =>
      prev.map((task) =>
        task.id === id ? { ...task, completed: !task.completed } : task
      )
    );
  };

  const handleDelete = (id: string) => {
    setTasks((prev) => prev.filter((task) => task.id !== id));
  };

  const filteredTasks = tasks.filter((task) => {
    if (filter === "all") return true;
    return task.type === filter;
  });

  const activeTasks = filteredTasks.filter((t) => !t.completed);
  const completedTasks = filteredTasks.filter((t) => t.completed);

  const stats = [
    {
      label: "Active Tasks",
      value: activeTasks.length,
      icon: AlertCircle,
      gradient: "from-chart-1/20 to-chart-1/10",
      iconColor: "text-chart-1",
    },
    {
      label: "Completed",
      value: completedTasks.length,
      icon: CheckCircle2,
      gradient: "from-chart-3/20 to-chart-3/10",
      iconColor: "text-chart-3",
    },
    {
      label: "Gmail",
      value: tasks.filter((t) => t.type === "gmail").length,
      icon: Mail,
      gradient: "from-chart-2/20 to-chart-2/10",
      iconColor: "text-chart-2",
    },
    {
      label: "WhatsApp",
      value: tasks.filter((t) => t.type === "whatsapp").length,
      icon: MessageCircle,
      gradient: "from-chart-4/20 to-chart-4/10",
      iconColor: "text-chart-4",
    },
  ];

  return (
    <div className="h-full overflow-auto bg-gradient-to-br from-background via-chart-3/5 to-chart-4/5 relative">
      <div className="absolute inset-0 bg-grid-pattern opacity-5 pointer-events-none" />
      
      <div className="max-w-6xl mx-auto p-6 space-y-8 relative z-10">
        <div className="flex items-center justify-between gap-4 flex-wrap animate-in fade-in slide-in-from-top-4 duration-700">
          <div>
            <h1 className="text-4xl font-bold bg-gradient-to-r from-chart-3 via-chart-4 to-chart-3 bg-clip-text text-transparent mb-2" data-testid="text-page-title">
              Tasks Dashboard
            </h1>
            <p className="text-muted-foreground text-lg">
              Manage your Gmail, WhatsApp, and reminder tasks
            </p>
          </div>
          <Button 
            data-testid="button-add-task" 
            onClick={() => console.log("Add task")}
            className="bg-gradient-to-r from-chart-3 to-chart-4 hover:shadow-lg hover:shadow-chart-3/30 transition-all duration-300 hover:scale-105"
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Task
          </Button>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 animate-in fade-in slide-in-from-bottom-4 duration-700 delay-150">
          {stats.map((stat, index) => (
            <div
              key={stat.label}
              className="relative p-4 rounded-2xl bg-card/80 backdrop-blur-xl border-2 hover:shadow-lg transition-all duration-300 hover:scale-105 group overflow-hidden"
              style={{ animationDelay: `${200 + index * 50}ms` }}
            >
              <div className={`absolute inset-0 bg-gradient-to-br ${stat.gradient} opacity-50 group-hover:opacity-70 transition-opacity duration-300`} />
              <div className="relative flex items-center gap-3">
                <stat.icon className={`h-8 w-8 ${stat.iconColor}`} />
                <div>
                  <p className="text-2xl font-bold">{stat.value}</p>
                  <p className="text-xs text-muted-foreground">{stat.label}</p>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="animate-in fade-in slide-in-from-bottom-4 duration-700 delay-300">
          <Tabs value={filter} onValueChange={(v) => setFilter(v as typeof filter)}>
            <TabsList className="bg-card/80 backdrop-blur-xl border">
              <TabsTrigger value="all" data-testid="tab-all" className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-primary/10 data-[state=active]:to-chart-2/10">
                All ({tasks.length})
              </TabsTrigger>
              <TabsTrigger value="gmail" data-testid="tab-gmail" className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-chart-1/10 data-[state=active]:to-chart-2/10">
                <Mail className="h-4 w-4 mr-1" />
                Gmail ({tasks.filter((t) => t.type === "gmail").length})
              </TabsTrigger>
              <TabsTrigger value="whatsapp" data-testid="tab-whatsapp" className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-chart-3/10 data-[state=active]:to-chart-4/10">
                <MessageCircle className="h-4 w-4 mr-1" />
                WhatsApp ({tasks.filter((t) => t.type === "whatsapp").length})
              </TabsTrigger>
              <TabsTrigger value="reminder" data-testid="tab-reminder" className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-chart-4/10 data-[state=active]:to-chart-5/10">
                <AlertCircle className="h-4 w-4 mr-1" />
                Reminders ({tasks.filter((t) => t.type === "reminder").length})
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        {activeTasks.length === 0 && completedTasks.length === 0 ? (
          <div className="text-center py-20 animate-in fade-in slide-in-from-bottom-4 duration-700 delay-500">
            <div className="mb-6 inline-flex">
              <div className="h-24 w-24 rounded-3xl bg-gradient-to-br from-chart-3/20 to-chart-4/20 flex items-center justify-center">
                <CheckCircle2 className="h-12 w-12 text-chart-3" />
              </div>
            </div>
            <h3 className="text-2xl font-semibold mb-2">No tasks found</h3>
            <p className="text-muted-foreground max-w-md mx-auto mb-6">
              Create your first task to get started with organizing your work!
            </p>
            <Button className="bg-gradient-to-r from-chart-3 to-chart-4">
              <Plus className="h-4 w-4 mr-2" />
              Create Task
            </Button>
          </div>
        ) : (
          <div className="space-y-8">
            {activeTasks.length > 0 && (
              <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-700 delay-400">
                <div className="flex items-center gap-3">
                  <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-chart-1/20 to-chart-1/10 flex items-center justify-center">
                    <AlertCircle className="h-5 w-5 text-chart-1" />
                  </div>
                  <h2 className="text-2xl font-semibold">Active Tasks</h2>
                  <span className="px-3 py-1 rounded-full bg-chart-1/10 text-chart-1 text-sm font-medium">
                    {activeTasks.length}
                  </span>
                </div>
                <div className="grid gap-4">
                  {activeTasks.map((task, index) => (
                    <div 
                      key={task.id}
                      className="animate-in fade-in slide-in-from-left duration-500"
                      style={{ animationDelay: `${450 + index * 50}ms` }}
                    >
                      <TaskCard
                        task={task}
                        onToggle={handleToggle}
                        onDelete={handleDelete}
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {completedTasks.length > 0 && (
              <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-700 delay-600">
                <div className="flex items-center gap-3">
                  <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-chart-3/20 to-chart-3/10 flex items-center justify-center">
                    <CheckCircle2 className="h-5 w-5 text-chart-3" />
                  </div>
                  <h2 className="text-2xl font-semibold">Completed</h2>
                  <span className="px-3 py-1 rounded-full bg-chart-3/10 text-chart-3 text-sm font-medium">
                    {completedTasks.length}
                  </span>
                </div>
                <div className="grid gap-4">
                  {completedTasks.map((task, index) => (
                    <div 
                      key={task.id}
                      className="animate-in fade-in slide-in-from-left duration-500"
                      style={{ animationDelay: `${650 + index * 50}ms` }}
                    >
                      <TaskCard
                        task={task}
                        onToggle={handleToggle}
                        onDelete={handleDelete}
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

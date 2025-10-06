import { useState } from "react";
import { TaskCard } from "@/components/TaskCard";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus } from "lucide-react";
import type { Task } from "@shared/schema";

export default function Tasks() {
  const [filter, setFilter] = useState<"all" | "gmail" | "whatsapp" | "reminder">("all");
  
  // TODO: remove mock functionality - replace with real data from backend
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

  return (
    <div className="h-full overflow-auto">
      <div className="max-w-5xl mx-auto p-6 space-y-6">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-3xl font-semibold" data-testid="text-page-title">Tasks</h1>
            <p className="text-muted-foreground">
              Manage your Gmail, WhatsApp, and reminder tasks
            </p>
          </div>
          <Button data-testid="button-add-task" onClick={() => console.log("Add task")}>
            <Plus className="h-4 w-4 mr-2" />
            Add Task
          </Button>
        </div>

        <Tabs value={filter} onValueChange={(v) => setFilter(v as typeof filter)}>
          <TabsList>
            <TabsTrigger value="all" data-testid="tab-all">
              All ({tasks.length})
            </TabsTrigger>
            <TabsTrigger value="gmail" data-testid="tab-gmail">
              Gmail ({tasks.filter((t) => t.type === "gmail").length})
            </TabsTrigger>
            <TabsTrigger value="whatsapp" data-testid="tab-whatsapp">
              WhatsApp ({tasks.filter((t) => t.type === "whatsapp").length})
            </TabsTrigger>
            <TabsTrigger value="reminder" data-testid="tab-reminder">
              Reminders ({tasks.filter((t) => t.type === "reminder").length})
            </TabsTrigger>
          </TabsList>
        </Tabs>

        {activeTasks.length === 0 && completedTasks.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-muted-foreground">No tasks found. Create one to get started!</p>
          </div>
        ) : (
          <div className="space-y-6">
            {activeTasks.length > 0 && (
              <div className="space-y-3">
                <h2 className="text-lg font-medium">Active Tasks</h2>
                <div className="grid gap-3">
                  {activeTasks.map((task) => (
                    <TaskCard
                      key={task.id}
                      task={task}
                      onToggle={handleToggle}
                      onDelete={handleDelete}
                    />
                  ))}
                </div>
              </div>
            )}

            {completedTasks.length > 0 && (
              <div className="space-y-3">
                <h2 className="text-lg font-medium">Completed</h2>
                <div className="grid gap-3">
                  {completedTasks.map((task) => (
                    <TaskCard
                      key={task.id}
                      task={task}
                      onToggle={handleToggle}
                      onDelete={handleDelete}
                    />
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

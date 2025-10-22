import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar, Mail, MessageCircle, AlertCircle, MoreVertical, Trash2 } from "lucide-react";
import type { Task } from "@shared/schema";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface TaskCardProps {
  task: Task;
  onToggle?: (id: string) => void;
  onDelete?: (id: string) => void;
}

const typeIcons = {
  gmail: Mail,
  whatsapp: MessageCircle,
  reminder: AlertCircle,
};

const typeColors = {
  gmail: "from-chart-1/20 to-chart-2/20",
  whatsapp: "from-chart-3/20 to-chart-4/20",
  reminder: "from-chart-4/20 to-chart-5/20",
};

const priorityColors = {
  low: "bg-chart-3/10 text-chart-3 border-chart-3/30 hover:bg-chart-3/20",
  medium: "bg-chart-4/10 text-chart-4 border-chart-4/30 hover:bg-chart-4/20",
  high: "bg-chart-5/10 text-chart-5 border-chart-5/30 hover:bg-chart-5/20",
};

const priorityGradients = {
  low: "from-chart-3/10 to-chart-3/5",
  medium: "from-chart-4/10 to-chart-4/5",
  high: "from-chart-5/10 to-chart-5/5",
};

export function TaskCard({ task, onToggle, onDelete }: TaskCardProps) {
  const Icon = typeIcons[task.type as keyof typeof typeIcons] ?? null;
  const priorityLabel = task.priority.charAt(0).toUpperCase() + task.priority.slice(1);

  return (
    <Card
      className={cn(
        "group p-5 hover-elevate transition-all duration-500 hover:shadow-xl border-2 relative overflow-hidden",
        task.completed && "opacity-60 hover:opacity-80"
      )}
      data-testid={`card-task-${task.id}`}
    >
      <div className={cn(
        "absolute inset-0 bg-gradient-to-br opacity-0 group-hover:opacity-100 transition-opacity duration-500",
        typeColors[task.type]
      )} />
      
      <div className={cn(
        "absolute inset-0 bg-gradient-to-br opacity-30",
        priorityGradients[task.priority]
      )} />

      <div className="flex items-start gap-4 relative z-10">
        <div className={cn(
          "mt-1 transition-transform duration-300",
          !task.completed && "group-hover:scale-110"
        )}>
          <Checkbox
            checked={task.completed}
            onCheckedChange={() => onToggle?.(task.id)}
            className="h-5 w-5 data-[state=checked]:bg-gradient-to-br data-[state=checked]:from-chart-3 data-[state=checked]:to-chart-4 data-[state=checked]:border-0"
            data-testid={`checkbox-task-${task.id}`}
          />
        </div>

        <div className="flex-1 min-w-0 space-y-3">
          <div className="flex items-start justify-between gap-3">
            <h3
              className={cn(
                "font-semibold text-base leading-snug transition-colors duration-300",
                task.completed && "line-through text-muted-foreground",
                !task.completed && "group-hover:text-primary"
              )}
              data-testid={`text-title-${task.id}`}
            >
              {task.title}
            </h3>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 -mr-2 opacity-0 group-hover:opacity-100 transition-all duration-300 hover:bg-muted hover:scale-110"
                  data-testid={`button-menu-${task.id}`}
                >
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem
                  onClick={() => onDelete?.(task.id)}
                  className="text-destructive focus:text-destructive focus:bg-destructive/10"
                  data-testid={`button-delete-${task.id}`}
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete Task
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
          
          {task.description && (
            <p className="text-sm text-muted-foreground line-clamp-2 leading-relaxed">
              {task.description}
            </p>
          )}
          
          <div className="flex items-center gap-2 flex-wrap">
            <Badge
              variant="outline"
              className={cn("text-xs font-medium px-3 py-1 transition-all duration-300", priorityColors[task.priority])}
              data-testid={`badge-priority-${task.id}`}
            >
              {priorityLabel} Priority
            </Badge>
            
            <Badge
              variant="outline"
              className="text-xs gap-1.5 px-3 py-1 bg-card/50 hover:bg-card transition-all duration-300"
              data-testid={`badge-type-${task.id}`}
            >
              {Icon ? <Icon className="h-3.5 w-3.5" /> : null}
              <span className="capitalize">{task.type}</span>
            </Badge>
            
            {task.dueDate && (
              <Badge 
                variant="outline" 
                className="text-xs gap-1.5 px-3 py-1 bg-card/50 hover:bg-card transition-all duration-300"
              >
                <Calendar className="h-3.5 w-3.5" />
                {new Date(task.dueDate).toLocaleDateString()}
              </Badge>
            )}
          </div>
        </div>
      </div>
    </Card>
  );
}

import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar, Mail, MessageCircle, AlertCircle, MoreVertical } from "lucide-react";
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

const priorityColors = {
  low: "bg-chart-3/10 text-chart-3 border-chart-3/20",
  medium: "bg-chart-4/10 text-chart-4 border-chart-4/20",
  high: "bg-chart-5/10 text-chart-5 border-chart-5/20",
};

export function TaskCard({ task, onToggle, onDelete }: TaskCardProps) {
  const Icon = typeIcons[task.type];
  const priorityLabel = task.priority.charAt(0).toUpperCase() + task.priority.slice(1);

  return (
    <Card
      className={cn(
        "p-4 hover-elevate transition-all",
        task.completed && "opacity-60"
      )}
      data-testid={`card-task-${task.id}`}
    >
      <div className="flex items-start gap-3">
        <Checkbox
          checked={task.completed}
          onCheckedChange={() => onToggle?.(task.id)}
          className="mt-1"
          data-testid={`checkbox-task-${task.id}`}
        />
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2 mb-2">
            <h3
              className={cn(
                "font-medium text-[15px] leading-snug",
                task.completed && "line-through text-muted-foreground"
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
                  className="h-7 w-7 -mr-2"
                  data-testid={`button-menu-${task.id}`}
                >
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem
                  onClick={() => onDelete?.(task.id)}
                  className="text-destructive"
                  data-testid={`button-delete-${task.id}`}
                >
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
          {task.description && (
            <p className="text-sm text-muted-foreground mb-3 line-clamp-2">
              {task.description}
            </p>
          )}
          <div className="flex items-center gap-2 flex-wrap">
            <Badge
              variant="outline"
              className={cn("text-xs", priorityColors[task.priority])}
              data-testid={`badge-priority-${task.id}`}
            >
              {priorityLabel}
            </Badge>
            <Badge variant="outline" className="text-xs gap-1" data-testid={`badge-type-${task.id}`}>
              <Icon className="h-3 w-3" />
              {task.type.charAt(0).toUpperCase() + task.type.slice(1)}
            </Badge>
            {task.dueDate && (
              <Badge variant="outline" className="text-xs gap-1">
                <Calendar className="h-3 w-3" />
                {new Date(task.dueDate).toLocaleDateString()}
              </Badge>
            )}
          </div>
        </div>
      </div>
    </Card>
  );
}

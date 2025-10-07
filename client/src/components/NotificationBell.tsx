import { Bell } from "lucide-react";
import { useNotification } from "@/contexts/NotificationContext";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";

export function NotificationBell() {
  const { notifications, clearNotifications } = useNotification();
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-6 w-6" />
          {notifications.length > 0 && (
            <span className="absolute top-0 right-0 h-2 w-2 rounded-full bg-destructive" />
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0">
        <Card className="p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="font-semibold">Notifications</span>
            <Button variant="outline" size="sm" onClick={clearNotifications}>Clear</Button>
          </div>
          {notifications.length === 0 ? (
            <div className="text-muted-foreground text-sm">No completed tasks yet.</div>
          ) : (
            <ul className="space-y-2 max-h-64 overflow-auto">
              {notifications.map((n) => (
                <li key={n.id} className="border-b pb-2">
                  <div className="font-medium">{n.title}</div>
                  <div className="text-xs text-muted-foreground">{n.type} • {n.completedAt.toLocaleString()}</div>
                  {n.description && <div className="text-sm mt-1">{n.description}</div>}
                </li>
              ))}
            </ul>
          )}
        </Card>
      </PopoverContent>
    </Popover>
  );
}

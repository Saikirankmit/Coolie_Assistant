import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Bot, User } from "lucide-react";
import type { ChatMessage } from "@shared/schema";

interface ChatBubbleProps {
  message: ChatMessage;
  userName?: string;
  userAvatar?: string;
}

export function ChatBubble({ message, userName, userAvatar }: ChatBubbleProps) {
  const isUser = message.role === "user";
  const time = new Date(message.timestamp).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });

  return (
    <div
      className={cn(
        "flex gap-4 max-w-[85%] animate-in fade-in slide-in-from-bottom-2 duration-500",
        isUser ? "ml-auto flex-row-reverse" : "mr-auto"
      )}
      data-testid={`message-${message.role}-${message.id}`}
    >
      <Avatar className={cn(
        "h-10 w-10 shrink-0 shadow-lg transition-transform duration-300 hover:scale-110",
        isUser ? "border-2 border-primary/20" : "border-2 border-chart-2/20"
      )}>
        {isUser ? (
          <>
            <AvatarImage src={userAvatar} alt={userName} />
            <AvatarFallback className="bg-gradient-to-br from-primary to-chart-1 text-primary-foreground">
              <User className="h-5 w-5" />
            </AvatarFallback>
          </>
        ) : (
          <AvatarFallback className="bg-gradient-to-br from-chart-2 to-primary text-primary-foreground">
            <Bot className="h-5 w-5" />
          </AvatarFallback>
        )}
      </Avatar>
      <div className={cn("flex flex-col gap-2", isUser ? "items-end" : "items-start")}>
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-muted-foreground">
            {isUser ? userName : "Coolie"}
          </span>
          <span className="text-xs text-muted-foreground/60" data-testid={`text-time-${message.id}`}>
            {time}
          </span>
        </div>
        <div
          className={cn(
            "rounded-2xl px-5 py-3 shadow-md transition-all duration-300 hover:shadow-lg relative overflow-hidden group",
            isUser
              ? "bg-gradient-to-br from-primary to-chart-1 text-primary-foreground rounded-tr-sm"
              : "bg-card border-2 text-foreground rounded-tl-sm"
          )}
        >
          {isUser && (
            <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
          )}
          {!isUser && (
            <div className="absolute inset-0 bg-gradient-to-br from-chart-2/5 to-primary/5 opacity-50" />
          )}
          <p className="text-[15px] leading-relaxed whitespace-pre-wrap break-words relative z-10">
            {message.content}
          </p>
        </div>
      </div>
    </div>
  );
}

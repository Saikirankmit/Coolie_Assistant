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
          {/* show model badge for assistant messages when available */}
          {!isUser && (message as any).model && (
            <span className="text-xs px-2 py-0.5 rounded bg-muted/10 text-muted-foreground border">{(message as any).model}</span>
          )}
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
          <div className="relative z-10">
            <div className="text-[15px] leading-relaxed whitespace-pre-wrap break-words">
                {renderMessageContent(message.content)}
              </div>
            {message.attachments && message.attachments.length > 0 && (
              <div className="mt-3 grid grid-cols-1 gap-2">
                {message.attachments.map((a, i) => (
                  <div key={i} className="flex items-center gap-3">
                    {a.mime.startsWith('image/') ? (
                      <img src={a.url} alt={a.name} className="h-24 w-24 object-cover rounded-md border" />
                    ) : a.mime === 'application/pdf' ? (
                      <a href={a.url} target="_blank" rel="noreferrer" className="text-sm underline">
                        {a.name}
                      </a>
                    ) : a.mime.startsWith('audio/') ? (
                      <div className="flex items-center gap-2">
                        <audio controls src={a.url} className="max-w-[260px]" />
                        <span className="text-xs text-muted-foreground">{a.name}</span>
                      </div>
                    ) : (
                      <a href={a.url} target="_blank" rel="noreferrer" className="text-sm underline">
                        {a.name}
                      </a>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function renderMessageContent(content: string | undefined | null) {
  if (!content) return null;

  // simple URL regex
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  const parts = content.split(urlRegex);

  return (
    <>
      {parts.map((part, i) => {
        if (urlRegex.test(part)) {
          // reset lastIndex in case of global regex reuse
          urlRegex.lastIndex = 0;
          return (
            <a key={i} href={part} target="_blank" rel="noopener noreferrer" className="text-sm underline text-primary">
              {part}
            </a>
          );
        }
        return <span key={i}>{part}</span>;
      })}
    </>
  );
}

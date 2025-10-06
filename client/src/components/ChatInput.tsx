import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Send, Paperclip, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

interface ChatInputProps {
  onSend: (message: string) => void;
  disabled?: boolean;
}

export function ChatInput({ onSend, disabled }: ChatInputProps) {
  const [message, setMessage] = useState("");
  const [isFocused, setIsFocused] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (message.trim() && !disabled) {
      onSend(message.trim());
      setMessage("");
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="border-t bg-card/95 backdrop-blur-xl p-6 relative z-10 shadow-lg">
      <div className="absolute inset-0 bg-gradient-to-t from-primary/5 to-transparent pointer-events-none" />
      
      <div className={cn(
        "flex gap-3 items-end max-w-4xl mx-auto relative transition-all duration-300",
        isFocused && "scale-[1.01]"
      )}>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="shrink-0 h-12 w-12 rounded-xl hover:bg-primary/10 hover:text-primary transition-all duration-300 hover:scale-110"
          data-testid="button-attach"
          onClick={() => console.log("Attach file")}
        >
          <Paperclip className="h-5 w-5" />
        </Button>
        
        <div className="flex-1 relative">
          <Textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={handleKeyDown}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
            placeholder="Type your message..."
            className={cn(
              "min-h-[52px] max-h-32 resize-none rounded-2xl transition-all duration-300 pr-12 bg-background/80 backdrop-blur-sm",
              isFocused && "ring-2 ring-primary/50 shadow-lg shadow-primary/10"
            )}
            disabled={disabled}
            data-testid="input-message"
          />
          {message.length > 0 && (
            <div className="absolute bottom-3 right-3 text-xs text-muted-foreground animate-in fade-in duration-200">
              {message.length} chars
            </div>
          )}
        </div>
        
        <Button
          type="submit"
          size="icon"
          disabled={!message.trim() || disabled}
          className={cn(
            "shrink-0 h-12 w-12 rounded-xl bg-gradient-to-br from-primary to-chart-2 hover:shadow-lg hover:shadow-primary/30 transition-all duration-300",
            message.trim() && !disabled ? "scale-100 hover:scale-110" : "scale-95 opacity-50"
          )}
          data-testid="button-send"
        >
          {disabled ? (
            <Sparkles className="h-5 w-5 animate-pulse" />
          ) : (
            <Send className="h-5 w-5" />
          )}
        </Button>
      </div>
      
      <div className="flex items-center justify-center gap-2 mt-3 text-xs text-muted-foreground">
        <Sparkles className="h-3 w-3" />
        <span>Press Enter to send, Shift+Enter for new line</span>
      </div>
    </form>
  );
}

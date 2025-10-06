import { useEffect, useRef, useState } from "react";
import { ChatBubble } from "@/components/ChatBubble";
import { TypingIndicator } from "@/components/TypingIndicator";
import { ChatInput } from "@/components/ChatInput";
import { useAuth } from "@/contexts/AuthContext";
import { useChat } from "@/contexts/ChatContext";
import { Button } from "@/components/ui/button";
import { Trash2, Sparkles } from "lucide-react";

const WEBHOOK_URL = import.meta.env.VITE_CLIENT_WEBHOOK_URL || "/api/webhook/proxy";

export default function Chat() {
  const { user } = useAuth();
  const { messages, addMessage, clearMessages, isTyping, setIsTyping } = useChat();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isTyping]);

  const handleSendMessage = async (content: string) => {
    const userMessage = {
      id: Date.now().toString(),
      content,
      role: "user" as const,
      timestamp: new Date(),
    };
    addMessage(userMessage);
    setIsTyping(true);
    setError(null);

    try {
      const payload = {
        message: content,
        userId: user?.uid,
        userName: user?.displayName,
      };

      console.debug("Sending webhook POST to", WEBHOOK_URL, "payload:", payload);

      const response = await fetch(WEBHOOK_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        let errorBody: string | undefined;
        try {
          const json = await response.json();
          errorBody = JSON.stringify(json);
        } catch (e) {
          try {
            errorBody = await response.text();
          } catch (e) {
            errorBody = undefined;
          }
        }

        const message = `HTTP error! status: ${response.status}${errorBody ? ` - ${errorBody}` : ""}`;
        throw new Error(message);
      }

      let data: any;
      try {
        data = await response.json();
      } catch (e) {
        data = { message: await response.text() };
      }

      const assistantMessage = {
        id: (Date.now() + 1).toString(),
        content: data.response || data.message || "I received your message!",
        role: "assistant" as const,
        timestamp: new Date(),
      };
      addMessage(assistantMessage);
    } catch (err) {
      console.error("Error sending message:", err);
      setError("Failed to send message. Please check if the webhook is running.");
      
      const errorMessage = {
        id: (Date.now() + 1).toString(),
        content: "I'm having trouble connecting right now. Please make sure the n8n webhook is running at " + WEBHOOK_URL,
        role: "assistant" as const,
        timestamp: new Date(),
      };
      addMessage(errorMessage);
    } finally {
      setIsTyping(false);
    }
  };

  return (
    <div className="h-full flex flex-col bg-gradient-to-br from-background via-primary/5 to-chart-2/5 relative">
      <div className="absolute inset-0 bg-grid-pattern opacity-5 pointer-events-none" />
      
      <div className="border-b bg-card/80 backdrop-blur-xl p-6 relative z-10 shadow-sm">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-primary to-chart-2 flex items-center justify-center shadow-lg shadow-primary/20">
              <Sparkles className="h-6 w-6 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-2xl font-bold bg-gradient-to-r from-primary to-chart-2 bg-clip-text text-transparent" data-testid="text-page-title">
                Chat with Coolie
              </h1>
              <p className="text-sm text-muted-foreground">Your AI assistant is here to help</p>
            </div>
          </div>
          {messages.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={clearMessages}
              data-testid="button-clear-chat"
              className="hover:bg-destructive/10 hover:text-destructive transition-all duration-300"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Clear Chat
            </Button>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-auto p-6 relative z-10">
        <div className="max-w-4xl mx-auto space-y-6">
          {messages.length === 0 && (
            <div className="text-center py-20 animate-in fade-in slide-in-from-bottom-4 duration-700">
              <div className="mb-6 inline-flex">
                <div className="h-20 w-20 rounded-2xl bg-gradient-to-br from-primary/20 to-chart-2/20 flex items-center justify-center">
                  <Sparkles className="h-10 w-10 text-primary" />
                </div>
              </div>
              <h3 className="text-2xl font-semibold mb-2">Start a Conversation</h3>
              <p className="text-muted-foreground max-w-md mx-auto">
                Ask Coolie anything! I'm here to help you with tasks, questions, and much more.
              </p>
              <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-3 max-w-2xl mx-auto">
                <div className="p-4 rounded-xl bg-card border hover:border-primary/50 transition-all duration-300 cursor-pointer hover:shadow-lg group">
                  <p className="text-sm font-medium group-hover:text-primary transition-colors">What can you help me with?</p>
                </div>
                <div className="p-4 rounded-xl bg-card border hover:border-primary/50 transition-all duration-300 cursor-pointer hover:shadow-lg group">
                  <p className="text-sm font-medium group-hover:text-primary transition-colors">Show me my tasks for today</p>
                </div>
              </div>
            </div>
          )}
          {messages.map((message) => (
            <ChatBubble
              key={message.id}
              message={message}
              userName={user?.displayName || "You"}
              userAvatar={user?.photoURL || ""}
            />
          ))}
          {isTyping && <TypingIndicator />}
          {error && (
            <div className="bg-destructive/10 border border-destructive/20 text-destructive text-sm p-4 rounded-xl backdrop-blur-xl animate-in fade-in slide-in-from-bottom-2 duration-300">
              <p className="font-medium">Connection Error</p>
              <p className="text-xs mt-1 opacity-80">{error}</p>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>
      </div>

      <ChatInput onSend={handleSendMessage} disabled={isTyping} />
    </div>
  );
}

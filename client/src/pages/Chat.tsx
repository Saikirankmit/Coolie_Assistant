import { useEffect, useRef, useState } from "react";
import { ChatBubble } from "@/components/ChatBubble";
import { TypingIndicator } from "@/components/TypingIndicator";
import { ChatInput } from "@/components/ChatInput";
import { useAuth } from "@/contexts/AuthContext";
import { useChat } from "@/contexts/ChatContext";
import { Button } from "@/components/ui/button";
import { Trash2 } from "lucide-react";

const WEBHOOK_URL = import.meta.env.VITE_N8N_WEBHOOK_URL || "http://localhost:5678/webhook-test/whatsapp-mcp";

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
      const response = await fetch(WEBHOOK_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message: content,
          userId: user?.uid,
          userName: user?.displayName,
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      
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
    <div className="h-full flex flex-col">
      <div className="border-b p-4 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold" data-testid="text-page-title">Chat with Coolie</h1>
          <p className="text-sm text-muted-foreground">Your AI assistant is here to help</p>
        </div>
        {messages.length > 0 && (
          <Button
            variant="ghost"
            size="sm"
            onClick={clearMessages}
            data-testid="button-clear-chat"
          >
            <Trash2 className="h-4 w-4 mr-2" />
            Clear Chat
          </Button>
        )}
      </div>

      <div className="flex-1 overflow-auto p-4">
        <div className="max-w-4xl mx-auto space-y-4">
          {messages.length === 0 && (
            <div className="text-center py-12">
              <p className="text-muted-foreground">
                Start a conversation with Coolie. Ask anything!
              </p>
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
            <div className="bg-destructive/10 text-destructive text-sm p-3 rounded-lg">
              {error}
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>
      </div>

      <ChatInput onSend={handleSendMessage} disabled={isTyping} />
    </div>
  );
}

import { useEffect, useRef, useState } from "react";
import { ChatBubble } from "@/components/ChatBubble";
import { TypingIndicator } from "@/components/TypingIndicator";
import { ChatInput } from "@/components/ChatInput";
import { useAuth } from "@/contexts/AuthContext";
import { useChat } from "@/contexts/ChatContext";
import { Button } from "@/components/ui/button";
import { Trash2, Sparkles } from "lucide-react";
import { PlusCircle, Archive } from "lucide-react";

const WEBHOOK_URL = import.meta.env.VITE_CLIENT_WEBHOOK_URL || "/api/webhook/proxy";

export default function Chat() {
  const { user } = useAuth();
  const {
    messages,
    addMessage,
    clearMessages,
    isTyping,
    setIsTyping,
    conversations,
    newConversation,
    loadConversation,
    deleteConversation,
    currentConversationId,
  } = useChat();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isTyping]);

  const handleSendMessage = async (content: string) => {
    // ChatInput may send structured payloads (JSON) containing message and attachments.
    let messageText = content;
    let attachments: any = undefined;
    try {
      const parsed = JSON.parse(content);
      if (parsed && typeof parsed === 'object' && 'message' in parsed) {
        messageText = String(parsed.message ?? "");
        attachments = parsed.attachments;
      }
    } catch (e) {
      // not JSON; treat content as plain text
    }

    const userMessage = {
      id: Date.now().toString(),
      content: messageText,
      role: "user" as const,
      timestamp: new Date(),
      attachments: attachments ?? undefined,
    };

    addMessage(userMessage);
    setIsTyping(true);
    setError(null);

    try {
      const payload: any = {
        message: messageText,
        attachments: attachments ?? undefined,
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

      // Try to read response as text first, then parse JSON if possible.
      let data: any = null;
      let rawText: string | null = null;
      try {
        rawText = await response.text();
        try {
          data = rawText ? JSON.parse(rawText) : rawText;
        } catch (e) {
          data = rawText;
        }
      } catch (e) {
        console.warn('Failed to read response body', e);
      }

      // Derive assistant content from common fields or fallbacks
      let assistantContent = "I received your message!";
      let assistantModel: string | undefined = undefined;

      // helper to extract message string from an object, including nested JSON strings
      const extractText = (obj: any): string | null => {
        if (obj === null || obj === undefined) return null;
        // if it's a string that looks like JSON, try parse it
        if (typeof obj === 'string') {
          const s = obj.trim();
          if (!s) return null;
          if ((s.startsWith('{') && s.endsWith('}')) || (s.startsWith('[') && s.endsWith(']'))) {
            try {
              const parsed = JSON.parse(s);
              return extractText(parsed);
            } catch (e) {
              return s;
            }
          }
          return s;
        }
        if (typeof obj === 'object') {
          // common fields
          const keys = ['output', 'response', 'message', 'reply', 'text', 'result', 'answer', 'body', 'data'];
          // try direct keys (case-sensitive)
          for (const k of keys) {
            const v = obj[k];
            if (typeof v === 'string' && v.trim()) return v.trim();
            if (Array.isArray(v) && v.length > 0) {
              const first = v[0];
              const extracted = extractText(first);
              if (extracted) return extracted;
            }
          }
          // try case-insensitive keys
          const lowerMap: Record<string, any> = {};
          for (const kk of Object.keys(obj)) {
            lowerMap[kk.toLowerCase()] = (obj as any)[kk];
          }
          for (const k of keys) {
            const v = lowerMap[k.toLowerCase()];
            if (typeof v === 'string' && v.trim()) return v.trim();
            if (Array.isArray(v) && v.length > 0) {
              const first = v[0];
              const extracted = extractText(first);
              if (extracted) return extracted;
            }
          }
          // OpenAI-like
          const choices = obj.choices;
          if (Array.isArray(choices) && choices.length > 0) {
            const first = choices[0];
            const textFromChoice = first?.text || first?.message?.content || first?.delta?.content || first?.output?.text;
            if (typeof textFromChoice === 'string' && textFromChoice.trim()) return textFromChoice.trim();
            const deep = extractText(first);
            if (deep) return deep;
          }
          // also if object looks like an array-like container (has 0 key)
          if ('0' in obj) {
            const maybe = (obj as any)[0];
            const deep = extractText(maybe);
            if (deep) return deep;
          }
        }
        return null;
      };

      // If response is an array like [{"output":"..."}] or ['{"output":"..."}'] prefer the first element
      let top: any = data;
      if (Array.isArray(data) && data.length > 0) {
        const first = data[0];
        if (typeof first === 'string') {
          try {
            top = JSON.parse(first);
          } catch (e) {
            top = first;
          }
        } else {
          top = first;
        }
      }
      const txt = extractText(top);
      if (txt) assistantContent = txt;

      // try to capture model info from various fields
      if (top && typeof top === 'object') {
        assistantModel = top.model || top.modelName || top.engine || top.provider || top.source || undefined;
        if (!assistantModel && Array.isArray(top.choices) && top.choices[0]) {
          assistantModel = top.choices[0].model || top.choices[0].engine || assistantModel;
        }
      }

  // fallback to rawText if we still don't have content
      if ((!assistantContent || assistantContent === 'I received your message!') && rawText && rawText.trim()) {
        // try JSON parse then extract
        try {
          const parsedRaw = JSON.parse(rawText);
          const candidate = extractText(Array.isArray(parsedRaw) ? parsedRaw[0] : parsedRaw);
          if (candidate) assistantContent = candidate;
          else assistantContent = String(parsedRaw);
        } catch (e) {
          // regex fallback: look for "output" or "message" fields inside rawText
          const rx = /"(?:output|message|response)"\s*:\s*"([\s\S]*?)"/i;
          const m = rx.exec(rawText);
          if (m && m[1]) {
            // unescape simple escaped quotes and newlines
            assistantContent = m[1].replace(/\\n/g, '\n').replace(/\\"/g, '"').trim();
          } else {
            assistantContent = rawText.trim();
          }
        }
      }

      // If we still ended up with the default message, fall back to rawText or a JSON dump so user sees something useful.
      if (assistantContent === 'I received your message!') {
        try {
          const fallback = (rawText && rawText.trim()) || (data ? JSON.stringify(data) : undefined) || (top ? JSON.stringify(top) : undefined) || '';
          if (fallback && fallback.trim()) {
            assistantContent = String(fallback).trim();
          } else {
            // final fallback: explicit empty-response note
            assistantContent = '(empty response)';
          }
        } catch (e) {
          assistantContent = '(empty response)';
        }
        console.warn('Unable to extract structured assistant text; showing raw payload for debugging. rawText:', rawText, 'data:', data, 'top:', top);
      }

      // normalize whitespace/newlines (strip trailing newlines)
      if (typeof assistantContent === 'string') {
        assistantContent = assistantContent.replace(/\n+$/g, '').trim();
      }

      const assistantMessage: any = {
        id: (Date.now() + 1).toString(),
        content: assistantContent,
        role: "assistant" as const,
        timestamp: new Date(),
      };
      if (assistantModel) assistantMessage.model = assistantModel;
      addMessage(assistantMessage);
    } catch (err) {
      console.error("Error sending message:", err);
      const friendly = "Server unreachable — please check your connection and try again.";
      setError(friendly);

      const errorMessage = {
        id: (Date.now() + 1).toString(),
        content: friendly,
        role: "assistant" as const,
        timestamp: new Date(),
      };
      addMessage(errorMessage);
    } finally {
      setIsTyping(false);
    }
  };

  return (
    <div className="h-full flex bg-gradient-to-br from-background via-primary/5 to-chart-2/5 relative">
      <div className="absolute inset-0 bg-grid-pattern opacity-5 pointer-events-none" />
      <aside className="w-80 border-r bg-card/70 backdrop-blur-xl p-4 z-10">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-primary to-chart-2 flex items-center justify-center">
              <Sparkles className="h-5 w-5 text-primary-foreground" />
            </div>
            <div>
              <h2 className="text-lg font-semibold">Chats</h2>
              <p className="text-xs text-muted-foreground">Conversation history</p>
            </div>
          </div>
          <Button size="sm" variant="ghost" onClick={() => newConversation()}>
            <PlusCircle className="h-4 w-4 mr-2" /> New
          </Button>
        </div>

        <div className="space-y-2 overflow-auto max-h-[70vh]">
          {conversations.length === 0 && (
            <div className="text-sm text-muted-foreground p-3">No conversations yet. Click New to start.</div>
          )}
          {conversations.map((c) => (
            <div
              key={c.id}
              className={`flex items-center justify-between p-2 rounded-md cursor-pointer hover:bg-primary/5 ${currentConversationId === c.id ? 'bg-primary/5' : ''}`}
              onClick={() => loadConversation(c.id)}
            >
              <div className="flex items-center gap-3">
                <div className="h-8 w-8 rounded-md bg-secondary/10 flex items-center justify-center text-sm font-medium">{c.title?.charAt(0) ?? 'C'}</div>
                <div className="text-sm">
                  <div className="font-medium truncate max-w-[180px]">{c.title || 'New chat'}</div>
                  <div className="text-xs text-muted-foreground">{new Date(c.updatedAt).toLocaleString()}</div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button size="sm" variant="ghost" onClick={(e) => { e.stopPropagation(); deleteConversation(c.id); }}>
                  <Archive className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      </aside>

      <main className="flex-1 flex flex-col">
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
      </main>
    </div>
  );
}

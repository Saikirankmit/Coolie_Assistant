import { createContext, useContext, useEffect, useMemo, useState } from "react";
import type { ChatMessage } from "@shared/schema";

type Conversation = {
  id: string;
  title: string;
  messages: ChatMessage[];
  createdAt: string;
  updatedAt: string;
};

interface ChatContextType {
  // current conversation messages (keeps compatibility with existing code)
  messages: ChatMessage[];
  addMessage: (message: ChatMessage) => void;
  clearMessages: () => void;
  isTyping: boolean;
  setIsTyping: (isTyping: boolean) => void;

  // conversations API
  conversations: Conversation[];
  currentConversationId: string | null;
  newConversation: (title?: string) => string; // returns id
  loadConversation: (id: string) => void;
  deleteConversation: (id: string) => void;
}

const ChatContext = createContext<ChatContextType | undefined>(undefined);

const STORAGE_PREFIX = "coolie:conversations";

function storageKeyForUser(): string {
  try {
    const uid = localStorage.getItem("userId") || "guest";
    return `${STORAGE_PREFIX}:${uid}`;
  } catch (e) {
    return `${STORAGE_PREFIX}:guest`;
  }
}

function loadFromStorage(): Conversation[] {
  try {
    const raw = localStorage.getItem(storageKeyForUser());
    if (!raw) return [];
    const parsed = JSON.parse(raw) as Conversation[];
    return parsed.map((c) => ({ ...c }));
  } catch (e) {
    console.warn("Failed to load conversations from storage:", e);
    return [];
  }
}

function saveToStorage(conversations: Conversation[]) {
  try {
    localStorage.setItem(storageKeyForUser(), JSON.stringify(conversations));
  } catch (e) {
    console.warn("Failed to save conversations to storage:", e);
  }
}

export function ChatProvider({ children }: { children: React.ReactNode }) {
  const [conversations, setConversations] = useState<Conversation[]>(() => loadFromStorage());
  const [currentConversationId, setCurrentConversationId] = useState<string | null>(() => {
    const convs = loadFromStorage();
    return convs.length ? convs[convs.length - 1].id : null;
  });

  const [isTyping, setIsTyping] = useState(false);

  // persist when conversations change
  useEffect(() => {
    saveToStorage(conversations);
  }, [conversations]);

  const newConversation = (title?: string) => {
    const id = (typeof crypto !== 'undefined' && (crypto as any).randomUUID ? (crypto as any).randomUUID() : `${Date.now()}`);
    const now = new Date().toISOString();
    const conv: Conversation = { id, title: title ?? "New chat", messages: [], createdAt: now, updatedAt: now };
    setConversations((prev) => [...prev, conv]);
    setCurrentConversationId(id);
    return id;
  };

  const loadConversation = (id: string) => {
    const exists = conversations.find((c) => c.id === id);
    if (!exists) return;
    setCurrentConversationId(id);
  };

  const deleteConversation = (id: string) => {
    setConversations((prev) => {
      const next = prev.filter((c) => c.id !== id);
      // if deleted current, switch to last
      if (currentConversationId === id) {
        const last = next.length ? next[next.length - 1].id : null;
        setCurrentConversationId(last);
      }
      return next;
    });
  };

  const addMessage = (message: ChatMessage) => {
    setConversations((prev) => {
      let idx = prev.findIndex((c) => c.id === currentConversationId);
      // if no current conversation, create one
      if (idx === -1) {
        const id = (typeof crypto !== 'undefined' && (crypto as any).randomUUID ? (crypto as any).randomUUID() : `${Date.now()}`);
        const now = new Date().toISOString();
        const conv: Conversation = { id, title: "New chat", messages: [message], createdAt: now, updatedAt: now };
        setCurrentConversationId(id);
        return [...prev, conv];
      }
      const conv = prev[idx];
      const updated: Conversation = { ...conv, messages: [...conv.messages, message], updatedAt: new Date().toISOString() };
      const next = [...prev];
      next[idx] = updated;
      return next;
    });
  };

  const clearMessages = () => {
    setConversations((prev) => {
      if (!currentConversationId) return prev;
      const idx = prev.findIndex((c) => c.id === currentConversationId);
      if (idx === -1) return prev;
      const conv = prev[idx];
      const updated: Conversation = { ...conv, messages: [], updatedAt: new Date().toISOString() };
      const next = [...prev];
      next[idx] = updated;
      return next;
    });
  };

  // export messages for current conversation to keep Chat.tsx compatibility
  const messages = useMemo(() => {
    const conv = conversations.find((c) => c.id === currentConversationId);
    return conv?.messages ?? [];
  }, [conversations, currentConversationId]);

  return (
    <ChatContext.Provider
      value={{
        messages,
        addMessage,
        clearMessages,
        isTyping,
        setIsTyping,

        conversations,
        currentConversationId,
        newConversation,
        loadConversation,
        deleteConversation,
      }}
    >
      {children}
    </ChatContext.Provider>
  );
}

export function useChat() {
  const context = useContext(ChatContext);
  if (context === undefined) {
    throw new Error("useChat must be used within a ChatProvider");
  }
  return context;
}

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import type { ChatMessage } from "@shared/schema";
import { useAuth } from "./AuthContext";

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

function storageKeyFor(uid?: string | null) {
  try {
    const id = uid || localStorage.getItem("userId") || "guest";
    return `${STORAGE_PREFIX}:${id}`;
  } catch (e) {
    return `${STORAGE_PREFIX}:guest`;
  }
}

function loadFromStorageFor(uid?: string | null): Conversation[] {
  try {
    const raw = localStorage.getItem(storageKeyFor(uid));
    if (!raw) return [];
    const parsed = JSON.parse(raw) as Conversation[];
    return parsed.map((c) => ({ ...c }));
  } catch (e) {
    console.warn("Failed to load conversations from storage:", e);
    return [];
  }
}

// Fallback loader: scan localStorage for any matching conversation keys and return the first non-empty
function scanAnyStoredConversations(): Conversation[] {
  try {
    const keys: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith(STORAGE_PREFIX + ':')) keys.push(k);
    }
    // try keys in insertion order; prefer the last one set by iterating reverse
    for (let i = keys.length - 1; i >= 0; i--) {
      const raw = localStorage.getItem(keys[i]);
      if (!raw) continue;
      try {
        const parsed = JSON.parse(raw) as Conversation[];
        if (Array.isArray(parsed) && parsed.length > 0) return parsed.map((c) => ({ ...c }));
      } catch (e) {
        // ignore parse errors and continue
        continue;
      }
    }
    return [];
  } catch (e) {
    console.warn('Failed to scan localStorage for conversations', e);
    return [];
  }
}

function saveToStorageFor(uid: string | null | undefined, conversations: Conversation[]) {
  try {
    localStorage.setItem(storageKeyFor(uid), JSON.stringify(conversations));
  } catch (e) {
    console.warn("Failed to save conversations to storage:", e);
  }
}

export function ChatProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();

  // start empty; we'll load from storage after auth state is known to avoid guest/uid race
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [currentConversationId, setCurrentConversationId] = useState<string | null>(null);

  const [isTyping, setIsTyping] = useState(false);

  // Load conversations for the current user when user changes (or on mount for guest)
  useEffect(() => {
    try {
      let loaded = loadFromStorageFor(user?.uid ?? null);
      if ((!loaded || loaded.length === 0) && !user?.uid) {
        // if no user and nothing found, try scanning any stored conversations (fallback)
        loaded = scanAnyStoredConversations();
      }
      console.debug('ChatProvider: initializing conversations for user', user?.uid ?? 'none', 'loadedCount', loaded.length);
      setConversations(loaded);
      setCurrentConversationId(loaded.length ? loaded[loaded.length - 1].id : null);
    } catch (e) {
      console.warn('Failed to initialize conversations from storage', e);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.uid]);

  // persist when conversations or user changes
  useEffect(() => {
    saveToStorageFor(user?.uid ?? null, conversations);
  }, [conversations, user?.uid]);

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

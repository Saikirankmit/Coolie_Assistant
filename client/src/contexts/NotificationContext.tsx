import React, { createContext, useContext, useEffect, useState } from "react";
import type { Task } from "@shared/schema";
import { useAuth } from "@/contexts/AuthContext";

interface Notification {
  id: string;
  title: string;
  description?: string;
  type: string;
  completedAt: Date;
}

interface NotificationContextType {
  notifications: Notification[];
  addNotification: (n: Notification) => void;
  clearNotifications: () => void;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const { getIdToken } = useAuth();

  // load persisted notifications from server on mount
  useEffect(() => {
    (async () => {
      try {
        const token = await getIdToken?.();
        if (!token) return;
        const res = await fetch('/api/notifications', { headers: { Authorization: `Bearer ${token}` } });
        if (!res.ok) return;
        const data = await res.json();
        if (Array.isArray(data)) {
          // transform rows
          const rows = data.map((r: any) => ({ id: r.id, title: r.message.slice(0,40), description: r.message, type: r.type, completedAt: r.delivered_at ? new Date(r.delivered_at) : new Date(r.created_at) } as Notification));
          setNotifications(rows);
        }
      } catch (err) {
        // ignore
      }
    })();
  }, [getIdToken]);

  const addNotification = (n: Notification) => {
    setNotifications((prev) => [n, ...prev.filter((x) => x.id !== n.id)]);
  };

  const clearNotifications = () => setNotifications([]);

  return (
    <NotificationContext.Provider value={{ notifications, addNotification, clearNotifications }}>
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotification() {
  const ctx = useContext(NotificationContext);
  if (!ctx) throw new Error("useNotification must be used within NotificationProvider");
  return ctx;
}

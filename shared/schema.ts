import { sql } from "drizzle-orm";
import { pgTable, text, varchar, timestamp, jsonb, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

export type ChatMessage = {
  id: string;
  content: string;
  role: "user" | "assistant";
  timestamp: Date;
  // attachments: array of objects with name, mime and data URL (base64) or remote URL
  attachments?: { name: string; mime: string; url: string }[];
  // optional model identifier that produced the assistant message
  model?: string;
};

export type Task = {
  id: string;
  title: string;
  description?: string;
  type: "gmail" | "whatsapp" | "reminder";
  priority: "low" | "medium" | "high";
  completed: boolean;
  dueDate?: Date;
  createdAt: Date;
};

export type PersonalizationSettings = {
  tone: "professional" | "casual" | "friendly" | "formal";
  responseLength: "brief" | "moderate" | "detailed";
  formality: "low" | "medium" | "high";
  includeEmojis: boolean;
};

export type UserPreferences = {
  theme: "light" | "dark" | "system";
  notifications: boolean;
  language: string;
};

import { type User, type InsertUser } from "@shared/schema";
import { randomUUID } from "crypto";
import { createClient } from "@supabase/supabase-js";

// Supabase client (service role) for reminders persistence — REQUIRED
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY environment variables are required for Supabase-backed reminders storage.");
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// modify the interface with any CRUD methods
// you might need

export interface IStorage {
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
}

export class MemStorage implements IStorage {
  private users: Map<string, User>;

  constructor() {
    this.users = new Map();
  }

  async getUser(id: string): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.username === username,
    );
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = randomUUID();
    const user: User = { ...insertUser, id };
    this.users.set(id, user);
    return user;
  }
}

export const storage = new MemStorage();

// --- Simple in-memory reminders store (for local/dev without external DB) ---
export type ReminderType = "whatsapp" | "gmail" | "general";

export type ReminderRow = {
  id: string;
  user_id: string;
  type: ReminderType;
  datetime: string; // ISO
  message: string;
  user_phone?: string | null;
  user_email?: string | null;
  user_token?: string | null;
  status: "pending" | "sent" | "failed";
  created_at: string;
  delivered_at?: string | null;
};

export class RemindersStorage {
  private rows: Map<string, ReminderRow> = new Map();

  // create reminder in Supabase (required)
  async create(row: Omit<Partial<ReminderRow>, "id" | "status" | "created_at"> & { user_id: string; type: ReminderType; datetime: string; message: string }) {
    const payload = {
      user_id: row.user_id,
      type: row.type,
      datetime: row.datetime,
      message: row.message,
      user_phone: row.user_phone ?? null,
      user_email: row.user_email ?? null,
      user_token: row.user_token ?? null,
      status: 'pending',
    } as any;
    const { data, error } = await supabase.from('reminders').insert(payload).select().single();
    if (error) throw error;
    return data as ReminderRow;
  }

  async listAll() {
    const { data, error } = await supabase.from('reminders').select('*').order('datetime', { ascending: true });
    if (error) throw error;
    return data as ReminderRow[];
  }

  async get(id: string) {
    const { data, error } = await supabase.from('reminders').select('*').eq('id', id).single();
    if (error) return undefined;
    return data as ReminderRow;
  }

  async delete(id: string) {
    const { error } = await supabase.from('reminders').delete().eq('id', id);
    if (error) throw error;
    return true;
  }

  async markSent(id: string) {
    const { error } = await supabase.from('reminders').update({ status: 'sent', delivered_at: new Date().toISOString() }).eq('id', id);
    if (error) throw error;
    return true;
  }

  async markFailed(id: string) {
    const { error } = await supabase.from('reminders').update({ status: 'failed' }).eq('id', id);
    if (error) throw error;
    return true;
  }

  async fetchDuePending(limit = 100) {
    const now = new Date().toISOString();
    const { data, error } = await supabase.from('reminders').select('*').eq('status', 'pending').lte('datetime', now).order('datetime', { ascending: true }).limit(limit);
    if (error) throw error;
    return data as ReminderRow[];
  }
}

export const reminders = new RemindersStorage();

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set for notifications');
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

export type NotificationRow = {
  id: string;
  reminder_id?: string | null;
  user_id: string;
  message: string;
  type: string;
  created_at: string;
  delivered_at?: string | null;
};

export async function insertNotification(n: { reminder_id?: string | null; user_id: string; message: string; type: string; delivered_at?: string | null }) {
  const payload = {
    reminder_id: n.reminder_id ?? null,
    user_id: n.user_id,
    message: n.message,
    type: n.type,
    delivered_at: n.delivered_at ?? null,
  } as any;

  const { data, error } = await supabase.from('notifications').insert(payload).select().single();
  if (error) throw error;
  return data as NotificationRow;
}

export async function listNotifications(userId: string, limit = 50) {
  const { data, error } = await supabase.from('notifications').select('*').eq('user_id', userId).order('created_at', { ascending: false }).limit(limit);
  if (error) throw error;
  return data as NotificationRow[];
}

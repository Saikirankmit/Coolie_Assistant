import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in the environment for preferences to work');
}
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

export type Preferences = {
  user_id: string;
  tone: 'professional' | 'casual' | 'friendly' | 'formal';
  response_length: 'brief' | 'moderate' | 'detailed';
  formality: 'low' | 'medium' | 'high';
  include_emojis: boolean;
};

export async function getPreferences(userId: string): Promise<Preferences | null> {
  const { data, error } = await supabase.from('user_preferences').select('*').eq('user_id', userId).single();
  if (error) {
    // PostgREST returns a 404-like code when no rows; normalize to null
    if (typeof (error as any).code === 'string' && (error as any).code === 'PGRST116') {
      return null;
    }
    // throw a descriptive Error so upstream route returns readable message
    throw new Error(`Supabase getPreferences error: ${JSON.stringify(error)}`);
  }
  return data ?? null;
}

export async function upsertPreferences(prefs: Preferences) {
  const payload = { ...prefs, updated_at: new Date().toISOString() };
  const { data, error } = await supabase.from('user_preferences').upsert(payload).select().single();
  if (error) {
    throw new Error(`Supabase upsertPreferences error: ${JSON.stringify(error)}`);
  }
  return data;
}

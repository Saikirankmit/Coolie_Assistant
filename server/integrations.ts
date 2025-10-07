import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set for integrations');
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

export type IntegrationType = 'gmail' | 'whatsapp';

export async function upsertUserCredentials(userId: string, type: IntegrationType, data: Record<string, any>) {
  const payload = {
    user_id: userId,
    type,
    data,
    updated_at: new Date().toISOString(),
  };
  // upsert by user_id and type
  try {
    const { data: out, error } = await supabase.from('user_credentials').upsert(payload, { onConflict: 'user_id,type' }).select().single();
    if (error) {
      console.error('Supabase upsert user_credentials error', error);
      throw error;
    }
    return out;
  } catch (err) {
    console.error('upsertUserCredentials failed', err);
    throw err;
  }
}

export async function getUserCredentials(userId: string, type: IntegrationType) {
  const { data, error } = await supabase.from('user_credentials').select('*').eq('user_id', userId).eq('type', type).single();
  if (error) return null;
  return data;
}

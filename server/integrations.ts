import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set for integrations');
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

export type IntegrationType = 'gmail' | 'whatsapp';

export async function upsertUserCredentials(userId: string, type: IntegrationType, data: Record<string, any>) {
  // Use a simple schema keyed by user_id only. Keep signature compatible but ignore `type`
  const payload: any = {
    user_id: userId,
    data,
    updated_at: new Date().toISOString(),
  };
  try {
    // Upsert by user_id (single-row per user)
    const { data: out, error } = await supabase.from('user_credentials').upsert(payload, { onConflict: 'user_id' }).select().single();
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
  try {
    // Select by user_id only (schema may not have `type` column)
    const { data, error } = await supabase.from('user_credentials').select('*').eq('user_id', userId).limit(1).single();
    if (error) return null;
    return data;
  } catch (err) {
    console.error('getUserCredentials failed', err);
    return null;
  }
}

export async function deleteUserCredentials(userId: string, type: IntegrationType) {
  try {
    // Delete by user_id only so this works with simplified schema (no `type` column)
    const { error } = await supabase.from('user_credentials').delete().eq('user_id', userId);
    if (error) {
      console.error('deleteUserCredentials error', error);
      throw error;
    }
    return { ok: true };
  } catch (err) {
    console.error('deleteUserCredentials failed', err);
    throw err;
  }
}

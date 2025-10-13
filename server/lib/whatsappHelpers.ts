import crypto from 'crypto';
import type { SupabaseClient } from '@supabase/supabase-js';

// Configurable options
const OTP_LENGTH = 6;
const OTP_TTL_MINUTES = 10;
const MAX_VERIFICATION_ATTEMPTS = 5;

// Generate a numeric OTP of length N (string)
export function generateOtp(length = OTP_LENGTH): string {
  const min = 10 ** (length - 1);
  const max = 10 ** length - 1;
  const n = Math.floor(Math.random() * (max - min + 1)) + min;
  return String(n);
}

// Hash OTP with SHA256 and a per-app pepper (optional)
export function hashOtp(otp: string, pepper?: string): string {
  const h = crypto.createHash('sha256');
  if (pepper) h.update(pepper);
  h.update(otp);
  return h.digest('hex');
}

// Store OTP hash into whatsapp_users row (by user_id or phone_number).
// This function updates verification_code_hash, verification_expires_at, verification_attempts
export async function storeOtpForUser(supabase: SupabaseClient, payload: { userId?: string; phoneNumber?: string; otp: string; pepper?: string }) {
  const { userId, phoneNumber, otp, pepper } = payload;
  const hash = hashOtp(otp, pepper);
  const expiresAt = new Date(Date.now() + OTP_TTL_MINUTES * 60 * 1000).toISOString();

  const update: any = {
    verification_code_hash: hash,
    verification_expires_at: expiresAt,
    verification_attempts: 0,
    updated_at: new Date().toISOString(),
    verified: false,
  };

  let resp;
  if (userId) {
    resp = await supabase.from('whatsapp_users').upsert({ user_id: userId, ...update }, { onConflict: 'user_id' }).select().limit(1).single();
  } else if (phoneNumber) {
    resp = await supabase.from('whatsapp_users').upsert({ phone_number: phoneNumber, ...update }, { onConflict: 'phone_number' }).select().limit(1).single();
  } else {
    throw new Error('userId or phoneNumber required');
  }

  if (resp.error) throw resp.error;
  return resp.data;
}

// Verify OTP: find record by userId or phoneNumber, check hash and expiry and attempts
export async function verifyOtpForUser(supabase: SupabaseClient, payload: { userId?: string; phoneNumber?: string; otp: string; pepper?: string }) {
  const { userId, phoneNumber, otp, pepper } = payload;
  let query = supabase.from('whatsapp_users').select('*').limit(1);
  if (userId) query = query.eq('user_id', userId);
  else if (phoneNumber) query = query.eq('phone_number', phoneNumber);
  else throw new Error('userId or phoneNumber required');

  const { data, error } = await query.single();
  if (error) throw error;
  if (!data) return { ok: false, reason: 'not_found' };

  // Check expiry
  if (data.verification_expires_at && new Date(data.verification_expires_at) < new Date()) {
    return { ok: false, reason: 'expired' };
  }

  // Check attempts
  if (data.verification_attempts >= MAX_VERIFICATION_ATTEMPTS) {
    return { ok: false, reason: 'too_many_attempts' };
  }

  const expectedHash = data.verification_code_hash;
  const providedHash = hashOtp(otp, pepper);
  if (expectedHash !== providedHash) {
    // increment attempts
    await supabase.from('whatsapp_users').update({ verification_attempts: (data.verification_attempts || 0) + 1, updated_at: new Date().toISOString() }).eq('id', data.id);
    return { ok: false, reason: 'mismatch' };
  }

  // Success — mark verified, null out sensitive hash, set last_verified_at
  const upd = {
    verified: true,
    verification_code_hash: null,
    verification_expires_at: null,
    verification_attempts: 0,
    last_verified_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  } as any;

  const up = await supabase.from('whatsapp_users').update(upd).eq('id', data.id).select().single();
  if (up.error) throw up.error;
  return { ok: true, data: up.data };
}

// Rotate token: store new token, update metadata
export async function rotateTokenForUser(supabase: SupabaseClient, payload: { userId?: string; phoneNumber?: string; newToken: string; expiresAt?: string }) {
  const { userId, phoneNumber, newToken, expiresAt } = payload;
  const upd: any = {
    token: newToken,
    token_expires_at: expiresAt || null,
    token_last_rotated_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  let resp;
  if (userId) resp = await supabase.from('whatsapp_users').update(upd).eq('user_id', userId).select().limit(1).single();
  else if (phoneNumber) resp = await supabase.from('whatsapp_users').update(upd).eq('phone_number', phoneNumber).select().limit(1).single();
  else throw new Error('userId or phoneNumber required');

  if (resp.error) throw resp.error;
  return resp.data;
}

// Example helper to clear tokens for a user (disconnect)
export async function clearTokenForUser(supabase: SupabaseClient, payload: { userId?: string; phoneNumber?: string }) {
  const { userId, phoneNumber } = payload;
  const upd = { token: null, token_expires_at: null, token_last_rotated_at: null, updated_at: new Date().toISOString() };
  let resp;
  if (userId) resp = await supabase.from('whatsapp_users').update(upd).eq('user_id', userId).select().single();
  else if (phoneNumber) resp = await supabase.from('whatsapp_users').update(upd).eq('phone_number', phoneNumber).select().single();
  else throw new Error('userId or phoneNumber required');
  if (resp.error) throw resp.error;
  return resp.data;
}

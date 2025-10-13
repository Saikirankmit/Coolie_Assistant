import type { Express } from 'express';
import { randomUUID } from 'crypto';
// use global fetch (Node 18+). No node-fetch import required.

import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

// normalize and validate Indian phone numbers to +91XXXXXXXXXX
function normalizeIndianPhone(input: string | undefined | null): string | null {
  if (!input) return null;
  const digits = input.replace(/\D/g, '');
  let num = digits;
  if (num.length === 11 && num.startsWith('0')) {
    num = num.slice(1);
  } else if (num.length === 12 && num.startsWith('91')) {
    num = num.slice(2);
  }
  // now ensure it's exactly 10 digits and starts with 6-9 (Indian mobile)
  if (/^[6-9]\d{9}$/.test(num)) return `+91${num}`;
  return null;
}

const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// Provider config read at runtime to avoid import-order issues with dotenv
function getWAPhoneId() { return process.env.WA_PHONE_ID; }
function getWAToken() { return process.env.WA_TOKEN; }
function getWATemplateName() { return process.env.WA_TEMPLATE_NAME; }
function getWATemplateLang() { return process.env.WA_TEMPLATE_LANG || 'en_US'; }
function getTwilioSid() { return process.env.TWILIO_ACCOUNT_SID; }
function getTwilioAuth() { return process.env.TWILIO_AUTH_TOKEN; }
function getTwilioFrom() { return process.env.TWILIO_FROM_NUMBER; }

// in-memory last provider response for diagnostics (do not store secrets)
let lastProviderResponse: any = null;

// helper to set last response (mask tokens)
function setLastProviderResponse(provider: string, resp: any) {
  const safeResp = JSON.parse(JSON.stringify(resp));
  if (safeResp && typeof safeResp === 'object') {
    if (safeResp.access_token) safeResp.access_token = '***REDACTED***';
    if (safeResp.accessToken) safeResp.accessToken = '***REDACTED***';
    if (safeResp.token) safeResp.token = '***REDACTED***';
  }
  lastProviderResponse = { time: new Date().toISOString(), provider, resp: safeResp };
  try { (globalThis as any).__whatsapp_last_provider_response = lastProviderResponse; } catch (e) {}
}

export function registerWhatsappRoutes(app: Express) {
  // Start verification: generate a code, store it, and send via WhatsApp (or log)
  app.post('/api/whatsapp/verify', async (req, res) => {
    try {
      const { phoneNumber, userId } = req.body;
      if (!phoneNumber || !userId) return res.status(400).json({ error: 'phoneNumber and userId required' });

      // validate Indian 10-digit mobile numbers and normalize to +91XXXXXXXXXX
      const normalized = normalizeIndianPhone(phoneNumber);
      if (!normalized) return res.status(400).json({ error: 'invalid_indian_number', message: 'Phone must be a valid 10-digit Indian mobile number (starts with 6-9)' });
      const code = Math.floor(100000 + Math.random() * 900000).toString();
      const id = randomUUID();

      // hash OTP with optional pepper
      const pepper = process.env.OTP_PEPPER || '';
      const codeHash = crypto.createHash('sha256').update(pepper + code).digest('hex');
      const expiresAt = new Date(Date.now() + (parseInt(process.env.OTP_TTL_MINUTES || '10', 10) * 60 * 1000)).toISOString();

      // upsert using onConflict so we reliably update existing by user_id
      const payload = {
        id,
        user_id: userId,
        phone_number: normalized,
        verified: false,
        verification_code_hash: codeHash,
        verification_expires_at: expiresAt,
        verification_attempts: 0,
        updated_at: new Date().toISOString(),
      };

      // Avoid ON CONFLICT usage because the DB may not yet have unique constraints.
      // Do a select -> update if row exists, otherwise insert.
      const existing = await supabase.from('whatsapp_users').select('id').eq('user_id', userId).limit(1).single();
      if (existing.error && existing.status !== 406) {
        // 406 indicates no rows (supabase-js sometimes returns 406 for no rows with single())
      }
      let dbErr = null;
      if (existing.data && existing.data.id) {
        const upd = await supabase.from('whatsapp_users').update({ verification_code_hash: payload.verification_code_hash, verification_expires_at: payload.verification_expires_at, verification_attempts: 0, phone_number: payload.phone_number, updated_at: payload.updated_at }).eq('user_id', userId).select().limit(1).single();
        if (upd.error) dbErr = upd.error;
      } else {
        const ins = await supabase.from('whatsapp_users').insert([payload]).select().limit(1).single();
        if (ins.error) dbErr = ins.error;
      }
      if (dbErr) {
        console.error('whatsapp verify db error', dbErr);
        // In local debug mode, return DB error details to help debugging (do not enable in prod)
        if (process.env.DEBUG_NO_AUTH === '1') {
          return res.status(500).json({ error: 'failed to store verification', detail: dbErr });
        }
        return res.status(500).json({ error: 'failed to store verification' });
      }

      // send via WhatsApp API (Meta Cloud) — Twilio removed; use only WhatsApp when configured

      // send via WhatsApp API (prefers Meta Cloud)
      const _waPhoneId = getWAPhoneId();
      const _waToken = getWAToken();
      const _waTemplate = getWATemplateName();
      const _waTemplateLang = getWATemplateLang();
  if (_waPhoneId && _waToken) {
        const url = `https://graph.facebook.com/v15.0/${_waPhoneId}/messages`;
        let payload: any;
        if (_waTemplate) {
          // Send as template message. The template must be pre-approved in Meta Business Manager.
          payload = {
            messaging_product: 'whatsapp',
            to: normalized,
            type: 'template',
            template: {
              name: _waTemplate,
              language: { code: _waTemplateLang },
              components: [
                {
                  type: 'body',
                  parameters: [
                    { type: 'text', text: code }
                  ]
                }
              ]
            }
          };
        } else {
          // Free-form text (works only within 24-hour session window)
          payload = {
            messaging_product: 'whatsapp',
            to: normalized,
            text: { body: `Your verification code: ${code}` },
          };
        }
        const resp = await fetch(url, { method: 'POST', headers: { Authorization: `Bearer ${_waToken}`, 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
        const respText = await resp.text();
        // try to parse JSON
        let parsed: any = null;
        try { parsed = respText ? JSON.parse(respText) : null; } catch (e) { parsed = null; }
        if (!resp.ok) {
          console.error('whatsapp send failed', resp.status, respText);
          // If template missing/not approved (132001), attempt a free-form text fallback
          const errCode = parsed?.error?.code || parsed?.error?.error_data?.code || null;
          if (errCode === 132001) {
            try {
              const fallbackPayload = { messaging_product: 'whatsapp', to: normalized, text: { body: `Your verification code: ${code}` } };
              const fallbackResp = await fetch(url, { method: 'POST', headers: { Authorization: `Bearer ${_waToken}`, 'Content-Type': 'application/json' }, body: JSON.stringify(fallbackPayload) });
              const fallbackText = await fallbackResp.text();
              let fallbackParsed: any = null; try { fallbackParsed = fallbackText ? JSON.parse(fallbackText) : null; } catch (e) { fallbackParsed = null; }
              setLastProviderResponse('whatsapp', { templateError: parsed || respText, fallback: fallbackParsed || fallbackText, fallbackStatus: fallbackResp.status });
              if (!fallbackResp.ok) {
                return res.status(502).json({ ok: false, provider: 'whatsapp', status: fallbackResp.status, detail: fallbackParsed || fallbackText, templateError: parsed || respText });
              }
              return res.json({ ok: true, provider: 'whatsapp', raw: fallbackParsed || fallbackText, note: 'sent_via_free_text_after_missing_template' });
            } catch (e: any) {
              console.error('whatsapp fallback send error', e);
              setLastProviderResponse('whatsapp', { templateError: parsed || respText, fallbackError: String(e) });
              return res.status(502).json({ ok: false, provider: 'whatsapp', error: String(e), templateError: parsed || respText });
            }
          }
          setLastProviderResponse('whatsapp', parsed || respText);
          return res.status(502).json({ ok: false, provider: 'whatsapp', status: resp.status, detail: parsed || respText });
        }
        setLastProviderResponse('whatsapp', parsed || respText);
        return res.json({ ok: true, provider: 'whatsapp', raw: parsed || respText });
  } else {
        // In dev when token not configured, return code in response for easier testing
        console.log(`WhatsApp verification code for ${normalized}: ${code}`);
        setLastProviderResponse('dev', { debugCode: code });
        return res.json({ ok: true, provider: 'dev', debugCode: code, phone: normalized });
      }
    } catch (err: any) {
      console.error('whatsapp verify error', err);
      return res.status(500).json({ ok: false, provider: 'internal', error: String(err) });
    }
  });

  // Confirm verification code
  app.post('/api/whatsapp/confirm', async (req, res) => {
    try {
      const { userId, code } = req.body;
      if (!userId || !code) return res.status(400).json({ error: 'userId and code required' });
      const { data, error } = await supabase.from('whatsapp_users').select('*').eq('user_id', userId).single();
      if (error || !data) return res.status(404).json({ error: 'not found' });

      // Check expiry
      if (data.verification_expires_at && new Date(data.verification_expires_at) < new Date()) {
        return res.status(400).json({ error: 'expired' });
      }

      // Check attempts
      const attempts = data.verification_attempts || 0;
      const maxAttempts = parseInt(process.env.OTP_MAX_ATTEMPTS || '5', 10);
      if (attempts >= maxAttempts) return res.status(400).json({ error: 'too_many_attempts' });

      // verify by hashing
      const pepper = process.env.OTP_PEPPER || '';
      const codeHash = crypto.createHash('sha256').update(pepper + code).digest('hex');
      if (data.verification_code_hash !== codeHash) {
        // increment attempts
        await supabase.from('whatsapp_users').update({ verification_attempts: attempts + 1, updated_at: new Date().toISOString() }).eq('user_id', userId);
        return res.status(400).json({ error: 'invalid code' });
      }

      // Success — mark verified and clear sensitive fields
      await supabase.from('whatsapp_users').update({ verified: true, verification_code_hash: null, verification_expires_at: null, verification_attempts: 0, last_verified_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq('user_id', userId);
      return res.json({ status: 'verified' });
    } catch (err: any) {
      console.error('whatsapp confirm error', err);
      return res.status(500).json({ error: String(err) });
    }
  });

  // Send message
  app.post('/api/whatsapp/send', async (req, res) => {
    try {
      const { userId, to, message } = req.body;
      if (!userId || !to || !message) return res.status(400).json({ error: 'userId,to,message required' });
      // find verified sender
      const { data } = await supabase.from('whatsapp_users').select('*').eq('user_id', userId).eq('verified', true).single();
      if (!data) return res.status(400).json({ error: 'no verified whatsapp number for user' });

      // send via Meta Cloud API
  const _waPhoneId2 = getWAPhoneId();
  const _waToken2 = getWAToken();
  if (_waPhoneId2 && _waToken2) {
  const url = `https://graph.facebook.com/v15.0/${_waPhoneId2}/messages`;
  const body = { messaging_product: 'whatsapp', to, text: { body: message } };
  const resp = await fetch(url, { method: 'POST', headers: { Authorization: `Bearer ${_waToken2}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
        const txt = await resp.text();
        if (!resp.ok) {
          console.error('whatsapp send failed', resp.status, txt);
          let parsed: any = txt;
          try { parsed = JSON.parse(txt); } catch (e) {}
          return res.status(502).json({ error: 'whatsapp_send_failed', status: resp.status, detail: parsed || txt });
        }
        // store message
        await supabase.from('whatsapp_messages').insert([{ id: randomUUID(), user_id: userId, "from": data.phone_number, "to": to, message, timestamp: new Date().toISOString() }]);
        return res.json({ status: 'sent', raw: txt });
      }

      // fallback: log and store
      console.log(`(dev) send whatsapp from ${data.phone_number} to ${to}: ${message}`);
  await supabase.from('whatsapp_messages').insert([{ id: randomUUID(), user_id: userId, "from": data.phone_number, "to": to, message, timestamp: new Date().toISOString() }]);
      return res.json({ status: 'sent_dev' });
    } catch (err: any) {
      console.error('whatsapp send error', err);
      return res.status(500).json({ error: String(err) });
    }
  });

  // Webhook for incoming messages
  app.post('/api/whatsapp/receive', async (req, res) => {
    try {
      // Meta webhook payload parsing will vary. For now, try to extract common fields.
      const payload = req.body;
      console.log('whatsapp webhook payload', JSON.stringify(payload).slice(0, 1000));
      // Very simple extraction for dev/testing
      const entry = (payload.entry && payload.entry[0]) || null;
      const changes = entry?.changes && entry.changes[0];
      const message = changes?.value?.messages && changes.value.messages[0];
      if (message) {
        const from = message.from;
        const text = message.text?.body || message.body || '';
        // try to find user by phone
        const { data } = await supabase.from('whatsapp_users').select('*').eq('phone_number', from).single();
        const userId = data?.user_id || null;
        await supabase.from('whatsapp_messages').insert([{ id: randomUUID(), user_id: userId, "from": from, "to": changes?.value?.metadata?.phone_number_id || getWAPhoneId() || '', message: text, timestamp: new Date().toISOString() }]);
      }
      res.status(200).send('ok');
    } catch (err: any) {
      console.error('whatsapp receive error', err);
      res.status(500).send('error');
    }
  });
}

// Exported helper to attempt sending an OTP payload to a normalized phone.
// Returns a plain object describing provider result (ok: boolean, provider, detail/raw...).
export async function sendOtpToPhone(normalizedPhone: string, code: string) {
  // replicate the provider selection logic used in verify
  try {
    // WhatsApp
    const _waPhoneIdLocal = getWAPhoneId();
    const _waTokenLocal = getWAToken();
    const _waTemplateLocal = getWATemplateName();
    const _waTemplateLangLocal = getWATemplateLang();
    if (_waPhoneIdLocal && _waTokenLocal) {
      const url = `https://graph.facebook.com/v15.0/${_waPhoneIdLocal}/messages`;
      let payload: any;
      if (_waTemplateLocal) {
        payload = { messaging_product: 'whatsapp', to: normalizedPhone, type: 'template', template: { name: _waTemplateLocal, language: { code: _waTemplateLangLocal }, components: [{ type: 'body', parameters: [{ type: 'text', text: code }] }] } };
      } else {
        payload = { messaging_product: 'whatsapp', to: normalizedPhone, text: { body: `Your verification code: ${code}` } };
      }
      const resp = await fetch(url, { method: 'POST', headers: { Authorization: `Bearer ${_waTokenLocal}`, 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      const respText = await resp.text();
      if (!resp.ok) {
        let parsed: any = respText; try { parsed = JSON.parse(respText); } catch (e) {}
        setLastProviderResponse('whatsapp', parsed || respText);
        return { ok: false, provider: 'whatsapp', status: resp.status, detail: parsed || respText };
      }
      setLastProviderResponse('whatsapp', respText);
      return { ok: true, provider: 'whatsapp', raw: respText };
    }

    // dev fallback
    setLastProviderResponse('dev', { debugCode: code });
    return { ok: true, provider: 'dev', debugCode: code, phone: normalizedPhone };
  } catch (err: any) {
    setLastProviderResponse('internal', { error: String(err) });
    return { ok: false, provider: 'internal', error: String(err) };
  }
}

// Expose a helper to read masked status for admin endpoints
export function getWhatsappRuntimeStatus() {
  return {
    waPhoneIdConfigured: !!getWAPhoneId(),
    waTokenConfigured: !!getWAToken(),
    twilioConfigured: !!getTwilioSid() && !!getTwilioAuth() && !!getTwilioFrom(),
  };
}

// Getter to return the last provider response (masked) for admin endpoints.
// We keep lastProviderResponse in module scope via closure inside registerWhatsappRoutes.
// To avoid breaking the existing function, we expose a safe getter that attempts to read
// a global symbol set when registerWhatsappRoutes runs.
export function getLastProviderResponse() {
  try {
    // runtime may set global.__whatsapp_last_provider_response when registerWhatsappRoutes runs
    // return that if present
    const g: any = globalThis as any;
    return g.__whatsapp_last_provider_response || null;
  } catch (e) {
    return null;
  }
}

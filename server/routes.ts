import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { reminders, type ReminderRow } from "./storage";
import { getPreferences, upsertPreferences } from "./prefs";
import { upsertUserCredentials } from './integrations';
import { registerWhatsappRoutes, getWhatsappRuntimeStatus, getLastProviderResponse } from './whatsapp';
import { insertNotification, listNotifications } from './notifications';
import admin from 'firebase-admin';
import { randomUUID } from 'crypto';

// Temporary connect sessions for authenticated SSE setup
const SSE_CONNECT_SESSIONS: Map<string, { uid: string; expiresAt: number }> = new Map();
const SSE_CONNECT_TTL = 1000 * 60; // 60s

// OAuth connect sessions for Google (state -> uid)
const OAUTH_SESSIONS: Map<string, { uid: string; expiresAt: number }> = new Map();
const OAUTH_SESSION_TTL = 1000 * 60 * 15; // 15 minutes

// Express request augmentation: attach uid when verified
declare module 'express-serve-static-core' {
  interface Request {
    uid?: string;
  }
}

async function verifyFirebaseToken(req: Request, res: Response, next: NextFunction) {
  let idToken: string | undefined;
  const auth = req.headers.authorization;
  if (auth && auth.startsWith('Bearer ')) {
    idToken = auth.split(' ')[1];
  } else if (req.query && typeof req.query.token === 'string') {
    // allow token via query for EventSource (browser can't set Authorization header)
    idToken = req.query.token as string;
  }
  if (!idToken) {
    return res.status(401).json({ message: 'ID token missing' });
  }
  try {
    if (!admin.apps.length) return res.status(500).json({ message: 'Firebase Admin not initialized' });
    const decoded = await admin.auth().verifyIdToken(idToken);
    req.uid = decoded.uid;
    next();
  } catch (err: any) {
    console.error('Token verification failed', err);
    return res.status(401).json({ message: 'Invalid or expired ID token' });
  }
}

// Allow multiple env var names so local dev (VITE_ prefixed) and server envs both work.
const N8N_WHATSAPP = process.env.N8N_WHATSAPP_WEBHOOK || process.env.N8N_WEBHOOK_URL || process.env.VITE_N8N_WEBHOOK_URL || process.env.VITE_N8N_WEBHOOK || "http://localhost:5678/webhook-test/whatsapp-mcp";
const N8N_GMAIL = process.env.N8N_GMAIL_WEBHOOK;

// SSE clients per user
const SSE_CLIENTS: Map<string, Set<import("express").Response>> = new Map();

function sendSSE(res: import("express").Response, event: string, data: any) {
  res.write(`event: ${event}\n`);
  res.write(`data: ${JSON.stringify(data)}\n\n`);
}

export async function registerRoutes(app: Express): Promise<Server> {
  // put application routes here
  // prefix all routes with /api

  // use storage to perform CRUD operations on the storage interface
  // e.g. storage.insertUser(user) or storage.getUserByUsername(username)

  const httpServer = createServer(app);

  // Register whatsapp-related routes (verify, confirm, send, receive)
  try {
    registerWhatsappRoutes(app);
  } catch (e) {
    console.error('Failed to register whatsapp routes', e);
  }

  // Proxy endpoint to forward messages to the configured n8n webhook
  app.post("/api/webhook/proxy", async (req, res) => {
    const webhookUrl = process.env.N8N_WEBHOOK_URL || process.env.VITE_N8N_WEBHOOK_URL || "http://localhost:5678/webhook-test/whatsapp-mcp";

    try {
      const forwarded = await fetch(webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(req.body),
      });

      const text = await forwarded.text();
      res.status(forwarded.status).contentType(forwarded.headers.get("content-type") || "text/plain").send(text);
    } catch (err: any) {
      res.status(502).json({ message: "Failed to forward to n8n webhook", error: String(err) });
    }
  });

  // Note: do not override /settings so Vite dev middleware or static serving can handle SPA routes

  // DEV: allow unauthenticated oauth start when DEBUG_NO_AUTH=1 for local testing
  // This helps when the frontend dev server serves index.html for /api/* and
  // the client can't include an ID token. Enable by setting DEBUG_NO_AUTH=1.
  if (process.env.DEBUG_NO_AUTH === '1') {
    // Debug-only oauth start. For safety, do NOT default to a literal UID.
    // Require explicit uid via query param or DEV_AUTH_BYPASS_UID env var.
    app.get('/api/oauth/google/start', async (req, res) => {
      try {
        const providedUid = (req.query.uid as string) || process.env.DEV_AUTH_BYPASS_UID;
        if (!providedUid) return res.status(400).json({ message: 'DEBUG_NO_AUTH enabled but no uid provided. Pass ?uid=<your-test-uid> or set DEV_AUTH_BYPASS_UID in env.' });
        if (providedUid === 'debug-user') return res.status(400).json({ message: 'Using literal "debug-user" is not allowed. Provide a real test UID.' });
        const uid = providedUid;
        const state = randomUUID();
        OAUTH_SESSIONS.set(state, { uid, expiresAt: Date.now() + OAUTH_SESSION_TTL });

    // allow using a Vite-prefixed env var for local dev convenience (public client id only)
    const clientId = process.env.GOOGLE_CLIENT_ID || process.env.VITE_GOOGLE_CLIENT_ID || process.env.VITE_GOOGLE_CLIENT_ID;
  const redirectUri = process.env.GOOGLE_OAUTH_REDIRECT_URI || `${process.env.SERVER_BASE_URL || 'http://localhost:5050'}/api/oauth/google/callback`;
    if (!clientId) return res.status(500).json({ message: 'GOOGLE_CLIENT_ID not configured on server. Set GOOGLE_CLIENT_ID in server/.env (or VITE_GOOGLE_CLIENT_ID for local dev).' });

        const scope = encodeURIComponent([
          'https://www.googleapis.com/auth/gmail.readonly',
          'https://www.googleapis.com/auth/gmail.send',
          'https://www.googleapis.com/auth/gmail.modify',
        ].join(' '));

        const url = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${encodeURIComponent(clientId)}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=${scope}&access_type=offline&prompt=consent&state=${encodeURIComponent(state)}`;
        return res.json({ url });
      } catch (err: any) {
        console.error('oauth/google/start debug error', err);
        return res.status(500).json({ message: String(err) });
      }
    });
  }

  // Start Google OAuth: creates a short-lived state and returns the Google auth URL
  app.get('/api/oauth/google/start', verifyFirebaseToken, async (req, res) => {
    try {
      const uid = req.uid!;
      const state = randomUUID();
      OAUTH_SESSIONS.set(state, { uid, expiresAt: Date.now() + OAUTH_SESSION_TTL });

    // allow a dev fallback to VITE_GOOGLE_CLIENT_ID so frontend-only dev setups can test the flow
    const clientId = process.env.GOOGLE_CLIENT_ID || process.env.VITE_GOOGLE_CLIENT_ID;
  const redirectUri = process.env.GOOGLE_OAUTH_REDIRECT_URI || `${process.env.SERVER_BASE_URL || 'http://localhost:5050'}/api/oauth/google/callback`;
    if (!clientId) return res.status(500).json({ message: 'GOOGLE_CLIENT_ID not configured on server. Set GOOGLE_CLIENT_ID in server/.env (or VITE_GOOGLE_CLIENT_ID for local dev).' });

      const scope = encodeURIComponent([
        'https://www.googleapis.com/auth/gmail.readonly',
        'https://www.googleapis.com/auth/gmail.send',
        'https://www.googleapis.com/auth/gmail.modify',
      ].join(' '));

      const url = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${encodeURIComponent(clientId)}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=${scope}&access_type=offline&prompt=consent&state=${encodeURIComponent(state)}`;
      return res.json({ url });
    } catch (err: any) {
      console.error('oauth/google/start error', err);
      return res.status(500).json({ message: String(err) });
    }
  });

  // OAuth callback: Google will redirect here with code and state
  app.get('/api/oauth/google/callback', async (req, res) => {
    try {
      const code = req.query.code as string | undefined;
      const state = req.query.state as string | undefined;
      if (!code || !state) return res.status(400).send('Missing code or state');

      const session = OAUTH_SESSIONS.get(state);
      if (!session || session.expiresAt < Date.now()) return res.status(400).send('Invalid or expired state');
      // consume
      OAUTH_SESSIONS.delete(state);

      const uid = session.uid;

      const redirectUri = process.env.GOOGLE_OAUTH_REDIRECT_URI || `${process.env.APP_BASE_URL || 'http://localhost:5173'}/api/oauth/google/callback`;
      const clientId = process.env.GOOGLE_CLIENT_ID || process.env.VITE_GOOGLE_CLIENT_ID;
      const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    if (!clientId || !clientSecret) {
      console.error('Missing Google client credentials');
      return res.status(500).send('Server not configured for Google OAuth. Ensure GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET are set in server/.env. For local testing you can set VITE_GOOGLE_CLIENT_ID for the client id, but the secret must be set as GOOGLE_CLIENT_SECRET on the server.');
    }

      // exchange code for tokens
      const params = new URLSearchParams();
      params.set('code', code);
      params.set('client_id', clientId);
      params.set('client_secret', clientSecret);
      params.set('redirect_uri', redirectUri);
      params.set('grant_type', 'authorization_code');

      const tokenResp = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: params.toString(),
      });

      const tokenBody = await tokenResp.text();
      let tokenJson: any = null;
      try { tokenJson = tokenBody ? JSON.parse(tokenBody) : {}; } catch (e) { tokenJson = { raw: tokenBody }; }

      if (!tokenResp.ok) {
        console.error('Google token exchange failed', tokenResp.status, tokenBody);
        return res.status(502).send('Failed to exchange code for tokens');
      }

      const { access_token, refresh_token, expires_in, id_token } = tokenJson;
      const expiryIso = expires_in ? new Date(Date.now() + Number(expires_in) * 1000).toISOString() : null;

      // persist credentials for user (uses upsertUserCredentials from integrations)
      try {
        await upsertUserCredentials(uid, 'gmail', {
          gmail_client_id: clientId,
          gmail_client_secret: clientSecret ? '[REDACTED]' : '',
          gmail_access_token: access_token,
          gmail_refresh_token: refresh_token,
          token_expiry: expiryIso,
        });
      } catch (err: any) {
        console.error('Failed to upsert Gmail credentials', err);
        // continue to redirect user but log server error
      }

    // redirect user back to server's settings handoff with query so client sees ?connected=gmail
    return res.redirect('/settings?connected=gmail');
    } catch (err: any) {
      console.error('oauth/google/callback error', err);
      return res.status(500).send('OAuth callback failed');
    }
  });

  // Reminders CRUD
  app.get("/api/reminders", verifyFirebaseToken, async (req, res) => {
    const uid = req.uid!;
    try {
      const list = await (reminders as any).listByUser ? (reminders as any).listByUser(uid) : await reminders.listAll();
      res.json(list);
    } catch (err: any) {
      res.status(500).json({ message: String(err) });
    }
  });

  app.post("/api/reminders", verifyFirebaseToken, async (req, res) => {
    try {
      const body = req.body;
      // require minimal fields
      if (!body.type || !body.datetime || !body.message) {
        return res.status(400).json({ message: "type, datetime, message required" });
      }
      const user_id = req.uid || body.user_id;
      if (!user_id) return res.status(400).json({ message: 'user_id not provided and no auth' });
      const r = await reminders.create({
        user_id,
        type: body.type,
        datetime: new Date(body.datetime).toISOString(),
        message: body.message,
        user_phone: body.user_phone,
        user_email: body.user_email,
        user_token: body.user_token,
      });
      // Immediately forward gmail-type reminders to the configured n8n Gmail webhook so
      // the workflow can run (e.g. send email or schedule delivery). This forward is
      // attempted once at creation time for gmail reminders and will mark the reminder
      // as sent on success or failed on error to prevent duplicate sends.
      (async () => {
        try {
          if (r && r.type === 'gmail') {
            // Attempt to enrich payload with Firebase user profile data (displayName, email, photoURL)
            let userName: string | undefined = undefined;
            let userPhoto: string | undefined = undefined;
            let userEmail: string | undefined = r.user_email ?? body.user_email ?? undefined;
            try {
              if (admin && admin.apps && admin.apps.length) {
                try {
                  const u = await admin.auth().getUser(r.user_id);
                  userName = u.displayName || undefined;
                  userPhoto = u.photoURL || undefined;
                  if (!userEmail && u.email) userEmail = u.email;
                } catch (e) {
                  console.warn('Failed to fetch Firebase user for n8n payload enrichment', e);
                }
              }
            } catch (e) {
              // ignore
            }

            const payload: any = {
              reminderId: r.id,
              userId: r.user_id,
              userName: userName,
              userAvatar: userPhoto,
              email: userEmail,
              token: r.user_token || body.user_token,
              message: r.message,
              datetime: r.datetime,
            };

            try {
              const resp = await fetch(N8N_GMAIL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
              if (!resp.ok) {
                const txt = await resp.text().catch(() => '');
                console.warn('n8n gmail webhook responded with non-ok status', resp.status, txt);
                await reminders.markFailed(r.id);
              } else {
                await reminders.markSent(r.id);
              }
            } catch (err) {
              console.error('Failed to forward gmail reminder to n8n webhook', err);
              await reminders.markFailed(r.id);
            }
          }
        } catch (err) {
          console.error('Error in async n8n forward handler', err);
        }
      })();
      res.status(201).json(r);
    } catch (err: any) {
      res.status(500).json({ message: String(err) });
    }
  });

  // Endpoints to save integration credentials (Gmail / WhatsApp)
  app.post('/api/external/save-gmail-credentials', verifyFirebaseToken, async (req, res) => {
    try {
      const uid = req.uid!;
      const body = req.body;
      // minimal validation
      if (!body) return res.status(400).json({ status: 'error', error: 'body missing' });
      // If credentials is null, treat as delete request
      if (body.credentials === null) {
        try {
          const { deleteUserCredentials } = await import('./integrations');
          await deleteUserCredentials(uid, 'gmail');
          return res.json({ status: 'success', deleted: true });
        } catch (err: any) {
          console.error('delete gmail credentials failed', err);
          return res.status(500).json({ status: 'error', error: String(err) });
        }
      }

      if (!body.credentials) return res.status(400).json({ status: 'error', error: 'credentials required' });
      // Don't store raw client secret in public logs — server persists to Supabase
      await upsertUserCredentials(uid, 'gmail', { client_id: body.credentials.gmailClientId, client_secret: body.credentials.gmailClientSecret, refresh_token: body.credentials.gmailRefreshToken, api_key: body.credentials.gmailApiKey });
      return res.json({ status: 'success' });
    } catch (err: any) {
      console.error('save-gmail-credentials error', err?.stack || err);
      const payload: any = { status: 'error', error: err?.message ?? String(err) };
      if (err?.code) payload.code = err.code;
      if (err?.details) payload.details = err.details;
      // Return 200 with error payload to avoid browser-level 500; logs still contain details.
      return res.json({ ...payload, httpStatus: 500 });
    }
  });

  app.post('/api/external/save-whatsapp-credentials', verifyFirebaseToken, async (req, res) => {
    try {
      const uid = req.uid!;
      const body = req.body;
      if (!body || !body.credentials) return res.status(400).json({ status: 'error', error: 'credentials required' });
      await upsertUserCredentials(uid, 'whatsapp', { api_key: body.credentials.whatsappApiKey, phone_number_id: body.credentials.whatsappPhoneNumberId, business_account_id: body.credentials.whatsappBusinessAccountId, access_token: body.credentials.whatsappAccessToken });
      return res.json({ status: 'success' });
    } catch (err: any) {
      console.error('save-whatsapp-credentials error', err?.stack || err);
      const payload: any = { status: 'error', error: err?.message ?? String(err) };
      if (err?.code) payload.code = err.code;
      if (err?.details) payload.details = err.details;
      return res.json({ ...payload, httpStatus: 500 });
    }
  });

  // Disconnect Gmail (explicit route)
  app.post('/api/integrations/disconnect', verifyFirebaseToken, async (req, res) => {
    try {
      const uid = req.uid!;
      const { deleteUserCredentials } = await import('./integrations');
      await deleteUserCredentials(uid, 'gmail');
      return res.json({ status: 'success' });
    } catch (err: any) {
      console.error('disconnect integration error', err);
      return res.status(500).json({ status: 'error', error: String(err) });
    }
  });

  // Disconnect WhatsApp: remove whatsapp_users row(s), messages, and stored credentials for the user
  app.post('/api/integrations/disconnect-whatsapp', verifyFirebaseToken, async (req, res) => {
    try {
      const uid = req.uid!;
      const { deleteUserCredentials } = await import('./integrations');
      // delete rows in Supabase directly using service role client
      try {
        const { createClient } = await import('@supabase/supabase-js');
        const SUPABASE_URL = process.env.SUPABASE_URL!;
        const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
        const sb = createClient(SUPABASE_URL, SUPABASE_KEY);
        const { error: delMsgErr } = await sb.from('whatsapp_messages').delete().eq('user_id', uid);
        if (delMsgErr) console.error('Failed to delete whatsapp_messages for user', delMsgErr);
        const { error: delUserErr } = await sb.from('whatsapp_users').delete().eq('user_id', uid);
        if (delUserErr) console.error('Failed to delete whatsapp_users for user', delUserErr);
      } catch (e) {
        console.error('Error deleting whatsapp rows', e);
      }

      // remove stored credentials (if present)
      try {
        await deleteUserCredentials(uid, 'whatsapp');
      } catch (e) {
        console.error('Failed to delete whatsapp credentials', e);
      }

      return res.json({ status: 'success' });
    } catch (err: any) {
      console.error('disconnect-whatsapp error', err);
      return res.status(500).json({ status: 'error', error: String(err) });
    }
  });

  // DEBUG: unauthenticated save route (local-only). Enabled when DEBUG_NO_AUTH=1.
  if (process.env.DEBUG_NO_AUTH === '1') {
    app.post('/api/debug/save-credentials', async (req, res) => {
      try {
        const { userId, type, credentials } = req.body;
        if (!userId || !type || !credentials) return res.status(400).json({ status: 'error', error: 'userId, type, credentials required' });
        const { upsertUserCredentials } = await import('./integrations');
        await upsertUserCredentials(userId, type, credentials);
        return res.json({ status: 'success' });
      } catch (err: any) {
        console.error('DEBUG save-credentials error', err?.stack || err);
        return res.status(500).json({ status: 'error', error: err?.message ?? String(err) });
      }
    });

    // DEBUG: unauthenticated whatsapp runtime status (includes masked provider response)
    app.get('/api/debug/whatsapp-status', async (req, res) => {
      try {
        const status = getWhatsappRuntimeStatus();
        const last = getLastProviderResponse();
        return res.json({ status, last });
      } catch (err: any) {
        console.error('debug whatsapp-status error', err);
        return res.status(500).json({ error: String(err) });
      }
    });

    // DEBUG: inspect WA_TOKEN using Facebook's debug_token (requires FB_APP_ID|FB_APP_SECRET in .env)
    app.get('/api/debug/whatsapp-token-debug', async (req, res) => {
      try {
        const token = process.env.WA_TOKEN;
        const appId = process.env.FB_APP_ID;
        const appSecret = process.env.FB_APP_SECRET;
        if (!token) return res.status(400).json({ error: 'WA_TOKEN not configured' });
        if (!appId || !appSecret) return res.status(400).json({ error: 'FB_APP_ID or FB_APP_SECRET not configured' });
        const appAccess = `${appId}|${appSecret}`;
        const url = `https://graph.facebook.com/debug_token?input_token=${encodeURIComponent(token)}&access_token=${encodeURIComponent(appAccess)}`;
        const resp = await fetch(url, { method: 'GET' });
        const bodyText = await resp.text();
        let json: any = null;
        try { json = bodyText ? JSON.parse(bodyText) : {}; } catch (e) { json = { raw: bodyText }; }
        // mask token-related fields before returning
        if (json && json.data) {
          if (json.data.app_id) json.data.app_id = String(json.data.app_id);
          if (json.data.scopes) json.data.scopes = json.data.scopes;
          if (json.data.expires_at) json.data.expires_at = json.data.expires_at;
        }
        return res.status(resp.ok ? 200 : 502).json({ ok: resp.ok, status: resp.status, body: json });
      } catch (err: any) {
        console.error('debug whatsapp-token-debug error', err);
        return res.status(500).json({ error: String(err) });
      }
    });
  }

  app.delete("/api/reminders/:id", verifyFirebaseToken, async (req, res) => {
    const id = req.params.id;
    try {
      const row = await reminders.get(id);
      if (!row) return res.status(404).json({ message: 'not found' });
      if (row.user_id !== req.uid) return res.status(403).json({ message: 'forbidden' });
      const ok = await reminders.delete(id);
      res.json({ ok });
    } catch (err: any) {
      res.status(500).json({ message: String(err) });
    }
  });

  // Update reminder (partial)
  app.patch('/api/reminders/:id', verifyFirebaseToken, async (req, res) => {
    const id = req.params.id;
    const body = req.body;
    try {
      const row = await reminders.get(id);
      if (!row) return res.status(404).json({ message: 'not found' });
      if (row.user_id !== req.uid) return res.status(403).json({ message: 'forbidden' });
      const updates: any = {};
      if (body.status) updates.status = body.status;
      if (body.message) updates.message = body.message;
      if (body.datetime) updates.datetime = new Date(body.datetime).toISOString();
      if (Object.keys(updates).length === 0) return res.status(400).json({ message: 'no updates' });
      const { error } = await (reminders as any).supabase.from('reminders').update(updates).eq('id', id);
      if (error) return res.status(500).json({ message: String(error) });
      res.json({ ok: true });
    } catch (err: any) {
      res.status(500).json({ message: String(err) });
    }
  });

  // SSE endpoint for general reminders
  // Legacy SSE that accepts token in query (kept for backwards compatibility)
  app.get("/api/sse/:userId", verifyFirebaseToken, (req, res) => {
    const userId = req.params.userId;
    if (userId !== req.uid) return res.status(403).end();
    res.set({
      Connection: "keep-alive",
      "Cache-Control": "no-cache",
      "Content-Type": "text/event-stream",
    });
    res.flushHeaders?.();

    const set = SSE_CLIENTS.get(userId) ?? new Set();
    set.add(res);
    SSE_CLIENTS.set(userId, set);

    req.on("close", () => {
      set.delete(res);
      if (set.size === 0) SSE_CLIENTS.delete(userId);
    });
  });

  // New secure connect flow: client POSTs to /api/sse/connect with Authorization header (or x-dev-uid when DEV_AUTH_BYPASS=1)
  // Server verifies token and returns a short-lived connectId. Client then opens EventSource to /api/sse/stream/:connectId
  app.post('/api/sse/connect', verifyFirebaseToken, (req, res) => {
    const uid = req.uid!;
    const connectId = randomUUID();
    SSE_CONNECT_SESSIONS.set(connectId, { uid, expiresAt: Date.now() + SSE_CONNECT_TTL });
    res.json({ connectId, ttl: SSE_CONNECT_TTL });
  });

  // Stream endpoint: no auth header required (browser EventSource can't send headers). It looks up the connectId created above.
  app.get('/api/sse/stream/:connectId', (req, res) => {
    const connectId = req.params.connectId;
    const session = SSE_CONNECT_SESSIONS.get(connectId);
    if (!session || session.expiresAt < Date.now()) {
      return res.status(404).json({ message: 'connectId not found or expired' });
    }
    // consume the session (one-time)
    SSE_CONNECT_SESSIONS.delete(connectId);

    const uid = session.uid;
    res.set({
      Connection: 'keep-alive',
      'Cache-Control': 'no-cache',
      'Content-Type': 'text/event-stream',
    });
    res.flushHeaders?.();

    const set = SSE_CLIENTS.get(uid) ?? new Set();
    set.add(res);
    SSE_CLIENTS.set(uid, set);

    req.on('close', () => {
      set.delete(res);
      if (set.size === 0) SSE_CLIENTS.delete(uid);
    });
  });

  // In-process poller (every 60s) to dispatch due reminders
  setInterval(async () => {
    try {
      // fetch only gmail reminders that are due (we handle gmail sends separately and
      // ensure each reminder is forwarded only once). Use a small lead time so Gmail
      // reminders can be processed slightly early if needed.
      const leadMsForGmail = 2 * 60 * 1000; // 2 minutes
      const gmailReminders = await reminders.fetchDuePending(500, leadMsForGmail, 'gmail');
      const merged = gmailReminders.sort((a: any, b: any) => new Date(a.datetime).getTime() - new Date(b.datetime).getTime());
      // iterate over merged (deduped) reminders
      for (const r of merged) {
        // iterate over merged list instead of just due
        try {
          // We only process gmail reminders in the poller. Other types are ignored here.
          if ((r as any).type === "gmail") {
            // Enrich payload with Firebase user profile where possible
            const payload = { phone: r.user_phone, message: r.message };
            const resp = await fetch(N8N_WHATSAPP, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
            if (!resp.ok) {
              await reminders.markFailed(r.id);
            } else {
              await reminders.markSent(r.id);
              // also push SSE to connected clients for this user (so active tab gets notified)
              try {
                const clients = SSE_CLIENTS.get(r.user_id);
                const payloadEvent = { id: r.id, message: r.message, datetime: r.datetime, type: r.type };
                if (clients && clients.size > 0) {
                  for (const res of Array.from(clients)) {
                    sendSSE(res, 'reminder', payloadEvent);
                  }
                  // persist notification
                  try {
                    await insertNotification({ reminder_id: r.id, user_id: r.user_id, message: r.message, type: r.type, delivered_at: new Date().toISOString() });
                  } catch (err) {
                    console.error('Failed to persist notification for whatsapp', err);
                  }
                }
              } catch (err) {
                console.error('Failed to send SSE for whatsapp reminder', err);
              }
            }
          } else if (r.type === "gmail") {
            // Enrich payload with Firebase user profile where possible
            let userName: string | undefined = undefined;
            let userPhoto: string | undefined = undefined;
            let userEmail: string | undefined = r.user_email ?? undefined;
            try {
              if (admin && admin.apps && admin.apps.length) {
                try {
                  const u = await admin.auth().getUser(r.user_id);
                  userName = u.displayName || undefined;
                  userPhoto = u.photoURL || undefined;
                  if (!userEmail && u.email) userEmail = u.email;
                } catch (e) {
                  console.warn('Failed to fetch Firebase user for n8n payload enrichment (poller)', e);
                }
              }
            } catch (e) {
              // ignore
            }

            const payload = { reminderId: r.id, userId: r.user_id, userName: userName, userAvatar: userPhoto, email: userEmail, token: r.user_token, message: r.message, datetime: r.datetime };
            const resp = await fetch(N8N_GMAIL, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
            if (!resp.ok) {
              await reminders.markFailed(r.id);
            } else {
              await reminders.markSent(r.id);
              try {
                const clients = SSE_CLIENTS.get(r.user_id);
                const payloadEvent = { id: r.id, message: r.message, datetime: r.datetime, type: r.type };
                if (clients && clients.size > 0) {
                  for (const res of Array.from(clients)) {
                    sendSSE(res, 'reminder', payloadEvent);
                  }
                  try {
                    await insertNotification({ reminder_id: r.id, user_id: r.user_id, message: r.message, type: r.type, delivered_at: new Date().toISOString() });
                  } catch (err) {
                    console.error('Failed to persist notification for gmail', err);
                  }
                }
              } catch (err) {
                console.error('Failed to send SSE for gmail reminder', err);
              }
            }
          } else if (r.type === "general") {
            // push to SSE clients if connected
            const clients = SSE_CLIENTS.get(r.user_id);
            const payload = { id: r.id, message: r.message, datetime: r.datetime, type: r.type };
            if (clients && clients.size > 0) {
              for (const res of Array.from(clients)) {
                sendSSE(res, "reminder", payload);
              }
              await reminders.markSent(r.id);
              try {
                await insertNotification({ reminder_id: r.id, user_id: r.user_id, message: r.message, type: r.type, delivered_at: new Date().toISOString() });
              } catch (err) {
                console.error('Failed to persist notification for general', err);
              }
            } else {
              // no clients connected; mark sent anyway (or keep pending) — we'll mark sent
              await reminders.markSent(r.id);
              try {
                await insertNotification({ reminder_id: r.id, user_id: r.user_id, message: r.message, type: r.type, delivered_at: new Date().toISOString() });
              } catch (err) {
                console.error('Failed to persist notification for general (no clients)', err);
              }
            }
          }
        } catch (err) {
          console.error("Dispatch reminder error", err);
          await reminders.markFailed(r.id);
        }
      }
    } catch (err) {
      console.error("Poller error", err);
    }
  }, 60 * 1000);

  return httpServer;
}

// whatsapp routes are registered inside registerRoutes when app is available

// Preferences endpoints (outside registerRoutes so supabase client is ready)
export async function registerPreferencesRoutes(app: Express) {
  app.get('/api/preferences/:userId', verifyFirebaseToken, async (req, res) => {
    try {
      const paramUserId = req.params.userId;
      let uid = req.uid as string | undefined;
      if (!uid && process.env.DEV_AUTH_BYPASS === '1') {
        // allow route param as uid in dev bypass mode
        uid = paramUserId;
      }
      if (!uid) return res.status(403).json({ message: 'forbidden' });
      if (paramUserId !== uid && process.env.DEV_AUTH_BYPASS !== '1') return res.status(403).json({ message: 'forbidden' });
      const prefs = await getPreferences(uid);
      res.json(prefs ?? {});
    } catch (err: any) {
      console.error('GET /api/preferences error', err);
      res.status(500).json({ message: err?.message ?? String(err) });
    }
  });

  app.put('/api/preferences/:userId', verifyFirebaseToken, async (req, res) => {
    try {
      const paramUserId = req.params.userId;
      let uid = req.uid as string | undefined;
      if (!uid && process.env.DEV_AUTH_BYPASS === '1') {
        uid = paramUserId;
      }
      if (!uid) return res.status(403).json({ message: 'forbidden' });
      if (paramUserId !== uid && process.env.DEV_AUTH_BYPASS !== '1') return res.status(403).json({ message: 'forbidden' });
      const body = req.body;
      const prefs = await upsertPreferences({ user_id: uid, tone: body.tone, response_length: body.responseLength, formality: body.formality, include_emojis: body.includeEmojis });
      res.json(prefs);
    } catch (err: any) {
      console.error('PUT /api/preferences error', err);
      res.status(500).json({ message: err?.message ?? String(err) });
    }
  });

  // Notifications
  app.get('/api/notifications', verifyFirebaseToken, async (req, res) => {
    try {
      const uid = req.uid!;
      const rows = await listNotifications(uid);
      res.json(rows);
    } catch (err: any) {
      console.error('GET /api/notifications error', err);
      res.status(500).json({ message: err?.message ?? String(err) });
    }
  });

  // Quick health check to ensure API routes are handled (useful when Vite dev server may serve index.html)
  app.get('/api/ping', (req, res) => {
    res.json({ ok: true, time: new Date().toISOString() });
  });

  // Integration status for current user (helps debug whether credentials exist)
  app.get('/api/integrations/status', verifyFirebaseToken, async (req, res) => {
    try {
      const uid = req.uid!;
      // lazy import to avoid cycles
      const { getUserCredentials } = await import('./integrations');
      const gmail = await getUserCredentials(uid, 'gmail');
      const whatsapp = await getUserCredentials(uid, 'whatsapp');
      res.json({ gmail: !!gmail, whatsapp: !!whatsapp });
    } catch (err: any) {
      console.error('GET /api/integrations/status error', err?.stack || err);
      res.status(500).json({ message: err?.message ?? String(err) });
    }
  });

  // Admin: runtime status for WhatsApp/Twilio providers (masked, auth required)
  app.get('/api/integrations/whatsapp-status', verifyFirebaseToken, async (req, res) => {
    try {
      const { getWhatsappRuntimeStatus } = await import('./whatsapp');
      // last provider response is internal to module; read via require cache to avoid changing module exports
      // (we keep lastProviderResponse in module scope and expose masked status via getter)
      const status = getWhatsappRuntimeStatus();
      // try to access lastProviderResponse by re-importing module and reading an exported symbol if available
      let last: any = null;
      try {
        // dynamic import returns module object where we added helpers
        const mod: any = await import('./whatsapp');
        // attempt to read lastProviderResponse if present
        if (mod && typeof mod.__lastProviderResponse !== 'undefined') last = mod.__lastProviderResponse;
      } catch (e) {
        // ignore
      }
      return res.json({ status, last: last ?? null });
    } catch (err: any) {
      console.error('GET /api/integrations/whatsapp-status error', err);
      return res.status(500).json({ message: String(err) });
    }
  });
}

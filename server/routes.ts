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
const N8N_GMAIL = process.env.N8N_GMAIL_WEBHOOK || process.env.N8N_WEBHOOK_URL || process.env.VITE_N8N_WEBHOOK_URL || process.env.VITE_N8N_WEBHOOK || "http://localhost:5678/webhook-test/gmail-action";

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

  // Import Gemini functions
  let analyzeImage: ((base64Image: string, prompt?: string) => Promise<string>) | undefined;
  let analyzeText: ((text: string, prompt?: string) => Promise<string>) | undefined;
  try {
    const gemini = await import('./gemini');
    analyzeImage = gemini.analyzeImage;
    analyzeText = gemini.analyzeText;
  } catch (e) {
    console.warn('Failed to import Gemini integration:', e);
  }
  
  // Import scraper utility
  const { scrapeWebpage } = await import('./lib/scraper');

  // Proxy endpoint to forward messages to the configured n8n webhook
  app.post("/api/webhook/proxy", async (req, res) => {
    const webhookUrl = process.env.N8N_WEBHOOK_URL || process.env.VITE_N8N_WEBHOOK_URL || "http://localhost:5678/webhook-test/whatsapp-mcp";

    // Helper: build an n8n-style items array: [{ json: {...}, binary: { field: { data: base64, mimeType, fileName }}}]
    const buildItemsFromJson = async (body: any) => {
      const items: any[] = [];

      // If body is already an array of items, pass-through
      if (Array.isArray(body) && body.length > 0 && body[0] && (body[0].json || body[0].binary)) {
        return body;
      }

      // single item: attempt to extract attachments and convert data: URLs into binary
      const jsonPart: any = { ...body };
      const binary: any = {};

      // If attachments array present, convert data URLs to base64 binary fields
      if (Array.isArray(body.attachments)) {
        let idx = 0;
        for (const a of body.attachments) {
          try {
            if (typeof a?.url === 'string' && a.url.startsWith('data:')) {
              // data:<mime>;base64,<base64>
              const m = /^data:(.*?);base64,(.*)$/.exec(a.url);
              if (m) {
                const mime = m[1] || 'application/octet-stream';
                const b64 = m[2] || '';
                const name = a.name || `attachment-${idx}`;
                binary[`file${idx}`] = { data: b64, mimeType: mime, fileName: name };
                idx++;
              }
            } else if (typeof a?.url === 'string') {
              // include URL info in json so n8n can fetch if required
              (jsonPart.attachments = jsonPart.attachments || []).push(a);
            }
          } catch (e) {
            console.warn('Failed to convert attachment to binary', e);
          }
        }
      }

      items.push({ json: jsonPart, binary: Object.keys(binary).length ? binary : undefined });
      return items;
    };

    // parse multipart/form-data using Busboy when content-type is multipart
    const contentType = (req.headers['content-type'] || '') as string;
    try {
      let itemsToSend: any[] | null = null;

      if (contentType.startsWith('multipart/')) {
        // lazy-require to avoid adding to top-level if not needed
  // dynamic import and cast to any to avoid TS module resolution issues in different environments
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const Busboy: any = (await import('busboy'))?.default || (await import('busboy'));
        itemsToSend = [];

        await new Promise<void>((resolve, reject) => {
          try {
            const bb = Busboy({ headers: req.headers as any });
            const jsonPart: any = {};
            const binary: any = {};
            let fileIndex = 0;

            bb.on('field', (fieldname: string, val: string) => {
              // accumulate simple fields
              try {
                // try parse JSON fields like attachments
                if ((fieldname === 'attachments' || fieldname.endsWith('attachments')) && val) {
                  try {
                    jsonPart.attachments = JSON.parse(val);
                    return;
                  } catch (e) {
                    // fallthrough
                  }
                }
                // common text fields
                jsonPart[fieldname] = val;
              } catch (e) {
                console.warn('busboy field parse error', e);
              }
            });

            bb.on('file', (fieldname: string, file: any, info: any) => {
              const { filename, mimeType } = info || {};
              const chunks: Buffer[] = [];
              file.on('data', (d: Buffer) => chunks.push(d));
              file.on('end', () => {
                try {
                  const buf = Buffer.concat(chunks);
                  const b64 = buf.toString('base64');
                  const key = `file${fileIndex++}`;
                  binary[key] = { data: b64, mimeType: mimeType || 'application/octet-stream', fileName: filename || key };
                } catch (e) {
                  console.warn('busboy file handling failed', e);
                }
              });
            });

            bb.on('finish', () => {
              itemsToSend = [{ json: jsonPart, binary: Object.keys(binary).length ? binary : undefined }];
              resolve();
            });

            bb.on('error', (err: any) => reject(err));

            // pipe the raw request to busboy
            (req as any).pipe(bb);
          } catch (err) {
            reject(err);
          }
        });
      } else if (contentType.includes('application/json') || typeof req.body === 'object') {
        // JSON body: convert attachments with data URLs
        itemsToSend = await buildItemsFromJson(req.body);
      } else {
        // unknown content-type: try to read raw text body and send as a single json field
        let raw = '';
        try {
          raw = await new Promise<string>((resolve) => {
            let acc = '';
            req.setEncoding('utf8');
            req.on('data', (c) => acc += c);
            req.on('end', () => resolve(acc));
            req.on('error', () => resolve(''));
          });
        } catch (e) {
          raw = '';
        }
        let parsed: any = raw;
        try { parsed = raw ? JSON.parse(raw) : { raw: '' }; } catch (e) { parsed = { raw }; }
        itemsToSend = await buildItemsFromJson(parsed);
      }

      // Prepare the payload for n8n: n8n expects either an array of items or an object { items: [...] }
      // Common n8n webhook nodes accept POST bodies as an array of items or an object wrapping them.
      // Import PDF processor if needed
      let { processPDFDocument, queryDocument } = await import('./pdfProcessor');

      // Check for attachments (images or PDFs)
      let analysisResult = '';
      if (Array.isArray(itemsToSend) && itemsToSend.length > 0) {
        const firstItem = itemsToSend[0];

        // Server-side guard: if the incoming JSON message appears to be a YouTube/video request,
        // perform intent analysis and a YouTube search and return the video info directly instead
        // of forwarding to n8n. This ensures clients or other producers that post to the webhook
        // will get a clear video response and we avoid forwarding video queries to workflows.
        try {
          if (firstItem.json && typeof firstItem.json.message === 'string' && analyzeText) {
            const { analyzeVideoIntent } = await import('./youtube_intent');
            try {
              const intent = await analyzeVideoIntent(firstItem.json.message);
              if (intent.isVideoRequest && intent.confidence > 0.7) {
                const searchQuery = intent.searchQuery || firstItem.json.message;
                const YT_KEY = process.env.YOUTUBE_API_KEY;
                if (!YT_KEY) {
                  return res.status(500).json({ status: 'error', error: 'YOUTUBE_API_KEY not configured on server' });
                }
                const params = new URLSearchParams({ part: 'snippet', q: searchQuery, type: 'video', maxResults: '1', key: YT_KEY });
                const ytResp = await fetch(`https://www.googleapis.com/youtube/v3/search?${params.toString()}`);
                if (!ytResp.ok) {
                  const txt = await ytResp.text().catch(() => '');
                  return res.status(502).json({ status: 'error', error: `YouTube API error ${ytResp.status}: ${txt}` });
                }
                const ytData = await ytResp.json();
                const item = Array.isArray(ytData.items) && ytData.items[0];
                if (!item) return res.json({ status: 'success', handled: 'youtube', video: null });
                const vid = item.id?.videoId;
                const snippet = item.snippet || {};
                const video = {
                  video_id: vid,
                  title: snippet.title,
                  description: snippet.description,
                  channel: snippet.channelTitle,
                  thumbnail: snippet.thumbnails?.default?.url,
                  url: vid ? `https://www.youtube.com/watch?v=${vid}` : null,
                };
                return res.json({ status: 'success', handled: 'youtube', video });
              }
            } catch (e) {
              console.warn('Video intent analysis in webhook guard failed', e);
            }
          }
        } catch (e) {
          console.warn('Webhook proxy youtube guard error', e);
        }
        
        if (firstItem.binary) {
          // Process each attachment
          for (const [key, value] of Object.entries(firstItem.binary)) {
            const binary = value as { mimeType: string; data: string };
            
            if (binary.mimeType.startsWith('image/') && analyzeImage) {
              try {
                // Reconstruct data URL
                const dataUrl = `data:${binary.mimeType};base64,${binary.data}`;
                const userMessage = firstItem.json?.message || '';
                const prompt = userMessage 
                  ? `Analyze this image based on the following request: ${userMessage}`
                  : 'Describe this image in detail';
                const result = await analyzeImage(dataUrl, prompt);
                analysisResult = result;
                break; // Only analyze the first image for now
              } catch (e) {
                console.error('Image analysis failed:', e);
              }
            } else if (firstItem.json?.url && analyzeText) {
              try {
                // Scrape the webpage
                const scrapedContent = await scrapeWebpage(firstItem.json.url);
                const userMessage = firstItem.json?.message || '';
                const prompt = userMessage 
                  ? `${userMessage}\n\nWebpage content from ${firstItem.json.url}:\n`
                  : `Analyze and summarize this webpage content from ${firstItem.json.url}:\n`;
                const result = await analyzeText(scrapedContent, prompt);
                analysisResult = result;
              } catch (e) {
                console.error('URL analysis failed:', e);
                throw new Error('Failed to analyze URL content');
              }
            } else if (binary.mimeType === 'application/pdf') {
              try {
                // Convert base64 to buffer
                const pdfBuffer = Buffer.from(binary.data, 'base64');
                const fileName = (value as any).fileName || 'document.pdf';
                const userId = firstItem.json?.userId || 'anonymous';

                // Get user's query from message (what they want done with the PDF)
                const userQuery = firstItem.json?.message || 'Please summarize this document';

                // Process and store PDF in vector database (create embeddings)
                await processPDFDocument(pdfBuffer, userId, fileName);

                // After embeddings are created, notify the configured n8n webhook with a minimal payload
                if (webhookUrl) {
                  try {
                    // Get user info from auth token if available
                    let username = 'anonymous';
                    try {
                      if (firstItem.json?.uid) {
                        const userRecord = await admin.auth().getUser(firstItem.json.uid);
                        username = userRecord.displayName || userRecord.email || 'anonymous';
                      }
                    } catch (e) {
                      console.warn('Failed to get username:', e);
                    }
                    const webhookPayload = { 
                      pdf: true, 
                      userId, 
                      username, 
                      fileName, 
                      message: userQuery 
                    };
                    const webhookResp = await fetch(webhookUrl, {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify(webhookPayload),
                    });

                    const webhookText = await webhookResp.text();
                    let webhookJson: any = null;
                    try { webhookJson = webhookText ? JSON.parse(webhookText) : null; } catch (e) { webhookJson = webhookText; }

                    // Prefer a human-readable field if present, otherwise stringify the webhook response
                    if (webhookJson && typeof webhookJson === 'object') {
                      analysisResult = String(webhookJson.output ?? webhookJson.message ?? JSON.stringify(webhookJson));
                    } else {
                      analysisResult = String(webhookJson ?? webhookText ?? '');
                    }

                    // If webhook responded with something useful, return it immediately
                    if (analysisResult && analysisResult.trim()) {
                      break;
                    }
                    // otherwise fallthrough to local query
                  } catch (e) {
                    console.error('Failed to call n8n webhook after PDF embeddings:', e);
                    // continue to local query fallback
                  }
                }

                // Fallback: query the processed document locally and return matches
                const queryResults = await queryDocument(userId, userQuery);
                analysisResult = JSON.stringify({ pdf: true, query: userQuery, results: queryResults });
                break;
              } catch (e) {
                console.error('PDF processing failed:', e);
                try {
                  console.error('Embedding provider:', process.env.EMBEDDING_PROVIDER, 'EMBEDDING_DIM:', process.env.EMBEDDING_DIM, 'GOOGLE_EMBEDDING_MODEL:', process.env.GOOGLE_EMBEDDING_MODEL);
                } catch (err) {
                  // ignore
                }
              }
            }
          }
        }
      }

      // If we have analysis results, send those directly
      if (analysisResult) {
        return res.json({ output: analysisResult });
      }

      // Decide how to forward to n8n. By default forward the items array.
      // But if the client intentionally sent an investigateMode payload (URL mode)
      // forward the raw JSON object so workflows expecting that exact shape receive it.
      let payloadForN8n: any = itemsToSend;
      try {
        if (Array.isArray(itemsToSend) && itemsToSend.length === 1 && itemsToSend[0] && itemsToSend[0].json) {
          const j = itemsToSend[0].json as any;
          if (j.investigateMode === true && j.investigateType === 'url') {
            // forward raw JSON payload for URL investigate flows
            payloadForN8n = j;
          }
        }
      } catch (e) {
        // ignore and fall back to default
      }

      const forwarded = await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payloadForN8n),
      });

      const text = await forwarded.text();
      res.status(forwarded.status).contentType(forwarded.headers.get('content-type') || 'text/plain').send(text);
    } catch (err: any) {
      console.error('Failed to forward to n8n webhook (proxy):', err);
      res.status(502).json({ message: 'Failed to forward to n8n webhook', error: String(err) });
    }
  });

  // Analyze message for video intent and search YouTube if appropriate
  app.post('/api/youtube/open', verifyFirebaseToken, async (req, res) => {
    try {
      const { query } = req.body || {};
      if (!query || typeof query !== 'string' || !query.trim()) {
        return res.status(400).json({ status: 'error', error: 'query required' });
      }

      // First analyze intent using Gemini
      const { analyzeVideoIntent } = await import('./youtube_intent');
      const intent = await analyzeVideoIntent(query);

      // If not a video request with high confidence, return early
      if (!intent.isVideoRequest || intent.confidence < 0.7) {
        return res.json({
          status: 'success',
          isVideoRequest: false,
          confidence: intent.confidence,
          video: null
        });
      }

      // We have a video request - search YouTube with the extracted query
      const searchQuery = intent.searchQuery || query;
      const YT_KEY = process.env.YOUTUBE_API_KEY;
      if (!YT_KEY) {
        return res.status(500).json({ status: 'error', error: 'YOUTUBE_API_KEY not configured on server' });
      }

      const params = new URLSearchParams({
        part: 'snippet',
        q: searchQuery,
        type: 'video',
        maxResults: '1',
        key: YT_KEY,
      });

      const resp = await fetch(`https://www.googleapis.com/youtube/v3/search?${params.toString()}`);
      if (!resp.ok) {
        const txt = await resp.text().catch(() => '');
        return res.status(502).json({ status: 'error', error: `YouTube API error ${resp.status}: ${txt}` });
      }

      const data = await resp.json();
      const item = Array.isArray(data.items) && data.items[0];
      if (!item) return res.status(404).json({ status: 'error', error: 'No videos found' });

      const vid = item.id?.videoId;
      const snippet = item.snippet || {};
      const video = {
        video_id: vid,
        title: snippet.title,
        description: snippet.description,
        channel: snippet.channelTitle,
        thumbnail: snippet.thumbnails?.default?.url,
        url: vid ? `https://www.youtube.com/watch?v=${vid}` : null,
      };

      return res.json({
        status: 'success',
        isVideoRequest: true,
        confidence: intent.confidence,
        video,
        originalQuery: query,
        searchQuery
      });
    } catch (err: any) {
      console.error('POST /api/youtube/open error', err);
      return res.status(500).json({ status: 'error', error: String(err) });
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
    // In production, require an explicit redirect URI to avoid localhost defaults
    const redirectUri = process.env.GOOGLE_OAUTH_REDIRECT_URI || (process.env.NODE_ENV === 'production' ? undefined : `${process.env.SERVER_BASE_URL || 'http://localhost:5050'}/api/oauth/google/callback`);
  if (!clientId) return res.status(500).json({ message: 'GOOGLE_CLIENT_ID not configured on server. Set GOOGLE_CLIENT_ID in .env (or VITE_GOOGLE_CLIENT_ID for local dev).' });
  if (!redirectUri) return res.status(500).json({ message: 'GOOGLE_OAUTH_REDIRECT_URI not configured. Set GOOGLE_OAUTH_REDIRECT_URI in .env for production.' });

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
    const redirectUri = process.env.GOOGLE_OAUTH_REDIRECT_URI || (process.env.NODE_ENV === 'production' ? undefined : `${process.env.SERVER_BASE_URL || 'http://localhost:5050'}/api/oauth/google/callback`);
  if (!clientId) return res.status(500).json({ message: 'GOOGLE_CLIENT_ID not configured on server. Set GOOGLE_CLIENT_ID in .env (or VITE_GOOGLE_CLIENT_ID for local dev).' });
  if (!redirectUri) return res.status(500).json({ message: 'GOOGLE_OAUTH_REDIRECT_URI not configured. Set GOOGLE_OAUTH_REDIRECT_URI in .env for production.' });

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
      return res.status(500).send('Server not configured for Google OAuth. Ensure GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET are set in .env. For local testing you can set VITE_GOOGLE_CLIENT_ID for the client id, but the secret must be set as GOOGLE_CLIENT_SECRET on the server.');
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
      let list = await (reminders as any).listByUser ? (reminders as any).listByUser(uid) : await reminders.listAll();
      if (!Array.isArray(list)) {
        // ensure we always return an array for client compatibility
        if (list == null) list = [];
        else list = [list];
      }
      return res.json(list);
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
      // fetch all types of reminders that are due
      const leadMs = 2 * 60 * 1000; // 2 minutes lead time
      const allReminders = await reminders.fetchDuePending(500, leadMs);
      const merged = allReminders.sort((a: any, b: any) => new Date(a.datetime).getTime() - new Date(b.datetime).getTime());
      
      if (merged.length > 0) {
        console.log(`[Poller] Found ${merged.length} due reminders:`, merged.map(r => ({ id: r.id, type: r.type, datetime: r.datetime, message: r.message.slice(0, 50) })));
      }
      
      // iterate over merged (deduped) reminders
      for (const r of merged) {
        // iterate over merged list instead of just due
        try {
          // Process whatsapp reminders here first; gmail reminders are handled in the following branch.
          if ((r as any).type === "whatsapp") {
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
            console.log(`[Poller] Processing general reminder ${r.id} for user ${r.user_id}, connected clients: ${clients?.size || 0}`);
            
            // Mark as sent first to prevent duplicate processing
            await reminders.markSent(r.id);
            
            if (clients && clients.size > 0) {
              for (const res of Array.from(clients)) {
                sendSSE(res, "reminder", payload);
              }
              console.log(`[Poller] Sent SSE reminder to ${clients.size} clients for reminder ${r.id}`);
            } else {
              console.log(`[Poller] No SSE clients connected for user ${r.user_id}, reminder ${r.id} marked as sent`);
            }
            
            try {
              await insertNotification({ reminder_id: r.id, user_id: r.user_id, message: r.message, type: r.type, delivered_at: new Date().toISOString() });
              console.log(`[Poller] Persisted notification for general reminder ${r.id}`);
            } catch (err) {
              console.error('Failed to persist notification for general', err);
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

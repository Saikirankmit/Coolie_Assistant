import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { reminders, type ReminderRow } from "./storage";

const N8N_WHATSAPP = process.env.N8N_WHATSAPP_WEBHOOK || process.env.N8N_WEBHOOK_URL || "http://localhost:5678/webhook-test/whatsapp-mcp";
const N8N_GMAIL = process.env.N8N_GMAIL_WEBHOOK || process.env.N8N_WEBHOOK_URL || "http://localhost:5678/webhook-test/gmail-mcp";

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

  // Reminders CRUD
  app.get("/api/reminders", async (_req, res) => {
    const list = await reminders.listAll();
    res.json(list);
  });

  app.post("/api/reminders", async (req, res) => {
    try {
      const body = req.body;
      // require minimal fields
      if (!body.user_id || !body.type || !body.datetime || !body.message) {
        return res.status(400).json({ message: "user_id, type, datetime, message required" });
      }
      const r = await reminders.create({
        user_id: body.user_id,
        type: body.type,
        datetime: new Date(body.datetime).toISOString(),
        message: body.message,
        user_phone: body.user_phone,
        user_email: body.user_email,
        user_token: body.user_token,
      });
      res.status(201).json(r);
    } catch (err: any) {
      res.status(500).json({ message: String(err) });
    }
  });

  app.delete("/api/reminders/:id", async (req, res) => {
    const id = req.params.id;
    const ok = await reminders.delete(id);
    res.json({ ok });
  });

  // Update reminder (partial)
  app.patch('/api/reminders/:id', async (req, res) => {
    const id = req.params.id;
    const body = req.body;
    try {
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
  app.get("/api/sse/:userId", (req, res) => {
    const userId = req.params.userId;
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

  // In-process poller (every 60s) to dispatch due reminders
  setInterval(async () => {
    try {
      const due = await reminders.fetchDuePending(200);
      for (const r of due) {
        try {
          if (r.type === "whatsapp") {
            // send to n8n whatsapp webhook
            const payload = { phone: r.user_phone, message: r.message };
            const resp = await fetch(N8N_WHATSAPP, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
            if (!resp.ok) {
              await reminders.markFailed(r.id);
            } else {
              await reminders.markSent(r.id);
            }
          } else if (r.type === "gmail") {
            const payload = { email: r.user_email, token: r.user_token, message: r.message };
            const resp = await fetch(N8N_GMAIL, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
            if (!resp.ok) {
              await reminders.markFailed(r.id);
            } else {
              await reminders.markSent(r.id);
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
            } else {
              // no clients connected; mark sent anyway (or keep pending) — we'll mark sent
              await reminders.markSent(r.id);
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

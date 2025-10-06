import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";

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

  return httpServer;
}

import "dotenv/config";
import express, { type Request, Response, NextFunction } from "express";
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

// Load server/.env (if present) into process.env early so modules that are imported
// afterwards (which read process.env at module-evaluation time) will see these values.
try {
  const serverEnvPath = path.resolve(process.cwd(), 'server', '.env');
  if (fs.existsSync(serverEnvPath)) {
    dotenv.config({ path: serverEnvPath });
    console.log('Loaded server/.env into process.env');
  }
} catch (err) {
  console.warn('Could not load server/.env:', err);
}

// Global error handlers to capture unhandled promise rejections and exceptions
process.on("unhandledRejection", (reason) => {
  console.error("Unhandled Rejection:", reason);
});
process.on("uncaughtException", (err) => {
  console.error("Uncaught Exception:", err);
});
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import admin from 'firebase-admin';
// fs, path, dotenv were already imported above for early server/.env loading

function tryParseJson(raw: string) {
  try {
    return JSON.parse(raw);
  } catch (err) {
    return null;
  }
}

function stripQuotes(s: string) {
  if (!s) return s;
  return s.replace(/^\s*"|"\s*$|^\s*'|'\s*$/g, '');
}

function tryInitWithServiceAccount(serviceAccountObj: any) {
  admin.initializeApp({ credential: admin.credential.cert(serviceAccountObj) });
  console.log('Firebase Admin initialized');
}

// Robust credential loader: prefer FIREBASE_SERVICE_ACCOUNT_JSON, then
// try FIREBASE_ADMIN_CREDENTIALS_PATH (with sanitization), then fall back
// to parsing server/.env for a path. This helps when a process-level var
// points to a missing file but you have provided a valid path in repository.
let firebaseInitialized = false;

if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
  const parsed = tryParseJson(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
  if (parsed) {
    tryInitWithServiceAccount(parsed);
    firebaseInitialized = true;
  } else {
    console.error('FIREBASE_SERVICE_ACCOUNT_JSON is set but not valid JSON');
  }
}

async function tryInitFromPath(envPath?: string) {
  if (!envPath) return false;
  const cleaned = stripQuotes(envPath || '');
  const candidates: string[] = [];

  // raw candidate
  candidates.push(cleaned);
  // resolve relative to repo root and server folder
  candidates.push(path.resolve(process.cwd(), cleaned));
  candidates.push(path.resolve(process.cwd(), 'server', cleaned));
  // also try removing enclosing quotes again as a defensive step
  candidates.push(cleaned.replace(/^"|"$/g, ''));

  for (const cand of candidates) {
    if (!cand) continue;
    try {
      if (fs.existsSync(cand)) {
        const content = fs.readFileSync(cand, { encoding: 'utf8' });
        const cred = tryParseJson(content);
        if (cred) {
          tryInitWithServiceAccount(cred);
          console.log(`Firebase Admin initialized from file: ${cand}`);
          return true;
        } else {
          console.error(`Found file at ${cand} but it does not contain valid JSON`);
        }
      }
    } catch (err) {
      console.error(`Error while attempting to read candidate path ${cand}:`, err);
    }
  }

  return false;
}

(async () => {
  try {
    // First try the explicit path env
    if (!firebaseInitialized && process.env.FIREBASE_ADMIN_CREDENTIALS_PATH) {
      const ok = await tryInitFromPath(process.env.FIREBASE_ADMIN_CREDENTIALS_PATH);
      if (ok) firebaseInitialized = true;
    }

    // If still not initialized, try to read server/.env (useful when dotenv loaded different file)
    if (!firebaseInitialized) {
      try {
        const serverEnvPath = path.resolve(process.cwd(), 'server', '.env');
        if (fs.existsSync(serverEnvPath)) {
          const parsed = dotenv.parse(fs.readFileSync(serverEnvPath, 'utf8'));
          if (parsed.FIREBASE_ADMIN_CREDENTIALS_PATH) {
            const ok = await tryInitFromPath(parsed.FIREBASE_ADMIN_CREDENTIALS_PATH);
            if (ok) firebaseInitialized = true;
          }
          if (!firebaseInitialized && parsed.FIREBASE_SERVICE_ACCOUNT_JSON) {
            const parsedJson = tryParseJson(parsed.FIREBASE_SERVICE_ACCOUNT_JSON);
            if (parsedJson) {
              tryInitWithServiceAccount(parsedJson);
              firebaseInitialized = true;
            }
          }
        }
      } catch (err) {
        console.error('Error reading server/.env fallback:', err);
      }
    }

    if (!firebaseInitialized) {
      throw new Error('Firebase Admin credentials are required. Set FIREBASE_SERVICE_ACCOUNT_JSON or FIREBASE_ADMIN_CREDENTIALS_PATH (and ensure the file exists)');
    }
  } catch (err) {
    console.error('Failed to initialize Firebase Admin credentials:', err);
    // Re-throw to stop startup so caller sees the error
    throw err;
  }
})();

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  let server: any;
  try {
    server = await registerRoutes(app);
  } catch (err) {
    console.error("Error registering routes:", err);
    // rethrow so the process fails loudly in dev
    throw err;
  }
  // Firebase Admin is required; server will not start without admin credentials
  try {
    // register preferences routes
    const { registerPreferencesRoutes } = await import('./routes');
    registerPreferencesRoutes(app);
  } catch (err) {
    console.error('Failed to register preferences routes', err);
    throw err;
  }

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    res.status(status).json({ message });
    throw err;
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  // ALWAYS serve the app on the port specified in the environment variable PORT
  // Other ports are firewalled. Default to 5000 if not specified.
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = parseInt(process.env.PORT || '5050', 10);
  const listenOptions: any = {
    port,
    host: "0.0.0.0",
  };

  // `reusePort` is not supported on Windows (it causes ENOTSUP). Only enable it on non-Windows platforms.
  if (process.platform !== "win32") {
    listenOptions.reusePort = true;
  }

  server.listen(listenOptions, () => {
    log(`serving on port ${port}`);
  });
})();
